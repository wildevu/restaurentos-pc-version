const { spawn } = require('child_process');
const http = require('http');

const child = spawn('npx', ['tsx', 'server.ts'], { stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', d => console.log('STDOUT:', d.toString()));
child.stderr.on('data', d => console.log('STDERR:', d.toString()));

setTimeout(() => {
  const req = http.request({hostname: 'localhost', port: 3000, path: '/api/state', method: 'GET'}, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode, body);
      child.kill();
    });
  });
  req.on('error', (e) => console.log('REQ ERR', e));
  req.end();
}, 2000);
