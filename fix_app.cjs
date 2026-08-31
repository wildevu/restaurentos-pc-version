const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Ensure optimistic apply imports
code = code.replace(
  "import { ChefHat, LogOut } from 'lucide-react';",
  "import { ChefHat, LogOut, CloudOff, Cloud, RefreshCw, AlertCircle } from 'lucide-react';\nimport { subscribeToQueue, subscribeToOptimistic, getPendingCount, flushQueue } from './offline';"
);

// Add state for pending queue
code = code.replace(
  "const [isConnected, setIsConnected] = useState(false);",
  "const [isConnected, setIsConnected] = useState(false);\n  const [pendingCommands, setPendingCommands] = useState(0);\n  const [syncError, setSyncError] = useState(false);"
);

// Set up effect for queue subscription
const useEffectString = `
  useEffect(() => {
    const unsubQueue = subscribeToQueue(async () => {
      const count = await getPendingCount();
      setPendingCommands(count);
      setSyncError(false); // Can be enhanced later to track rejected commands specifically
    });

    const unsubOpt = subscribeToOptimistic((type, payload) => {
      setTables(prevTables => {
        setOrders(prevOrders => {
           const { applyOptimisticCommand } = require('./offline/optimistic');
           const result = applyOptimisticCommand({ tables: prevTables, orders: prevOrders }, type, payload);
           return result.orders;
        });
        // Very hacky but applyOptimisticCommand returns {tables, orders}. Let's do it cleanly:
        return prevTables; 
      });
    });

    return () => {
      unsubQueue();
      unsubOpt();
    };
  }, []);
`;
code = code.replace("useEffect(() => {\n    checkStatus();\n  }, []);", `useEffect(() => {
    checkStatus();
  }, []);${useEffectString}`);

// Wait, the above optimistic UI hack is tricky inside state setters. Let's fix it inside App.tsx:
const betterUseEffectString = `
  useEffect(() => {
    const unsubQueue = subscribeToQueue(async () => {
      const count = await getPendingCount();
      setPendingCommands(count);
    });

    const unsubOpt = subscribeToOptimistic((type, payload) => {
      setTables(prevTables => {
        let newTables = prevTables;
        setOrders(prevOrders => {
           const { applyOptimisticCommand } = require('./offline/optimistic');
           const result = applyOptimisticCommand({ tables: prevTables, orders: prevOrders }, type, payload);
           newTables = result.tables;
           return result.orders;
        });
        return newTables;
      });
    });

    return () => {
      unsubQueue();
      unsubOpt();
    };
  }, []);
`;
code = code.replace(useEffectString, betterUseEffectString);


// On connect, trigger flushQueue
code = code.replace(
  "console.log('SYNC: Client is up to date.');\n          }",
  "console.log('SYNC: Client is up to date.');\n          }\n          flushQueue();"
);

// UI for status
const oldStatus = `<div className={\`w-2.5 h-2.5 rounded-full \${isConnected ? 'bg-emerald-500' : 'bg-red-500'}\`}></div>
            <span className="text-gray-600 mr-4">{isConnected ? 'LAN Connected' : 'Disconnected'}</span>`;
            
const newStatus = `<div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200 mr-4">
              {isConnected ? (
                pendingCommands > 0 ? (
                  <><RefreshCw size={14} className="text-blue-500 animate-spin" /><span className="text-xs font-medium text-gray-700">Syncing ({pendingCommands})</span></>
                ) : (
                  <><Cloud size={14} className="text-emerald-500" /><span className="text-xs font-medium text-gray-700">Online</span></>
                )
              ) : (
                <><CloudOff size={14} className="text-red-500" /><span className="text-xs font-medium text-gray-700">Offline {pendingCommands > 0 && \`(\${pendingCommands})\`}</span></>
              )}
            </div>`;

code = code.replace(oldStatus, newStatus);
fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
