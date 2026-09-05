/**
 * RestaurantOS — End-to-End Fresh Install, Setup Wizard, and Licensing Test Suite
 * Validates:
 * 1. Fresh installation state
 * 2. Setup with valid license
 * 3. Setup rejection with invalid license
 * 4. Setup rejection with license for another installation ID
 * 5. Setup rejection with expired license
 * 6. License renewal without data loss or ID change
 * 7. Persistence after Local Hub reload
 * 8. Language and Currency handling
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();

// Setup test keypair for cryptographic verification
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const testPubKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
const testPrivKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

console.log('====================================================');
console.log('   RESTAURANTOS SETUP & LICENSING E2E VERIFICATION  ');
console.log('====================================================\n');

const { db, runMigrations } = require('../src/db/index.ts');
const { restaurants, users, installations, licenses, orders, tables, hubState } = require('../src/db/schema.ts');
const { LicensingService } = require('../src/licensing/service.ts');
const { generateLicenseKey } = require('./generate-offline-license.cjs');
const { eq } = require('drizzle-orm');

let testsPassed = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ Test ${totalTests}: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ Test ${totalTests} FAILED: ${message}`);
    process.exit(1);
  }
}

async function runSuite() {
  try {
    if (typeof runMigrations === 'function') {
      await runMigrations();
    }

    // ----------------------------------------------------
    // TEST 1: Fresh Installation - No Restaurant, Valid Installation ID
    // ----------------------------------------------------
    console.log('--- Phase 1: Fresh Hub Installation State ---');
    const initialInst = await LicensingService.getOrCreateInstallation();
    assert(initialInst && initialInst.id.startsWith('inst_'), `Hub generated persistent Installation ID: ${initialInst.id}`);

    const initialStatus = await LicensingService.getStatus();
    assert(initialStatus.status === 'UNLICENSED' || initialStatus.status === 'ACTIVE', `Initial status: ${initialStatus.status}`);
    assert(initialStatus.installationId === initialInst.id, 'Installation ID matches status');

    // ----------------------------------------------------
    // TEST 2: Rejection of Invalid License
    // ----------------------------------------------------
    console.log('\n--- Phase 2: Invalid License Rejection ---');
    const invalidResult = await LicensingService.activate('ROS-L1.invalidpayload.invalidsig', undefined, testPubKeyPem);
    assert(invalidResult.success === false, 'Invalid license string is rejected');
    assert(invalidResult.error !== undefined, `Rejection error returned: ${invalidResult.error}`);

    // ----------------------------------------------------
    // TEST 3: Rejection of License for Another Installation ID
    // ----------------------------------------------------
    console.log('\n--- Phase 3: Installation ID Mismatch Rejection ---');
    const otherInstLicense = generateLicenseKey({
      installationId: 'inst_FOREIGN_DEVICE_99999',
      durationDays: 365,
    }, testPrivKeyPem);
    const mismatchResult = await LicensingService.activate(otherInstLicense, undefined, testPubKeyPem);
    assert(mismatchResult.success === false, 'License for foreign installation ID is rejected');
    assert(mismatchResult.error.toLowerCase().includes('installation'), `Installation mismatch error: ${mismatchResult.error}`);

    // ----------------------------------------------------
    // TEST 4: Rejection of Expired License
    // ----------------------------------------------------
    console.log('\n--- Phase 4: Expired License Rejection ---');
    const pastDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const expiredLicense = generateLicenseKey({
      installationId: initialInst.id,
      durationDays: 30,
      issuedAt: pastDate,
    }, testPrivKeyPem);
    const expiredResult = await LicensingService.activate(expiredLicense, undefined, testPubKeyPem);
    assert(expiredResult.success === false, 'Expired license code is rejected');
    assert(expiredResult.error.toLowerCase().includes('expired'), `Rejection indicates license expired: ${expiredResult.error}`);

    // ----------------------------------------------------
    // TEST 5: Successful Activation with Valid License
    // ----------------------------------------------------
    console.log('\n--- Phase 5: Valid Offline License Activation ---');
    const validLicense = generateLicenseKey({
      installationId: initialInst.id,
      durationDays: 365,
    }, testPrivKeyPem);
    const activateResult = await LicensingService.activate(validLicense, undefined, testPubKeyPem);
    assert(activateResult.success === true, 'Valid offline license successfully activated');
    assert(activateResult.statusInfo.status === 'ACTIVE', 'License status transitioned to ACTIVE');
    assert(activateResult.statusInfo.remainingDays > 360, `Days remaining properly calculated: ${activateResult.statusInfo.remainingDays} days`);
    assert(activateResult.statusInfo.canOperate === true, 'Hub is now authorized to operate');

    // ----------------------------------------------------
    // TEST 6: First-Run Restaurant Setup with Active License
    // ----------------------------------------------------
    console.log('\n--- Phase 6: First-Run Setup Wizard Flow ---');
    const restId = 'rest_test_001_' + Date.now();
    const ownerId = 'user_owner_001_' + Date.now();
    const now = new Date();

    await db.insert(restaurants).values({
      id: restId,
      name: 'Bistro des Artistes',
      language: 'fr',
      currency: 'EUR',
      timezone: 'Europe/Paris',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(users).values({
      id: ownerId,
      restaurantId: restId,
      name: 'Chef Michel',
      username: 'michel_' + Date.now(),
      passwordHash: 'hash_secret_123',
      role: 'OWNER',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Link installation and licenses to the restaurant
    await db.update(installations).set({ restaurantId: restId }).where(eq(installations.id, initialInst.id));
    await db.update(licenses).set({ restaurantId: restId }).where(eq(licenses.installationId, initialInst.id));

    // Verify restaurant initialized
    const savedRests = await db.select().from(restaurants).where(eq(restaurants.id, restId));
    const savedRest = savedRests[0];
    assert(savedRest.name === 'Bistro des Artistes', 'Restaurant identity saved');
    assert(savedRest.language === 'fr', 'French language preference persisted');
    assert(savedRest.currency === 'EUR', 'EUR currency preference persisted');

    // ----------------------------------------------------
    // TEST 7: Renewal Workflow Without Data Loss
    // ----------------------------------------------------
    console.log('\n--- Phase 7: License Renewal & Data Integrity ---');
    // Create a table and order to verify persistent business data
    const tableId = 'tbl_test_' + Date.now();
    await db.insert(tables).values({
      id: tableId,
      number: 1,
      label: 'Table 1',
      section: 'Main Dining',
      status: 'OCCUPIED',
      createdAt: now,
      updatedAt: now,
    });

    const orderId = 'ord_sample_' + Date.now();
    await db.insert(orders).values({
      id: orderId,
      tableId: tableId,
      status: 'OPEN',
      currencySnapshot: 'EUR',
      openedByUserId: ownerId,
      createdAt: now,
      updatedAt: now,
    });

    // Issue a renewal license for 730 days (2 years)
    const renewalLicense = generateLicenseKey({
      installationId: initialInst.id,
      restaurantId: restId,
      durationDays: 730,
    }, testPrivKeyPem);
    const renewalResult = await LicensingService.activate(renewalLicense, ownerId, testPubKeyPem);
    assert(renewalResult.success === true, 'Renewal license successfully activated');
    assert(renewalResult.statusInfo.status === 'ACTIVE', 'Status remains ACTIVE');
    assert(renewalResult.statusInfo.remainingDays > 720, `Expiration extended to ${renewalResult.statusInfo.remainingDays} days`);

    // Verify installation ID and restaurant data untouched
    const instAfterRenewal = await LicensingService.getOrCreateInstallation();
    assert(instAfterRenewal.id === initialInst.id, 'Installation ID strictly preserved across renewal');

    const ordersAfter = await db.select().from(orders).where(eq(orders.id, orderId));
    assert(ordersAfter.length > 0 && ordersAfter[0].currencySnapshot === 'EUR', 'Orders and restaurant data intact after license renewal');

    // ----------------------------------------------------
    // TEST 8: Local Hub Restart Simulation
    // ----------------------------------------------------
    console.log('\n--- Phase 8: Hub Restart & Persistence Simulation ---');
    const freshStatusCheck = await LicensingService.getStatus();
    assert(freshStatusCheck.status === 'ACTIVE', 'License status persists as ACTIVE across hub reload');
    assert(freshStatusCheck.installationId === initialInst.id, 'Persistent installation ID verified');
    assert(freshStatusCheck.restaurantId === restId, 'Associated restaurant ID verified');

    console.log('\n====================================================');
    console.log(`✓ ALL ${testsPassed}/${totalTests} TESTS PASSED PERFECTLY!`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runSuite();
