const fs = require('fs');
let code = fs.readFileSync('src/components/admin/StaffManagement.tsx', 'utf8');

const originalModal = `<div className="bg-blue-50 text-blue-800 text-xs rounded-lg p-3 mb-6">
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
            </div>`;

const updatedModal = `<div className="bg-blue-50 text-blue-800 text-sm rounded-lg p-3 mb-6 space-y-1 text-left">
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
            </div>`;

code = code.replace(originalModal, updatedModal);
fs.writeFileSync('src/components/admin/StaffManagement.tsx', code);
