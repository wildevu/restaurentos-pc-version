const { spawnSync } = require('node:child_process');

function runAudit(label, args) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['audit', ...args, '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120000
  });
  const output = String(result.stdout || '');
  const firstBrace = output.indexOf('{');
  const lastBrace = output.lastIndexOf('}');
  let report;
  try {
    if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('npm audit did not return JSON output');
    report = JSON.parse(output.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    console.warn('[DEPENDENCY AUDIT] ' + label + ' report unavailable: ' + (error.message || error));
    if (result.error) console.warn('[DEPENDENCY AUDIT] Process error: ' + result.error.message);
    if (result.stderr) console.warn(String(result.stderr).trim());
    return null;
  }

  const counts = report.metadata?.vulnerabilities || {};
  console.log('');
  console.log('=== ' + label + ' ===');
  console.log('Vulnerabilities: ' + ['critical', 'high', 'moderate', 'low', 'info'].map(level => level + '=' + (counts[level] || 0)).join(' | '));

  const entries = Object.entries(report.vulnerabilities || {}).sort((a, b) => {
    const weight = { critical: 5, high: 4, moderate: 3, low: 2, info: 1 };
    return (weight[b[1].severity] || 0) - (weight[a[1].severity] || 0) || a[0].localeCompare(b[0]);
  });
  for (const [name, vulnerability] of entries) {
    const via = (vulnerability.via || []).map(item => typeof item === 'string' ? item : (item.name || item.title || 'advisory')).join(', ');
    const fix = vulnerability.fixAvailable === true ? 'fix available' : vulnerability.fixAvailable === false ? 'no automatic fix' : JSON.stringify(vulnerability.fixAvailable || null);
    console.log('- ' + name + ' | ' + vulnerability.severity + ' | direct=' + Boolean(vulnerability.isDirect) + ' | range=' + (vulnerability.range || 'unknown') + ' | via=' + (via || 'unknown') + ' | ' + fix);
  }
  return report;
}

console.log('RestaurantOS dependency security inventory');
const all = runAudit('All installed dependencies (production + development)', []);
const production = runAudit('Production dependencies only', ['--omit=dev']);

if (!all && !production) {
  console.warn('[DEPENDENCY AUDIT] Could not retrieve npm audit data. Treat dependency security status as UNVERIFIED.');
}
if (production?.metadata?.vulnerabilities?.critical > 0) {
  console.error('[DEPENDENCY AUDIT] CRITICAL: production dependencies contain critical advisories. Do not release until reviewed and remediated.');
} else if (production?.metadata?.vulnerabilities?.high > 0) {
  console.warn('[DEPENDENCY AUDIT] HIGH: production dependencies contain high-severity advisories. Review before release.');
} else if (production) {
  console.log('[DEPENDENCY AUDIT] No high or critical production dependency advisories were reported.');
}

// Informational only: functional regression checks must still run. Critical/high
// production findings remain explicit release blockers.
