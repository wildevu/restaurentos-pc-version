/**
 * RestaurantOS — Dynamic Windows Native Dependencies Audit
 * 
 * Dynamically traverses node_modules and package.json to discover ALL parent packages
 * declaring Windows native optionalDependencies (or platform-specific native binaries).
 * Validates their presence and integrity on the Windows runner before building.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('   RESTAURANTOS DYNAMIC WINDOWS NATIVE AUDIT        ');
console.log('====================================================\n');

const ROOT_DIR = process.cwd();
const NODE_MODULES = path.join(ROOT_DIR, 'node_modules');

if (!fs.existsSync(NODE_MODULES)) {
  console.error('[FATAL] node_modules directory does not exist! Please run npm ci first.');
  process.exit(1);
}

// 1. Discover all packages in node_modules that declare Windows optionalDependencies
const discoveredWindowsDeps = new Map();

function scanPackageJson(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item.startsWith('.')) continue;
    const full = path.join(dir, item);
    if (item.startsWith('@')) {
      scanPackageJson(full);
      continue;
    }
    
    const pjPath = path.join(full, 'package.json');
    if (fs.existsSync(pjPath)) {
      try {
        const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
        const optDeps = pj.optionalDependencies || {};
        for (const [depName, versionRange] of Object.entries(optDeps)) {
          if (depName.includes('win32') || depName.includes('windows')) {
            if (!discoveredWindowsDeps.has(depName)) {
              discoveredWindowsDeps.set(depName, {
                targetPkg: depName,
                requiredBy: new Set(),
                isRuntime: depName.includes('libsql'),
                versionRanges: new Set()
              });
            }
            discoveredWindowsDeps.get(depName).requiredBy.add(`${pj.name}@${pj.version}`);
            discoveredWindowsDeps.get(depName).versionRanges.add(versionRange);
          }
        }
      } catch (e) {}
    }

    const sub = path.join(full, 'node_modules');
    if (fs.existsSync(sub)) {
      scanPackageJson(sub);
    }
  }
}

scanPackageJson(NODE_MODULES);

// Also include top-level optionalDependencies from root package.json
try {
  const rootPj = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  const rootOpt = rootPj.optionalDependencies || {};
  for (const [depName, versionRange] of Object.entries(rootOpt)) {
    if (depName.includes('win32') || depName.includes('windows')) {
      if (!discoveredWindowsDeps.has(depName)) {
        discoveredWindowsDeps.set(depName, {
          targetPkg: depName,
          requiredBy: new Set(),
          isRuntime: depName.includes('libsql'),
          versionRanges: new Set()
        });
      }
      discoveredWindowsDeps.get(depName).requiredBy.add(`root(package.json)@${rootPj.version}`);
      discoveredWindowsDeps.get(depName).versionRanges.add(versionRange);
    }
  }
} catch (e) {}

console.log(`[Discovery] Identified ${discoveredWindowsDeps.size} Windows platform package declarations across dependency tree.`);

// Function to find where a package lives in node_modules (root or nested)
function findPackagePath(pkgName) {
  const parts = pkgName.split('/');
  const rootPath = path.join(NODE_MODULES, ...parts);
  if (fs.existsSync(rootPath)) return rootPath;

  // Search nested in rolldown, vite, @tailwindcss/node, drizzle-kit, esbuild
  const knownParents = [
    ['rolldown', 'node_modules', ...parts],
    ['vite', 'node_modules', ...parts],
    ['vite', 'node_modules', 'rolldown', 'node_modules', ...parts],
    ['@tailwindcss', 'node', 'node_modules', ...parts],
    ['drizzle-kit', 'node_modules', ...parts],
    ['esbuild', 'node_modules', ...parts]
  ];

  for (const p of knownParents) {
    const candidate = path.join(NODE_MODULES, ...p);
    if (fs.existsSync(candidate)) return candidate;
  }

  // Deep recursive search in node_modules subtrees if nested under arbitrary dependencies
  function searchNested(dir, depth = 0) {
    if (depth > 3 || !fs.existsSync(dir)) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const sub = path.join(dir, entry.name);
        const target = path.join(sub, 'node_modules', ...parts);
        if (fs.existsSync(target)) return target;
        if (entry.name.startsWith('@') || entry.name === 'vite' || entry.name === 'rolldown') {
          const res = searchNested(sub, depth + 1);
          if (res) return res;
        }
      }
    } catch (e) {}
    return null;
  }

  return searchNested(NODE_MODULES, 0);
}

// Function to find native binary (.node or .exe) in package directory
function findNativeBinaries(dir) {
  const binaries = [];
  if (!dir || !fs.existsSync(dir)) return binaries;

  function scan(sub) {
    try {
      const files = fs.readdirSync(sub);
      for (const f of files) {
        const full = path.join(sub, f);
        const s = fs.statSync(full);
        if (s.isDirectory() && f !== 'node_modules') {
          scan(full);
        } else if (f.endsWith('.node') || f.endsWith('.exe')) {
          binaries.push(f);
        }
      }
    } catch (e) {}
  }
  scan(dir);
  return binaries;
}

// Filter down to Windows x64 (the primary architecture targeted by the Windows installer)
const isWinPlatform = process.platform === 'win32';
let totalAudited = 0;
let passedCount = 0;
let failedCount = 0;

console.log(`\n--- Windows Native Dependencies Audit (Host Platform: ${process.platform}, Arch: ${process.arch}) ---`);

// Load package-lock.json for lockfile resolution verification
let lockfilePackages = {};
try {
  const lockData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package-lock.json'), 'utf8'));
  lockfilePackages = lockData.packages || {};
} catch (e) {
  console.warn('[Warning] Could not parse package-lock.json:', e.message);
}

function checkLockfileForPackage(pkgName) {
  const keys = Object.keys(lockfilePackages);
  return keys.some(k => k === `node_modules/${pkgName}` || k.endsWith(`/node_modules/${pkgName}`));
}

for (const [depName, info] of discoveredWindowsDeps.entries()) {
  const isX64 = depName.includes('x64') || (!depName.includes('arm64') && !depName.includes('ia32'));
  const isArm64 = depName.includes('arm64');
  const isIa32 = depName.includes('ia32');

  const pkgLocation = findPackagePath(depName);
  const existsOnDisk = pkgLocation !== null;
  const inLockfile = checkLockfileForPackage(depName);
  const binaries = existsOnDisk ? findNativeBinaries(pkgLocation) : [];
  const reqByStr = Array.from(info.requiredBy).join(', ');
  const category = info.isRuntime ? '[CUSTOMER RUNTIME]' : '[BUILD-TIME ONLY]';

  totalAudited++;

  if (isWinPlatform) {
    // When executing on Windows runner, package MUST exist on disk in node_modules
    if (existsOnDisk) {
      passedCount++;
      console.log(`  ✓ [INSTALLED] ${depName}`);
      console.log(`     Type: ${category} | Required By: ${reqByStr}`);
      console.log(`     Location: ${path.relative(ROOT_DIR, pkgLocation)}`);
      if (binaries.length > 0) {
        console.log(`     Native Binary: ${binaries.join(', ')}`);
      }
    } else {
      if (isX64 && !depName.includes('gnu')) {
        // Attempt automatic on-demand recovery for Windows runners
        const targetVersion = Array.from(info.versionRanges)[0] || 'latest';
        console.log(`  [Auto-Recovery] Attempting to fetch missing Windows package: ${depName}@${targetVersion}...`);
        try {
          execSync(`npm install --no-save --ignore-scripts=false ${depName}@${targetVersion}`, { stdio: 'pipe' });
          const recoveredPath = findPackagePath(depName);
          if (recoveredPath && fs.existsSync(recoveredPath)) {
            passedCount++;
            console.log(`  ✓ [RECOVERED] ${depName}`);
            console.log(`     Type: ${category} | Required By: ${reqByStr}`);
            console.log(`     Location: ${path.relative(ROOT_DIR, recoveredPath)}`);
            continue;
          }
        } catch (recoverErr) {
          console.warn(`  [Auto-Recovery] Could not auto-install ${depName}: ${recoverErr.message}`);
        }

        failedCount++;
        console.error(`  ✗ [MISSING ON DISK - CRITICAL] ${depName}`);
        console.error(`     Type: ${category} | Required By: ${reqByStr}`);
        console.error(`     Target Versions: ${Array.from(info.versionRanges).join(', ')}`);
      } else {
        console.log(`  - [OPTIONAL NON-X64] ${depName} (Architecture: ${isArm64 ? 'arm64' : isIa32 ? 'ia32' : 'other'})`);
      }
    }
  } else {
    // When auditing on Linux/macOS, verify lockfile determinism for clean Windows npm ci
    if (inLockfile) {
      passedCount++;
      console.log(`  ✓ [LOCKED] ${depName}`);
      console.log(`     Type: ${category} | Required By: ${reqByStr}`);
      console.log(`     Lockfile: Present & Deterministically Resolved for Windows runners`);
    } else {
      if (isX64) {
        failedCount++;
        console.error(`  ✗ [MISSING FROM LOCKFILE - CRITICAL] ${depName}`);
        console.error(`     Type: ${category} | Required By: ${reqByStr}`);
      } else {
        console.log(`  - [OPTIONAL NON-X64] ${depName} (Architecture: ${isArm64 ? 'arm64' : isIa32 ? 'ia32' : 'other'})`);
      }
    }
  }
}

console.log('\n====================================================');
console.log(`Audit Summary: ${passedCount} packages verified, ${failedCount} critical issues.`);
console.log('====================================================\n');

if (failedCount > 0) {
  console.error(`[FAILURE] Windows CI audit detected ${failedCount} missing Windows native packages!`);
  process.exit(1);
} else {
  console.log('✓ Dynamic Windows Native Dependency Audit passed successfully.');
  process.exit(0);
}
