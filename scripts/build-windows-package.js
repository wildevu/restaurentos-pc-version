import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PKG_DIR = path.join(DIST_DIR, 'windows-package');
const APP_OUT = path.join(PKG_DIR, 'RestaurantOS');
const RUNTIME_CACHE_DIR = path.join(ROOT_DIR, 'runtime');
const NODE_EXE_CACHE = path.join(RUNTIME_CACHE_DIR, 'node.exe');

console.log('====================================================');
console.log('   RESTAURANTOS WINDOWS PACKAGE BUILD PIPELINE      ');
console.log('====================================================');

// Helper to copy recursive with exclusion
function copyFolderSync(from, to, exclude = []) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    if (exclude.includes(element)) return;
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    const stat = fs.lstatSync(fromPath);
    if (stat.isFile()) {
      fs.copyFileSync(fromPath, toPath);
    } else if (stat.isDirectory()) {
      copyFolderSync(fromPath, toPath, exclude);
    }
  });
}

const NODE_VERSION = process.env.NODE_VERSION || '20.18.0';
const NODE_ARCH = 'win-x64';

// Ensure official Windows Node.js runtime is available
async function ensureWindowsNodeRuntime() {
  if (!fs.existsSync(RUNTIME_CACHE_DIR)) {
    fs.mkdirSync(RUNTIME_CACHE_DIR, { recursive: true });
  }

  if (fs.existsSync(NODE_EXE_CACHE) && fs.statSync(NODE_EXE_CACHE).size > 10000000) {
    console.log('[Runtime] Found cached Windows x64 Node.js runtime binary (' + Math.round(fs.statSync(NODE_EXE_CACHE).size / 1024 / 1024) + ' MB)');
    return;
  }

  console.log(`[Runtime] Downloading official standalone Windows x64 Node.js binary (v${NODE_VERSION}) from nodejs.org...`);
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCH}/node.exe`;
  
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(NODE_EXE_CACHE);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error('Failed to download node.exe, HTTP status: ' + response.statusCode));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log('[Runtime] Downloaded Windows x64 Node.js runtime successfully (' + Math.round(fs.statSync(NODE_EXE_CACHE).size / 1024 / 1024) + ' MB)');
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(NODE_EXE_CACHE, () => {});
      reject(err);
    });
  });
}

function compileWindowsLauncher() {
  const csSource = path.join(ROOT_DIR, 'windows', 'launcher', 'RestaurantOS.cs');
  const icoFile = path.join(ROOT_DIR, 'public', 'favicon.ico');
  const targetExe = path.join(APP_OUT, 'RestaurantOS.exe');
  const launcherOutExe = path.join(ROOT_DIR, 'windows', 'launcher', 'RestaurantOS.exe');

  if (!fs.existsSync(csSource)) return;

  // Check if RestaurantOS.exe was pre-compiled by a previous workflow step
  if (fs.existsSync(launcherOutExe)) {
    try {
      fs.copyFileSync(launcherOutExe, targetExe);
      console.log(`[Launcher] Using pre-compiled RestaurantOS.exe (${Math.round(fs.statSync(targetExe).size / 1024)} KB).`);
      return;
    } catch {}
  }

  console.log('[Launcher] Checking C# compiler for native Windows launcher (RestaurantOS.exe)...');
  
  const cscCandidates = [
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.8.1.0\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.8.0\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.7.2\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.5.2\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
    'csc.exe',
    'csc'
  ];

  let cscPath = null;
  for (const candidate of cscCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        cscPath = candidate;
        break;
      }
      execSync(`"${candidate}" /?`, { stdio: 'ignore' });
      cscPath = candidate;
      break;
    } catch {}
  }

  if (cscPath) {
    try {
      console.log(`[Launcher] Compiling native Windows launcher with ${cscPath}...`);
      const iconFlag = fs.existsSync(icoFile) ? `/win32icon:"${icoFile}"` : '';
      const refs = '/r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll';
      execSync(`"${cscPath}" /target:winexe /optimize+ /platform:anycpu ${refs} ${iconFlag} /out:"${targetExe}" "${csSource}"`, { stdio: 'inherit' });
      fs.copyFileSync(targetExe, launcherOutExe);
      console.log(`[Launcher] Compiled RestaurantOS.exe successfully (${Math.round(fs.statSync(targetExe).size / 1024)} KB).`);
    } catch (cErr) {
      console.warn('[Launcher] Warning compiling C# launcher with csc:', cErr.message);
      if (process.platform === 'win32') {
        throw new Error(`Failed to compile RestaurantOS.exe on Windows: ${cErr.message}`);
      }
    }
  } else {
    console.log('[Launcher] Note: C# csc compiler not in Linux container. C# source and VBS/BAT wrappers packaged for Windows compilation & execution.');
  }
}

async function buildPackage() {
  // 1. Clean previous package folder before building
  if (fs.existsSync(PKG_DIR)) {
    fs.rmSync(PKG_DIR, { recursive: true, force: true });
  }

  // 2. Build Client and Server Bundles
  console.log('[1/6] Compiling production frontend and backend bundles...');
  execSync('npm run build', { stdio: 'inherit' });

  // 3. Ensure Windows Node.js Runtime is ready
  console.log('[2/6] Verifying embedded Windows Node.js runtime...');
  await ensureWindowsNodeRuntime();

  // 4. Prepare Package Directory Structure
  console.log('[3/6] Creating Windows deployment layout...');
  fs.mkdirSync(APP_OUT, { recursive: true });
  const appRuntimeDir = path.join(APP_OUT, 'runtime');
  fs.mkdirSync(appRuntimeDir, { recursive: true });
  fs.copyFileSync(NODE_EXE_CACHE, path.join(appRuntimeDir, 'node.exe'));

  // 5. Copy Application Assets to Windows Bundle
  console.log('[4/6] Bundling server, PWA assets, migrations, and dependencies...');
  fs.copyFileSync(path.join(DIST_DIR, 'server.cjs'), path.join(APP_OUT, 'server.cjs'));
  if (fs.existsSync(path.join(DIST_DIR, 'server.cjs.map'))) {
    fs.copyFileSync(path.join(DIST_DIR, 'server.cjs.map'), path.join(APP_OUT, 'server.cjs.map'));
  }
  fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(APP_OUT, 'package.json'));

  // Copy static PWA frontend
  copyFolderSync(DIST_DIR, path.join(APP_OUT, 'dist'), ['windows-package', 'installer']);

  // Copy DB migrations
  copyFolderSync(path.join(ROOT_DIR, 'src', 'db', 'migrations'), path.join(APP_OUT, 'src', 'db', 'migrations'));
  copyFolderSync(path.join(ROOT_DIR, 'src', 'db', 'migrations'), path.join(APP_OUT, 'migrations'));

  // Copy public assets & icons
  copyFolderSync(path.join(ROOT_DIR, 'public'), path.join(APP_OUT, 'public'));

  // Copy Windows helpers (service, firewall, installer)
  copyFolderSync(path.join(ROOT_DIR, 'windows'), path.join(APP_OUT, 'windows'));

  // Copy top-level launcher and installers
  fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'launcher', 'launch-hub.bat'), path.join(APP_OUT, 'launch-hub.bat'));
  fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'launcher', 'Launch-RestaurantOS.vbs'), path.join(APP_OUT, 'Launch-RestaurantOS.vbs'));
  fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'launcher', 'RestaurantOS.cs'), path.join(APP_OUT, 'RestaurantOS.cs'));
  
  fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'install.bat'), path.join(PKG_DIR, 'Install-RestaurantOS.bat'));
  fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'uninstall.bat'), path.join(PKG_DIR, 'Uninstall-RestaurantOS.bat'));
  fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'install.ps1'), path.join(PKG_DIR, 'install.ps1'));
  fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'uninstall.ps1'), path.join(PKG_DIR, 'uninstall.ps1'));
  fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'RestaurantOS-Setup.iss'), path.join(PKG_DIR, 'RestaurantOS-Setup.iss'));

  // Copy production node_modules into RestaurantOS/node_modules
  console.log('[5/6] Packaging production runtime dependencies...');
  const destModules = path.join(APP_OUT, 'node_modules');
  fs.mkdirSync(destModules, { recursive: true });
  
  const devPrefixes = [
    '@tailwindcss',
    'tailwindcss',
    'lightningcss',
    '@rolldown',
    'rolldown',
    '@rollup',
    'rollup',
    '@esbuild',
    'esbuild',
    '@vitejs',
    'vite',
    'vite-plugin-pwa',
    'typescript',
    '@types',
    'drizzle-kit',
    'tsx',
    'postcss',
    'terser'
  ];

  const srcModules = path.join(ROOT_DIR, 'node_modules');
  if (fs.existsSync(srcModules)) {
    const items = fs.readdirSync(srcModules);
    for (const item of items) {
      if (devPrefixes.some(prefix => item === prefix || item.startsWith(prefix))) continue;
      const sPath = path.join(srcModules, item);
      const dPath = path.join(destModules, item);
      if (fs.existsSync(sPath)) {
        fs.cpSync(sPath, dPath, { recursive: true });
      }
    }
  }

  // Ensure Windows prebuilt binary for @libsql/win32-x64-msvc exists in package node_modules
  const winLibsqlDest = path.join(destModules, '@libsql', 'win32-x64-msvc');
  const winLibsqlSrc = path.join(srcModules, '@libsql', 'win32-x64-msvc');
  if (!fs.existsSync(winLibsqlDest) && fs.existsSync(winLibsqlSrc)) {
    fs.mkdirSync(path.join(destModules, '@libsql'), { recursive: true });
    fs.cpSync(winLibsqlSrc, winLibsqlDest, { recursive: true });
  } else if (!fs.existsSync(winLibsqlDest) || !fs.existsSync(path.join(winLibsqlDest, 'index.node'))) {
    console.log('[Dependencies] Ensuring prebuilt Windows x64 LibSQL binary is packaged...');
    try {
      const tmpDir = path.join(ROOT_DIR, 'runtime', 'libsql-win-pkg');
      fs.mkdirSync(tmpDir, { recursive: true });
      execSync('npm pack @libsql/win32-x64-msvc@0.5.29 --pack-destination=' + tmpDir, { stdio: 'pipe' });
      const tarballs = fs.readdirSync(tmpDir).filter(f => f.endsWith('.tgz'));
      if (tarballs.length > 0) {
        fs.mkdirSync(winLibsqlDest, { recursive: true });
        execSync(`tar -xzf "${path.join(tmpDir, tarballs[0])}" --strip-components=1 -C "${winLibsqlDest}"`, { stdio: 'pipe' });
        console.log('[Dependencies] Embedded Windows x64 LibSQL native binary successfully into package.');
      } else {
        throw new Error('No .tgz package archive found after npm pack @libsql/win32-x64-msvc');
      }
    } catch (lErr) {
      console.error('[FATAL] LibSQL Windows native binary packaging failed:', lErr.message);
      console.error('[FATAL] The application requires @libsql/win32-x64-msvc to run on Windows.');
      process.exit(1);
    }
  }

  if (!fs.existsSync(path.join(winLibsqlDest, 'index.node'))) {
    console.error('[FATAL] Verification failed: index.node is missing from ' + winLibsqlDest);
    process.exit(1);
  }

  // Copy bundled Visual C++ 2015-2022 x64 Runtime DLLs
  const redistX64Dir = path.join(ROOT_DIR, 'windows', 'redist', 'x64');
  const requiredDlls = ['msvcp140.dll', 'vcruntime140.dll'];
  if (!fs.existsSync(redistX64Dir)) {
    console.warn('[Redist] Warning: Visual C++ redist directory not found at ' + redistX64Dir);
  } else {
    console.log('[Redist] Packaging Visual C++ 2015-2022 x64 Runtime DLLs into application root, runtime, and LibSQL module...');
    const dlls = fs.readdirSync(redistX64Dir).filter(f => f.toLowerCase().endsWith('.dll'));
    
    const missingDlls = requiredDlls.filter(req => !dlls.some(f => f.toLowerCase() === req.toLowerCase()));
    if (missingDlls.length > 0) {
      console.warn(`[Redist] WARNING: Required MSVC runtime DLLs missing in ${redistX64Dir}: ${missingDlls.join(', ')}`);
    }

    const dests = [
      APP_OUT,
      path.join(APP_OUT, 'runtime'),
      path.join(APP_OUT, 'node_modules', '@libsql', 'win32-x64-msvc')
    ];
    
    for (const dest of dests) {
      fs.mkdirSync(dest, { recursive: true });
      for (const dll of dlls) {
        fs.copyFileSync(path.join(redistX64Dir, dll), path.join(dest, dll));
      }
    }
    console.log(`[Redist] Packaged ${dlls.length} MSVC runtime DLLs across all target directories.`);
  }

  const redistExe = path.join(ROOT_DIR, 'windows', 'redist', 'VC_redist.x64.exe');
  if (fs.existsSync(redistExe)) {
    fs.mkdirSync(path.join(APP_OUT, 'windows', 'redist'), { recursive: true });
    fs.copyFileSync(redistExe, path.join(APP_OUT, 'windows', 'redist', 'VC_redist.x64.exe'));
    fs.mkdirSync(path.join(PKG_DIR, 'windows', 'redist'), { recursive: true });
    fs.copyFileSync(redistExe, path.join(PKG_DIR, 'windows', 'redist', 'VC_redist.x64.exe'));
    console.log('[Redist] Packaged official VC_redist.x64.exe for Inno Setup silent installer.');
  }

  // Compile native Windows Launcher if compiler is available
  compileWindowsLauncher();

  // 6. Generate Windows Configuration Template & Readme
  console.log('[6/6] Writing deployment config template and documentation...');
  const configTemplate = `# RestaurantOS Local Hub Configuration
# Placed in C:\\ProgramData\\RestaurantOS\\config\\restaurantos.env
NODE_ENV=production
PORT=3000
# DB_PATH=C:\\ProgramData\\RestaurantOS\\data\\restaurantos.db
# BACKUP_DIR=C:\\ProgramData\\RestaurantOS\\backups
# LOG_DIR=C:\\ProgramData\\RestaurantOS\\logs
`;
  fs.writeFileSync(path.join(APP_OUT, 'restaurantos.env.template'), configTemplate, 'utf-8');

  const windowsReadme = `# RestaurantOS Local Hub for Windows

## Truly Self-Contained Deployment
RestaurantOS includes everything required to run out of the box:
- Embedded Windows x64 Node.js runtime (RestaurantOS\\runtime\\node.exe)
- Bundled server engine with pre-packaged runtime dependencies (RestaurantOS\\server.cjs)
- Offline-first Progressive Web App (PWA) client (RestaurantOS\\dist)
- Automated SQLite database schema migrations (RestaurantOS\\migrations)
- Bundled Visual C++ 2015-2022 x64 Runtime DLLs
- Zero external runtime prerequisites (No Node.js, npm, Python, or Git required on customer PC)

## Quick Installation on Windows 10/11
1. Extract or download this folder to the restaurant Windows PC.
2. Right-click **Install-RestaurantOS.bat** and select **Run as administrator**.
3. The installer will:
   - Install binaries into: C:\\Program Files\\RestaurantOS\\
   - Provision data and backups at: C:\\ProgramData\\RestaurantOS\\
   - Configure Windows Firewall for Port 3000 on private Wi-Fi
   - Configure RestaurantOS to start automatically on Windows boot
   - Open your browser to http://localhost:3000/hub

## Connecting Waiters & Kitchen Displays
- Connect your waiter tablets and phones to the same restaurant Wi-Fi.
- Open the browser on any phone/tablet and navigate to: http://<LAN_IP>:3000
- Or scan the QR Code displayed on the RestaurantOS Local Hub Status screen!
- Add the app to your home screen (PWA).

## Data Safety Guarantee
- Upgrades and uninstalls NEVER delete your customer data or automated backups in C:\\ProgramData\\RestaurantOS.
`;
  fs.writeFileSync(path.join(PKG_DIR, 'README-WINDOWS.txt'), windowsReadme, 'utf-8');

  console.log('====================================================');
  console.log('✓ WINDOWS PACKAGE SUCCESSFULLY BUILT & PACKAGED!');
  console.log(`✓ Package Location: ${PKG_DIR}`);
  console.log(`✓ Embedded Runtime: ${path.join(APP_OUT, 'runtime', 'node.exe')}`);
  console.log(`✓ Runtime Modules:  ${destModules}`);
  console.log('====================================================');
}

buildPackage().catch(err => {
  console.error('[FATAL] Package build failed:', err);
  process.exit(1);
});
