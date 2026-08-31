import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  User, 
  Smartphone, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  Code,
  X
} from 'lucide-react';

export function AuditLogs({ authToken }: { authToken?: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const getEffectiveToken = () => authToken || localStorage.getItem('restaurantos_auth_token') || localStorage.getItem('token') || '';

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getEffectiveToken();
      const params = new URLSearchParams();
      if (actionFilter !== 'ALL') params.append('action', actionFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('AUTH') || action.includes('LOGIN')) return 'bg-purple-100 text-purple-800';
    if (action.includes('DEVICE') || action.includes('PAIR')) return 'bg-blue-100 text-blue-800';
    if (action.includes('ORDER') || action.includes('ITEM') || action.includes('TABLE')) return 'bg-emerald-100 text-emerald-800';
    if (action.includes('BACKUP') || action.includes('RESTORE')) return 'bg-amber-100 text-amber-800';
    if (action.includes('MENU') || action.includes('CSV')) return 'bg-indigo-100 text-indigo-800';
    if (action.includes('STAFF') || action.includes('USER')) return 'bg-rose-100 text-rose-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Audit Log Viewer</h2>
        <p className="text-gray-500 text-sm mt-0.5">
          Immutable event log of operational commands, staff logins, device pairings, and menu modifications.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search action, staff member, device, or metadata..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">All Event Types</option>
            <option value="ORDER_CREATED">Orders</option>
            <option value="ORDER_ITEM_ADDED">Item Additions</option>
            <option value="ORDER_ITEM_NOTE_UPDATED">Item Notes</option>
            <option value="ORDER_ITEM_KITCHEN_UPDATED">Kitchen Updates</option>
            <option value="TABLE_CLOSED">Table Closes</option>
            <option value="LOGIN_SUCCESS">Logins</option>
            <option value="STAFF_CREATED">Staff Creation</option>
            <option value="DEVICE_PAIRED">Device Pairing</option>
            <option value="BACKUP_CREATED">Backups</option>
            <option value="MENU_IMPORT_CSV">Menu CSV Imports</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm font-medium">
            Loading audit events...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm font-medium">
            No audit records matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Device</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => {
                  const date = new Date(log.createdAt);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{date.toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{date.toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-lg ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{log.actorName}</div>
                        {log.actorRole && (
                          <div className="text-xs text-gray-400 font-semibold">{log.actorRole}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {log.actorDeviceName || <span className="text-gray-400 italic">Direct / Server</span>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 font-medium">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-600">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs transition-colors inline-flex items-center gap-1"
                        >
                          <Code size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 bg-gray-50 border-b border-gray-200 flex items-start justify-between">
              <div>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-lg ${getActionBadgeColor(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-2">
                  Event ID: <span className="font-mono font-normal text-sm text-gray-600">{selectedLog.id}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Logged at {new Date(selectedLog.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 block">Actor</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedLog.actorName}</span>
                  {selectedLog.actorRole && (
                    <span className="text-xs text-gray-500 block">Role: {selectedLog.actorRole}</span>
                  )}
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 block">Device</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {selectedLog.actorDeviceName || 'Direct / Server'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Structured Payload / Metadata
                </h4>
                <pre className="p-4 bg-gray-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-64 scrollbar-none">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-gray-900 text-white font-bold text-sm rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
