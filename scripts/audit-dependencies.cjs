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

if (!all || !production) {
  console.error('[DEPENDENCY AUDIT] ERROR: complete all-dependency and production-only audit reports are required for release validation.');
  process.exitCode = 1;
} else {
  const allCounts = all.metadata?.vulnerabilities || {};
  const productionCounts = production.metadata?.vulnerabilities || {};
  const hasCriticalOrHigh = (allCounts.critical || 0) > 0 || (allCounts.high || 0) > 0;
  if (hasCriticalOrHigh) {
    const developmentCritical = Math.max(0, (allCounts.critical || 0) - (productionCounts.critical || 0));
    const developmentHigh = Math.max(0, (allCounts.high || 0) - (productionCounts.high || 0));
    console.error('[DEPENDENCY AUDIT] BLOCKED: critical/high advisories exist in the install/build dependency tree.');
    console.error('[DEPENDENCY AUDIT] Production: critical=' + (productionCounts.critical || 0) + ', high=' + (productionCounts.high || 0));
    console.error('[DEPENDENCY AUDIT] Development/build-only estimate: critical=' + developmentCritical + ', high=' + developmentHigh);
    console.error('[DEPENDENCY AUDIT] Remediate all critical/high advisories before producing a release installer.');
    process.exitCode = 1;
  } else {
    console.log('[DEPENDENCY AUDIT] No critical or high advisories were reported in production or build dependencies.');
  }
}

// The Windows workflow stops before packaging when the inventory is unavailable
// or high/critical production dependencies are affected.
