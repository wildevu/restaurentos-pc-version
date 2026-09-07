import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChefHat, CheckCircle, XCircle, Camera, Keyboard } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { RestosLogo } from './RestosLogo';
import { uuidv4 } from '../utils/uuid';

export function PairingScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>(token ? 'LOADING' : 'IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [mode, setMode] = useState<'SCAN' | 'MANUAL'>('SCAN');
  const [manualToken, setManualToken] = useState('');

  const processPairing = async (pairingToken: string) => {
    setStatus('LOADING');
    try {
      let deviceId = localStorage.getItem('restaurantos_device_id');
      if (!deviceId) {
        deviceId = uuidv4();
        localStorage.setItem('restaurantos_device_id', deviceId);
      }

      const res = await fetch('/api/auth/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pairingToken, deviceId })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Pairing failed. Ensure the server is reachable and code is valid.');
      }
      
      setStatus('SUCCESS');
      setTimeout(() => {
        onLogin(data.token);
        navigate('/', { replace: true });
      }, 1500);
    } catch (err: any) {
      setStatus('ERROR');
      setErrorMessage(err.message || 'Failed to reach Local Hub. Please retry.');
    }
  };

  useEffect(() => {
    if (token) {
      processPairing(token);
    }
  }, []); // Only on mount if token is in URL

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      processPairing(manualToken.trim());
    }
  };

  const parseScannedData = (text: string) => {
    try {
      const url = new URL(text);
      const t = url.searchParams.get('token');
      if (t) {
        processPairing(t);
      } else {
        throw new Error('Invalid QR format');
      }
    } catch {
      processPairing(text); // If they just encoded the token
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
        <div className="flex justify-center mb-6">
          <RestosLogo className="h-10 w-auto" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Connecting Device</h2>
        
        {status === 'IDLE' && (
          <div className="py-4">
            <div className="flex justify-center gap-4 mb-6">
              <button 
                onClick={() => setMode('SCAN')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'SCAN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
              >
                <Camera size={18} /> Scan QR
              </button>
              <button 
                onClick={() => setMode('MANUAL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${mode === 'MANUAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
              >
                <Keyboard size={18} /> Manual Code
              </button>
            </div>

            {mode === 'SCAN' ? (
              <div className="rounded-xl overflow-hidden border-2 border-gray-100">
                <Scanner onScan={(result) => parseScannedData(result[0].rawValue)} />
                <p className="text-sm text-gray-500 mt-3 p-2">Position the QR code within the frame to pair automatically.</p>
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <input 
                  type="text" 
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Enter pairing code..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-center font-mono"
                  required
                />
                <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                  Connect Device
                </button>
              </form>
            )}
          </div>
        )}

        {status === 'LOADING' && (
          <div className="py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Authenticating securely...</p>
          </div>
        )}
        
        {status === 'SUCCESS' && (
          <div className="py-8 animate-fade-in">
            <CheckCircle className="text-emerald-500 w-16 h-16 mx-auto mb-4" />
            <p className="text-emerald-700 font-medium text-lg">Device Paired Successfully</p>
            <p className="text-gray-500 text-sm mt-2">Redirecting you to the app...</p>
          </div>
        )}
        
        {status === 'ERROR' && (
          <div className="py-8">
            <XCircle className="text-red-500 w-16 h-16 mx-auto mb-4" />
            <p className="text-red-700 font-medium text-lg mb-2">Pairing Failed</p>
            <p className="text-red-500 text-sm">{errorMessage}</p>
            <div className="flex gap-3 justify-center mt-6">
              <button 
                onClick={() => {
                  setSearchParams({});
                  setStatus('IDLE');
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <button 
                onClick={() => navigate('/', { replace: true })}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
