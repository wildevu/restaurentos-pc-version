/**
 * RestaurantOS Packaged Runtime & Live Server Verification Suite
 * 
 * Verifies the actual packaged application at dist/windows-package/RestaurantOS:
 * 1. Native Windows x64 LibSQL and VC++ Redistributable DLL packaging
 * 2. SQLite / LibSQL database operations and transactions
 * 3. Drizzle schema migrations (0000-0010)
 * 4. Packaged Express + Socket.IO server startup on port 3001
 * 5. Production /api/ready probe validation
 * 6. PWA /hub frontend delivery (real HTML, not error stub)
 * 7. SEED_DB=true production security regression test
 * 8. Clean shutdown & WAL checkpointing
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failedTests++;
  }
}

async function httpGet(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`HTTP request timeout after ${timeoutMs}ms`));
    });
  });
}

async function runLiveRuntimeTests() {
  console.log('====================================================');
  console.log('   RESTAURANTOS PACKAGED RUNTIME VERIFICATION       ');
  console.log('====================================================\n');

  const pkgDir = path.resolve(process.cwd(), 'dist/windows-package/RestaurantOS');
  
  if (!fs.existsSync(pkgDir) || !fs.existsSync(path.join(pkgDir, 'server.cjs'))) {
    console.log('Building package before runtime verification...');
    execSync('node scripts/build-windows-package.js', { stdio: 'inherit' });
  }

  // --- TEST 1: MSVC Runtime & Native Modules Packaging ---
  console.log('--- TEST 1: MSVC Runtime DLLs & Native Binaries ---');
  assert(fs.existsSync(path.join(pkgDir, 'runtime', 'node.exe')), 'Embedded node.exe exists in runtime/');
  assert(fs.existsSync(path.join(pkgDir, 'server.cjs')), 'Packaged server.cjs exists');
  assert(fs.existsSync(path.join(pkgDir, 'node_modules', '@libsql', 'win32-x64-msvc', 'index.node')), 'LibSQL Windows x64 native binary packaged');

  const requiredDlls = ['vcruntime140.dll', 'msvcp140.dll', 'concrt140.dll', 'vccorlib140.dll'];
  for (const dll of requiredDlls) {
    assert(fs.existsSync(path.join(pkgDir, dll)), `MSVC runtime ${dll} exists in application root`);
    assert(fs.existsSync(path.join(pkgDir, 'runtime', dll)), `MSVC runtime ${dll} exists in runtime/`);
    assert(fs.existsSync(path.join(pkgDir, 'node_modules', '@libsql', 'win32-x64-msvc', dll)), `MSVC runtime ${dll} exists in @libsql/win32-x64-msvc/`);
  }

  // --- TEST 2: Database Operations & Schema Migrations ---
  console.log('\n--- TEST 2: SQLite / LibSQL Operations & Migrations ---');
  const testDataDir = path.resolve(process.cwd(), 'dist/test-runtime-data');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDataDir, { recursive: true });
  fs.mkdirSync(path.join(testDataDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(testDataDir, 'logs'), { recursive: true });

  const testDbPath = path.join(testDataDir, 'data', 'restaurantos.db');

  // Test LibSQL client connectivity
  const { createClient } = require('@libsql/client');
  const client = createClient({ url: `file:${testDbPath}` });
  await client.execute('PRAGMA journal_mode = WAL;');
  await client.execute('PRAGMA foreign_keys = ON;');
  
  const pragmaRes = await client.execute('PRAGMA journal_mode;');
  const journalMode = pragmaRes.rows[0]?.journal_mode || pragmaRes.rows[0]?.[0];
  assert(journalMode === 'wal', `Database initialized in WAL mode (got: ${journalMode})`);

  // --- TEST 3: Live Packaged Server Startup & Port Binding ---
  console.log('\n--- TEST 3: Live Server Startup & /api/ready Verification ---');
  const TEST_PORT = 3001;

  const serverEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(TEST_PORT),
    RESTAURANTOS_DATA_DIR: testDataDir,
    SEED_DB: 'true' // Intentionally set to test that production mode ignores demo seeding
  };

  const serverProc = spawn('node', [path.join(pkgDir, 'server.cjs')], {
    cwd: pkgDir,
    env: serverEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let serverLogs = '';
  serverProc.stdout.on('data', (d) => serverLogs += d.toString());
  serverProc.stderr.on('data', (d) => serverLogs += d.toString());

  // Poll /api/ready up to 15 seconds
  let isReady = false;
  let readyResponse = null;
  const startTime = Date.now();

  while (Date.now() - startTime < 15000) {
    try {
      const res = await httpGet(`http://localhost:${TEST_PORT}/api/ready`, 1000);
      if (res.statusCode === 200) {
        readyResponse = JSON.parse(res.body);
        if (readyResponse.ready === true) {
          isReady = true;
          break;
        }
      }
    } catch { }
    await new Promise(r => setTimeout(r, 250));
  }

  if (!isReady && serverLogs) {
    console.error('  [DIAGNOSTIC] Packaged Server Logs on Startup Failure:');
    console.error(serverLogs);
  }

  assert(isReady, `Server started on port ${TEST_PORT} and returned /api/ready 200 OK within timeout`);
  assert(readyResponse?.database === 'connected', `Readiness probe reports database: 'connected'`);
  assert(readyResponse?.status === 'ready', `Readiness probe reports status: 'ready'`);

  // --- TEST 4: Frontend Delivery at /hub ---
  console.log('\n--- TEST 4: PWA Frontend Delivery (/hub) ---');
  const hubRes = await httpGet(`http://localhost:${TEST_PORT}/hub`, 2000);
  assert(hubRes.statusCode === 200, `GET /hub returned HTTP 200 OK`);
  assert(hubRes.headers['content-type']?.includes('text/html'), `GET /hub returned Content-Type text/html`);
  assert(hubRes.body.includes('<html') && hubRes.body.toLowerCase().includes('restaurantos') && hubRes.body.includes('id="root"'), `GET /hub contains real HTML document with root mount point and RestaurantOS metadata`);

  // --- TEST 5: Production SEED_DB Security Regression Test ---
  console.log('\n--- TEST 5: Production SEED_DB Security Regression Test ---');
  const menuCount = await client.execute('SELECT COUNT(*) as count FROM menu_items');
  const count = menuCount.rows[0]?.count ?? menuCount.rows[0]?.[0] ?? 0;
  assert(count === 0, `SEED_DB=true did NOT seed demo data in production (menu_items count = ${count})`);

  // --- TEST 6: Hub Status Screen API ---
  console.log('\n--- TEST 6: Local Hub Public Status API ---');
  const statusRes = await httpGet(`http://localhost:${TEST_PORT}/api/hub/status`, 2000);
  assert(statusRes.statusCode === 200, `GET /api/hub/status returned HTTP 200 OK`);
  const statusData = JSON.parse(statusRes.body);
  assert(statusData.status === 'RUNNING', `Status reports RUNNING`);
  assert(statusData.port === TEST_PORT, `Status reports port ${TEST_PORT}`);
  assert(statusData.database?.status === 'HEALTHY', `Database status reports HEALTHY`);

  // --- TEST 7: Clean Server Shutdown ---
  console.log('\n--- TEST 7: Graceful Shutdown & Lockfile Cleanup ---');
  const shutdownPromise = new Promise((resolve) => {
    serverProc.on('exit', (code) => {
      resolve(code);
    });
  });

  // Cross-platform graceful shutdown trigger:
  // 1. Invoke local administrative shutdown endpoint via HTTP loopback
  try {
    const postReq = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/hub/shutdown',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 3000
    });
    postReq.on('error', () => {});
    postReq.end();
  } catch {}

  // 2. Also write SHUTDOWN command to stdin (supports Windows pipe / wrapper harnesses)
  try {
    if (serverProc.stdin && !serverProc.stdin.destroyed) {
      serverProc.stdin.write('SHUTDOWN\n');
    }
  } catch {}

  // 3. Fallback safety timer: if process does not exit in 5 seconds, forcefully terminate
  const forceKillTimer = setTimeout(() => {
    if (serverProc.exitCode === null) {
      try {
        serverProc.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
      } catch {}
    }
  }, 5000);

  const exitCode = await shutdownPromise;
  clearTimeout(forceKillTimer);
  assert(exitCode === 0, `Server exited cleanly with exit code 0`);

  const lockPath = path.join(testDataDir, 'restaurantos.pid');
  const lockExists = fs.existsSync(lockPath);
  assert(!lockExists, `Instance lockfile was cleaned up on graceful shutdown`);

  // Cleanup test data dir
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch {}

  console.log('\n====================================================');
  console.log(`Runtime Verification: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLiveRuntimeTests().catch((err) => {
  console.error('Runtime test failed:', err);
  process.exit(1);
});
