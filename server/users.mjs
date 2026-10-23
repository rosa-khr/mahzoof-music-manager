import { all, one, run, transaction, audit } from "./db.mjs";
import { requireRole, createUser, hashPassword } from "./auth.mjs";
import { roleRecord, requireMenu } from "./permissions.mjs";
import { assert, text, integer, choice } from "./validation.mjs";
const fields =
  "u.id,u.username,r.code AS role,r.name AS role_name,u.role_id,u.active,u.auth_version AS version";
const source = "users u JOIN roles r ON r.id=u.role_id";
function record(db, id) {
  const user = one(db, `SELECT ${fields} FROM ${source} WHERE u.id=?`, id);
  assert(user, "کاربر یافت نشد", 404);
  return user;
}
function checkVersion(body, old, required = false) {
  if (required || body.version !== undefined)
    assert(
      integer(body.version, "نسخه") === old.version,
      "اطلاعات کاربر تغییر کرده است؛ صفحه را دوباره باز کنید",
      409,
    );
}
export function installUsers(app, db) {
  app.get("/api/users", (req, res) => {
    requireMenu(req, "/users");
    res.json(all(db, `SELECT ${fields} FROM ${source} ORDER BY u.id`));
  });
  app.get("/api/users/role-options", (req, res) => {
    requireMenu(req, "/users");
    res.json(
      all(db, "SELECT id,code,name,is_admin,active FROM roles ORDER BY id"),
    );
  });
  app.get("/api/users/:id", (req, res) => {
    requireMenu(req, "/users");
    res.json(record(db, integer(req.params.id, "کاربر")));
  });
  app.post("/api/users", (req, res) => {
    requireMenu(req, "/users");
    roleRecord(db, req.body.role);
    assert(
      req.body.active === undefined || typeof req.body.active === "boolean",
      "وضعیت نامعتبر است",
    );
    const id = transaction(db, () => {
      const id = Number(
        createUser(db, req.body.username, req.body.password, req.body.role),
      );
      if (req.body.active === false)
        run(db, "UPDATE users SET active=0 WHERE id=?", id);
      audit(db, req.user, "user-created", id, {
        role: req.body.role,
        active: req.body.active !== false,
      });
      return id;
    });
    res.status(201).json(record(db, id));
  });
  app.patch("/api/users/:id", (req, res) => {
    requireMenu(req, "/users");
    const id = integer(req.params.id, "کاربر"),
      role = roleRecord(db, req.body.role).code;
    assert(typeof req.body.active === "boolean", "وضعیت نامعتبر است");
    transaction(db, () => {
      const old = record(db, id);
      checkVersion(req.body, old);
      assert(
        roleRecord(db, role).active || role === old.role,
        "نقش غیرفعال قابل تخصیص نیست",
      );
      const username =
        req.body.username === undefined
          ? old.username
          : text(req.body.username, "نام کاربری", 80, true);
      if (
        old.role === "admin" &&
        old.active &&
        (!req.body.active || role !== "admin")
      )
        assert(
          one(
            db,
            "SELECT COUNT(*) n FROM users u JOIN roles r ON r.id=u.role_id WHERE r.is_admin=1 AND u.active=1",
          ).n > 1,
          "آخرین مدیر فعال قابل حذف نیست",
          409,
        );
      run(
        db,
        "UPDATE users SET username=?,role=?,active=?,role_id=?,auth_version=auth_version+1 WHERE id=?",
        username,
        ["admin", "secretary", "accountant"].includes(role)
          ? role
          : "secretary",
        req.body.active ? 1 : 0,
        roleRecord(db, role).id,
        id,
      );
      run(db, "DELETE FROM auth_sessions WHERE user_id=?", id);
      audit(db, req.user, "user-updated", id, {
        role,
        active: req.body.active,
        username,
        version: old.version + 1,
      });
    });
    res.json({ ...record(db, id), ok: true });
  });
  app.post("/api/users/:id/reset-password", (req, res) => {
    requireMenu(req, "/users");
    const id = integer(req.params.id, "کاربر");
    const hash = hashPassword(req.body.password);
    transaction(db, () => {
      const old = record(db, id);
      checkVersion(req.body, old, true);
      run(
        db,
        "UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?",
        hash,
        id,
      );
      run(db, "DELETE FROM auth_sessions WHERE user_id=?", id);
      audit(db, req.user, "user-password-reset", id, {
        version: old.version + 1,
      });
    });
    res.json({ ...record(db, id), ok: true });
  });
}
