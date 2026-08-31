const fs = require('fs');

let indexCode = fs.readFileSync('src/components/admin/index.ts', 'utf8');
indexCode += "\nexport * from './MenuManagement';\n";
fs.writeFileSync('src/components/admin/index.ts', indexCode);

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  "import { RestaurantSettings, StaffManagement, TableManagement, DeviceManagement } from './components/admin';",
  "import { RestaurantSettings, StaffManagement, TableManagement, DeviceManagement, MenuManagement } from './components/admin';"
);

appCode = appCode.replace(
  "<Route path=\"devices\" element={<DeviceManagement authToken={authToken!} />} />",
  "<Route path=\"devices\" element={<DeviceManagement authToken={authToken!} />} />\n              <Route path=\"menu\" element={<MenuManagement authToken={authToken!} />} />"
);
fs.writeFileSync('src/App.tsx', appCode);
