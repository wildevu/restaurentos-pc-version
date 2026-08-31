import { db } from './src/db/index';
async function run() {
  const usersList = await db.query.users.findMany();
  console.log(usersList.map(u => ({ username: u.username, role: u.role })));
  process.exit(0);
}
run();
