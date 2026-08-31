const http = require('http');
const req = http.request({hostname: 'localhost', port: 3000, path: '/api/auth/setup-status', method: 'GET'}, res => {
  let d = ''; res.on('data', c=>d+=c); res.on('end', ()=>console.log(res.statusCode, d));
});
req.end();
