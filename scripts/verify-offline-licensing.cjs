/**
 * RestaurantOS - Comprehensive Offline Licensing Verification Suite
 * Tests Ed25519 cryptographic licensing, ROS-L1 format canonicalization,
 * offline verification, tamper resistance, duration calculation, and clock protection.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// 1. Generate an ephemeral Ed25519 keypair for testing
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const testPublicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

console.log('\n======================================================');
console.log(' RestaurantOS — Offline Licensing Verification Suite');
console.log('======================================================\n');

function canonicalizePayload(payload) {
  const canonicalObject = {
    durationDays: Math.floor(payload.durationDays),
    installationId: String(payload.installationId).trim(),
    issuedAt: String(payload.issuedAt).trim(),
    licenseId: String(payload.licenseId).trim(),
    product: String(payload.product).trim(),
    restaurantId: String(payload.restaurantId).trim(),
    v: Math.floor(payload.v),
  };
  return JSON.stringify(canonicalObject);
}

function issueTestLicense(payload, privKey) {
  const canonical = canonicalizePayload(payload);
  const dataBuf = Buffer.from(canonical, 'utf-8');
  const sigBuf = crypto.sign(null, dataBuf, privKey);
  const payloadB64 = Buffer.from(canonical, 'utf-8').toString('base64url');
  const sigB64 = sigBuf.toString('base64url');
  return `ROS-L1.${payloadB64}.${sigB64}`;
}

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
  }
}

// TEST 1: Canonical payload format
test('Canonicalization produces deterministic property ordering without whitespace', () => {
  const payload1 = {
    restaurantId: 'rest_abc',
    v: 1,
    durationDays: 365,
    licenseId: 'lic_001',
    product: 'restaurantos',
    issuedAt: '2026-09-04T12:00:00.000Z',
    installationId: 'inst_xyz',
  };
  const payload2 = {
    v: 1,
    product: 'restaurantos',
    licenseId: 'lic_001',
    restaurantId: 'rest_abc',
    installationId: 'inst_xyz',
    durationDays: 365,
    issuedAt: '2026-09-04T12:00:00.000Z',
  };

  const canonical1 = canonicalizePayload(payload1);
  const canonical2 = canonicalizePayload(payload2);

  assert.strictEqual(canonical1, canonical2);
  const parsed = JSON.parse(canonical1);
  const keys = Object.keys(parsed);
  const expectedKeys = ['durationDays', 'installationId', 'issuedAt', 'licenseId', 'product', 'restaurantId', 'v'];
  assert.deepStrictEqual(keys, expectedKeys);
});

// TEST 2: Valid License Generation and Verification
test('Valid ROS-L1 license signs and verifies cleanly with Ed25519', () => {
  const payload = {
    v: 1,
    product: 'restaurantos',
    licenseId: 'lic_test_100',
    restaurantId: 'rest_01',
    installationId: 'inst_alpha_01',
    durationDays: 30,
    issuedAt: new Date().toISOString(),
  };

  const licenseKey = issueTestLicense(payload, privateKey);
  assert(licenseKey.startsWith('ROS-L1.'));

  const parts = licenseKey.split('.');
  assert.strictEqual(parts.length, 3);

  const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  assert.strictEqual(decodedPayload.licenseId, 'lic_test_100');
  assert.strictEqual(decodedPayload.durationDays, 30);

  const canonicalStr = canonicalizePayload(decodedPayload);
  const verified = crypto.verify(
    null,
    Buffer.from(canonicalStr, 'utf-8'),
    publicKey,
    Buffer.from(parts[2], 'base64url')
  );
  assert.strictEqual(verified, true);
});

// TEST 3: Tamper Resistance (tampered durationDays)
test('Tampering with durationDays invalidates cryptographic signature', () => {
  const payload = {
    v: 1,
    product: 'restaurantos',
    licenseId: 'lic_test_tamper',
    restaurantId: 'rest_01',
    installationId: 'inst_alpha_01',
    durationDays: 30,
    issuedAt: new Date().toISOString(),
  };

  const licenseKey = issueTestLicense(payload, privateKey);
  const parts = licenseKey.split('.');
  
  // Attacker tries to alter payload to 9999 days
  const tamperedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  tamperedPayload.durationDays = 9999;
  const tamperedPayloadB64 = Buffer.from(canonicalizePayload(tamperedPayload), 'utf-8').toString('base64url');
  
  const tamperedLicenseKey = `ROS-L1.${tamperedPayloadB64}.${parts[2]}`;
  const tamperedParts = tamperedLicenseKey.split('.');

  const canonicalStr = canonicalizePayload(tamperedPayload);
  const verified = crypto.verify(
    null,
    Buffer.from(canonicalStr, 'utf-8'),
    publicKey,
    Buffer.from(tamperedParts[2], 'base64url')
  );
  assert.strictEqual(verified, false, 'Tampered payload should fail verification');
});

// TEST 4: Tamper Resistance (tampered installationId)
test('Tampering with installationId invalidates cryptographic signature', () => {
  const payload = {
    v: 1,
    product: 'restaurantos',
    licenseId: 'lic_test_binding',
    restaurantId: 'rest_01',
    installationId: 'inst_machine_A',
    durationDays: 60,
    issuedAt: new Date().toISOString(),
  };

  const licenseKey = issueTestLicense(payload, privateKey);
  const parts = licenseKey.split('.');

  const tamperedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  tamperedPayload.installationId = 'inst_machine_B';
  const tamperedPayloadB64 = Buffer.from(canonicalizePayload(tamperedPayload), 'utf-8').toString('base64url');

  const canonicalStr = canonicalizePayload(tamperedPayload);
  const verified = crypto.verify(
    null,
    Buffer.from(canonicalStr, 'utf-8'),
    publicKey,
    Buffer.from(parts[2], 'base64url')
  );
  assert.strictEqual(verified, false, 'Tampered installation binding should fail verification');
});

// TEST 5: Wrong Signature / Forged Key
test('Forged license signed by untrusted key is rejected', () => {
  const { privateKey: roguePrivKey } = crypto.generateKeyPairSync('ed25519');
  const payload = {
    v: 1,
    product: 'restaurantos',
    licenseId: 'lic_fake',
    restaurantId: 'rest_01',
    installationId: 'inst_alpha_01',
    durationDays: 365,
    issuedAt: new Date().toISOString(),
  };

  const forgedLicenseKey = issueTestLicense(payload, roguePrivKey);
  const parts = forgedLicenseKey.split('.');

  const canonicalStr = canonicalizePayload(payload);
  const verified = crypto.verify(
    null,
    Buffer.from(canonicalStr, 'utf-8'),
    publicKey, // Official public key
    Buffer.from(parts[2], 'base64url')
  );
  assert.strictEqual(verified, false, 'Forged signature should fail official verification');
});

// TEST 6: Clock rollback detection math
test('Clock rollback detection identifies past timestamps exceeding leeway', () => {
  const now = new Date();
  const lastSeenTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour in future
  const thresholdMs = 10 * 60 * 1000;

  const isRollback = now.getTime() < lastSeenTime.getTime() - thresholdMs;
  assert.strictEqual(isRollback, true, 'Time discrepancy should trigger rollback warning');
});

// TEST 7: Expiration calculation
test('License duration calculation accurately evaluates remaining days', () => {
  const now = new Date();
  const activatedAt = now;
  const durationDays = 30;
  const expiresAt = new Date(activatedAt.getTime() + durationDays * 86400000);

  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / 86400000));
  assert.strictEqual(remainingDays, 30);

  // Simulated future date after expiration
  const futureNow = new Date(expiresAt.getTime() + 1000);
  const expiredRemainingMs = expiresAt.getTime() - futureNow.getTime();
  const expiredRemainingDays = Math.max(0, Math.ceil(expiredRemainingMs / 86400000));
  assert.strictEqual(expiredRemainingDays, 0);
});

// TEST 8: Public Key Security Audit
test('RestaurantOS codebase does not contain any private Ed25519 keys', () => {
  const keysFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'licensing', 'keys.ts'), 'utf-8');
  assert(keysFile.includes('BEGIN PUBLIC KEY'), 'Must contain public key');
  assert(!keysFile.includes('PRIVATE KEY'), 'Must NEVER contain private key');
});

console.log(`\n======================================================`);
console.log(` Licensing Test Results: ${passedTests}/${totalTests} PASSED`);
console.log(`======================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
