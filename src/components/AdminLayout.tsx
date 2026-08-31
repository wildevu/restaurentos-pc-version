import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Store, 
  Users, 
  Grid, 
  Smartphone, 
  MenuSquare, 
  History, 
  ShieldCheck, 
  Database, 
  Activity,
  Server
} from 'lucide-react';

export function AdminLayout() {
  const location = useLocation();
  const navItems = [
    { name: 'Local Hub Status', path: '/admin/hub', icon: Server },
    { name: 'Settings', path: '/admin/settings', icon: Store },
    { name: 'Staff', path: '/admin/staff', icon: Users },
    { name: 'Menu & CSV', path: '/admin/menu', icon: MenuSquare },
    { name: 'Tables', path: '/admin/tables', icon: Grid },
    { name: 'Devices', path: '/admin/devices', icon: Smartphone },
    { name: 'Order History', path: '/admin/orders', icon: History },
    { name: 'Audit Logs', path: '/admin/audit', icon: ShieldCheck },
    { name: 'Backups', path: '/admin/backups', icon: Database },
    { name: 'System Health', path: '/admin/health', icon: Activity },
  ];

  return (
    <div className="flex h-[calc(100vh-73px)]">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between">
        <nav className="p-4 space-y-1.5 overflow-y-auto">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 pb-2">
            Operations & Setup
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50/70 p-8">
        <Outlet />
      </main>
    </div>
  );
}
