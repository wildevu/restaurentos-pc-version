import { spawnSync } from 'node:child_process';
import path from 'node:path';

export type WindowsProcessDetails = {
  executablePath?: string | null;
  commandLine?: string | null;
};

export type WindowsProcessIdentity = 'match' | 'other' | 'missing' | 'unknown';

function normalizeWindowsPath(value: string): string {
  return path.win32.normalize(value.trim().replace(/^"(.*)"$/, '$1').replace(/\//g, '\\\\')).toLowerCase();
}

export function matchesRestaurantOSProcessIdentity(
  details: WindowsProcessDetails | null | undefined,
  expectedExecutable: string,
  expectedServerScript: string
): boolean {
  if (!details?.executablePath || !details.commandLine) return false;

  const actualExecutable = normalizeWindowsPath(details.executablePath);
  const requiredExecutable = normalizeWindowsPath(expectedExecutable);
  const requiredServerScript = normalizeWindowsPath(expectedServerScript);
  const commandLine = details.commandLine.replace(/\//g, '\\\\').toLowerCase();

  return actualExecutable === requiredExecutable && commandLine.includes(requiredServerScript);
}

/**
 * On Windows, process.kill(pid, 0) only establishes that some process currently
 * owns the PID. Query Win32_Process and compare the executable and command line
 * so a PID reused by taskhostw.exe (or another application) is treated as stale.
 */
export function inspectWindowsProcessIdentity(
  pid: number,
  expectedExecutable: string,
  expectedServerScript: string
): WindowsProcessIdentity {
  if (!Number.isSafeInteger(pid) || pid <= 0) return 'missing';

  const powershell = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe';
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$target = Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction Stop`,
    'if ($null -eq $target) { exit 3 }',
    '@{ executablePath = $target.ExecutablePath; commandLine = $target.CommandLine } | ConvertTo-Json -Compress'
  ].join('; ');

  const result = spawnSync(
    powershell,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024 }
  );

  if (result.error || result.signal) return 'unknown';
  if (result.status === 3) return 'missing';
  if (result.status !== 0) return 'unknown';

  try {
    const details = JSON.parse(String(result.stdout || '').trim()) as WindowsProcessDetails;
    if (!details?.executablePath || !details.commandLine) return 'unknown';
    return matchesRestaurantOSProcessIdentity(details, expectedExecutable, expectedServerScript)
      ? 'match'
      : 'other';
  } catch {
    return 'unknown';
  }
}
