const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const newImports = `
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { RestaurantSettings, StaffManagement, TableManagement } from './components/admin';
import { Settings } from 'lucide-react';
`;

code = code.replace("import { ChefHat, LogOut, CloudOff, Cloud, RefreshCw, AlertCircle } from 'lucide-react';", 
  "import { ChefHat, LogOut, CloudOff, Cloud, RefreshCw, AlertCircle, Settings } from 'lucide-react';\n" + newImports);

// Find the <main> block
const mainStart = code.indexOf("<main className=\"flex-1 p-6 max-w-7xl mx-auto w-full\">");
const mainEnd = code.indexOf("</main>") + 7;

const oldMain = code.substring(mainStart, mainEnd);

const newMain = `
      <main className="flex-1 w-full bg-gray-50 h-[calc(100vh-73px)] overflow-hidden">
        <Routes>
          <Route path="/" element={
            <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
              {activeTableId && activeTable ? (
                <TableDetail 
                  table={activeTable} 
                  order={activeOrder || null}
                  menu={menu}
                  onBack={() => setActiveTableId(null)} 
                />
              ) : (
                <TableGrid tables={tables.filter(t => !t.archivedAt)} onSelectTable={setActiveTableId} />
              )}
            </div>
          } />
          
          {(user?.role === 'OWNER' || user?.role === 'MANAGER') && (
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="settings" element={<RestaurantSettings authToken={authToken!} />} />
              <Route path="staff" element={<StaffManagement authToken={authToken!} currentUser={user} />} />
              <Route path="tables" element={<TableManagement authToken={authToken!} />} />
              <Route index element={<Navigate to="settings" replace />} />
            </Route>
          )}
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
`;

code = code.replace(oldMain, newMain);

// Add BrowserRouter wrapper around the return
const returnStart = code.indexOf("return (\n    <div className=\"min-h-screen bg-gray-50 text-gray-900 flex flex-col\">");
code = code.slice(0, returnStart) + "return (\n  <BrowserRouter>\n" + code.slice(returnStart).replace(/}$/, "  </BrowserRouter>\n  );\n}");

// Add settings link to header
const oldHeaderRight = `                    <div className="flex items-center gap-3 text-sm font-medium border-l pl-6 border-gray-200">`;
const newHeaderRight = `                    <div className="flex items-center gap-3 text-sm font-medium border-l pl-6 border-gray-200">
            {(user?.role === 'OWNER' || user?.role === 'MANAGER') && (
              <Link to="/admin" className="text-gray-500 hover:text-blue-600 transition-colors mr-2 flex items-center gap-1" title="Settings">
                <Settings size={20} />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}`;
code = code.replace(oldHeaderRight, newHeaderRight);

// Make the logo act as home link
const oldLogo = `<div className="flex items-center gap-2">
          <ChefHat className="text-blue-600" size={24} />
          <h1 className="text-xl font-bold tracking-tight text-gray-800">RestaurantOS</h1>
        </div>`;
const newLogo = `<Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <ChefHat className="text-blue-600" size={24} />
          <h1 className="text-xl font-bold tracking-tight text-gray-800">RestaurantOS</h1>
        </Link>`;
code = code.replace(oldLogo, newLogo);

fs.writeFileSync('src/App.tsx', code);
