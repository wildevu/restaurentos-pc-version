import { useEffect, useState, useRef } from 'react';
import { socket, connectSocket, disconnectSocket } from './socket';
import type { Table, MenuItem, Order } from './types';
import { TableGrid } from './components/TableGrid';
import { TableDetail } from './components/TableDetail';
import { KitchenDisplay } from './components/KitchenDisplay';
import { SetupScreen } from './components/SetupScreen';
import { LoginScreen } from './components/LoginScreen';
import { PairingScreen } from './components/PairingScreen';
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
  QrCode
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
  LocalHubStatus
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

type AppState = 'LOADING' | 'SETUP' | 'LOGIN' | 'APP';

function AppContent({ 
  user, 
  authToken, 
  tables, 
  orders, 
  menu, 
  activeTableId, 
  setActiveTableId, 
  isConnected, 
  pendingCommands, 
  rejectedCommands, 
  handleLogout, 
  handleLogin 
}: any) {
  const [showRejectedModal, setShowRejectedModal] = useState(false);
  const location = useLocation();
  const activeTable = tables.find((t: any) => t.id === activeTableId);
  const activeOrder = activeTable?.orderId 
    ? orders.find((o: any) => o.id === activeTable.orderId) 
    : null;

  const isKitchenUser = user?.role === 'KITCHEN';
  const isOwnerOrManager = user?.role === 'OWNER' || user?.role === 'MANAGER';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <RejectedCommandsModal 
        commands={rejectedCommands} 
        isOpen={showRejectedModal} 
        onClose={() => setShowRejectedModal(false)} 
      />

      <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <ChefHat size={20} />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-gray-900 leading-none">RestaurantOS</h1>
              <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Local Hub</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                location.pathname === '/' 
                  ? 'bg-white text-gray-900 shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UtensilsCrossed size={14} />
              <span>Tables</span>
            </Link>

            <Link
              to="/kitchen"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                location.pathname === '/kitchen' 
                  ? 'bg-orange-500 text-white shadow-xs' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Flame size={14} />
              <span>Kitchen Display</span>
            </Link>

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
                <span>Admin & Ops</span>
              </Link>
            )}
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs font-bold text-gray-900">{user?.name}</div>
            <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">{user?.role}</div>
          </div>
          
          <div className="flex items-center gap-2 text-sm font-medium border-l pl-4 border-gray-200">
            {rejectedCommands.length > 0 && (
              <button 
                className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-full border border-red-200 cursor-pointer transition-colors" 
                onClick={() => setShowRejectedModal(true)}
                title="View rejected sync issues"
              >
                <AlertCircle size={13} />
                <span className="text-xs font-bold">{rejectedCommands.length} Issue{rejectedCommands.length === 1 ? '' : 's'}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
              {isConnected ? (
                pendingCommands > 0 ? (
                  <>
                    <RefreshCw size={13} className="text-blue-500 animate-spin" />
                    <span className="text-xs font-bold text-gray-700">Syncing ({pendingCommands})</span>
                  </>
                ) : (
                  <>
                    <Cloud size={13} className="text-emerald-500" />
                    <span className="text-xs font-bold text-gray-700">Online</span>
                  </>
                )
              ) : (
                <>
                  <CloudOff size={13} className="text-red-500" />
                  <span className="text-xs font-bold text-gray-700">Offline {pendingCommands > 0 && `(${pendingCommands})`}</span>
                </>
              )}
            </div>
            
            <button 
              onClick={handleLogout} 
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" 
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full bg-gray-50 h-[calc(100vh-61px)] overflow-hidden">
        <Routes>
          <Route path="/" element={
            isKitchenUser ? (
              <Navigate to="/kitchen" replace />
            ) : (
              <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
                {activeTableId && activeTable ? (
                  <TableDetail 
                    table={activeTable} 
                    order={activeOrder || null}
                    menu={menu}
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
            <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
              <KitchenDisplay orders={orders} />
            </div>
          } />
          
          <Route path="/pair" element={<PairingScreen onLogin={handleLogin} />} />
          <Route path="/hub" element={
            <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
              <LocalHubStatus authToken={authToken || undefined} />
            </div>
          } />
          
          {isOwnerOrManager && (
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="hub" element={<LocalHubStatus authToken={authToken!} />} />
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
          )}
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [appState, setAppState] = useState<AppState>('LOADING');
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('restaurantos_auth_token'));
  const [user, setUser] = useState<any>(null);

  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingCommands, setPendingCommands] = useState(0);
  const [rejectedCommands, setRejectedCommands] = useState<any[]>([]);
  const stateVersionRef = useRef<number>(0);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    const unsubQueue = subscribeToQueue(async () => {
      const count = await getPendingCount();
      const rejected = await getRejectedCommands();
      setRejectedCommands(rejected);
      setPendingCommands(count);
    });

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

  const checkStatus = async (token = authToken) => {
    try {
      if (token) {
        // Verify token
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setAppState('APP');
          initApp(token);
          return;
        } else {
          // Token invalid, clear it
          localStorage.removeItem('restaurantos_auth_token');
          setAuthToken(null);
        }
      }

      // Check setup
      const setupRes = await fetch('/api/auth/setup-status');
      const setupData = await setupRes.json();
      if (!setupData.isInitialized) {
        setAppState('SETUP');
      } else {
        setAppState('LOGIN');
      }
    } catch (err) {
      console.error('Failed to check status', err);
    }
  };

  const initApp = async (token: string) => {
    try {
      const res = await fetch('/api/state', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stateVersion !== undefined) stateVersionRef.current = data.stateVersion;
        setTables(data.tables);
        setMenu(data.menu);
        setOrders(data.orders);
      }

      connectSocket(token);

      socket.on('connect', () => {
        setIsConnected(true);
        socket.emit('SYNC', { lastKnownVersion: stateVersionRef.current }, async (res: any) => {
          let latestTables: any[] = [];
          let latestOrders: any[] = [];
          setTables(prev => { latestTables = prev; return prev; });
          setOrders(prev => { latestOrders = prev; return prev; });
          
          if (res && res.upToDate === false && res.state) {
            stateVersionRef.current = res.state.stateVersion;
            latestTables = res.state.tables;
            latestOrders = res.state.orders;
            if (res.state.menu) setMenu(res.state.menu);
          }
          
          try {
            const pending = await offlineDb.commands.where('status').anyOf('PENDING', 'SYNCING').sortBy('createdAt');
            let state = { tables: latestTables, orders: latestOrders };
            for (const cmd of pending) {
               state = applyOptimisticCommand(state, cmd.type, cmd.payload);
            }
            setTables(state.tables);
            setOrders(state.orders);
          } catch(e) {
            console.error('Optimistic re-apply failed', e);
            setTables(latestTables);
            setOrders(latestOrders);
          }
          
          flushQueue();
        });
      });
      
      socket.on('disconnect', () => setIsConnected(false));
      socket.on('connect_error', () => {
        setIsConnected(false);
      });
      
      socket.on('AUTH_REVOKED', (payload: any) => {
        console.warn('Session revoked by server:', payload?.reason);
        handleLogout();
      });
      
      socket.on('STATE_UPDATE', (data: { tables: Table[], orders: Order[], menu?: MenuItem[], stateVersion?: number }) => {
        if (data.stateVersion !== undefined) {
          stateVersionRef.current = data.stateVersion;
        }
        setTables(data.tables);
        setOrders(data.orders);
        if (data.menu) {
          setMenu(data.menu);
        }
      });
    } catch (err) {
      console.error("Init error", err);
    }
  };

  const handleLogin = (token: string) => {
    localStorage.setItem('restaurantos_auth_token', token);
    setAuthToken(token);
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
    setAppState('LOGIN');
  };

  if (appState === 'LOADING') {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  }

  if (appState === 'SETUP') {
    return <SetupScreen onComplete={() => checkStatus(null)} />;
  }

  if (appState === 'LOGIN') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <AppContent
        user={user}
        authToken={authToken}
        tables={tables}
        orders={orders}
        menu={menu}
        activeTableId={activeTableId}
        setActiveTableId={setActiveTableId}
        isConnected={isConnected}
        pendingCommands={pendingCommands}
        rejectedCommands={rejectedCommands}
        handleLogout={handleLogout}
        handleLogin={handleLogin}
      />
    </BrowserRouter>
  );
}

export default App;
