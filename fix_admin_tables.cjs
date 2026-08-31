const fs = require('fs');
let code = fs.readFileSync('src/api/admin.ts', 'utf8');

code = code.replace(/eq\(tables\.restaurantId, req\.user\.restaurantId\)/g, "sql`1=1`");
code = code.replace(/restaurantId: req\.user\.restaurantId, \/\/ WAIT.*/g, "");
code = code.replace(/eq\(tables\.restaurantId, req\.user\.restaurantId\),/g, "");

fs.writeFileSync('src/api/admin.ts', code);
