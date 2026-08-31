const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add PairingScreen import
code = code.replace("import { LoginScreen } from './components/LoginScreen';", "import { LoginScreen } from './components/LoginScreen';\nimport { PairingScreen } from './components/PairingScreen';");

// Add /pair route
const appRouterStr = `
          {(user?.role === 'OWNER' || user?.role === 'MANAGER') && (
`;
const newRouterStr = `
          <Route path="/pair" element={<PairingScreen onLogin={handleLogin} />} />
          {(user?.role === 'OWNER' || user?.role === 'MANAGER') && (
`;
code = code.replace(appRouterStr, newRouterStr);

fs.writeFileSync('src/App.tsx', code);
