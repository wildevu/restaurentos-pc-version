/**
 * RestaurantOS — Comprehensive Licensing Subsystem Audit
 * 
 * Verifies all security, cryptographic, operational, and edge-case behaviors
 * of the offline licensing engine.
 */

const crypto = require('crypto');
const { canonicalizePayload, generateLicenseKey } = require('./generate-offline-license.cjs');

// Generate test Ed25519 keypair for end-to-end verification
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pubKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
const privKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

let passed = 0;
let failed = 0;

function check(title, condition, detail) {
  if (condition) {
    console.log(`  [PASS] ${title}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${title} - ${detail || 'Assertion failed'}`);
    failed++;
  }
}

async function runAudit() {
  console.log('====================================================');
  console.log('       RESTAURANTOS LICENSING SUBSYSTEM AUDIT       ');
  console.log('====================================================\n');

  // Test 1: Canonical Payload Serialization & Property Ordering
  console.log('--- 1. Cryptographic Canonicalization ---');
  const payloadA = {
    restaurantId: 'rest_001',
    installationId: 'inst_abc123',
    issuedAt: '2026-09-07T08:00:00.000Z',
    durationDays: 365,
    v: 1,
    product: 'restaurantos',
    licenseId: 'lic_xyz789',
  };
  const payloadB = {
    product: 'restaurantos',
    licenseId: 'lic_xyz789',
    v: 1,
    durationDays: 365,
    issuedAt: '2026-09-07T08:00:00.000Z',
    installationId: 'inst_abc123',
    restaurantId: 'rest_001',
  };

  const canonA = canonicalizePayload(payloadA);
  const canonB = canonicalizePayload(payloadB);
  check('Canonicalization produces byte-identical strings regardless of object property order', canonA === canonB);
  check('Canonical string contains required sorted keys with no whitespace', canonA.startsWith('{"durationDays":365,"installationId":'));

  // Test 2: Signing and Verification Roundtrip
  console.log('\n--- 2. Cryptographic Signing & Verification ---');
  const validKey = generateLicenseKey(payloadA, privKeyPem);
  check('Generated license key format adheres to ROS-L1.<payload>.<sig>', validKey.startsWith('ROS-L1.') && validKey.split('.').length === 3);

  const parts = validKey.split('.');
  const sigBuf = Buffer.from(parts[2], 'base64url');
  const dataBuf = Buffer.from(canonA, 'utf-8');
  const sigVerify = crypto.verify(null, dataBuf, pubKeyPem, sigBuf);
  check('Raw Ed25519 signature verifies against public key', sigVerify === true);

  // Test 3: Tamper Detection
  console.log('\n--- 3. Tamper Resistance ---');
  // Tamper duration from 365 to 999
  const tamperedPayload = { ...payloadA, durationDays: 999 };
  const tamperedCanon = canonicalizePayload(tamperedPayload);
  const tamperedPayloadB64 = Buffer.from(tamperedCanon, 'utf-8').toString('base64url');
  const tamperedKey = `ROS-L1.${tamperedPayloadB64}.${parts[2]}`;

  const tamperedVerify = crypto.verify(null, Buffer.from(tamperedCanon, 'utf-8'), pubKeyPem, sigBuf);
  check('Tampered payload is cryptographically rejected', tamperedVerify === false);

  // Test 4: Live HTTP Local Hub Verification
  console.log('\n--- 4. Live Hub HTTP API Verification ---');
  try {
    const instRes = await fetch('http://127.0.0.1:3000/api/licensing/installation');
    check('GET /api/licensing/installation returns 200 OK', instRes.status === 200);
    const instData = await instRes.json();
    check('Installation ID starts with inst_ and has >= 20 chars', instData.installationId && instData.installationId.startsWith('inst_') && instData.installationId.length >= 20);

    const statusRes = await fetch('http://127.0.0.1:3000/api/licensing/status');
    check('GET /api/licensing/status returns 200 OK', statusRes.status === 200);
    const statusData = await statusRes.json();
    check('Status contains valid lifecycle enum (ACTIVE, UNLICENSED, etc.)', ['ACTIVE', 'UNLICENSED', 'EXPIRED', 'CLOCK_ROLLBACK_DETECTED'].includes(statusData.status));

    // Test 5: Rejection of Garbage / Malformed Keys
    console.log('\n--- 5. Malformed & Invalid Key Rejection ---');
    const badKeyRes = await fetch('http://127.0.0.1:3000/api/licensing/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: 'NOT-A-LICENSE-KEY' }),
    });
    check('Malformed license key returns HTTP 400 Bad Request', badKeyRes.status === 400);
    const badKeyData = await badKeyRes.json();
    check('Error detail explains malformed format', badKeyData.error && badKeyData.error.includes('Malformed license format'));

    // Test 6: Rejection of Empty or Missing Key
    const emptyKeyRes = await fetch('http://127.0.0.1:3000/api/licensing/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: '' }),
    });
    check('Empty license key returns HTTP 400 Bad Request', emptyKeyRes.status === 400);

    // Test 7: Rejection of Wrong Product Key
    const wrongProductPayload = {
      product: 'someotherapp',
      licenseId: 'lic_bad_prod',
      installationId: instData.installationId,
      restaurantId: 'rest_001',
      durationDays: 30,
      issuedAt: new Date().toISOString(),
      v: 1,
    };
    const wrongProdKey = generateLicenseKey(wrongProductPayload, privKeyPem);
    const wrongProdRes = await fetch('http://127.0.0.1:3000/api/licensing/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: wrongProdKey }),
    });
    check('Wrong product license returns HTTP 400', wrongProdRes.status === 400);

  } catch (netErr) {
    check('Local Hub server reachable', false, netErr.message);
  }

  // Test 8: Public Key Integrity Audit
  console.log('\n--- 6. Public Key & Security Integrity ---');
  const fs = require('fs');
  const path = require('path');
  const keysContent = fs.readFileSync(path.join(__dirname, '../src/licensing/keys.ts'), 'utf-8');
  check('keys.ts contains official Master Public Key', keysContent.includes('RESTAURANTOS_PRODUCTION_PUBLIC_KEY'));
  check('keys.ts contains NO private keys', !keysContent.includes('PRIVATE KEY'));

  const codebaseSearch = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf-8');
  check('server.ts contains NO private keys', !codebaseSearch.includes('PRIVATE KEY'));

  console.log('\n====================================================');
  console.log(`AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

runAudit().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
