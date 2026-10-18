const fs = require('node:fs');
const path = require('node:path');

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) {
    passed++;
    console.log('  PASS ' + message);
  } else {
    failed++;
    console.error('  FAIL ' + message);
  }
}
function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

console.log('RestaurantOS reliability regression guardrails');
const queue = read('src/offline/queue.ts');
check(queue.includes('clearTimeout(timeoutId)'), 'acknowledgement timeout is cleared after response');
check(queue.includes('ACK_TIMEOUT') && queue.includes('same action ID'), 'uncertain acknowledgement preserves idempotent action identity');
check(queue.includes("status: 'PENDING'") && !queue.includes('Max retries ('), 'transport exhaustion preserves uncertain commands instead of falsely rejecting them');
check(queue.includes("where('status').anyOf('PENDING', 'SYNCING')") && queue.includes('flushRequested'), 'queue drain re-queries and schedules a requested follow-up');
check(queue.includes('scheduleFlushRetry') && queue.includes('15000'), 'uncertain queued commands retry periodically while the socket remains connected');
const flushStart = queue.indexOf('export async function flushQueue');
check(queue.indexOf('if (flushPromise)', flushStart) < queue.indexOf('if (retryFlushTimer)', flushStart), 'concurrent queue drains preserve an existing retry cooldown');
check(queue.includes("db.transaction('rw', db.commands") && queue.includes('latestTime + 1'), 'queue preserves strict FIFO order for same-millisecond actions');
check(queue.includes("notifyListeners('rejected')"), 'permanent rejection signals authoritative reconciliation');
check(queue.includes('stablePayload.clientOrderId') && queue.includes('stablePayload.clientItemId'), 'offline entity IDs are persisted in queued payloads');

const app = read('src/App.tsx');
check(app.includes("'HUB_UNAVAILABLE'") && app.includes('Retry connection'), 'startup failure is bounded and recoverable');
check(app.includes('void refreshQueueStatus()'), 'persisted queue is hydrated at boot');
check(app.includes('reconcileInFlightRef') && app.includes("reason !== 'rejected'"), 'permanent rejection triggers authoritative rebase');
check(app.includes('if (socket.connected) synchronize()'), 'existing socket receives an immediate sync');
check(app.includes('data.stateVersion < stateVersionRef.current') && app.includes('forceResync'), 'out-of-order state events are guarded with restore override');

const server = read('server.ts');
check(server.includes("fs.openSync(LOCK_FILE, 'wx')"), 'single-instance lock uses exclusive file creation');
check(server.includes('owner === process.pid'), 'process releases only its own PID lock');
check(server.includes('return getFrontendStateTx(tx, versionRow?.version || 0)'), 'REST snapshot includes a state version');
check(server.includes('if (currentVersion !== lastKnownVersion || lastKnownVersion === 0)'), 'SYNC handles version differences in both directions');
check(server.includes('UNCAUGHT_EXCEPTION') && server.includes('UNHANDLED_REJECTION'), 'fatal process errors request controlled shutdown');
check(server.includes('beginDatabaseMaintenance') && server.includes('activeDatabaseRequests') && server.includes('activeSocketOperations'), 'database restore gates new writes and drains active operations');
check(server.includes("code: 'HUB_MAINTENANCE'"), 'commands and HTTP requests receive explicit retryable maintenance responses');

const launcher = read('windows/launcher/RestaurantOS.cs');
const mainFlow = launcher.slice(launcher.indexOf('static void Main'), launcher.indexOf('private static bool ProbeUrl'));
check(!mainFlow.includes('KillOrphanedServerProcesses()'), 'launcher does not kill existing hub based on slow readiness');
check(!mainFlow.includes('process.Kill()'), 'launcher does not kill a hub during slow startup');

const supervisor = read('windows/service/run-hub-supervisor.ps1');
check(supervisor.includes('while ($true)') && supervisor.includes('Start-Sleep'), 'Windows supervisor restarts exited server with backoff');
check(supervisor.includes('$env:NODE_ENV = "production"') && supervisor.includes('$env:RESTAURANTOS_DATA_DIR = $DataDir'), 'Windows supervisor configures production and data paths');
const installer = read('windows/installer/install.ps1');
const serviceInstaller = read('windows/service/install-service.ps1');
check(installer.includes('Join-Path "windows" (Join-Path "service" "run-hub-supervisor.ps1")'), 'main installer resolves supervisor script using platform-independent path joins');
check(serviceInstaller.includes('Join-Path "windows" (Join-Path "service" "run-hub-supervisor.ps1")'), 'service installer resolves supervisor script using platform-independent path joins');
check(installer.includes('-WorkingDirectory $InstallPath') && serviceInstaller.includes('-WorkingDirectory $AppDir'), 'both scheduled-task actions set application working directory');

const db = read('src/db/index.ts');
check(db.includes('PRAGMA integrity_check') && db.includes('requiredTables'), 'restore validates integrity and core tables before swap');
check(db.includes('await client.close()') && db.includes('oldDatabaseMoved') && db.includes('rollbackPath'), 'restore closes live handle and preserves rollback');
check(db.includes('if (oldDatabaseMoved) {') && db.includes('If moving the original failed, keep it intact.'), 'restore never deletes the original DB if its rollback rename fails');

const admin = read('src/api/admin.ts');
check(admin.includes('beginMaintenance()') && admin.includes('restoreInProgress') && admin.includes('endMaintenance()'), 'restore is exclusive and releases maintenance gate on every exit');
check(admin.includes('VACUUM INTO') && admin.includes('Refusing to back up a database that failed integrity_check'), 'backup is consistent and fails on invalid integrity');
const scheduler = admin.slice(admin.indexOf('export function startAutoBackupScheduler'));
check(scheduler.includes('if (restoreInProgress)'), 'automatic backups do not race an exclusive restore');
check(admin.includes('options.forceResync ? { ...state, forceResync: true } : state'), 'state publishes after commit and restore can force resync');

const workflow = read('.github/workflows/build-windows.yml');
check(workflow.includes('branches: [ main, master, gpt-harness ]'), 'gpt-harness push triggers Windows build');
check(workflow.includes("github.event_name == 'push' && github.ref_type == 'tag'"), 'branch builds cannot publish over stable releases');

const pkg = JSON.parse(read('package.json'));
check(pkg.scripts.test.includes('verify-reliability-hardening.cjs'), 'npm test includes reliability guardrails');
check(read('verify_all_parts.ts').includes("process.env.API_BASE || 'http://localhost:8989'"), 'integration test default matches server port');

console.log('\nReliability guardrails: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) process.exit(1);
