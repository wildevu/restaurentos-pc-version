import { runMigrations } from './src/db/index';
runMigrations().then(() => {
  console.log('done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
