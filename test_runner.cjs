const io = require('socket.io-client');
const fs = require('fs');
const token = JSON.parse(fs.readFileSync('test_login.json')).token;
const crypto = require('crypto');

const socket = io('http://localhost:3000', { auth: { token } });

socket.on('connect', async () => {
  console.log('Connected');

  const actionId = crypto.randomUUID();
  
  socket.emit('COMMAND', { actionId, type: 'OPEN_TABLE', payload: { tableId: '1' } }, (res1) => {
    console.log('Res1:', res1);
    socket.emit('COMMAND', { actionId, type: 'OPEN_TABLE', payload: { tableId: '1' } }, (res2) => {
      console.log('Res2:', res2); // Should say duplicate: true
      process.exit(0);
    });
  });
});
