import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
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
  Server,
  Key
} from 'lucide-react';

export function AdminLayout() {
  const location = useLocation();
  const { t } = useI18n();

  const navItems = [
    { nameKey: 'admin.navHub', defaultName: 'Local Hub Status', path: '/admin/hub', icon: Server },
    { nameKey: 'admin.navLicensing', defaultName: 'Licensing', path: '/admin/licensing', icon: Key },
    { nameKey: 'admin.navSettings', defaultName: 'Settings', path: '/admin/settings', icon: Store },
    { nameKey: 'admin.navStaff', defaultName: 'Staff', path: '/admin/staff', icon: Users },
    { nameKey: 'admin.navMenu', defaultName: 'Menu & CSV', path: '/admin/menu', icon: MenuSquare },
    { nameKey: 'admin.navTables', defaultName: 'Tables', path: '/admin/tables', icon: Grid },
    { nameKey: 'admin.navDevices', defaultName: 'Devices', path: '/admin/devices', icon: Smartphone },
    { nameKey: 'admin.navOrders', defaultName: 'Order History', path: '/admin/orders', icon: History },
    { nameKey: 'admin.navAudit', defaultName: 'Audit Logs', path: '/admin/audit', icon: ShieldCheck },
    { nameKey: 'admin.navBackups', defaultName: 'Backups', path: '/admin/backups', icon: Database },
    { nameKey: 'admin.navHealth', defaultName: 'System Health', path: '/admin/health', icon: Activity },
  ];

  return (
    <div className="flex h-[calc(100vh-73px)]">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between">
        <nav className="p-4 space-y-1.5 overflow-y-auto">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 pb-2">
            {t('admin.operationsHeader', 'Operations & Setup')}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            const label = t(item.nameKey as any, item.defaultName);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                <span>{label}</span>
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
