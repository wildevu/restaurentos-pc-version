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
  const r = await req('/api/auth/pair', 'POST', {token: 'test', deviceId: 'test'});
  console.log(r.status, r.data);
}
run();
