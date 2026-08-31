import React, { useState, useEffect } from 'react';
import { Smartphone, Laptop, AlertTriangle, Monitor, XCircle } from 'lucide-react';

export function DeviceManagement({ authToken }: { authToken: string }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDevices = () => {
    fetch('/api/admin/devices', { headers: { 'Authorization': `Bearer ${authToken}` } })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          // Sort active first, then by last seen
          data.sort((a: any, b: any) => {
            if (a.revokedAt && !b.revokedAt) return 1;
            if (!a.revokedAt && b.revokedAt) return -1;
            return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
          });
          setDevices(data);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDevices();
  }, [authToken]);

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this device? It will be immediately logged out.')) return;
    
    try {
      const res = await fetch(`/api/admin/devices/${id}/revoke`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke device');
      fetchDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Device Management</h2>
      </div>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Device</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Member</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Activity</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {devices.map(device => (
              <tr key={device.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{device.name || 'Mobile Device'}</div>
                      <div className="text-xs text-gray-500 font-mono" title={device.deviceIdentifier}>
                        {device.deviceIdentifier.substring(0, 8)}...
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-gray-700">
                  {device.userName || <span className="text-gray-400 italic">Unknown</span>}
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">
                  {new Date(device.lastSeenAt).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  {!device.revokedAt ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium px-2 py-1 bg-emerald-50 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium px-2 py-1 bg-red-50 rounded-full">
                      <AlertTriangle size={12} /> Revoked
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {!device.revokedAt && (
                    <button
                      onClick={() => handleRevoke(device.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-2"
                      title="Revoke Device"
                    >
                      <XCircle size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {devices.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No devices registered yet.
          </div>
        )}
      </div>
    </div>
  );
}
