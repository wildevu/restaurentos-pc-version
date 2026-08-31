const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldSync = `socket.emit('SYNC', { lastKnownVersion: stateVersionRef.current }, (res: any) => {
          if (res && res.upToDate === false && res.state) {
            console.log('SYNC: Client was behind. Updating to version', res.state.stateVersion);
            stateVersionRef.current = res.state.stateVersion;
            setTables(res.state.tables);
            setOrders(res.state.orders);
            // Optionally update menu if it changed
            if (res.state.menu) setMenu(res.state.menu);
          } else {
            console.log('SYNC: Client is up to date.');
          }
          flushQueue();
        });`;

const newSync = `socket.emit('SYNC', { lastKnownVersion: stateVersionRef.current }, async (res: any) => {
          let latestTables = [];
          let latestOrders = [];
          setTables(prev => { latestTables = prev; return prev; });
          setOrders(prev => { latestOrders = prev; return prev; });
          
          if (res && res.upToDate === false && res.state) {
            console.log('SYNC: Client was behind. Updating to version', res.state.stateVersion);
            stateVersionRef.current = res.state.stateVersion;
            latestTables = res.state.tables;
            latestOrders = res.state.orders;
            if (res.state.menu) setMenu(res.state.menu);
          } else {
            console.log('SYNC: Client is up to date.');
          }
          
          // Re-apply pending commands optimistically
          try {
            const { db } = require('./offline/db');
            const { applyOptimisticCommand } = require('./offline/optimistic');
            const pending = await db.commands.where('status').anyOf('PENDING', 'SYNCING').sortBy('createdAt');
            let state = { tables: latestTables, orders: latestOrders };
            for (const cmd of pending) {
               state = applyOptimisticCommand(state, cmd.type, cmd.payload);
            }
            setTables(state.tables);
            setOrders(state.orders);
          } catch(e) {
            console.error('Optimistic re-apply failed', e);
            setTables(latestTables);
            setOrders(latestOrders);
          }
          
          flushQueue();
        });`;

code = code.replace(oldSync, newSync);
fs.writeFileSync('src/App.tsx', code);
