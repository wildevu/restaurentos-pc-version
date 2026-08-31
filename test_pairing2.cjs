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
  const loginData = JSON.parse(fs.readFileSync('test_login.json', 'utf8'));
  const ownerToken = loginData.token;
  const staffRes = await req('/api/admin/staff', 'GET', null, ownerToken);
  console.log(staffRes.data);
}
run();
