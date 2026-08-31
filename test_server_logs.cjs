const { spawn } = require('child_process');
const http = require('http');

const child = spawn('npx', ['tsx', 'server.ts'], { stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', d => console.log('STDOUT:', d.toString()));
child.stderr.on('data', d => console.log('STDERR:', d.toString()));

setTimeout(() => {
  const req = http.request({hostname: 'localhost', port: 3000, path: '/api/auth/pair', method: 'POST'}, res => {
    console.log('STATUS:', res.statusCode);
    child.kill();
  });
  req.on('error', (e) => console.log('REQ ERR', e));
  req.end();
}, 2000);
