const fs = require('fs');

// 1. Update App.tsx
let codeApp = fs.readFileSync('src/App.tsx', 'utf8');
codeApp = codeApp.replace("RestaurantSettings, StaffManagement, TableManagement }", "RestaurantSettings, StaffManagement, TableManagement, DeviceManagement }");
codeApp = codeApp.replace("<Route path=\"tables\" element={<TableManagement authToken={authToken!} />} />", "<Route path=\"tables\" element={<TableManagement authToken={authToken!} />} />\n              <Route path=\"devices\" element={<DeviceManagement authToken={authToken!} />} />");
fs.writeFileSync('src/App.tsx', codeApp);

// 2. Update AdminLayout.tsx
let codeAdmin = fs.readFileSync('src/components/AdminLayout.tsx', 'utf8');
codeAdmin = codeAdmin.replace("import { Store, Users, Grid } from 'lucide-react';", "import { Store, Users, Grid, Smartphone } from 'lucide-react';");
codeAdmin = codeAdmin.replace("{ name: 'Tables', path: '/admin/tables', icon: Grid },", "{ name: 'Tables', path: '/admin/tables', icon: Grid },\n    { name: 'Devices', path: '/admin/devices', icon: Smartphone },");
fs.writeFileSync('src/components/AdminLayout.tsx', codeAdmin);
