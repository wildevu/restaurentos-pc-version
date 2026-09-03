import { db } from '../src/db/index';
import { restaurants, users, sessions } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = 'http://localhost:3000';

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('========================================================');
  console.log('🚀 RUNNING RESTAURANTOS FIRST-RUN & LIFECYCLE TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // --- STEP 0: Reset DB to Fresh State using Development Reset API ---
  console.log('\n--- Step 0: Reset Database to Fresh State ---');
  const resetFail = await request('/api/auth/dev-reset-database', {
    method: 'POST',
    body: JSON.stringify({ confirmation: 'WRONG_CONFIRMATION' })
  });
  assert(resetFail.status === 400, 'Dev reset rejects invalid confirmation');

  const resetOk = await request('/api/auth/dev-reset-database', {
    method: 'POST',
    body: JSON.stringify({ confirmation: 'RESET_LOCAL_DEVELOPMENT_DATABASE' })
  });
  assert(resetOk.ok && resetOk.data?.configured === false, 'Dev reset succeeds with valid confirmation');

  // --- STEP 1: Fresh Database / Status Detection ---
  console.log('\n--- Step 1: Fresh Unconfigured Detection (/api/auth/status) ---');
  const status1 = await request('/api/auth/status');
  assert(
    status1.ok && status1.data.configured === false && status1.data.status === 'UNCONFIGURED',
    'Status endpoint reports unconfigured on fresh database',
    JSON.stringify(status1.data)
  );

  const setupStatus1 = await request('/api/auth/setup-status');
  assert(
    setupStatus1.ok && setupStatus1.data.isInitialized === false,
    'Legacy setup-status reports isInitialized: false'
  );

  // Unconfigured login attempt
  const loginBeforeSetup = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'owner', password: 'password123', deviceId: 'test-device' })
  });
  assert(
    loginBeforeSetup.status === 401,
    'Login on unconfigured database safely fails authentication'
  );

  // --- STEP 2: Setup Input & Security Validations ---
  console.log('\n--- Step 2: Setup Input & Security Validations ---');
  
  // Missing required fields
  const invalidSetup1 = await request('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ restaurantName: 'A' }) // too short
  });
  assert(invalidSetup1.status === 400, 'Setup rejects short restaurant name (< 2 chars)');

  // Weak/short password (< 6 chars)
  const invalidPassword = await request('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({
      restaurantName: 'The French Bistro',
      currency: 'USD',
      timezone: 'America/New_York',
      ownerName: 'Owner User',
      ownerUsername: 'owner',
      ownerPassword: '123' // too short
    })
  });
  assert(invalidPassword.status === 400, 'Setup rejects short password (< 6 chars)');

  // Invalid currency format (must be 3 chars)
  const invalidCurrency = await request('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({
      restaurantName: 'The French Bistro',
      currency: 'DOLLARS',
      timezone: 'America/New_York',
      ownerName: 'Owner User',
      ownerUsername: 'owner',
      ownerPassword: 'securePassword123'
    })
  });
  assert(invalidCurrency.status === 400, 'Setup rejects invalid currency code format');

  // --- STEP 3: Complete First-Run Setup ---
  console.log('\n--- Step 3: Complete First-Run Setup Execution ---');
  const validSetup = await request('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({
      restaurantName: 'Bistro Central',
      currency: 'USD',
      timezone: 'America/New_York',
      tableCount: 8,
      sections: ['Main Dining', 'Patio'],
      ownerName: 'Alex Miller',
      ownerUsername: 'alexowner',
      ownerPassword: 'Password123!'
    })
  });
  assert(
    validSetup.ok && validSetup.data.success === true && !!validSetup.data.token,
    'First-run setup successfully initializes Hub and returns auth token',
    JSON.stringify(validSetup.data)
  );

  const ownerToken = validSetup.data.token;
  const ownerUser = validSetup.data.user;
  assert(ownerUser.role === 'OWNER', 'Returned user role is OWNER');

  // --- STEP 4: Prevent Duplicate Setup ---
  console.log('\n--- Step 4: Prevent Duplicate Setup ---');
  const duplicateSetup = await request('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({
      restaurantName: 'Another Name',
      currency: 'EUR',
      timezone: 'UTC',
      ownerName: 'Other Owner',
      ownerUsername: 'otherowner',
      ownerPassword: 'Password456!'
    })
  });
  assert(
    duplicateSetup.status === 400 && duplicateSetup.data?.error?.includes('already initialized'),
    'Duplicate setup is strictly rejected when already configured'
  );

  // --- STEP 5: Verify Auth Status is CONFIGURED ---
  console.log('\n--- Step 5: Verify Configured Status ---');
  const status2 = await request('/api/auth/status');
  assert(
    status2.ok && status2.data.configured === true && status2.data.restaurantName === 'Bistro Central',
    'Status endpoint now confirms configured: true with restaurant metadata'
  );

  // --- STEP 6: Owner Session & Token Verification (/api/auth/me) ---
  console.log('\n--- Step 6: Verify Owner Session Token ---');
  const meRes = await request('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert(
    meRes.ok && meRes.data.user?.username === 'alexowner' && meRes.data.user?.role === 'OWNER',
    '/api/auth/me validates owner token'
  );

  // --- STEP 7: Admin Panel Operations: Create Staff Accounts ---
  console.log('\n--- Step 7: Create Manager, Waiter, and Kitchen Accounts ---');
  
  // Create Manager
  const createMgr = await request('/api/admin/staff', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name: 'Manager Mary',
      username: 'manager_mary',
      password: 'ManagerPassword123!',
      role: 'MANAGER'
    })
  });
  assert(createMgr.ok && createMgr.data.success === true, 'Created MANAGER user');

  // Create Waiter
  const createWaiter = await request('/api/admin/staff', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name: 'Waiter Sam',
      username: 'waiter_sam',
      password: 'WaiterPassword123!',
      role: 'WAITER'
    })
  });
  assert(createWaiter.ok && createWaiter.data.success === true, 'Created WAITER user');

  // Create Kitchen
  const createKitchen = await request('/api/admin/staff', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({
      name: 'Chef Gordon',
      username: 'chef_gordon',
      password: 'KitchenPassword123!',
      role: 'KITCHEN'
    })
  });
  assert(createKitchen.ok && createKitchen.data.success === true, 'Created KITCHEN user');

  // List all users
  const listUsers = await request('/api/admin/staff', {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert(
    listUsers.ok && Array.isArray(listUsers.data) && listUsers.data.length === 4,
    'Admin user list contains 4 active accounts (Owner, Manager, Waiter, Kitchen)'
  );

  // --- STEP 8: Staff Login & Role Verification ---
  console.log('\n--- Step 8: Staff Logins ---');
  
  // Waiter login
  const waiterLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'waiter_sam',
      password: 'WaiterPassword123!',
      deviceId: 'device-waiter-1'
    })
  });
  assert(waiterLogin.ok && waiterLogin.data.user.role === 'WAITER', 'Waiter login successful');

  // Kitchen login
  const kitchenLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'chef_gordon',
      password: 'KitchenPassword123!',
      deviceId: 'device-kitchen-1'
    })
  });
  assert(kitchenLogin.ok && kitchenLogin.data.user.role === 'KITCHEN', 'Kitchen login successful');

  // --- STEP 9: Logout & Re-login ---
  console.log('\n--- Step 9: Logout & Re-login ---');
  const logoutRes = await request('/api/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${waiterLogin.data.token}` }
  });
  assert(logoutRes.ok, 'Waiter session logout succeeds');

  const meAfterLogout = await request('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${waiterLogin.data.token}` }
  });
  assert(meAfterLogout.status === 401, 'Logged-out token is immediately invalid');

  // Owner Re-login
  const ownerRelogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'alexowner',
      password: 'Password123!',
      deviceId: 'device-owner-desktop'
    })
  });
  assert(ownerRelogin.ok && ownerRelogin.data.user.role === 'OWNER', 'Owner re-login succeeds');

  // --- STEP 10: Verify Setup Never Reappears When Configured ---
  console.log('\n--- Step 10: Verify Setup Never Reappears When Database Has Data ---');
  const finalStatus = await request('/api/auth/status');
  assert(
    finalStatus.ok && finalStatus.data.configured === true && finalStatus.data.status === 'CONFIGURED',
    'Hub remains permanently CONFIGURED across requests'
  );

  console.log('\n========================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
