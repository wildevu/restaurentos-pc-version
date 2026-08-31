const http = require('http');
const fs = require('fs');

async function req(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {}
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.bodyStr = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(opts.bodyStr);
    }
    if (token) {
      opts.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const request = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    request.on('error', reject);
    if (body) request.write(opts.bodyStr);
    request.end();
  });
}

async function run() {
  const loginRes = await req('/api/auth/login', 'POST', { username: 'alice', password: 'password123', deviceId: 'test_owner_dev' });
  if (loginRes.status !== 200) throw new Error("Could not login owner " + JSON.stringify(loginRes.data));
  const ownerToken = loginRes.data.token;
  
  // Get staff
  const staffRes = await req('/api/admin/staff', 'GET', null, ownerToken);
  if (staffRes.status !== 200 || !staffRes.data.length) {
    // create a staff member
    await req('/api/admin/staff', 'POST', { name: 'Bob Waiter', username: 'bob', password: 'password123', role: 'WAITER' }, ownerToken);
  }
  
  const staffRes2 = await req('/api/admin/staff', 'GET', null, ownerToken);
  const staffId = staffRes2.data.find(s => s.role !== 'OWNER').id;
  
  console.log("TEST A - VALID PAIRING");
  const pairRes = await req('/api/admin/pairing/generate', 'POST', { userId: staffId }, ownerToken);
  const rawPairToken = pairRes.data.token;
  
  const scanRes = await req('/api/auth/pair', 'POST', { token: rawPairToken, deviceId: 'waiter_dev_1' });
  const waiterToken = scanRes.data.token;
  console.log("-> Success, waiter logged in");
  
  console.log("TEST C - SINGLE-USE PAIRING");
  const scanRes2 = await req('/api/auth/pair', 'POST', { token: rawPairToken, deviceId: 'waiter_dev_1' });
  if (scanRes2.status !== 401) throw new Error("Token was reused!");
  console.log("-> Success, single-use prevented reuse");
  
  console.log("TEST D - REVOKED DEVICE");
  // Check devices
  const devRes = await req('/api/admin/devices', 'GET', null, ownerToken);
  const waiterDev = devRes.data.find(d => d.deviceIdentifier === 'waiter_dev_1');
  
  // Waiter performs action successfully
  const stateRes1 = await req('/api/state', 'GET', null, waiterToken);
  if (stateRes1.status !== 200) throw new Error("Waiter token failed");
  
  // Revoke device
  const revokeRes = await req(`/api/admin/devices/${waiterDev.id}/revoke`, 'POST', null, ownerToken);
  if (revokeRes.status !== 200) throw new Error("Failed to revoke device");
  
  // Waiter performs action -> should fail
  const stateRes2 = await req('/api/state', 'GET', null, waiterToken);
  if (stateRes2.status !== 401 && stateRes2.status !== 403) throw new Error("Revoked device still active! Status: " + stateRes2.status);
  console.log("-> Success, revoked device rejected");
  
  console.log("TEST C2 - INVALIDATED QR");
  const pairRes3 = await req('/api/admin/pairing/generate', 'POST', { userId: staffId }, ownerToken);
  const rawPairToken3 = pairRes3.data.token;
  await req('/api/admin/pairing/invalidate', 'POST', { userId: staffId }, ownerToken);
  
  const scanRes3 = await req('/api/auth/pair', 'POST', { token: rawPairToken3, deviceId: 'waiter_dev_3' });
  if (scanRes3.status !== 401) throw new Error("Invalidated token still worked!");
  console.log("-> Success, invalidated QR rejected");
  
  console.log("ALL TESTS PASSED");
}
run();
