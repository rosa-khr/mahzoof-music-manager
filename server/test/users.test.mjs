import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, one } from "../db.mjs";
import { createApp } from "../app.mjs";
import { createUser } from "../auth.mjs";
let db, server, base, admin, secretary, accountant;
const origin = "http://localhost:4200",
  original = "Original-Test-Password-2026",
  replacement = "Replacement-Test-Password-2026";
async function call(path, { method = "GET", body, user = admin } = {}) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      ...(user ? { Cookie: user.cookie, "X-CSRF-Token": user.csrf } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json(), headers: r.headers };
}
async function login(username, password = original) {
  const r = await call("/auth/login", {
    method: "POST",
    user: null,
    body: { username, password },
  });
  return {
    ...r,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    csrf: r.body.csrf,
  };
}
before(async () => {
  db = openDatabase(":memory:");
  for (const role of ["admin", "secretary", "accountant"])
    createUser(db, role, original, role);
  server = createApp(db, { origin }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  admin = await login("admin");
  secretary = await login("secretary");
  accountant = await login("accountant");
});
after(() => {
  server.close();
  db.close();
});
test("user lifecycle: create, edit identity/role, revoke sessions, reset password, lock and unlock", async () => {
  let r = await call("/users", {
    method: "POST",
    body: { username: "lifecycle", password: original, role: "secretary" },
  });
  assert.equal(r.status, 201);
  let u = r.body;
  assert.equal(u.version, 1);
  assert.equal(u.password_hash, undefined);
  const first = await login("lifecycle");
  assert.equal(first.status, 200);
  r = await call("/users/" + u.id, {
    method: "PATCH",
    body: {
      version: u.version,
      username: "renamed",
      role: "accountant",
      active: true,
    },
  });
  assert.equal(r.status, 200);
  u = r.body;
  assert.equal(u.version, 2);
  assert.equal((await call("/auth/me", { user: first })).status, 401);
  assert.equal((await login("lifecycle")).status, 401);
  const second = await login("renamed");
  assert.equal(second.body.user.role, "accountant");
  r = await call(`/users/${u.id}/reset-password`, {
    method: "POST",
    body: { version: u.version, password: replacement },
  });
  assert.equal(r.status, 200);
  u = r.body;
  assert.equal(u.version, 3);
  assert.equal((await call("/auth/me", { user: second })).status, 401);
  assert.equal((await login("renamed")).status, 401);
  const third = await login("renamed", replacement);
  assert.equal(third.status, 200);
  r = await call("/users/" + u.id, {
    method: "PATCH",
    body: { version: u.version, role: u.role, active: false },
  });
  assert.equal(r.status, 200);
  u = r.body;
  assert.equal(u.active, 0);
  assert.equal((await call("/auth/me", { user: third })).status, 401);
  assert.equal((await login("renamed", replacement)).status, 401);
  r = await call(`/users/${u.id}/reset-password`, {
    method: "POST",
    body: { version: u.version, password: original },
  });
  assert.equal(r.status, 200);
  u = r.body;
  assert.equal(u.active, 0);
  assert.equal((await login("renamed")).status, 401);
  r = await call("/users/" + u.id, {
    method: "PATCH",
    body: { version: u.version, role: u.role, active: true },
  });
  assert.equal(r.status, 200);
  assert.equal((await login("renamed")).status, 200);
  const audits = db
    .prepare(
      "SELECT summary FROM audit_log WHERE action='user-password-reset' AND target=?",
    )
    .all(String(u.id));
  assert.ok(audits.length);
  for (const a of audits) {
    assert.ok(!a.summary.includes(original));
    assert.ok(!a.summary.includes(replacement));
    assert.ok(!a.summary.includes("hash"));
  }
});
test("user mutations reject stale versions, duplicate usernames, invalid roles/passwords and protect last admin atomically", async () => {
  const created = await call("/users", {
    method: "POST",
    body: { username: "atomic", password: original, role: "secretary" },
  });
  const u = created.body;
  const payload = {
    username: "admin",
    role: "accountant",
    active: false,
    version: u.version,
  };
  assert.equal(
    (await call("/users/" + u.id, { method: "PATCH", body: payload })).status,
    409,
  );
  assert.equal((await call("/users/" + u.id)).body.role, "secretary");
  for (const change of [
    { role: "invalid" },
    { active: "false" },
    { version: 999 },
  ]) {
    const r = await call("/users/" + u.id, {
      method: "PATCH",
      body: { ...payload, username: "atomic", ...change },
    });
    assert.ok([409, 422].includes(r.status));
  }
  for (const body of [
    { password: "short", version: 1 },
    { password: replacement, version: 999 },
    { password: replacement },
  ])
    assert.ok(
      [409, 422].includes(
        (await call(`/users/${u.id}/reset-password`, { method: "POST", body }))
          .status,
      ),
    );
  assert.equal((await login("atomic")).status, 200);
  const a = (await call("/users")).body.find((x) => x.username === "admin");
  for (const change of [
    { role: "secretary", active: true },
    { role: "admin", active: false },
  ])
    assert.equal(
      (
        await call("/users/" + a.id, {
          method: "PATCH",
          body: { ...change, version: a.version },
        })
      ).status,
      409,
    );
  assert.equal((await call("/auth/me")).status, 200);
  assert.equal(
    one(db, "SELECT auth_version n FROM users WHERE id=?", u.id).n,
    1,
  );
});
test("only administrators can list, inspect, create, edit, lock or reset other users; hashes never leave API", async () => {
  for (const user of [secretary, accountant])
    for (const [path, method, body] of [
      ["/users", "GET"],
      ["/users/1", "GET"],
      [
        "/users",
        "POST",
        { username: "forbidden", password: replacement, role: "admin" },
      ],
      ["/users/1", "PATCH", { role: "secretary", active: false }],
      [
        "/users/1/reset-password",
        "POST",
        { password: replacement, version: 1 },
      ],
    ])
      assert.equal((await call(path, { method, body, user })).status, 403);
  assert.equal((await call("/users", { user: null })).status, 401);
  for (const u of (await call("/users")).body) {
    assert.equal(u.password_hash, undefined);
    assert.equal((await call("/users/" + u.id)).body.password_hash, undefined);
  }
  assert.equal((await call("/users/9999")).status, 404);
});

test("eight-character passwords work for creation, reset and personal change; seven characters stay rejected", async () => {
  const username = "eight-character",
    first = "Pass1234",
    next = "Newp5678",
    last = "Self9876";
  assert.equal(
    (
      await call("/users", {
        method: "POST",
        body: { username, password: "Pass123", role: "secretary" },
      })
    ).status,
    422,
  );
  let r = await call("/users", {
    method: "POST",
    body: { username, password: first, role: "secretary" },
  });
  assert.equal(r.status, 201);
  const u = r.body;
  const session = await login(username, first);
  assert.equal(session.status, 200);
  assert.equal(
    (
      await call(`/users/${u.id}/reset-password`, {
        method: "POST",
        body: { password: "Newp567", version: u.version },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(`/users/${u.id}/reset-password`, {
        method: "POST",
        body: { password: next, version: u.version },
      })
    ).status,
    200,
  );
  assert.equal((await call("/auth/me", { user: session })).status, 401);
  assert.equal((await login(username, first)).status, 401);
  const changed = await login(username, next);
  assert.equal(changed.status, 200);
  assert.equal(
    (
      await call("/auth/password", {
        method: "POST",
        user: changed,
        body: { currentPassword: next, newPassword: "Self987" },
      })
    ).status,
    422,
  );
  assert.equal((await call("/auth/me", { user: changed })).status, 200);
  assert.equal(
    (
      await call("/auth/password", {
        method: "POST",
        user: changed,
        body: { currentPassword: next, newPassword: last },
      })
    ).status,
    200,
  );
  assert.equal((await call("/auth/me", { user: changed })).status, 401);
  assert.equal((await login(username, last)).status, 200);
});
