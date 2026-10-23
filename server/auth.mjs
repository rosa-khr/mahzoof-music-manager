import {
  scryptSync,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { one, run, audit, transaction } from "./db.mjs";
import { decorateUser, roleRecord } from "./permissions.mjs";
import { assert, text, choice } from "./validation.mjs";
export const hashToken = (v) => createHash("sha256").update(v).digest("hex");
export function hashPassword(password) {
  assert(
    typeof password === "string" &&
      password.length >= 8 &&
      password.length <= 256,
    "رمز باید ۸ تا ۲۵۶ نویسه باشد",
  );
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password, stored) {
  const [salt, digest] = stored.split(":");
  const candidate = scryptSync(String(password).slice(0, 256), salt, 64);
  return timingSafeEqual(candidate, Buffer.from(digest, "hex"));
}
export function createUser(db, username, password, role = "admin") {
  username = text(username, "نام کاربری", 80, true);
  const assigned = roleRecord(db, role);
  assert(assigned.active, "نقش غیرفعال قابل تخصیص نیست");
  return run(
    db,
    "INSERT INTO users(username,password_hash,role,role_id) VALUES(?,?,?,?)",
    username,
    hashPassword(password),
    ["admin", "secretary", "accountant"].includes(role) ? role : "secretary",
    assigned.id,
  ).lastInsertRowid;
}
export const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  role: u.roleCode,
  roleName: u.roleName,
  education: u.education,
  finance: u.finance,
  admin: u.isAdmin,
  permissions: u.permissions,
});
export function installAuth(app, db, origin) {
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers.origin !== origin)
        return res.status(403).json({ error: "مبدأ درخواست مجاز نیست" });
    }
    next();
  });
  app.post("/api/auth/login", (req, res) => {
    const username = text(req.body.username, "نام کاربری", 80, true),
      key = req.ip + ":" + username,
      now = Date.now();
    const attempt = one(db, "SELECT * FROM auth_attempts WHERE key=?", key);
    assert(
      !attempt || attempt.reset_at < now || attempt.count < 5,
      "تلاش‌های ورود بیش از حد است؛ ۱۵ دقیقه بعد تلاش کنید",
      429,
    );
    const user = one(
      db,
      "SELECT u.* FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username=? AND r.active=1",
      username,
    );
    const valid = verifyPassword(
      String(req.body.password || ""),
      user?.password_hash || dummyHash,
    );
    if (!user || !user.active || !valid) {
      run(
        db,
        "INSERT INTO auth_attempts(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END",
        key,
        now + 900000,
        now,
        now,
        now + 900000,
      );
      return res
        .status(401)
        .json({ error: "نام کاربری یا رمز عبور نادرست است" });
    }
    run(db, "DELETE FROM auth_attempts WHERE key=?", key);
    run(db, "DELETE FROM auth_sessions WHERE expires_at<?", now);
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    run(
      db,
      "INSERT INTO auth_sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)",
      hashToken(token),
      user.id,
      csrf,
      now + 8 * 3600000,
    );
    audit(db, user, "login", user.id, {});
    res.cookie("mahzoof_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 8 * 3600000,
      path: "/",
    });
    res.json({ user: publicUser(decorateUser(db, user)), csrf });
  });
  app.use("/api", (req, res, next) => {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("mahzoof_session="))
      ?.slice(16);
    const auth =
      token &&
      one(
        db,
        "SELECT u.*,s.csrf,s.expires_at FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id WHERE s.token_hash=? AND r.active=1",
        hashToken(token),
      );
    assert(
      auth && auth.active && auth.expires_at > Date.now(),
      "لطفاً وارد شوید",
      401,
    );
    if (!["GET", "HEAD"].includes(req.method))
      assert(
        req.headers["x-csrf-token"] === auth.csrf,
        "درخواست امنیتی نامعتبر است",
        403,
      );
    req.user = decorateUser(db, auth);
    req.token = token;
    next();
  });
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: publicUser(req.user), csrf: req.user.csrf }),
  );
  app.post("/api/auth/logout", (req, res) => {
    run(
      db,
      "DELETE FROM auth_sessions WHERE token_hash=?",
      hashToken(req.token),
    );
    audit(db, req.user, "logout", req.user.id, {});
    res.clearCookie("mahzoof_session", { path: "/" }).json({ ok: true });
  });
  app.post("/api/auth/password", (req, res) => {
    assert(
      verifyPassword(req.body.currentPassword, req.user.password_hash),
      "رمز فعلی نادرست است",
      403,
    );
    const hash = hashPassword(req.body.newPassword);
    transaction(db, () => {
      run(
        db,
        "UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?",
        hash,
        req.user.id,
      );
      run(db, "DELETE FROM auth_sessions WHERE user_id=?", req.user.id);
      audit(db, req.user, "password-change", req.user.id, {});
    });
    res.clearCookie("mahzoof_session", { path: "/" }).json({ ok: true });
  });
}
const dummyHash = hashPassword(randomBytes(24).toString("hex"));
export function requireRole(req, roles) {
  const u = req.user;
  const allowed =
    roles.length === 1 && roles[0] === "admin"
      ? (u.isAdmin ?? u.role === "admin")
      : roles.includes(u.role);
  assert(allowed, "دسترسی مجاز نیست", 403);
}
