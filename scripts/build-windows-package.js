import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PKG_DIR = path.join(DIST_DIR, 'windows-package');
const APP_OUT = path.join(PKG_DIR, 'RestaurantOS');

console.log('====================================================');
console.log('   RESTAURANTOS WINDOWS PACKAGE BUILD PIPELINE      ');
console.log('====================================================');

// 1. Clean previous package folder before building
if (fs.existsSync(PKG_DIR)) {
  fs.rmSync(PKG_DIR, { recursive: true, force: true });
}

// 2. Build Client and Server Bundles
console.log('[1/5] Compiling production frontend and backend bundles...');
execSync('npm run build', { stdio: 'inherit' });

// 3. Prepare Package Directory Structure
console.log('[2/5] Creating Windows deployment layout...');
fs.mkdirSync(APP_OUT, { recursive: true });

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

// 4. Copy Application Assets to Windows Bundle
console.log('[3/5] Bundling server, PWA assets, and migration schemas...');
fs.copyFileSync(path.join(DIST_DIR, 'server.cjs'), path.join(APP_OUT, 'server.cjs'));
fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(APP_OUT, 'package.json'));

// Copy static PWA frontend (excluding windows-package)
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
fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'install.bat'), path.join(PKG_DIR, 'Install-RestaurantOS.bat'));
fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'uninstall.bat'), path.join(PKG_DIR, 'Uninstall-RestaurantOS.bat'));
fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'install.ps1'), path.join(PKG_DIR, 'install.ps1'));
fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'uninstall.ps1'), path.join(PKG_DIR, 'uninstall.ps1'));
fs.copyFileSync(path.join(ROOT_DIR, 'windows', 'installer', 'RestaurantOS-Setup.iss'), path.join(PKG_DIR, 'RestaurantOS-Setup.iss'));

// 5. Generate Windows Configuration Template
console.log('[4/5] Writing Windows deployment configuration template...');
const configTemplate = `# RestaurantOS Local Hub Configuration
# Placed in C:\\ProgramData\\RestaurantOS\\config\\restaurantos.env
NODE_ENV=production
PORT=3000
# DB_PATH=C:\\ProgramData\\RestaurantOS\\data\\restaurantos.db
# BACKUP_DIR=C:\\ProgramData\\RestaurantOS\\backups
# LOG_DIR=C:\\ProgramData\\RestaurantOS\\logs
`;
fs.writeFileSync(path.join(APP_OUT, 'restaurantos.env.template'), configTemplate, 'utf-8');

// Write Windows README
const windowsReadme = `# RestaurantOS Local Hub for Windows

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

console.log('[5/5] Packaging completed successfully!');
console.log(`Package output located at: ${PKG_DIR}`);
console.log('====================================================');
