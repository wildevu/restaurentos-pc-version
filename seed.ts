import { seedDb } from './src/db/index';
seedDb().then(() => process.exit(0)).catch(console.error);
