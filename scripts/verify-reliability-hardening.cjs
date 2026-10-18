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
check(queue.includes('socket.timeout(ACK_TIMEOUT_MS).emit'), 'Socket.IO owns ACK timeout cleanup and removes expired callbacks');
check(queue.includes('ACK_TIMEOUT') && queue.includes('same action ID'), 'uncertain acknowledgement preserves idempotent action identity');
check(queue.includes('socket.timeout(ACK_TIMEOUT_MS).emit') && queue.includes('ACK_TIMEOUT'), 'transport ACK timeout is bounded by Socket.IO itself');
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
check(app.includes('syncSequenceRef.current') && app.includes('syncSequence !== syncSequenceRef.current'), 'late SYNC callbacks cannot overwrite more recent recovery results');
check(app.includes('lastKnownEpoch: syncEpochRef.current') && app.includes("localStorage.setItem('restaurantos_sync_epoch'"), 'client persists server epoch across reloads to avoid unnecessary full snapshots');

const server = read('server.ts');
check(server.includes("fs.openSync(LOCK_FILE, 'wx')"), 'single-instance lock uses exclusive file creation');
check(server.includes('owner === process.pid'), 'process releases only its own PID lock');
check(server.includes('return getFrontendStateTx(tx, versionRow?.version || 0)'), 'REST snapshot includes a state version');
check(server.includes('if (currentVersion !== lastKnownVersion || lastKnownVersion === 0 || clientEpoch !== syncEpoch)'), 'SYNC handles state-version and server-epoch differences');
check(server.includes('forceResync: currentVersion < lastKnownVersion'), 'SYNC identifies a legitimate version rollback after backup restore');
check(server.includes('clientEpoch !== syncEpoch') && server.includes('app.set(\'advanceSyncEpoch\''), 'SYNC epoch forces refresh after server restarts and restores even if versions match');
check(server.includes('UNCAUGHT_EXCEPTION') && server.includes('UNHANDLED_REJECTION'), 'fatal process errors request controlled shutdown');
check(server.includes('beginDatabaseMaintenance') && server.includes('activeDatabaseRequests') && server.includes('activeSocketOperations'), 'database restore gates new writes and drains active operations');
check(server.includes("code: 'HUB_MAINTENANCE'"), 'commands and HTTP requests receive explicit retryable maintenance responses');

const launcher = read('windows/launcher/RestaurantOS.cs');
const mainFlow = launcher.slice(launcher.indexOf('static void Main'), launcher.indexOf('private static bool ProbeUrl'));
check(!mainFlow.includes('KillOrphanedServerProcesses()'), 'launcher does not kill existing hub based on slow readiness');
check(!mainFlow.includes('process.Kill()'), 'launcher does not kill a hub during slow startup');
check(mainFlow.includes('run-hub-supervisor.ps1') && mainFlow.includes('RedirectStandardOutput = false') && mainFlow.includes('RedirectStandardError = false'), 'native launcher starts a persistent supervisor without short-lived output pipes');
check(!mainFlow.includes('RedirectStandardOutput = true') && !mainFlow.includes('RedirectStandardError = true'), 'native launcher does not own the live hub output streams');
const launcherSource = launcher;
check(launcherSource.includes('NormalizeDirectoryPath(AppDomain.CurrentDomain.BaseDirectory)'), 'native launcher removes trailing separator before quoting install path');
check(launcherSource.includes('QuoteWindowsArgument(supervisorScript)') && launcherSource.includes('QuoteWindowsArgument(appDir)') && launcherSource.includes('QuoteWindowsArgument(dataDir)'), 'native launcher quotes each supervisor argument independently');
check(launcherSource.includes('private static string QuoteWindowsArgument(string value)') && launcherSource.includes("backslashCount * 2"), 'Windows argument quoting handles backslashes and closing quotes correctly');
check(launcherSource.includes('Environment.GetEnvironmentVariable("RESTAURANTOS_DATA_DIR")'), 'native launcher honors configured shared data directory');
check(launcherSource.includes('Launcher starting supervisor. AppDir=['), 'launcher logs resolved app/data paths before starting supervisor');
const launcherSource = launcher;
check(launcherSource.includes('NormalizeDirectoryPath(AppDomain.CurrentDomain.BaseDirectory)'), 'native launcher removes trailing separator before quoting install path');
check(launcherSource.includes('QuoteWindowsArgument(supervisorScript)') && launcherSource.includes('QuoteWindowsArgument(appDir)') && launcherSource.includes('QuoteWindowsArgument(dataDir)'), 'native launcher quotes each supervisor argument independently');
check(launcherSource.includes('private static string QuoteWindowsArgument(string value)') && launcherSource.includes("backslashCount * 2"), 'Windows argument quoting handles backslashes and closing quotes correctly');
check(launcherSource.includes('Environment.GetEnvironmentVariable("RESTAURANTOS_DATA_DIR")'), 'native launcher honors configured shared data directory');
check(launcherSource.includes('Launcher starting supervisor. AppDir=['), 'launcher logs resolved app/data paths before starting supervisor');
const fallbackLauncher = read('windows/launcher/Launch-RestaurantOS.vbs');
check(fallbackLauncher.includes('run-hub-supervisor.ps1') && !fallbackLauncher.includes('server.cjs'), 'fallback launcher uses the same persistent supervisor');
const logger = read('src/logger.ts');
check(logger.includes('protectConsoleStream') && logger.includes("'EPIPE'") && logger.includes("'EBADF'"), 'console stream errors cannot crash the hub logger');
const pwaEntrypoint = read('src/main.tsx');
check(pwaEntrypoint.includes('An update for RestaurantOS is ready. Reload now to apply it?'), 'PWA prompt accurately describes an application update');
const innoSetup = read('windows/installer/RestaurantOS-Setup.iss');
check(innoSetup.includes('DisableDirPage=no'), 'installer explicitly displays destination-folder selection');
const serviceUninstaller = read('windows/service/uninstall-service.ps1');
check(serviceUninstaller.includes('run-hub-supervisor.ps1') && serviceUninstaller.includes('Get-CimInstance'), 'service uninstall terminates this installation supervisor');
check(read('windows/installer/uninstall.ps1').includes('run-hub-supervisor.ps1'), 'standalone uninstall stops supervisor before removing binaries');

const supervisor = read('windows/service/run-hub-supervisor.ps1');
check(supervisor.includes('while ($true)') && supervisor.includes('Start-Sleep'), 'Windows supervisor restarts exited server with backoff');
check(supervisor.includes('[System.IO.Path]::GetFullPath($AppDir)') && supervisor.includes('[System.IO.Path]::GetFullPath($DataDir)'), 'supervisor canonicalizes app and data paths before resolving runtime');
check(supervisor.includes('AppDir=[$AppDir]') && supervisor.includes('NodeExe=[$NodeExe]'), 'supervisor diagnostics include resolved runtime path');
check(supervisor.includes('-gt 10MB') && supervisor.includes('$rotatedLog = "$SupervisorLog.1"'), 'supervisor status log is bounded by rotation');
check(supervisor.includes('[System.IO.Path]::GetFullPath($AppDir)') && supervisor.includes('[System.IO.Path]::GetFullPath($DataDir)'), 'supervisor canonicalizes app and data paths before resolving runtime');
check(supervisor.includes('AppDir=[$AppDir]') && supervisor.includes('NodeExe=[$NodeExe]'), 'supervisor diagnostics include resolved runtime path');
check(supervisor.includes('-gt 10MB') && supervisor.includes('$rotatedLog = "$SupervisorLog.1"'), 'supervisor status log is bounded by rotation');
check(supervisor.includes('$env:NODE_ENV = "production"') && supervisor.includes('$env:RESTAURANTOS_DATA_DIR = $DataDir'), 'Windows supervisor configures production and data paths');
const installer = read('windows/installer/install.ps1');
const serviceInstaller = read('windows/service/install-service.ps1');
check(installer.includes('Join-Path "windows" (Join-Path "service" "run-hub-supervisor.ps1")'), 'main installer resolves supervisor script using platform-independent path joins');
check(serviceInstaller.includes('Join-Path "windows" (Join-Path "service" "run-hub-supervisor.ps1")'), 'service installer resolves supervisor script using platform-independent path joins');
check(installer.includes('-WorkingDirectory $InstallPath') && serviceInstaller.includes('-WorkingDirectory $AppDir'), 'both scheduled-task actions set application working directory');

const packageBuilder = read('scripts/build-windows-package.js');
check(packageBuilder.includes("process.env.NODE_VERSION || '22.23.0'"), 'packaged runtime uses a maintained Node.js LTS line instead of EOL Node 20');
check(packageBuilder.includes('NODE_VERSION_MARKER') && packageBuilder.includes('cachedVersion === NODE_VERSION'), 'packaging refuses stale or unverified cached Node runtimes');
const runtimeVerifier = read('scripts/verify-packaged-runtime.cjs');
check(runtimeVerifier.includes("process.platform === 'win32' ? bundledNode : process.execPath"), 'Windows packaged-runtime test executes the bundled node.exe rather than CI Node');
check(runtimeVerifier.includes("node-version: '22.23.0'") || read('.github/workflows/build-windows.yml').includes("node-version: '22.23.0'"), 'CI Node runtime is pinned to the same patch version as the packaged runtime');
check(runtimeVerifier.includes("['--version']") && runtimeVerifier.includes("v22.23.0"), 'Windows packaged-runtime verification checks the embedded Node version');
const db = read('src/db/index.ts');
check(db.includes('PRAGMA integrity_check') && db.includes('requiredTables'), 'restore validates integrity and core tables before swap');
check(db.includes('await client.close()') && db.includes('oldDatabaseMoved') && db.includes('rollbackPath'), 'restore closes live handle and preserves rollback');
check(db.includes('if (oldDatabaseMoved) {') && db.includes('If moving the original failed, keep it intact.'), 'restore never deletes the original DB if its rollback rename fails');

const admin = read('src/api/admin.ts');
check(admin.includes('beginMaintenance()') && admin.includes('restoreInProgress') && admin.includes('endMaintenance()'), 'restore is exclusive and releases maintenance gate on every exit');
check(admin.indexOf('const advanceSyncEpoch = req.app.get(\'advanceSyncEpoch\')') < admin.indexOf('await db.insert(auditEvents).values({', admin.indexOf("adminRouter.post('/backups/restore'")), 'restore epoch is invalidated immediately after swap, before fallible audit writes');
check(admin.includes('VACUUM INTO') && admin.includes('Refusing to back up a database that failed integrity_check'), 'backup is consistent and fails on invalid integrity');
const scheduler = admin.slice(admin.indexOf('export function startAutoBackupScheduler'));
check(scheduler.includes('if (restoreInProgress || autoBackupInProgress)'), 'automatic backups do not start while restore or another backup is active');
check(admin.includes('waitForAutoBackupToFinish()') && admin.includes('autoBackupInProgress = false'), 'restore waits for any auto-backup already in flight before closing the DB');
check(admin.includes('options.forceResync ? { ...state, forceResync: true } : state'), 'state publishes after commit and restore can force resync');
check(admin.includes('if (stateVersion === undefined)'), 'state version zero is handled without duplicate hub-state insertion');

const workflow = read('.github/workflows/build-windows.yml');
check(workflow.includes('branches: [ main, master, gpt-harness ]'), 'gpt-harness push triggers Windows build');
check(workflow.includes("github.event_name == 'push' && github.ref_type == 'tag'"), 'branch builds cannot publish over stable releases');

const pkg = JSON.parse(read('package.json'));
check(pkg.scripts.test.includes('verify-reliability-hardening.cjs'), 'npm test includes reliability guardrails');
check(pkg.scripts.test.includes('verify-command-idempotency.ts'), 'npm test includes real database command idempotency tests');
check(fs.existsSync(path.join(process.cwd(), 'scripts/verify-command-idempotency.ts')), 'real database regression suite is present');
check(read('verify_all_parts.ts').includes("process.env.API_BASE || 'http://localhost:8989'"), 'integration test default matches server port');

console.log('\nReliability guardrails: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) process.exit(1);
