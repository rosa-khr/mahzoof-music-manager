import menuCatalog from "../shared/menu-permissions.json" with { type: "json" };
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
    [5, "005_student_tabs_session_statuses.sql"],
    [6, "006_roles.sql"],
    [7, "007_role_status.sql"],
    [8, "008_subject_contact_details.sql"],
    [9, "009_instructor_profiles.sql"],
    [10, "010_payment_methods.sql"],
    [11, "011_student_workflow.sql"],
    [12, "012_delivery_methods.sql"],
    [13, "013_simplified_student_flow.sql"],
    [14, "014_workflow_safety.sql"],
    [15, "015_weekly_schedule_history.sql"],
    [16, "016_student_policy_acceptances.sql"],
  ]) {
    if (
      db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get(version)
    )
      continue;
    if (version === 11) db.exec("PRAGMA foreign_keys=OFF");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(
        readFileSync(new URL("./migrations/" + file, import.meta.url), "utf8"),
      );
      if (version === 6) {
        for (const [code, access] of [
          ["admin", "admin"],
          ["secretary", "education"],
          ["accountant", "finance"],
        ]) {
          const menus = menuCatalog
            .filter(
              (m) =>
                code === "admin" || m.access === "all" || m.access === access,
            )
            .map((m) => m.path);
          db.prepare("UPDATE roles SET permissions=? WHERE code=?").run(
            JSON.stringify(menus),
            code,
          );
        }
      }
      db.prepare("INSERT INTO schema_migrations(version) VALUES(?)").run(
        version,
      );
      if (version === 11 && db.prepare("PRAGMA foreign_key_check").all().length)
        throw Error("Workflow migration has inconsistent references");
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    } finally {
      if (version === 11) db.exec("PRAGMA foreign_keys=ON");
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
