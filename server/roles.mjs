import { randomUUID } from "node:crypto";
import { all, one, run, transaction, audit } from "./db.mjs";
import { assert, text, integer, normalize } from "./validation.mjs";
import { MENU_PERMISSIONS, ALL_MENUS, requireMenu } from "./permissions.mjs";
export function roleView(row) {
  return {
    ...row,
    permissions: row.is_admin
      ? [...ALL_MENUS]
      : JSON.parse(row.permissions).filter((p) => ALL_MENUS.includes(p)),
  };
}
function record(db, id) {
  const row = one(db, "SELECT * FROM roles WHERE id=?", id);
  assert(row, "نقش یافت نشد", 404);
  return roleView(row);
}
function validate(body, old) {
  const name = text(body.name, "نام نقش", 100, true);
  assert(
    body.active === undefined || typeof body.active === "boolean",
    "وضعیت نقش نامعتبر است",
  );
  const active =
    body.active === undefined ? (old ? !!old.active : true) : body.active;
  assert(!old?.is_admin || active, "نقش مدیر قابل غیرفعال‌کردن نیست");
  assert(
    Array.isArray(body.permissions) &&
      body.permissions.every(
        (p) => typeof p === "string" && ALL_MENUS.includes(p),
      ),
    "فهرست دسترسی نامعتبر است",
  );
  const permissions = [...new Set(body.permissions)];
  if (old?.is_admin)
    assert(
      permissions.length === ALL_MENUS.length,
      "نقش مدیر باید به همه منوها دسترسی داشته باشد",
    );
  return {
    name,
    name_key: normalize(name).replace(/\s+/g, " "),
    permissions,
    active: active ? 1 : 0,
  };
}
export function installRoles(app, db) {
  app.get("/api/roles/menu-options", (req, res) => {
    requireMenu(req, "/roles");
    res.json(MENU_PERMISSIONS);
  });
  app.get("/api/roles", (req, res) => {
    requireMenu(req, "/roles");
    res.json(
      all(
        db,
        "SELECT r.*,(SELECT COUNT(*) FROM users u WHERE u.role_id=r.id) user_count FROM roles r ORDER BY r.id",
      ).map(roleView),
    );
  });
  app.get("/api/roles/:id", (req, res) => {
    requireMenu(req, "/roles");
    res.json(record(db, integer(req.params.id, "نقش")));
  });
  app.post("/api/roles", (req, res) => {
    requireMenu(req, "/roles");
    const v = validate(req.body);
    const id = transaction(db, () => {
      const id = Number(
        run(
          db,
          "INSERT INTO roles(code,name,name_key,permissions,active) VALUES(?,?,?,?,?)",
          "role-" + randomUUID(),
          v.name,
          v.name_key,
          JSON.stringify(v.permissions),
          v.active,
        ).lastInsertRowid,
      );
      audit(db, req.user, "role-created", id, {
        name: v.name,
        permissions: v.permissions,
        active: v.active,
      });
      return id;
    });
    res.status(201).json(record(db, id));
  });
  app.patch("/api/roles/:id", (req, res) => {
    requireMenu(req, "/roles");
    const id = integer(req.params.id, "نقش");
    transaction(db, () => {
      const old = record(db, id),
        v = validate(req.body, old);
      assert(
        integer(req.body.version, "نسخه") === old.version,
        "نقش تغییر کرده است؛ صفحه را دوباره باز کنید",
        409,
      );
      assert(
        req.body.code === undefined || req.body.code === old.code,
        "کد نقش قابل تغییر نیست",
      );
      assert(
        req.body.is_admin === undefined ||
          Number(req.body.is_admin) === old.is_admin,
        "نوع نقش مدیر قابل تغییر نیست",
      );
      run(
        db,
        "UPDATE roles SET name=?,name_key=?,permissions=?,active=?,version=version+1 WHERE id=?",
        v.name,
        v.name_key,
        JSON.stringify(v.permissions),
        v.active,
        id,
      );
      run(
        db,
        "DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE role_id=?)",
        id,
      );
      run(
        db,
        "UPDATE users SET auth_version=auth_version+1 WHERE role_id=?",
        id,
      );
      audit(db, req.user, "role-updated", id, {
        name: v.name,
        permissions: v.permissions,
        version: old.version + 1,
        active: v.active,
      });
    });
    res.json(record(db, id));
  });
}
