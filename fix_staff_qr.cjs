const fs = require('fs');
let code = fs.readFileSync('src/components/admin/StaffManagement.tsx', 'utf8');

// Add QRCode import
code = code.replace("import { Plus, Edit2, Shield, User, UserX, UserCheck } from 'lucide-react';", "import { Plus, Edit2, Shield, User, UserX, UserCheck, QrCode } from 'lucide-react';\nimport { QRCodeSVG } from 'qrcode.react';");

// Add state for pairing QR
const newStates = `
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
          'Authorization': \`Bearer \${authToken}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to generate token');
      else {
        // Construct the URL that the QR will point to
        const hubUrl = window.location.origin;
        const pairUrl = \`\${hubUrl}/pair?token=\${data.token}\`;
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
          'Authorization': \`Bearer \${authToken}\`,
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
`;
code = code.replace("const [isActive, setIsActive] = useState(true);", "const [isActive, setIsActive] = useState(true);\n" + newStates);

// Add button to table
const actionsHTML = `
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
`;
code = code.replace(/<td className="px-6 py-4 text-right">[\s\S]*?<\/td>/, actionsHTML);

// Add Pairing Modal
const pairingModal = `
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
            
            <div className="bg-blue-50 text-blue-800 text-xs rounded-lg p-3 mb-6">
              This code expires in 15 minutes and can only be used once.
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
            </div>
          </div>
        </div>
      )}
`;
code = code.replace("{showModal && (", pairingModal + "\n      {showModal && (");

fs.writeFileSync('src/components/admin/StaffManagement.tsx', code);
