import React, { useState } from 'react';

export function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Ensure deviceId exists
    let deviceId = localStorage.getItem('restaurantos_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('restaurantos_device_id', deviceId);
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-neutral-900">
          RestaurantOS
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-600">
          Sign in to your account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-neutral-700">Username</label>
              <div className="mt-1">
                <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="block w-full appearance-none rounded-md border border-neutral-300 px-3 py-2 shadow-sm placeholder-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700">Password</label>
              <div className="mt-1">
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="block w-full appearance-none rounded-md border border-neutral-300 px-3 py-2 shadow-sm placeholder-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm" />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md border border-transparent bg-neutral-900 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
