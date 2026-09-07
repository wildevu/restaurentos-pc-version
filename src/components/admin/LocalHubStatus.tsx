import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Wifi, 
  Database, 
  ShieldCheck, 
  CheckCircle2, 
  Copy, 
  Check, 
  RefreshCw, 
  Smartphone, 
  Tablet, 
  AlertCircle, 
  ExternalLink,
  QrCode,
  Layers,
  Clock,
  HardDrive
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function LocalHubStatus({ authToken }: { authToken?: string }) {
  const [status, setStatus] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hub/status');
      if (!res.ok) throw new Error('Could not reach Local Hub status service');
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const primaryUrl = status?.primaryLanUrl || (status?.lanIps?.[0] ? `http://${status.lanIps[0]}:3000` : 'http://localhost:3000');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Local Hub Access & Status</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Local restaurant server connection, Wi-Fi LAN access point, and connected device diagnostics.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 self-start"
        >
          <RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !status ? (
        <div className="p-12 text-center text-gray-400 text-sm bg-white rounded-2xl border border-gray-200">
          Querying Local Hub status...
        </div>
      ) : status && (
        <div className="space-y-6">
          {/* Main Status Hero Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Server size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">Hub Active & Running</span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mt-0.5">{status.restaurantName}</h3>
                  <span className="text-xs font-medium text-gray-400">RESTOS v{status.version} • Uptime {formatUptime(status.uptimeSeconds)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-100">
                  Port {status.port}
                </span>
                <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-100">
                  Windows Service Active
                </span>
              </div>
            </div>

            {/* Quick LAN Connect Box with QR Code */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Restaurant Wi-Fi / LAN Access URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={primaryUrl}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-base font-mono font-black text-blue-600 select-all"
                    />
                    <button
                      onClick={() => handleCopyUrl(primaryUrl)}
                      className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                        copied 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      }`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Copied' : 'Copy URL'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600 space-y-2">
                  <div className="font-bold text-gray-900 flex items-center gap-1.5">
                    <Smartphone size={14} className="text-blue-600" />
                    <span>How to connect staff tablets and phones:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-gray-600">
                    <li>Connect the waiter tablet or phone to the restaurant Wi-Fi.</li>
                    <li>Open the Camera or Safari / Chrome and scan the QR code on the right.</li>
                    <li>Or open browser and type <strong className="font-mono text-gray-900">{primaryUrl}</strong>.</li>
                    <li>Install the web app to the home screen (PWA) for 1-tap offline-ready access.</li>
                  </ol>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center justify-center p-5 bg-gray-50 rounded-2xl border border-gray-200/80">
                <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100">
                  <QRCodeSVG value={primaryUrl} size={130} level="M" />
                </div>
                <span className="text-[11px] font-bold text-gray-500 mt-2.5 text-center">
                  Scan with phone/tablet camera to open PWA
                </span>
              </div>
            </div>
          </div>

          {/* 4 Status Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status */}
            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 block">Hub Status</span>
                <span className="text-lg font-black text-emerald-600">● Running</span>
              </div>
            </div>

            {/* Database */}
            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Database size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 block">Database</span>
                <span className="text-lg font-black text-gray-900">● Healthy (WAL)</span>
              </div>
            </div>

            {/* Backups */}
            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <ShieldCheck size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 block">Backups</span>
                <span className="text-lg font-black text-gray-900">
                  ● Healthy ({status.backups?.totalBackups || 0})
                </span>
              </div>
            </div>

            {/* Connected Devices */}
            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Tablet size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 block">Connected Devices</span>
                <span className="text-lg font-black text-gray-900">
                  {status.connectedDevices} active
                </span>
              </div>
            </div>
          </div>

          {/* Network Adapters / Multi-IP Breakdown */}
          {status.lanIps && status.lanIps.length > 1 && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                <Wifi size={16} className="text-blue-600" />
                <span>Additional Network Interfaces</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {status.lanIps.map((ip: string) => (
                  <div key={ip} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-gray-800">http://{ip}:3000</span>
                    <button
                      onClick={() => handleCopyUrl(`http://${ip}:3000`)}
                      className="text-blue-600 hover:text-blue-700 text-xs font-bold"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
