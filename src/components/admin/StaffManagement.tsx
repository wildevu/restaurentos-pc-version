import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Shield, User, UserX, UserCheck, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function StaffManagement({ authToken, currentUser }: { authToken: string, currentUser: any }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('WAITER');
  const [isActive, setIsActive] = useState(true);

  const [pairingUser, setPairingUser] = useState<any>(null);
  const [pairingData, setPairingData] = useState<{ token: string, url: string } | null>(null);
  const [generatingQR, setGeneratingQR] = useState(false);

  const handleGeneratePairing = async (user: any) => {
    setPairingUser(user);
    setPairingData(null);
    setGeneratingQR(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/pairing/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to generate token');
      else {
        // Construct the URL that the QR will point to
        const hubUrl = window.location.origin;
        const pairUrl = `${hubUrl}/pair?token=${data.token}`;
        setPairingData({ token: data.token, url: pairUrl });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingQR(false);
    }
  };
  
  const handleInvalidatePairing = async () => {
    if (!pairingUser) return;
    try {
      await fetch('/api/admin/pairing/invalidate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: pairingUser.id })
      });
      setPairingUser(null);
      setPairingData(null);
    } catch (err) {
      console.error(err);
    }
  };


  const fetchStaff = () => {
    fetch('/api/admin/staff', { headers: { 'Authorization': `Bearer ${authToken}` } })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setStaff(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStaff();
  }, [authToken]);

  const handleOpenNew = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setPassword('');
    setRole('WAITER');
    setIsActive(true);
    setShowModal(true);
  };
  
  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setName(user.name);
    setUsername(user.username);
    setPassword(''); // don't show existing
    setRole(user.role);
    setIsActive(user.isActive);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const url = editingUser ? `/api/admin/staff/${editingUser.id}` : `/api/admin/staff`;
    const method = editingUser ? 'PUT' : 'POST';
    
    const body: any = { name, role, isActive };
    if (!editingUser) {
      body.username = username;
      body.password = password;
    } else if (password) {
      body.password = password;
    }
    
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to save');
      else {
        setShowModal(false);
        fetchStaff();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Staff Management</h2>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> Add Staff
        </button>
      </div>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map(member => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{member.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{member.username}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                    ${member.role === 'OWNER' ? 'bg-purple-100 text-purple-800' :
                      member.role === 'MANAGER' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-gray-100 text-gray-800'}`}>
                    <Shield size={12} />
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {member.isActive ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium">
                      <UserCheck size={16} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
                      <UserX size={16} /> Deactivated
                    </span>
                  )}
                </td>
                
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button
                    onClick={() => handleGeneratePairing(member)}
                    className="text-gray-400 hover:text-green-600 transition-colors p-2"
                    title="Generate Pairing QR"
                  >
                    <QrCode size={18} />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(member)}
                    className="text-gray-400 hover:text-blue-600 transition-colors p-2"
                  >
                    <Edit2 size={18} />
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      
      {pairingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Pair Device
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Scan this QR code with {pairingUser.name}'s phone to log them in automatically.
            </p>
            
            <div className="flex justify-center mb-6 min-h-[200px] items-center">
              {generatingQR ? (
                <div className="text-gray-500">Generating secure token...</div>
              ) : pairingData ? (
                <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm inline-block">
                  <QRCodeSVG value={pairingData.url} size={200} />
                </div>
              ) : (
                <div className="text-red-500">Failed to generate QR</div>
              )}
            </div>
            
            <div className="bg-blue-50 text-blue-800 text-sm rounded-lg p-3 mb-6 space-y-1 text-left">
              <p><strong>Expiration:</strong> 15 minutes</p>
              <p><strong>Usage Status:</strong> {pairingData ? 'Pending Scan (Valid)' : 'Invalidated / Used'}</p>
            </div>
            
            <div className="flex gap-3 justify-center border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  handleInvalidatePairing();
                  setPairingUser(null);
                }}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition-colors"
              >
                Close & Invalidate
              </button>
              <button
                type="button"
                onClick={() => handleGeneratePairing(pairingUser)}
                className="px-4 py-2 bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 rounded-lg transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingUser ? 'Edit Staff Member' : 'Add New Staff'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep)' : 'Password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editingUser}
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={editingUser?.role === 'OWNER'}
                >
                  {editingUser?.role === 'OWNER' && <option value="OWNER">OWNER</option>}
                  {currentUser.role === 'OWNER' && <option value="MANAGER">MANAGER</option>}
                  <option value="WAITER">WAITER</option>
                  <option value="KITCHEN">KITCHEN</option>
                </select>
              </div>

              {editingUser && editingUser.role !== 'OWNER' && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Account Active</label>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 mt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
