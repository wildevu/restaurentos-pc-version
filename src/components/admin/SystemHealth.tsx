import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Server, 
  Cpu, 
  Wifi, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers,
  Clock
} from 'lucide-react';

export function SystemHealth({ authToken }: { authToken?: string }) {
  const [health, setHealth] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getEffectiveToken = () => authToken || localStorage.getItem('restaurantos_auth_token') || localStorage.getItem('token') || '';

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getEffectiveToken();
      const res = await fetch('/api/admin/system/health', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve system health metrics');
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const formatMB = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Local Hub & System Health</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Real-time diagnostics, SQLite database metrics, active websockets, and node runtime vitals.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 self-start"
        >
          <RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !health ? (
        <div className="p-12 text-center text-gray-400 text-sm bg-white rounded-2xl border border-gray-200">
          Gathering hardware and hub diagnostics...
        </div>
      ) : health && (
        <div className="space-y-6">
          {/* Top Key Indicator Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 block">Hub Status</span>
                <span className="text-xl font-black text-emerald-600">HEALTHY</span>
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 block">Hub Uptime</span>
                <span className="text-xl font-black text-gray-900">{formatUptime(health.uptimeSeconds)}</span>
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Wifi size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 block">Connected Devices</span>
                <span className="text-xl font-black text-gray-900">{health.connectedClientsCount} socket{health.connectedClientsCount === 1 ? '' : 's'}</span>
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Layers size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 block">State Version</span>
                <span className="text-xl font-black text-gray-900">v{health.hubStateVersion}</span>
              </div>
            </div>
          </div>

          {/* Local Area Network (LAN) Connectivity */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Wifi size={20} className="text-emerald-600" />
              <h3 className="font-black text-gray-900 text-base">Local Restaurant LAN Access</h3>
            </div>
            
            <p className="text-xs text-gray-500">
              Staff tablets and kitchen displays on the same local Wi-Fi / Ethernet network can open RestaurantOS at the following addresses:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {health.lanIps && health.lanIps.length > 0 ? (
                health.lanIps.map((ip: string) => (
                  <div key={ip} className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-700 block">Local IP Access</span>
                      <span className="font-mono text-sm font-black text-gray-900">http://{ip}:3000</span>
                    </div>
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md uppercase">LAN Active</span>
                  </div>
                ))
              ) : (
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 font-medium">
                  Localhost: <span className="font-mono font-bold text-gray-900">http://localhost:3000</span>
                </div>
              )}
            </div>
          </div>

          {/* Database Diagnostics */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Database size={20} className="text-blue-600" />
              <h3 className="font-black text-gray-900 text-base">Local SQLite Database Metrics</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 block">Journaling Mode</span>
                <span className="text-base font-bold text-gray-900">WAL (Write-Ahead)</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 block">Database Size</span>
                <span className="text-base font-bold text-gray-900">{formatMB(health.db.sizeBytes)}</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 block">Total Orders Logged</span>
                <span className="text-base font-bold text-gray-900">{health.db.ordersCount}</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 block">Active Tables</span>
                <span className="text-base font-bold text-gray-900">{health.db.tablesCount}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 block">Active Menu Items</span>
                <span className="text-base font-bold text-gray-900">{health.db.menuItemsCount}</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 block">Staff Accounts</span>
                <span className="text-base font-bold text-gray-900">{health.db.usersCount}</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 block">Paired Devices</span>
                <span className="text-base font-bold text-gray-900">{health.db.devicesCount}</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-400 block">Audit Log Entries</span>
                <span className="text-base font-bold text-gray-900">{health.db.auditEventsCount}</span>
              </div>
            </div>
          </div>

          {/* Node Runtime & Memory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Server size={20} className="text-purple-600" />
                <h3 className="font-black text-gray-900 text-base">Node.js Runtime</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Node Engine</span>
                  <span className="font-mono font-bold text-gray-900">{health.nodeVersion}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Operating System</span>
                  <span className="font-mono font-bold text-gray-900">{health.platform}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">RestaurantOS Core</span>
                  <span className="font-bold text-gray-900">v{health.appVersion}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Cpu size={20} className="text-amber-600" />
                <h3 className="font-black text-gray-900 text-base">Memory Consumption</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Process RSS</span>
                  <span className="font-mono font-bold text-gray-900">{formatMB(health.memory.rssBytes)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Heap Used</span>
                  <span className="font-mono font-bold text-gray-900">{formatMB(health.memory.heapUsedBytes)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Heap Allocated</span>
                  <span className="font-mono font-bold text-gray-900">{formatMB(health.memory.heapTotalBytes)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
