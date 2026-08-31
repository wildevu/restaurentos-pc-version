const fs = require('fs');
let code = fs.readFileSync('src/components/AdminLayout.tsx', 'utf8');

code = code.replace(
  "{ name: 'Staff', path: '/admin/staff', icon: Users },",
  "{ name: 'Staff', path: '/admin/staff', icon: Users },\n    { name: 'Menu', path: '/admin/menu', icon: Users }, // we'll use a generic icon for now, actually let's import Menu from lucide"
);

// Add Menu to lucide imports
code = code.replace(
  "import { Store, Users, Grid, Smartphone } from 'lucide-react';",
  "import { Store, Users, Grid, Smartphone, MenuSquare } from 'lucide-react';"
);

code = code.replace(
  "{ name: 'Menu', path: '/admin/menu', icon: Users }, // we'll use a generic icon for now, actually let's import Menu from lucide",
  "{ name: 'Menu', path: '/admin/menu', icon: MenuSquare },"
);

fs.writeFileSync('src/components/AdminLayout.tsx', code);
