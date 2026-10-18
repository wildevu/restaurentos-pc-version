import { useEffect, useState, useRef } from 'react';
import { socket, connectSocket, disconnectSocket } from './socket';
import type { Table, MenuItem, Order } from './types';
import { TableGrid } from './components/TableGrid';
import { TableDetail } from './components/TableDetail';
import { KitchenDisplay } from './components/KitchenDisplay';
import { CashierDisplay } from './components/CashierDisplay';
import { SetupScreen } from './components/SetupScreen';
import { LoginScreen } from './components/LoginScreen';
import { PairingScreen } from './components/PairingScreen';
import { ExpiredLicenseModal } from './components/ExpiredLicenseModal';
import { I18nProvider, useI18n } from './i18n';
import { 
  ChefHat, 
  LogOut, 
  CloudOff, 
  Cloud, 
  RefreshCw, 
  AlertCircle, 
  Settings, 
  UtensilsCrossed, 
  Flame,
  Receipt,
  QrCode,
  Globe
} from 'lucide-react';

import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { 
  RestaurantSettings, 
  StaffManagement, 
  TableManagement, 
  DeviceManagement, 
  MenuManagement,
  OrderHistory,
  AuditLogs,
  Backups,
  SystemHealth,
  LocalHubStatus,
  LicenseManagement,
  ConsultantModule
} from './components/admin';

import { 
  subscribeToQueue, 
  subscribeToOptimistic, 
  getPendingCount, 
  flushQueue,
  getRejectedCommands,
  clearRejectedCommands,
  applyOptimisticCommand,
  db as offlineDb
} from './offline';
import { RejectedCommandsModal } from './components/RejectedCommandsModal';

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

type AppState = 'LOADING' | 'SETUP' | 'LOGIN' | 'APP' | 'HUB_UNAVAILABLE';

function AppContent({ 
  user, 
  authToken, 
  tables, 
  orders, 
  menu, 
  restaurant,
  activeTableId, 
  setActiveTableId, 
  isConnected, 
  pendingCommands, 
  rejectedCommands, 
  handleLogout, 
  handleLogin,
  checkStatus,
  licenseStatus,
  fetchLicenseStatus
}: any) {
  const [showRejectedModal, setShowRejectedModal] = useState(false);
  const location = useLocation();
  const { t, language, setLanguage } = useI18n();

  useEffect(() => {
    fetchLicenseStatus();
    const interval = setInterval(fetchLicenseStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  const activeTable = tables.find((t: any) => t.id === activeTableId);
  const activeOrder = activeTable?.orderId 
    ? orders.find((o: any) => o.id === activeTable.orderId) 
    : null;

  const isKitchenUser = user?.role === 'KITCHEN';
  const isCashierUser = user?.role === 'CASHIER';
  const isWaiterUser = user?.role === 'WAITER';
  const isOwnerOrManager = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const isExpired = licenseStatus && !licenseStatus.canOperate;

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800';
      case 'MANAGER':
        return 'bg-indigo-100 text-indigo-800';
      case 'CASHIER':
        return 'bg-teal-100 text-teal-800';
      case 'KITCHEN':
        return 'bg-orange-100 text-orange-800';
      case 'WAITER':
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <RejectedCommandsModal 
        commands={rejectedCommands} 
        isOpen={showRejectedModal} 
        onClose={() => setShowRejectedModal(false)} 
      />

      {/* Expired License Renewal Modal Window */}
      <ExpiredLicenseModal
        installationId={licenseStatus?.installationId || ''}
        isOpen={!!isExpired}
        isOwnerOrManager={isOwnerOrManager}
        onActivated={() => {
          fetchLicenseStatus();
          checkStatus();
        }}
      />

      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {restaurant?.logo ? (
              <img src={restaurant.logo} alt="Restaurant Logo" className="w-8 h-8 rounded-lg object-cover shadow-xs" />
            ) : (
              <img src="/logo.svg" alt="RestaurantOS Logo" className="w-8 h-8" />
            )}
            <div>
              <h1 className="text-base font-black tracking-tight text-gray-900 leading-none">
                {restaurant?.name && !restaurant.name.startsWith('inst_') ? restaurant.name : 'RestaurantOS'}
              </h1>
              <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Local Hub</span>
            </div>
          </Link>

          {/* Role-Based Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            {(isOwnerOrManager || isWaiterUser) && (
              <Link
                to="/"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  location.pathname === '/' 
                    ? 'bg-white text-gray-900 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UtensilsCrossed size={14} />
                <span>{t('nav.tables')}</span>
              </Link>
            )}

            {(isOwnerOrManager || isKitchenUser) && (
              <Link
                to="/kitchen"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  location.pathname === '/kitchen' 
                    ? 'bg-orange-500 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Flame size={14} />
                <span>{t('nav.kitchen')}</span>
              </Link>
            )}

            {(isOwnerOrManager || isCashierUser) && (
              <Link
                to="/cashier"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  location.pathname === '/cashier' 
                    ? 'bg-teal-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Receipt size={14} />
                <span>{t('nav.cashier')}</span>
              </Link>
            )}

            {isOwnerOrManager && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  location.pathname.startsWith('/admin') 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Settings size={14} />
                <span>{t('nav.admin')}</span>
              </Link>
            )}
          </nav>
        </div>
        
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Language Switcher */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded-lg transition-all ${language === 'en' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
              title="English"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('fr')}
              className={`px-2 py-1 rounded-lg transition-all ${language === 'fr' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
              title="Français"
            >
              FR
            </button>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-gray-900 truncate max-w-[120px]">{user?.name}</div>
            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${getRoleBadgeStyle(user?.role)}`}>
              {user?.role}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm font-medium border-l pl-3 sm:pl-4 border-gray-200">
            {rejectedCommands.length > 0 && (
              <button 
                className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-full border border-red-200 cursor-pointer transition-colors" 
                onClick={() => setShowRejectedModal(true)}
                title="View rejected sync issues"
              >
                <AlertCircle size={13} />
                <span className="text-xs font-bold">{rejectedCommands.length}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
              {isConnected ? (
                pendingCommands > 0 ? (
                  <>
                    <RefreshCw size={13} className="text-blue-500 animate-spin" />
                    <span className="text-xs font-bold text-gray-700 hidden sm:inline">{t('status.syncing')} ({pendingCommands})</span>
                  </>
                ) : (
                  <>
                    <Cloud size={13} className="text-emerald-500" />
                    <span className="text-xs font-bold text-gray-700 hidden sm:inline">{t('status.online')}</span>
                  </>
                )
              ) : (
                <>
                  <CloudOff size={13} className="text-red-500" />
                  <span className="text-xs font-bold text-gray-700 hidden sm:inline">{t('status.offline')} {pendingCommands > 0 && `(${pendingCommands})`}</span>
                </>
              )}
            </div>
            
            <button 
              onClick={handleLogout} 
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" 
              title={t('auth.signOut')}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 bg-gray-50 overflow-y-auto">
        <Routes>
          <Route path="/" element={
            isKitchenUser ? (
              <Navigate to="/kitchen" replace />
            ) : isCashierUser ? (
              <Navigate to="/cashier" replace />
            ) : (
              <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
                {activeTable ? (
                  <TableDetail 
                    table={activeTable} 
                    order={activeOrder} 
                    menu={menu}
                    currency={restaurant?.currency || 'USD'}
                    onBack={() => setActiveTableId(null)} 
                  />
                ) : (
                  <TableGrid 
                    tables={tables.filter((t: any) => !t.archivedAt)} 
                    orders={orders}
                    onSelectTable={setActiveTableId} 
                  />
                )}
              </div>
            )
          } />

          <Route path="/kitchen" element={
            <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
              <KitchenDisplay orders={orders} />
            </div>
          } />

          <Route path="/cashier" element={
            <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
              <CashierDisplay 
                tables={tables} 
                orders={orders} 
                restaurantName={restaurant?.name || 'RestaurantOS'}
                currency={restaurant?.currency || 'USD'} 
              />
            </div>
          } />
          
          <Route path="/pair" element={<PairingScreen onLogin={handleLogin} />} />
          <Route path="/hub" element={
            <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
              <LocalHubStatus authToken={authToken || undefined} />
            </div>
          } />
          
          <Route path="/admin" element={
            isOwnerOrManager ? (
              <AdminLayout />
            ) : (
              <Navigate to="/" replace />
            )
          }>
            <Route path="hub" element={<LocalHubStatus authToken={authToken!} />} />
            <Route path="licensing" element={<LicenseManagement />} />
            <Route path="consultant" element={<ConsultantModule authToken={authToken!} />} />
            <Route path="settings" element={<RestaurantSettings authToken={authToken!} />} />
            <Route path="staff" element={<StaffManagement authToken={authToken!} currentUser={user} />} />
            <Route path="tables" element={<TableManagement authToken={authToken!} />} />
            <Route path="devices" element={<DeviceManagement authToken={authToken!} />} />
            <Route path="menu" element={<MenuManagement authToken={authToken!} />} />
            <Route path="orders" element={<OrderHistory authToken={authToken!} />} />
            <Route path="audit" element={<AuditLogs authToken={authToken!} />} />
            <Route path="backups" element={<Backups authToken={authToken!} />} />
            <Route path="health" element={<SystemHealth authToken={authToken!} />} />
            <Route index element={<Navigate to="hub" replace />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Role-Based Bottom Navigation for Mobile */}
      <footer className="md:hidden bg-white border-t border-gray-200 px-3 py-2 flex items-center justify-around z-20 shadow-xs">
        {(isOwnerOrManager || isWaiterUser) && (
          <Link
            to="/"
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              location.pathname === '/' ? 'text-blue-600 font-bold' : 'text-gray-500'
            }`}
          >
            <UtensilsCrossed size={18} />
            <span className="text-[10px]">{t('nav.tables')}</span>
          </Link>
        )}

        {(isOwnerOrManager || isKitchenUser) && (
          <Link
            to="/kitchen"
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              location.pathname === '/kitchen' ? 'text-orange-600 font-bold' : 'text-gray-500'
            }`}
          >
            <Flame size={18} />
            <span className="text-[10px]">{t('nav.kitchen')}</span>
          </Link>
        )}

        {(isOwnerOrManager || isCashierUser) && (
          <Link
            to="/cashier"
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              location.pathname === '/cashier' ? 'text-teal-600 font-bold' : 'text-gray-500'
            }`}
          >
            <Receipt size={18} />
            <span className="text-[10px]">{t('nav.cashier')}</span>
          </Link>
        )}

        {isOwnerOrManager && (
          <Link
            to="/admin"
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
              location.pathname.startsWith('/admin') ? 'text-blue-600 font-bold' : 'text-gray-500'
            }`}
          >
            <Settings size={18} />
            <span className="text-[10px]">{t('nav.admin')}</span>
          </Link>
        )}
      </footer>
    </div>
  );
}

export function App() {
  const [appState, setAppState] = useState<AppState>('LOADING');
  const [user, setUser] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('restaurantos_auth_token');
  });
  const [restaurant, setRestaurant] = useState<any>(null);
  const [startupError, setStartupError] = useState<string | null>(null);

  // Auto-login persistence check on app boot
  useEffect(() => {
    const token = localStorage.getItem('restaurantos_auth_token');
    if (token) {
      checkStatus(token);
    } else {
      checkStatus(null);
    }
  }, []);


  useEffect(() => {
    const refreshQueueStatus = async () => {
      const [count, rejected] = await Promise.all([getPendingCount(), getRejectedCommands()]);
      setRejectedCommands(rejected);
      setPendingCommands(count);
    };

    const unsubQueue = subscribeToQueue(async (reason) => {
      await refreshQueueStatus();
      if (reason !== 'rejected' || reconcileInFlightRef.current) return;
      const token = localStorage.getItem('restaurantos_auth_token');
      if (!token) return;

      reconcileInFlightRef.current = true;
      try {
        const response = await fetchWithTimeout('/api/state', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) return;
        const authoritative = await response.json();
        if (authoritative.stateVersion !== undefined) stateVersionRef.current = authoritative.stateVersion;
        const pending = await offlineDb.commands.where('status').anyOf('PENDING', 'SYNCING').sortBy('createdAt');
        let reconciled = { tables: authoritative.tables || [], orders: authoritative.orders || [] };
        for (const command of pending) reconciled = applyOptimisticCommand(reconciled, command.type, command.payload);
        setTables(reconciled.tables);
        setOrders(reconciled.orders);
        if (authoritative.menu) setMenu(authoritative.menu);
        if (authoritative.restaurant) setRestaurant(authoritative.restaurant);
      } catch (error) {
        console.error('Could not reconcile rejected optimistic command with server state', error);
      } finally {
        reconcileInFlightRef.current = false;
      }
    });
    void refreshQueueStatus();

    const unsubOpt = subscribeToOptimistic((type, payload) => {
      setTables(prevTables => {
        let newTables = prevTables;
        setOrders(prevOrders => {
           const result = applyOptimisticCommand({ tables: prevTables, orders: prevOrders }, type, payload);
           newTables = result.tables;
           return result.orders;
        });
        return newTables;
      });
    });

    return () => {
      unsubQueue();
      unsubOpt();
    };
  }, []);

  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingCommands, setPendingCommands] = useState(0);
  const [rejectedCommands, setRejectedCommands] = useState<any[]>([]);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const stateVersionRef = useRef<number>(0);
  const syncSequenceRef = useRef(0);
  const initInFlightRef = useRef(false);
  const reconcileInFlightRef = useRef(false);
  const lastWakeSyncAtRef = useRef(0);

  const fetchLicenseStatus = async () => {
    try {
      const res = await fetch('/api/licensing/status');
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(prev => {
          // Deep equality check: skip state update if payload is identical
          if (JSON.stringify(prev) === JSON.stringify(data)) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error('License check error', err);
    }
  };

  const checkStatus = async (token = authToken, retriesLeft = 3) => {
    setStartupError(null);
    try {
      if (token) {
        const res = await fetchWithTimeout('/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + token }
        });

        if (res.status === 401 || res.status === 403) {
          // Only explicit auth rejection invalidates saved credentials.
          localStorage.removeItem('restaurantos_auth_token');
          setAuthToken(null);
          setUser(null);
          token = null;
        } else if (!res.ok) {
          throw new Error('Hub authentication check failed (HTTP ' + res.status + ')');
        } else {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            if (data.restaurant) setRestaurant(data.restaurant);
            setAppState('APP');
            void initApp(token);
            return;
          }

          localStorage.removeItem('restaurantos_auth_token');
          setAuthToken(null);
          setUser(null);
          token = null;
        }
      }

      if (!token) {
        const setupRes = await fetchWithTimeout('/api/auth/status');
        if (!setupRes.ok) throw new Error('Hub setup check failed (HTTP ' + setupRes.status + ')');
        const setupData = await setupRes.json();
        if (setupData.restaurant) setRestaurant(setupData.restaurant);
        setAppState(!setupData.configured && !setupData.isInitialized ? 'SETUP' : 'LOGIN');
        return;
      }
    } catch (err: any) {
      console.error('Failed to check RestaurantOS status (retries left: ' + retriesLeft + ')', err);
      if (retriesLeft > 0) {
        window.setTimeout(() => { void checkStatus(token, retriesLeft - 1); }, 1500);
        return;
      }

      // Never clear a token because the local hub is temporarily unavailable.
      setStartupError(err?.message || 'The local hub could not be reached.');
      setAppState('HUB_UNAVAILABLE');
    }
  };

  const initApp = async (token: string, retriesLeft = 3) => {
    if (initInFlightRef.current) return;
    initInFlightRef.current = true;
    try {
      const res = await fetchWithTimeout('/api/state', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.stateVersion !== undefined) stateVersionRef.current = data.stateVersion;
        setTables(data.tables);
        setMenu(data.menu);
        setOrders(data.orders);
        if (data.restaurant) {
          setRestaurant(data.restaurant);
        }
      } else if (res.status === 402 || res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.code === 'LICENSE_REQUIRED' || errorData.error?.includes('license')) {
          void fetchLicenseStatus();
        }
      } else {
        throw new Error('Could not load current restaurant state (HTTP ' + res.status + ')');
      }

      // Unbind previous listeners before reconnecting
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('AUTH_REVOKED');
      socket.off('STATE_UPDATE');

      connectSocket(token);

      let disconnectTimer: any = null;

      const synchronize = () => {
        if (!socket.connected) return;
        const syncSequence = ++syncSequenceRef.current;
        if (disconnectTimer) {
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
        }
        setIsConnected(true);
        socket.emit('SYNC', { lastKnownVersion: stateVersionRef.current }, async (res: any) => {
          if (syncSequence !== syncSequenceRef.current) return;
          let latestTables: any[] = [];
          let latestOrders: any[] = [];
          setTables(prev => { latestTables = prev; return prev; });
          setOrders(prev => { latestOrders = prev; return prev; });

          if (!res || res.error) {
            console.error('Hub synchronization failed', res?.error || 'No response');
            return;
          }

          if (res.upToDate === false && res.state) {
            // Don't let a slow snapshot overwrite newer events. A server-declared
            // version rollback is an intentional restore and must be accepted.
            const incomingVersion = Number(res.state.stateVersion || 0);
            if (incomingVersion < stateVersionRef.current && !res.forceResync) return;
            stateVersionRef.current = incomingVersion;
            latestTables = res.state.tables || [];
            latestOrders = res.state.orders || [];
            if (res.state.menu) setMenu(res.state.menu);
            if (res.state.restaurant) setRestaurant(res.state.restaurant);
          }

          try {
            const pending = await offlineDb.commands.where('status').anyOf('PENDING', 'SYNCING').sortBy('createdAt');
            let state = { tables: latestTables, orders: latestOrders };
            for (const cmd of pending) state = applyOptimisticCommand(state, cmd.type, cmd.payload);
            setTables(state.tables);
            setOrders(state.orders);
          } catch (error) {
            console.error('Optimistic re-apply failed', error);
            setTables(latestTables);
            setOrders(latestOrders);
          }

          void flushQueue();
        });
      };

      socket.on('connect', synchronize);
      if (socket.connected) synchronize();

      socket.on('disconnect', () => {
        if (!disconnectTimer) {
          disconnectTimer = setTimeout(() => {
            setIsConnected(false);
          }, 3000);
        }
      });
      socket.on('connect_error', () => {
        if (!disconnectTimer) {
          disconnectTimer = setTimeout(() => {
            setIsConnected(false);
          }, 3000);
        }
      });
      
      socket.on('AUTH_REVOKED', (payload: any) => {
        console.warn('Session revoked by server:', payload?.reason);
        handleLogout();
      });
      
      socket.on('STATE_UPDATE', (data: { tables: Table[], orders: Order[], menu?: MenuItem[], stateVersion?: number, restaurant?: any, forceResync?: boolean }) => {
        // Prevent late events from overwriting newer state. A full forced resync is
        // allowed to lower the version after a restore from an older backup.
        if (data.stateVersion !== undefined && data.stateVersion < stateVersionRef.current && !data.forceResync) return;
        if (data.stateVersion !== undefined) stateVersionRef.current = data.stateVersion;
        setTables(data.tables || []);
        setOrders(data.orders || []);
        if (data.menu) setMenu(data.menu);
        if (data.restaurant) setRestaurant(data.restaurant);
      });
    } catch (err) {
      console.error('Init error (retries left: ' + retriesLeft + ')', err);
      if (retriesLeft > 0) {
        window.setTimeout(() => { void initApp(token, retriesLeft - 1); }, 1000);
      } else {
        setIsConnected(false);
      }
    } finally {
      initInFlightRef.current = false;
    }
  };

  // Focus, visibility and network events can fire together; coalesce them into one sync.
  useEffect(() => {
    const handleWakeAndSync = () => {
      const now = Date.now();
      if (now - lastWakeSyncAtRef.current < 1500) return;
      lastWakeSyncAtRef.current = now;
      const savedToken = localStorage.getItem('restaurantos_auth_token') || authToken;
      if (savedToken) void initApp(savedToken);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWakeAndSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleWakeAndSync);
    window.addEventListener('focus', handleWakeAndSync);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleWakeAndSync);
      window.removeEventListener('focus', handleWakeAndSync);
    };
  }, [authToken]);

  const handleLogin = (token: string, userData?: any) => {
    localStorage.setItem('restaurantos_auth_token', token);
    setAuthToken(token);
    if (userData) {
      setUser(userData);
      setAppState('APP');
      initApp(token);
      return;
    }
    checkStatus(token);
  };

  const handleLogout = async () => {
    if (authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    }
    localStorage.removeItem('restaurantos_auth_token');
    setAuthToken(null);
    setUser(null);
    disconnectSocket();
    socket.off('connect');
    socket.off('disconnect');
    socket.off('STATE_UPDATE');
    checkStatus(null);
  };

  if (appState === 'LOADING') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-bold text-gray-500 gap-3">
        <RefreshCw size={24} className="animate-spin text-blue-600" />
        <span>Loading RestaurantOS...</span>
      </div>
    );
  }

  if (appState === 'HUB_UNAVAILABLE') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6 text-center text-gray-700">
        <CloudOff size={36} className="text-amber-600" />
        <h1 className="text-xl font-bold">RestaurantOS hub unavailable</h1>
        <p className="max-w-md text-sm">
          The local hub could not be reached. Your saved sign-in has been preserved. Check that the RestaurantOS hub is running on the main PC, then retry.
        </p>
        {startupError && <p className="max-w-md text-xs text-gray-500">{startupError}</p>}
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          onClick={() => {
            setAppState('LOADING');
            void checkStatus(localStorage.getItem('restaurantos_auth_token'), 4);
          }}
        >
          Retry connection
        </button>
      </div>
    );
  }

  if (appState === 'SETUP') {
    return (
      <I18nProvider restaurant={restaurant} initialLanguage={restaurant?.language || 'en'}>
        <SetupScreen onComplete={(token?: string) => { if (token) handleLogin(token); else checkStatus(null); }} />
      </I18nProvider>
    );
  }

  if (appState === 'LOGIN') {
    // Allow unauthenticated access to the pairing screen
    if (window.location.pathname.startsWith('/pair')) {
      return (
        <I18nProvider restaurant={restaurant} initialLanguage={restaurant?.language || 'en'}>
          <BrowserRouter>
            <PairingScreen onLogin={handleLogin} />
          </BrowserRouter>
        </I18nProvider>
      );
    }

    return (
      <I18nProvider restaurant={restaurant} initialLanguage={restaurant?.language || 'en'}>
        <LoginScreen onLogin={handleLogin} onReset={() => checkStatus(null)} />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider restaurant={restaurant} initialLanguage={restaurant?.language || 'en'}>
      <BrowserRouter>
        <AppContent
          user={user}
          authToken={authToken}
          tables={tables}
          orders={orders}
          menu={menu}
          restaurant={restaurant}
          activeTableId={activeTableId}
          setActiveTableId={setActiveTableId}
          isConnected={isConnected}
          pendingCommands={pendingCommands}
          rejectedCommands={rejectedCommands}
          handleLogout={handleLogout}
          handleLogin={handleLogin}
          checkStatus={checkStatus}
          licenseStatus={licenseStatus}
          fetchLicenseStatus={fetchLicenseStatus}
        />
      </BrowserRouter>
    </I18nProvider>
  );
}

export default App;
