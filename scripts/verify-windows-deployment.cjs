/**
 * RestaurantOS Windows Packaging & Deployment Verification Suite
 * Exhaustive audit for self-contained, offline-ready Windows deployment:
 * 1. Data directory separation (Program Files vs ProgramData)
 * 2. Embedded Node.js runtime (RestaurantOS/runtime/node.exe)
 * 3. Packaged production node_modules & native dependencies
 * 4. PWA static assets & SQLite migrations inclusion
 * 5. Launcher independence from developer tools
 * 6. Non-destructive upgrade & reinstall safety
 * 7. Uninstallation safety (database & backups preserved)
 * 8. Firewall rule parameters (TCP 3000, private/domain only)
 * 9. Inno Setup and PowerShell installer structure
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

console.log('====================================================');
console.log('   RESTAURANTOS WINDOWS PACKAGING & AUDIT SUITE     ');
console.log('====================================================\n');

// TEST 1: Package Files and Scripts Existence
console.log('--- TEST 1: Source Installer & Configuration Artifacts ---');
const requiredFiles = [
  'windows/installer/install.ps1',
  'windows/installer/install.bat',
  'windows/installer/uninstall.ps1',
  'windows/installer/uninstall.bat',
  'windows/installer/RestaurantOS-Setup.iss',
  'windows/firewall/add-firewall-rule.ps1',
  'windows/firewall/add-firewall-rule.bat',
  'windows/firewall/remove-firewall-rule.bat',
  'windows/service/install-service.ps1',
  'windows/service/uninstall-service.ps1',
  'windows/launcher/launch-hub.bat',
  'scripts/build-windows-package.js',
  'src/paths.ts',
  'src/components/admin/LocalHubStatus.tsx'
];

for (const file of requiredFiles) {
  const exists = fs.existsSync(path.resolve(process.cwd(), file));
  assert(exists, `Required artifact exists: ${file}`);
}

// TEST 2: Firewall Security Audit
console.log('\n--- TEST 2: Firewall Configuration Security Audit ---');
const firewallBat = fs.readFileSync(path.resolve(process.cwd(), 'windows/firewall/add-firewall-rule.bat'), 'utf-8');
const firewallPs1 = fs.readFileSync(path.resolve(process.cwd(), 'windows/firewall/add-firewall-rule.ps1'), 'utf-8');

assert(firewallBat.includes('localport=3000'), 'Firewall BAT limits inbound rule to port 3000');
assert(firewallBat.includes('protocol=TCP'), 'Firewall BAT specifies TCP protocol');
assert(firewallBat.includes('profile=private,domain'), 'Firewall BAT restricts access to private and domain networks');
assert(firewallPs1.includes('localport=$Port') || firewallPs1.includes('3000'), 'Firewall PS1 limits inbound rule to port 3000');
assert(firewallPs1.includes('profile=private,domain'), 'Firewall PS1 restricts access to private/domain network profile');

// TEST 3: Uninstaller Non-Destructive Data Safety Audit
console.log('\n--- TEST 3: Uninstallation Safety Audit ---');
const uninstallPs1 = fs.readFileSync(path.resolve(process.cwd(), 'windows/installer/uninstall.ps1'), 'utf-8');
const innoSetupIss = fs.readFileSync(path.resolve(process.cwd(), 'windows/installer/RestaurantOS-Setup.iss'), 'utf-8');

assert(!uninstallPs1.includes('Remove-Item -Path $DataPath'), 'Uninstaller NEVER executes recursive removal of DataPath');
assert(uninstallPs1.includes('DELIBERATELY PRESERVED'), 'Uninstaller provides explicit notice that data was preserved');
assert((innoSetupIss.includes('Permissions: users-modify') || innoSetupIss.includes('Permissions: users-full')) && innoSetupIss.includes('{commonappdata}\\RestaurantOS'), 'Inno Setup provisions ProgramData with proper permissions without overwriting');

// TEST 4: Path Resolution & Environment Fallbacks
console.log('\n--- TEST 4: Directory Separation Logic ---');
const pathsCode = fs.readFileSync(path.resolve(process.cwd(), 'src/paths.ts'), 'utf-8');
assert(pathsCode.includes('ProgramData') || pathsCode.includes('ALLUSERSPROFILE'), 'Paths module references Windows ProgramData directory');
assert(pathsCode.includes('RESTAURANTOS_DATA_DIR'), 'Paths module supports custom RESTAURANTOS_DATA_DIR override');
assert(pathsCode.includes('restaurantos.pid') || pathsCode.includes('local_hub.pid') || pathsCode.includes('LOCK_FILE'), 'Paths module defines instance lockfile');

// TEST 5: Launcher Self-Contained Runtime Audit
console.log('\n--- TEST 5: Launcher Independence Audit ---');
const launcherBat = fs.readFileSync(path.resolve(process.cwd(), 'windows/launcher/launch-hub.bat'), 'utf-8');
assert(launcherBat.includes('runtime\\node.exe'), 'Launcher prioritizes bundled embedded runtime/node.exe');
assert(!launcherBat.includes('npm run') && !launcherBat.includes('npx') && !launcherBat.includes('git '), 'Launcher has ZERO reliance on npm, npx, git, or build tools');
assert(launcherBat.includes('server.cjs'), 'Launcher launches compiled server.cjs directly');

// TEST 6: Packaging Build Execution
console.log('\n--- TEST 6: Build Package Execution & Structure Audit ---');
try {
  execSync('node scripts/build-windows-package.js', { stdio: 'pipe' });
  const pkgDir = path.resolve(process.cwd(), 'dist/windows-package');
  const appDir = path.join(pkgDir, 'RestaurantOS');
  
  assert(fs.existsSync(pkgDir), 'Windows package directory dist/windows-package exists');
  assert(fs.existsSync(appDir), 'Application directory dist/windows-package/RestaurantOS exists');
  
  // Verify embedded node.exe
  const nodeExe = path.join(appDir, 'runtime/node.exe');
  assert(fs.existsSync(nodeExe), 'Embedded Node.js runtime exists at RestaurantOS/runtime/node.exe');
  const nodeExeSize = fs.existsSync(nodeExe) ? fs.statSync(nodeExe).size : 0;
  assert(nodeExeSize > 10000000, `Embedded Node.js runtime binary is valid (Size: ${Math.round(nodeExeSize / 1024 / 1024)} MB)`);
  
  // Verify production node_modules
  const nodeModulesDir = path.join(appDir, 'node_modules');
  assert(fs.existsSync(nodeModulesDir), 'Pre-packaged node_modules exists in RestaurantOS/node_modules');
  const requiredModules = ['@libsql', 'libsql', 'express', 'socket.io', 'drizzle-orm', 'bcryptjs', 'dotenv', 'uuid', 'zod'];
  for (const mod of requiredModules) {
    assert(fs.existsSync(path.join(nodeModulesDir, mod)), `Production dependency '${mod}' is packaged in node_modules`);
  }
  assert(fs.existsSync(path.join(nodeModulesDir, '@libsql', 'win32-x64-msvc', 'index.node')), 'Prebuilt Windows x64 LibSQL native binary index.node is packaged');
  
  // Verify server bundle
  assert(fs.existsSync(path.join(appDir, 'server.cjs')), 'Bundled server.cjs exists in package');
  
  // Verify PWA static frontend
  assert(fs.existsSync(path.join(appDir, 'dist/index.html')), 'Production PWA static index.html exists in package dist');
  assert(fs.existsSync(path.join(appDir, 'dist/sw.js')), 'Production PWA service worker sw.js exists in package dist');
  assert(fs.existsSync(path.join(appDir, 'dist/manifest.webmanifest')), 'Production PWA manifest.webmanifest exists in package dist');
  
  // Verify DB migrations
  assert(fs.existsSync(path.join(appDir, 'migrations')), 'Database migrations folder exists in package');
  assert(fs.existsSync(path.join(appDir, 'src/db/migrations')), 'Database migrations folder exists in src/db/migrations');
  assert(fs.existsSync(path.join(appDir, 'migrations/0000_flippant_alice.sql')), 'Initial schema migration SQL exists');
  assert(fs.existsSync(path.join(appDir, 'migrations/0010_offline_licensing_and_installation.sql')), 'Latest schema migration SQL exists');
  assert(fs.existsSync(path.join(appDir, 'migrations/meta/_journal.json')), 'Schema journal meta file exists');
  
  // Verify installers
  assert(fs.existsSync(path.join(pkgDir, 'Install-RestaurantOS.bat')), 'Top-level Install-RestaurantOS.bat exists');
  assert(fs.existsSync(path.join(pkgDir, 'Uninstall-RestaurantOS.bat')), 'Top-level Uninstall-RestaurantOS.bat exists');
  assert(fs.existsSync(path.join(pkgDir, 'install.ps1')), 'Top-level install.ps1 exists');
  assert(fs.existsSync(path.join(pkgDir, 'uninstall.ps1')), 'Top-level uninstall.ps1 exists');
  assert(fs.existsSync(path.join(pkgDir, 'RestaurantOS-Setup.iss')), 'Inno Setup script exists');
  assert(fs.existsSync(path.join(pkgDir, 'README-WINDOWS.txt')), 'Windows README documentation exists');
  
} catch (err) {
  assert(false, `Packaging build failed: ${err.message}`);
}

// Summary
console.log('\n====================================================');
console.log(`Verification Complete: ${passedTests} Passed, ${failedTests} Failed`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
