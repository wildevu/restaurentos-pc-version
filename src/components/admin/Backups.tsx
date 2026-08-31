import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  RotateCcw, 
  Plus, 
  HardDrive, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldAlert,
  RefreshCw,
  X
} from 'lucide-react';

export function Backups({ authToken }: { authToken?: string }) {
  const [backups, setBackups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Restore Modal
  const [restoreCandidate, setRestoreCandidate] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const getEffectiveToken = () => authToken || localStorage.getItem('restaurantos_auth_token') || localStorage.getItem('token') || '';

  const fetchBackups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getEffectiveToken();
      const res = await fetch('/api/admin/backups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load backup list');
      const data = await res.json();
      setBackups(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = getEffectiveToken();
      const res = await fetch('/api/admin/backups/create', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to create backup snapshot');
      setSuccessMsg('Safe SQLite backup created successfully.');
      await fetchBackups();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownloadBackup = (filename: string) => {
    const token = getEffectiveToken();
    window.location.href = `/api/admin/backups/download/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`;
  };

  const handleConfirmRestore = async () => {
    if (!restoreCandidate) return;
    setIsRestoring(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = getEffectiveToken();
      const res = await fetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: restoreCandidate.filename,
          confirm: true
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to restore backup');
      }
      setSuccessMsg(`Database restored from ${restoreCandidate.filename}. Automatic pre-restore backup was preserved.`);
      setRestoreCandidate(null);
      await fetchBackups();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Database Backup & Recovery</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Safe SQLite snapshots, automatic rotation, file downloads, and atomic restore guarantees.
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={isCreating}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center gap-2 self-start"
        >
          {isCreating ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />}
          <span>{isCreating ? 'Creating Snapshot...' : 'Create Backup Now'}</span>
        </button>
      </div>

      {/* Status Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <HardDrive size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 block">Available Snapshots</span>
            <span className="text-2xl font-black text-gray-900">{backups.length}</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldAlert size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 block">WAL Journal Checkpoint</span>
            <span className="text-sm font-bold text-emerald-700">Atomic Safe Passive</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 block">Snapshot Retention</span>
            <span className="text-sm font-bold text-gray-800">Top 15 Most Recent</span>
          </div>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Backup Archive Files</h3>
          <button
            onClick={fetchBackups}
            className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg text-xs flex items-center gap-1 font-semibold"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading backup archives...</div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No backups stored yet. Click "Create Backup Now" above to generate your first snapshot.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {backups.map(backup => {
              const date = new Date(backup.createdAt);
              return (
                <div key={backup.filename} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-gray-100 text-gray-600 rounded-xl">
                      <Database size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900 text-sm">{backup.filename}</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          backup.type === 'manual'
                            ? 'bg-blue-100 text-blue-800'
                            : backup.type === 'pre-restore'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {backup.type}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                        <span>Created: {date.toLocaleString()}</span>
                        <span>•</span>
                        <span>Size: {formatBytes(backup.sizeBytes)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleDownloadBackup(backup.filename)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>Download .db</span>
                    </button>
                    <button
                      onClick={() => setRestoreCandidate(backup)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw size={13} />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {restoreCandidate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl flex-shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Confirm Database Restore</h3>
                <p className="text-xs text-gray-500 mt-1">
                  You are about to restore the local hub database from:
                </p>
                <div className="p-2 bg-gray-100 rounded-lg text-xs font-mono font-bold text-gray-800 mt-2 break-all">
                  {restoreCandidate.filename}
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <ShieldAlert size={14} className="text-blue-600" />
                <span>Safety Pre-Restore Guarantee</span>
              </div>
              <p className="text-blue-800">
                RestaurantOS will automatically take a safety snapshot of the current state immediately before performing this restore.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRestoreCandidate(null)}
                disabled={isRestoring}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                {isRestoring && <RefreshCw className="animate-spin" size={14} />}
                <span>{isRestoring ? 'Restoring...' : 'Yes, Restore Database'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
