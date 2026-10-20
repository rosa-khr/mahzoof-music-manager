import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
export function openDatabase(
  path = process.env.DB_PATH || "./data/mahzoof.sqlite",
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  for (const [version, file] of [
    [1, "001_initial.sql"],
    [2, "002_student_editor.sql"],
    [3, "003_base_data.sql"],
    [4, "004_instrument_english_name.sql"],
  ]) {
    if (
      db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get(version)
    )
      continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(
        readFileSync(new URL("./migrations/" + file, import.meta.url), "utf8"),
      );
      db.prepare("INSERT INTO schema_migrations(version) VALUES(?)").run(
        version,
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return db;
}
export const one = (db, sql, ...args) => db.prepare(sql).get(...args);
export const all = (db, sql, ...args) => db.prepare(sql).all(...args);
export const run = (db, sql, ...args) => db.prepare(sql).run(...args);
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function audit(db, user, action, target, summary) {
  run(
    db,
    "INSERT INTO audit_log(actor_id,action,target,summary) VALUES(?,?,?,?)",
    user.id,
    action,
    String(target),
    JSON.stringify(summary),
  );
}
