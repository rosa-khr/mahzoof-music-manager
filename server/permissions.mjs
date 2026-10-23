import catalog from "../shared/menu-permissions.json" with { type: "json" };
import { one } from "./db.mjs";
import { assert } from "./validation.mjs";
export const MENU_PERMISSIONS = catalog;
export const ALL_MENUS = catalog.map((x) => x.path);
export function roleRecord(db, code) {
  assert(
    typeof code === "string" && code.length > 0 && code.length <= 100,
    "نقش نامعتبر است",
  );
  const row = one(db, "SELECT * FROM roles WHERE code=?", code);
  assert(row, "نقش نامعتبر است");
  return row;
}
export function decorateUser(db, u) {
  if (!u) return u;
  const role = one(db, "SELECT * FROM roles WHERE id=?", u.role_id);
  assert(role, "نقش کاربر یافت نشد", 403);
  const permissions = role.is_admin
    ? ALL_MENUS
    : JSON.parse(role.permissions).filter((p) => ALL_MENUS.includes(p));
  const education =
    !!role.is_admin ||
    (permissions.includes("/students") && role.code !== "accountant");
  const finance =
    !!role.is_admin ||
    permissions.some(
      (p) => catalog.find((x) => x.path === p)?.access === "finance",
    );
  return {
    ...u,
    role: education
      ? finance
        ? "admin"
        : "secretary"
      : finance
        ? "accountant"
        : "none",
    roleCode: role.code,
    roleName: role.name,
    isAdmin: !!role.is_admin,
    education,
    finance,
    permissions,
  };
}
export function requireMenu(req, ...paths) {
  assert(
    req.user.isAdmin || paths.some((p) => req.user.permissions?.includes(p)),
    "دسترسی مجاز نیست",
    403,
  );
}
export function installMenuAccess(app) {
  app.use("/api", (req, res, next) => {
    const p = req.path;
    if (p.startsWith("/auth/")) return next();
    if (p === "/today") requireMenu(req, "/");
    else if (p === "/session-status-options") requireMenu(req, "/students");
    else if (p.startsWith("/users")) requireMenu(req, "/users");
    else if (p.startsWith("/roles")) requireMenu(req, "/roles");
    else if (p.startsWith("/base-data/"))
      requireMenu(req, "/base-data/" + p.split("/")[2]);
    else if (p.startsWith("/instructors/"))
      requireMenu(req, "/base-data/instructors");
    else if (p === "/subjects") requireMenu(req, "/subjects", "/students");
    else if (p.startsWith("/subject-catalog")) requireMenu(req, "/subjects");
    else if (p.startsWith("/registration-policies"))
      requireMenu(req, "/registration-policies");
    else if (p.startsWith("/settings/letterhead"))
      requireMenu(req, "/settings/letterhead");
    else if (p.startsWith("/enrollments/")) requireMenu(req, "/students");
    else if (p === "/full-tuition-payments") requireMenu(req, "/payments");
    else if (
      p.startsWith("/students") ||
      p.startsWith("/terms/") ||
      p.startsWith("/sessions/") ||
      p.startsWith("/attendance/")
    )
      requireMenu(req, "/students");
    else if (p === "/bank-accounts")
      requireMenu(req, "/bank-accounts", "/payments");
    else if (p === "/payments" || p.startsWith('/payments/')) requireMenu(req, "/payments");
    next();
  });
}
