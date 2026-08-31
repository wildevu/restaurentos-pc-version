const http = require('http');

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
  const loginRes = await req('/api/auth/login', 'POST', { username: 'owner2', password: 'password123', deviceId: 'test_owner_dev' });
  const ownerToken = loginRes.data.token;
  
  const staffRes2 = await req('/api/admin/staff', 'GET', null, ownerToken);
  const staffId = staffRes2.data.find(s => s.role === 'WAITER').id;
  
  const pairRes = await req('/api/admin/pairing/generate', 'POST', { userId: staffId }, ownerToken);
  const rawPairToken = pairRes.data.token;
  
  const scanRes = await req('/api/auth/pair', 'POST', { token: rawPairToken, deviceId: 'waiter_dev_1' });
  console.log(scanRes.status, scanRes.data);
}
run();
