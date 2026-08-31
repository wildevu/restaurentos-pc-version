const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// I will add a small query for REJECTED commands
code = code.replace(
  "const [syncError, setSyncError] = useState(false);",
  "const [syncError, setSyncError] = useState(false);\n  const [rejectedCommands, setRejectedCommands] = useState<any[]>([]);"
);

// In the queue subscriber
code = code.replace(
  "const count = await getPendingCount();",
  "const count = await getPendingCount();\n      const { getRejectedCommands } = require('./offline');\n      const rejected = await getRejectedCommands();\n      setRejectedCommands(rejected);"
);

// Add the UI for rejected commands next to the status
const statusPill = `<div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200 mr-4">`;
const newStatusPill = `{rejectedCommands.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-full border border-red-200 mr-2 cursor-pointer" 
                   onClick={async () => {
                     const { clearRejectedCommands } = require('./offline');
                     await clearRejectedCommands();
                   }}
                   title={rejectedCommands.map(c => c.lastError).join('\\n')}>
                <AlertCircle size={14} />
                <span className="text-xs font-medium">{rejectedCommands.length} Error(s)</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200 mr-4">`;
code = code.replace(statusPill, newStatusPill);

fs.writeFileSync('src/App.tsx', code);
