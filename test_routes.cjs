const { authRouter } = require('./src/auth.routes');
console.log(authRouter.stack.map(r => r.route && r.route.path));
