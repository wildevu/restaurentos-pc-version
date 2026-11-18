import React, { useState, useEffect } from 'react';
import {
  Server,
  Wifi,
  Database,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Smartphone,
  Tablet,
  AlertCircle,
  ChevronDown,
  Activity,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function LocalHubStatus({ authToken }: { authToken?: string }) {
  const [status, setStatus] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState<'primary' | 'fallback' | null>(null);
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
      setError(err.message || 'Could not load Local Hub status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyUrl = async (url: string, type: 'primary' | 'fallback') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(type);
      window.setTimeout(() => setCopied(current => current === type ? null : current), 2500);
    } catch {
      setError('Could not copy the address. Please select and copy it manually.');
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!Number.isFinite(seconds) || (seconds ?? 0) < 0) return '—';
    const total = Math.floor(seconds ?? 0);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
  };

  // The QR always uses the canonical hostname, never the temporary DHCP address.
  const primaryUrl: string = status?.primaryLanUrl || 'http://restos.local:8989';
  const lanFallbackUrl: string | null = status?.lanFallbackUrl || null;
  const hubIsRunning = status?.status === 'RUNNING';
  const mdnsIsPublished = status?.mdnsStatus === 'published';
  const databaseIsHealthy = status?.database?.status === 'HEALTHY';
  const backupCount = Number.isFinite(status?.backups?.totalBackups)
    ? status.backups.totalBackups
    : 0;
  const activeConnections = Number.isFinite(status?.connectedDevices)
    ? status.connectedDevices
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900">Local Hub</h2>
          <p className="mt-0.5 text-sm text-gray-500">Restaurant server and staff connection</p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="flex items-center gap-2 self-start rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-60"
        >
          <RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !status ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          Loading Local Hub status...
        </div>
      ) : status && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className={`rounded-2xl p-3.5 ${hubIsRunning ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  <Server size={30} />
                </div>
                <div className="min-w-0">
                  <div className={`mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wider ${hubIsRunning ? 'text-emerald-600' : 'text-red-600'}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${hubIsRunning ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {hubIsRunning ? 'Hub running' : 'Hub unavailable'}
                  </div>
                  <h3 className="truncate text-xl font-black text-gray-900">{status.restaurantName || 'RestaurantOS'}</h3>
                  <p className="mt-0.5 text-xs font-medium text-gray-400">
                    {status.version ? `RestaurantOS Local Hub v${status.version}` : 'RestaurantOS Local Hub'}
                    {status.uptimeSeconds !== undefined ? ` · Uptime ${formatUptime(status.uptimeSeconds)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700">
                  Port {status.port || 8989}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-gray-900">Connect staff devices</h4>
                    {mdnsIsPublished ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Stable address advertised</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">Address discovery needs attention</span>
                    )}
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-gray-500">
                    Connect staff phones and tablets to the restaurant Wi-Fi, then scan this QR code.
                  </p>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">Restaurant address</label>
                    <div className="flex min-w-0 items-center gap-2">
                      <code className="min-w-0 flex-1 break-all text-sm font-bold text-blue-700">{primaryUrl.replace(/^https?:\/\//, '')}</code>
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(primaryUrl, 'primary')}
                        aria-label="Copy restaurant address"
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${copied === 'primary' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      >
                        {copied === 'primary' ? <Check size={14} /> : <Copy size={14} />}
                        {copied === 'primary' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {lanFallbackUrl && (
                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">Temporary alternative address</p>
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <code className="min-w-0 break-all text-xs font-semibold text-amber-900">{lanFallbackUrl.replace(/^https?:\/\//, '')}</code>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(lanFallbackUrl, 'fallback')}
                          className="flex shrink-0 items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800"
                        >
                          {copied === 'fallback' ? <Check size={13} /> : <Copy size={13} />}
                          {copied === 'fallback' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-800">Use this only if a phone cannot open the stable address. This IP can change when the router renews its address.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                  <Smartphone size={16} className="mt-0.5 shrink-0 text-blue-600" />
                  <p>Keep staff devices connected to the same restaurant Wi-Fi. Scan the QR code or open the restaurant address above.</p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <QRCodeSVG value={primaryUrl} size={150} level="M" />
                </div>
                <span className="mt-3 text-center text-xs font-semibold text-gray-500">Scan to open RestaurantOS</span>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
              <div className={`rounded-xl p-3 ${databaseIsHealthy ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                <Database size={22} />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-semibold text-gray-400">Database</span>
                <span className={`text-sm font-black ${databaseIsHealthy ? 'text-emerald-700' : 'text-red-700'}`}>
                  {databaseIsHealthy ? 'Healthy' : 'Unavailable'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-semibold text-gray-400">Stored backups</span>
                <span className="text-sm font-black text-gray-900">
                  {backupCount === 0 ? 'No backups yet' : `${backupCount} available`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <Tablet size={22} />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-semibold text-gray-400">Active connections</span>
                <span className="text-sm font-black text-gray-900">{activeConnections}</span>
              </div>
            </div>
          </section>

          <details className="group overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-gray-100 p-2.5 text-gray-600">
                  <Activity size={19} />
                </div>
                <div>
                  <span className="block text-sm font-bold text-gray-900">Advanced diagnostics</span>
                  <span className="block text-xs text-gray-500">Technical connection and system details for troubleshooting</span>
                </div>
              </div>
              <ChevronDown size={18} className="shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-4 border-t border-gray-100 p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                    <Wifi size={16} className="text-blue-600" />
                    Network discovery (mDNS)
                  </div>
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Hostname</dt><dd className="break-all text-right font-semibold text-gray-800">{status.localHostname || 'restos.local'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Discovery status</dt><dd className="text-right font-semibold text-gray-800">{status.mdnsStatus || 'Unknown'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Advertised at</dt><dd className="break-all text-right font-semibold text-gray-800">{status.mdnsAddress || 'Not available'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Queries received</dt><dd className="text-right font-semibold text-gray-800">{status.mdnsQueriesReceived ?? 0}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Last query</dt><dd className="text-right font-semibold text-gray-800">{formatDateTime(status.mdnsLastQueryAt)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Query type(s)</dt><dd className="text-right font-semibold text-gray-800">{status.mdnsLastQueryTypes?.length ? status.mdnsLastQueryTypes.join(', ') : '—'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Query source</dt><dd className="break-all text-right font-semibold text-gray-800">{status.mdnsLastQuerySourceAddress ? `${status.mdnsLastQuerySourceAddress}:${status.mdnsLastQuerySourcePort || '?'}` : '—'}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Responses sent</dt><dd className="text-right font-semibold text-gray-800">{status.mdnsResponsesSent ?? 0}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Legacy unicast replies</dt><dd className="text-right font-semibold text-gray-800">{status.mdnsLegacyUnicastResponses ?? 0}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Unicast replies</dt><dd className="text-right font-semibold text-gray-800">{status.mdnsUnicastResponses ?? 0}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Last response</dt><dd className="text-right font-semibold text-gray-800">{formatDateTime(status.mdnsLastResponseAt)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-gray-500">Response mode</dt><dd className="text-right font-semibold text-gray-800">{status.mdnsLastResponseMode || '—'}</dd></div>
                  </dl>
                  {(status.mdnsLastResponseError || status.mdnsError) && (
                    <div className="mt-3 space-y-1 rounded-lg border border-red-100 bg-red-50 p-2 text-[11px] text-red-700">
                      {status.mdnsLastResponseError && <p><strong>Response error:</strong> {status.mdnsLastResponseError}</p>}
                      {status.mdnsError && <p><strong>Discovery error:</strong> {status.mdnsError}</p>}
                    </div>
                  )}
                  <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800">
                    Android troubleshooting: keep the phone on the restaurant Wi-Fi. Temporarily disable VPN and mobile data while testing the .local address, then try the temporary alternative address if needed.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                      <Database size={16} className="text-blue-600" />
                      Database and backups
                    </div>
                    <dl className="space-y-2 text-xs">
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">Database status</dt><dd className="text-right font-semibold text-gray-800">{status.database?.status || 'Unknown'}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">Journal mode</dt><dd className="text-right font-semibold text-gray-800">{status.database?.mode || '—'}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">Backup count</dt><dd className="text-right font-semibold text-gray-800">{backupCount}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">Last backup</dt><dd className="text-right font-semibold text-gray-800">{formatDateTime(status.backups?.lastBackupAt)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">Hub uptime</dt><dd className="text-right font-semibold text-gray-800">{formatUptime(status.uptimeSeconds)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gray-500">Application version</dt><dd className="text-right font-semibold text-gray-800">{status.version || '—'}</dd></div>
                    </dl>
                    {status.database?.error && (
                      <p className="mt-3 break-words rounded-lg border border-red-100 bg-red-50 p-2 text-[11px] text-red-700">{status.database.error}</p>
                    )}
                  </div>

                  {Array.isArray(status.lanIps) && status.lanIps.length > 0 && (
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                        <Wifi size={16} className="text-blue-600" />
                        Network interfaces
                      </div>
                      <div className="space-y-2">
                        {status.lanIps.map((ip: string) => (
                          <div key={ip} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-2">
                            <code className="break-all text-xs font-semibold text-gray-800">http://{ip}:{status.port || 8989}</code>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(`http://${ip}:${status.port || 8989}`, 'fallback')}
                              className="shrink-0 text-xs font-bold text-blue-700 hover:text-blue-800"
                            >
                              Copy
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-gray-400">
                These details are intended for support and troubleshooting. The hub refreshes its status automatically every 15 seconds.
              </p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
