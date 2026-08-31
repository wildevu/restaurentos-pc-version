const { Database } = require('better-sqlite3');
const db = new (require('better-sqlite3'))('local_hub.db');
console.log(db.prepare("SELECT username, role FROM users;").all());
