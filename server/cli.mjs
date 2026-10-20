import { openDatabase, one, run, transaction } from "./db.mjs";
import { createUser, hashPassword } from "./auth.mjs";
const db = openDatabase();
const command = process.argv[2] || "create";
try {
  if (command === "create") {
    const role = process.argv[3] || "admin";
    const id = createUser(
      db,
      process.env.ADMIN_USERNAME,
      process.env.ADMIN_PASSWORD,
      role,
    );
    console.log("User created:", id, role);
  } else if (command === "reset") {
    const hash = hashPassword(process.env.ADMIN_PASSWORD);
    transaction(db, () => {
      const u = one(
        db,
        "SELECT * FROM users WHERE username=?",
        process.env.ADMIN_USERNAME,
      );
      if (!u) throw Error("User not found");
      run(db, "UPDATE users SET password_hash=? WHERE id=?", hash, u.id);
      run(db, "DELETE FROM auth_sessions WHERE user_id=?", u.id);
      run(
        db,
        "INSERT INTO audit_log(action,target,summary) VALUES('cli-password-reset',?,'{}')",
        String(u.id),
      );
    });
    console.log("Password reset and sessions revoked");
  } else throw Error("Use create [admin|secretary|accountant] or reset");
} finally {
  db.close();
}
