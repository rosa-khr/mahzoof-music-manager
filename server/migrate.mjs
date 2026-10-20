import { openDatabase } from "./db.mjs";
const db = openDatabase();
console.log(
  "Database migrated:",
  db.prepare("SELECT * FROM schema_migrations").all(),
);
db.close();
