const fs = require('fs');
let code = fs.readFileSync('src/components/TableDetail.tsx', 'utf8');

// replace socket import and add executeCommand import
code = code.replace(
  "import { socket } from '../socket';",
  "import { executeCommand } from '../offline';"
);

const oldExecute = `  const executeCommand = (type: string, payload: any, callback?: () => void) => {
    const actionId = uuidv4();
    socket.emit('COMMAND', { actionId, type, payload }, (response: any) => {
      if (!response.success) {
        alert('Action failed: ' + response.error);
      } else if (response.duplicate) {
        console.warn('Action was duplicate but acknowledged:', actionId);
      }
      if (callback) callback();
    });
  };`;
  
const newExecute = `  const dispatchCommand = async (type: string, payload: any, callback?: () => void) => {
    await executeCommand(type, payload);
    if (callback) callback();
  };`;

code = code.replace(oldExecute, newExecute);
code = code.replace(/executeCommand\(/g, "dispatchCommand(");
// Wait, we just renamed it so we don't conflict with the imported one, let's fix the import rename if needed.
// Ah, the imported one is executeCommand. So dispatchCommand works.

fs.writeFileSync('src/components/TableDetail.tsx', code);
console.log('TableDetail updated');
