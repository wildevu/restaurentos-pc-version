/**
 * Translation Keys & UX Audit Script
 * Scans all frontend files for raw t('...') calls and verifies they exist in en.ts & fr.ts.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const enFile = fs.readFileSync(path.join(ROOT, 'src/i18n/en.ts'), 'utf-8');
const frFile = fs.readFileSync(path.join(ROOT, 'src/i18n/fr.ts'), 'utf-8');

console.log('====================================================');
console.log('   RESTAURANTOS TRANSLATIONS & UX AUDIT PIPELINE    ');
console.log('====================================================\n');

// Extract all keys from object structure recursively
function extractKeys(content) {
  const keys = new Set();
  // Match key patterns like key: 'val' or nested groups
  const lines = content.split('\n');
  let currentGroup = '';

  for (const line of lines) {
    const groupMatch = line.match(/^\s*([a-zA-Z0-9_]+):\s*\{/);
    if (groupMatch) {
      currentGroup = groupMatch[1];
      continue;
    }
    const keyMatch = line.match(/^\s*([a-zA-Z0-9_]+):\s*['"`]/);
    if (keyMatch && currentGroup) {
      keys.add(`${currentGroup}.${keyMatch[1]}`);
    } else if (keyMatch) {
      keys.add(keyMatch[1]);
    }
  }
  return keys;
}

const enKeys = extractKeys(enFile);
const frKeys = extractKeys(frFile);

console.log(`[i18n] English keys loaded: ${enKeys.size}`);
console.log(`[i18n] French keys loaded: ${frKeys.size}`);

// Scan all TSX and TS files in src/
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, fileList);
    } else if (file.endsWith('.tsx') || (file.endsWith('.ts') && !file.includes('/i18n/'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const srcFiles = getFiles(path.join(ROOT, 'src'));
console.log(`[Scan] Scanning ${srcFiles.length} frontend source files for translation calls...\n`);

let missingInEn = 0;
let missingInFr = 0;
const usedKeys = new Set();

for (const file of srcFiles) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf-8');
  
  // Find all t('key.path') or t("key.path")
  const matches = content.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g);
  for (const match of matches) {
    const key = match[1];
    usedKeys.add(key);

    if (!enKeys.has(key)) {
      console.warn(`  ⚠ Missing in en.ts: "${key}" used in ${relPath}`);
      missingInEn++;
    }
    if (!frKeys.has(key)) {
      console.warn(`  ⚠ Missing in fr.ts: "${key}" used in ${relPath}`);
      missingInFr++;
    }
  }
}

console.log(`\n[Audit Results]`);
console.log(`- Unique translation keys referenced in UI: ${usedKeys.size}`);
console.log(`- Missing in English (en.ts): ${missingInEn}`);
console.log(`- Missing in French (fr.ts): ${missingInFr}`);

if (missingInEn === 0 && missingInFr === 0) {
  console.log(`\n✓ All ${usedKeys.size} translation keys are 100% synchronized and verified across English and French.`);
  process.exit(0);
} else {
  console.error(`\n✗ Found missing translation keys.`);
  process.exit(1);
}
