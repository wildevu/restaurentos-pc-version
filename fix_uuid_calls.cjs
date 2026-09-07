const fs = require('fs');
for (const file of ['src/components/LoginScreen.tsx', 'src/components/PairingScreen.tsx']) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('crypto.randomUUID()')) {
    content = content.replace(/crypto\.randomUUID\(\)/g, 'uuidv4()');
    if (!content.includes('import { uuidv4 }')) {
      content = "import { uuidv4 } from '../utils/uuid';\n" + content;
    }
    fs.writeFileSync(file, content);
    console.log(`Fixed ${file}`);
  }
}
