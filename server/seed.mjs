// Explicit test fixture only: never invoked by migrate/start.
import { openDatabase, transaction, run, one } from "./db.mjs";
import { createTerm } from "./education.mjs";
if (process.argv[2] !== "--demo")
  throw Error(
    "Run npm run seed -- --demo explicitly against a disposable database",
  );
const db = openDatabase();
const admin = one(
  db,
  "SELECT * FROM users WHERE role='admin' AND active=1 LIMIT 1",
);
if (!admin) throw Error("Create an admin first");
if (one(db, "SELECT COUNT(*) n FROM students").n)
  throw Error("Demo seed requires empty student database");
transaction(db, () => {
  for (const [first, last, currency, quota, amount, consumed] of [
    ["آرمان", "نمونه بدهکار", "TOMAN", 4, "8000000", 0],
    ["سارا", "نمونه تکمیل‌شده", "TOMAN", 1, "2000000", 1],
    ["نیما", "نمونه دلار", "USD", 4, "100.50", 0],
  ]) {
    const id = Number(
      run(
        db,
        "INSERT INTO students(first_name,last_name,phone,history,search_text) VALUES(?,?,?,?,?)",
        first,
        last,
        "+989120000000",
        "unknown",
        first + " " + last,
      ).lastInsertRowid,
    );
    run(db, "UPDATE students SET code=? WHERE id=?", "DEMO-" + id, id);
    const term = createTerm(db, admin, id, {
      subjectId: 1,
      quota,
      amount,
      currency,
      registeredOn: "2026-10-19",
      mode: "onsite",
      location: "آموزشگاه محذوف",
    });
    if (consumed) {
      const st = one(db, "SELECT * FROM student_terms WHERE id=?", term);
      const sid = run(
        db,
        "INSERT INTO sessions(term_id,starts_at,timezone) VALUES(?,'2026-01-01T10:00:00Z','Asia/Tehran')",
        st.term_id,
      ).lastInsertRowid;
      run(
        db,
        "INSERT INTO attendance(session_id,student_term_id,status,counts) VALUES(?,?,'present',1)",
        sid,
        term,
      );
      run(db, "UPDATE student_terms SET status='completed' WHERE id=?", term);
    }
  }
});
console.log("Explicit synthetic demo fixtures created");
db.close();
