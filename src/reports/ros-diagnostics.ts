import fs from 'fs';
import path from 'path';

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 6 * 1024 * 1024;
const MAX_EVENTS = 500;

function redactText(value: string): string {
  return value
    .replace(/(bearer\s+)[^\s,;"']+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|api_key|apikey|password|secret)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/\b(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;"']+)/gi, '$1=[REDACTED]');
}

function sanitize(value: any, depth = 0): any {
  if (depth > 5) return '[TRUNCATED]';
  if (typeof value === 'string') return redactText(value).slice(0, 1200);
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((entry) => sanitize(entry, depth + 1));
  if (typeof value !== 'object') return String(value);
  const result: Record<string, any> = {};
  const sensitive = /(password|token|secret|authorization|cookie|credential|api.?key|pin|hash)/i;
  for (const [key, entry] of Object.entries(value).slice(0, 40)) {
    result[key] = sensitive.test(key) ? '[REDACTED]' : sanitize(entry, depth + 1);
  }
  return result;
}

function readBoundedFile(filePath: string, remainingBytes: number) {
  const size = fs.statSync(filePath).size;
  const allowed = Math.max(0, Math.min(size, MAX_FILE_BYTES, remainingBytes));
  if (allowed === 0) return { content: '', bytesRead: 0, truncated: size > 0 };
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(allowed);
    const start = Math.max(0, size - allowed);
    const bytesRead = fs.readSync(fd, buffer, 0, allowed, start);
    let content = buffer.toString('utf8', 0, bytesRead);
    if (start > 0) {
      const newline = content.indexOf('\n');
      content = newline >= 0 ? content.slice(newline + 1) : '';
    }
    return { content, bytesRead, truncated: start > 0 };
  } finally {
    fs.closeSync(fd);
  }
}

function severityOf(value: any): string {
  const raw = String(value || '').toUpperCase();
  if (raw.includes('FATAL') || raw.includes('CRITICAL')) return 'CRITICAL';
  if (raw.includes('ERROR')) return 'ERROR';
  if (raw.includes('WARN')) return 'WARNING';
  return 'INFO';
}

function componentOf(entry: any, message: string): string {
  const meta = entry?.meta && typeof entry.meta === 'object' ? entry.meta : {};
  if (typeof meta.component === 'string' && meta.component.trim()) return redactText(meta.component).slice(0, 80);
  const lower = message.toLowerCase();
  if (/database|sqlite|migration|integrity|backup|restore/.test(lower)) return 'DATABASE';
  if (/socket|sync|command|acknowledg|offline|queue|fetch/.test(lower)) return 'SYNCHRONIZATION';
  if (/mdns|hostname|dns|network|address/.test(lower)) return 'NETWORKING';
  if (/kitchen|kds|ready|served/.test(lower)) return 'KITCHEN';
  if (/license|activation/.test(lower)) return 'LICENSING';
  if (/installer|supervisor|local hub|hub/.test(lower)) return 'LOCAL_HUB';
  return 'APPLICATION';
}

function parseEvent(line: string, source: string, fallbackTimestamp: string | null) {
  let entry: any = null;
  try { entry = JSON.parse(line); } catch {}
  const message = typeof entry?.message === 'string'
    ? entry.message
    : typeof entry?.error?.message === 'string'
      ? entry.error.message
      : line;
  const severity = severityOf(entry?.level || entry?.severity || (/\b(error|fatal|critical)\b/i.test(message) ? 'ERROR' : /\bwarn(ing)?\b/i.test(message) ? 'WARN' : 'INFO'));
  if (severity === 'INFO') return null;
  const meta = entry?.meta && typeof entry.meta === 'object'
    ? sanitize(entry.meta)
    : entry?.context && typeof entry.context === 'object'
      ? sanitize(entry.context)
      : null;
  const rawTimestamp = entry?.timestamp || fallbackTimestamp || null;
  const parsedTimestamp = rawTimestamp && Number.isFinite(new Date(rawTimestamp).getTime())
    ? new Date(rawTimestamp).toISOString()
    : null;
  const metaOriginal = entry?.meta && typeof entry.meta === 'object' ? entry.meta : {};
  const recoveryStatus = metaOriginal.recoveryStatus ||
    metaOriginal.recoveryAction ||
    (metaOriginal.recovered === true ? 'RECOVERED' : 'NOT_RECORDED');
  return {
    occurredAt: parsedTimestamp,
    timestampUnavailable: parsedTimestamp === null,
    severity,
    component: componentOf(entry, message),
    eventCode: metaOriginal.eventCode || metaOriginal.code || entry?.code || null,
    message: redactText(String(message)).slice(0, 600),
    device: metaOriginal.deviceName || metaOriginal.device || null,
    recoveryStatus: redactText(String(recoveryStatus)).slice(0, 120),
    appVersion: metaOriginal.appVersion || entry?.appVersion || null,
    context: meta,
    source
  };
}

export function collectTechnicalDiagnostics(logDir: string, periodStart: Date, now: Date, retentionDays = 14) {
  const cutoff = new Date(Math.max(periodStart.getTime(), now.getTime() - retentionDays * 86400000));
  const events: any[] = [];
  const collectionWarnings: string[] = [];
  const sourceFiles: string[] = [];
  let bytesRemaining = MAX_TOTAL_BYTES;
  let truncated = false;

  try {
    if (!fs.existsSync(logDir)) {
      return {
        status: 'NO_LOG_DIRECTORY',
        windowStart: cutoff.toISOString(),
        retentionDays,
        sourceFiles,
        events,
        eventCount: 0,
        omittedEventCount: 0,
        truncated: false,
        collectionWarnings: ['The local diagnostics directory was not found.']
      };
    }

    const names = fs.readdirSync(logDir).filter((name) =>
      /^restaurantos-\d{4}-\d{2}-\d{2}\.log$/i.test(name) || name === 'hub-stderr.log'
    );
    const startDay = cutoff.toISOString().slice(0, 10);
    const endDay = now.toISOString().slice(0, 10);
    const selected = names.filter((name) => {
      if (name === 'hub-stderr.log') return true;
      const day = name.slice('restaurantos-'.length, -'.log'.length);
      return day >= startDay && day <= endDay;
    }).sort();

    for (const name of selected) {
      if (bytesRemaining <= 0) {
        truncated = true;
        break;
      }
      const filePath = path.join(logDir, name);
      try {
        const read = readBoundedFile(filePath, bytesRemaining);
        bytesRemaining -= read.bytesRead;
        truncated = truncated || read.truncated;
        if (!read.content) continue;
        sourceFiles.push(name);
        const lines = read.content.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const fallbackTimestamp = name.startsWith('restaurantos-') ? name.slice(12, 22) + 'T00:00:00.000Z' : null;
        for (const line of lines) {
          const event = parseEvent(line, name, fallbackTimestamp);
          if (!event) continue;
          if (event.occurredAt) {
            const time = new Date(event.occurredAt).getTime();
            if (time < cutoff.getTime() || time > now.getTime()) continue;
          }
          events.push(event);
        }
      } catch (error: any) {
        collectionWarnings.push('Could not read ' + name + ': ' + redactText(String(error?.message || error)).slice(0, 180));
      }
    }
  } catch (error: any) {
    collectionWarnings.push('Could not enumerate diagnostics: ' + redactText(String(error?.message || error)).slice(0, 180));
  }

  events.sort((a, b) => {
    if (!a.occurredAt) return 1;
    if (!b.occurredAt) return -1;
    return a.occurredAt.localeCompare(b.occurredAt);
  });
  const omittedEventCount = Math.max(0, events.length - MAX_EVENTS);
  const boundedEvents = events.slice(-MAX_EVENTS);
  return {
    status: sourceFiles.length > 0 ? 'AVAILABLE' : 'NO_LOG_FILES',
    windowStart: cutoff.toISOString(),
    retentionDays,
    sourceFiles,
    events: boundedEvents,
    eventCount: boundedEvents.length,
    omittedEventCount,
    truncated: truncated || omittedEventCount > 0,
    collectionWarnings
  };
}

export function redactDiagnosticTextForTest(value: string): string {
  return redactText(value);
}
