import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, one } from "../db.mjs";
import { createUser } from "../auth.mjs";
import { createApp } from "../app.mjs";
import { ALL_MENUS } from "../permissions.mjs";
let db, server, base, admin;
const origin = "http://localhost:4200",
  password = "Role-Test-Password-2026";
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
async function login(username) {
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
  createUser(db, "admin", password);
  server = createApp(db, { origin }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  admin = await login("admin");
});
after(() => {
  server.close();
  db.close();
});
test("seeded administrator has every menu and cannot lose privileges or be replaced by arbitrary code", async () => {
  const roles = (await call("/roles")).body;
  assert.equal(roles.length, 3);
  const a = roles.find((r) => r.code === "admin");
  assert.equal(a.name, "مدیر");
  assert.deepEqual(a.permissions, ALL_MENUS);
  assert.deepEqual(admin.body.user.permissions, ALL_MENUS);
  for (const change of [
    { permissions: [] },
    { code: "other" },
    { is_admin: 0 },
  ])
    assert.equal(
      (
        await call("/roles/" + a.id, {
          method: "PATCH",
          body: { ...a, ...change },
        })
      ).status,
      422,
    );
  assert.equal((await call("/roles/" + a.id)).body.version, a.version);
  assert.equal(
    (
      await call("/roles", {
        method: "POST",
        body: { name: "مدیر", permissions: [] },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/roles", {
        method: "POST",
        body: { name: "نامعتبر", permissions: ["/unknown"] },
      })
    ).status,
    422,
  );
});
test("custom menu grants control API and session payload, role edits revoke sessions and persist versions", async () => {
  let r = await call("/roles", {
    method: "POST",
    body: { name: "مسئول ساز", permissions: ["/base-data/instruments"] },
  });
  assert.equal(r.status, 201);
  let role = r.body;
  const user = (
    await call("/users", {
      method: "POST",
      body: { username: "instrument-user", password, role: role.code },
    })
  ).body;
  assert.equal(user.role, role.code);
  let session = await login("instrument-user");
  assert.equal(session.status, 200);
  assert.equal(session.body.user.roleName, "مسئول ساز");
  assert.equal(session.body.user.admin, false);
  assert.deepEqual(session.body.user.permissions, ["/base-data/instruments"]);
  assert.equal(
    (await call("/base-data/instruments", { user: session })).status,
    200,
  );
  assert.equal(
    (
      await call("/base-data/instruments", {
        method: "POST",
        user: session,
        body: { name: "ساز مجاز" },
      })
    ).status,
    201,
  );
  for (const path of [
    "/users",
    "/roles",
    "/students",
    "/today",
    "/base-data/instructors",
    "/bank-accounts",
  ])
    assert.equal((await call(path, { user: session })).status, 403);
  assert.equal(
    (
      await call("/users/1/reset-password", {
        method: "POST",
        user: session,
        body: { version: 1, password },
      })
    ).status,
    403,
  );
  r = await call("/roles/" + role.id, {
    method: "PATCH",
    body: {
      version: role.version,
      name: "مسئول هنرجو",
      permissions: ["/students"],
    },
  });
  assert.equal(r.status, 200);
  role = r.body;
  assert.equal((await call("/auth/me", { user: session })).status, 401);
  session = await login("instrument-user");
  assert.equal((await call("/students", { user: session })).status, 200);
  assert.equal(
    (await call("/session-status-options", { user: session })).status,
    200,
  );
  assert.equal(
    (await call("/base-data/instruments", { user: session })).status,
    403,
  );
  assert.equal(
    (
      await call("/roles/" + role.id, {
        method: "PATCH",
        body: { version: 1, name: "قدیمی", permissions: [] },
      })
    ).status,
    409,
  );
  assert.equal((await call("/users/" + user.id)).body.role_name, "مسئول هنرجو");
});
test("users-only and roles-only delegates get exactly their granted management APIs; empty roles stay denied", async () => {
  for (const [name, permissions, allowed, denied] of [
    ["users-only", ["/users"], "/users", "/roles"],
    ["roles-only", ["/roles"], "/roles", "/users"],
    ["empty", [], null, "/roles"],
  ]) {
    const role = (
      await call("/roles", { method: "POST", body: { name, permissions } })
    ).body;
    createUser(db, name, password, role.code);
    const session = await login(name);
    assert.equal(session.status, 200);
    if (allowed)
      assert.equal((await call(allowed, { user: session })).status, 200);
    assert.equal((await call(denied, { user: session })).status, 403);
    for (const path of [
      "/students",
      "/today",
      "/base-data/instruments",
      "/bank-accounts",
    ])
      assert.equal((await call(path, { user: session })).status, 403);
    assert.equal((await call("/auth/me", { user: session })).status, 200);
  }
  assert.equal(one(db, "SELECT COUNT(*) n FROM roles WHERE is_admin=1").n, 1);
});
test("custom education and finance combinations preserve privacy and require contact details", async () => {
  const student = (
    await call("/students", {
      method: "POST",
      body: {
        firstName: "آوا",
        lastName: "نقش",
        phone: "+989121234567",
        subjectId: 1,
        age: 22,
        address: "نشانی محرمانه",
      },
    })
  ).body;
  const role = (
    await call("/roles", {
      method: "POST",
      body: { name: "آموزش و مالی", permissions: ["/students", "/payments"] },
    })
  ).body;
  createUser(db, "combined", password, role.code);
  const session = await login("combined");
  assert.equal(session.body.user.education, true);
  assert.equal(session.body.user.finance, true);
  assert.equal(session.body.user.admin, false);
  assert.equal(
    (await call("/students/" + student.id, { user: session })).body.age,
    22,
  );
  assert.equal(
    (
      await call("/students", {
        method: "POST",
        user: session,
        body: {
          firstName: "بدون",
          lastName: "تماس",
          phone: "",
          subjectId: 1,
          missingContactReason: "استثنا",
        },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call("/students", {
        method: "POST",
        body: {
          firstName: "بدون",
          lastName: "تماس مدیر",
          phone: "",
          subjectId: 1,
          missingContactReason: "استثنا",
        },
      })
    ).status,
    422,
  );
  createUser(db, "legacy-accountant", password, "accountant");
  const accountant = await login("legacy-accountant");
  assert.equal(accountant.body.user.education, false);
  assert.equal(
    (await call("/students/" + student.id, { user: accountant })).body.age,
    undefined,
  );
});

test("inactive roles revoke sessions, deny login and new assignments; reactivation preserves users and grants", async () => {
  const created = await call("/roles", {
    method: "POST",
    body: {
      name: "نقش قابل توقف",
      permissions: ["/", "/students"],
      active: true,
    },
  });
  assert.equal(created.status, 201);
  let role = created.body;
  const user = (
    await call("/users", {
      method: "POST",
      body: { username: "role-status-member", password, role: role.code },
    })
  ).body;
  const session = await login(user.username);
  assert.equal(session.status, 200);
  let result = await call("/roles/" + role.id, {
    method: "PATCH",
    body: {
      name: role.name,
      permissions: role.permissions,
      version: role.version,
      active: false,
    },
  });
  assert.equal(result.status, 200);
  role = result.body;
  assert.equal(role.active, 0);
  assert.equal((await call("/auth/me", { user: session })).status, 401);
  assert.equal((await login(user.username)).status, 401);
  assert.equal((await call("/users/" + user.id)).body.active, 1);
  assert.equal(
    (
      await call("/users", {
        method: "POST",
        body: { username: "inactive-assignment", password, role: role.code },
      })
    ).status,
    422,
  );
  const other = (
    await call("/users", {
      method: "POST",
      body: { username: "other-role-member", password, role: "secretary" },
    })
  ).body;
  assert.equal(
    (
      await call("/users/" + other.id, {
        method: "PATCH",
        body: { role: role.code, active: true, version: other.version },
      })
    ).status,
    422,
  );
  // Identity edits preserve an existing inactive assignment without making it effective.
  assert.equal(
    (
      await call("/users/" + user.id, {
        method: "PATCH",
        body: {
          role: role.code,
          active: true,
          username: user.username,
          version: (await call("/users/" + user.id)).body.version,
        },
      })
    ).status,
    200,
  );
  result = await call("/roles/" + role.id, {
    method: "PATCH",
    body: {
      name: role.name,
      permissions: role.permissions,
      version: role.version,
      active: true,
    },
  });
  assert.equal(result.status, 200);
  assert.equal((await login(user.username)).status, 200);
  assert.deepEqual(result.body.permissions, role.permissions);
  const a = (await call("/roles/1")).body;
  assert.equal(
    (await call("/roles/1", { method: "PATCH", body: { ...a, active: false } }))
      .status,
    422,
  );
  assert.equal(
    (
      await call("/roles", {
        method: "POST",
        body: { name: "وضعیت اشتباه", permissions: [], active: 0 },
      })
    ).status,
    422,
  );
  const inactive = await call("/roles", {
    method: "POST",
    body: { name: "از ابتدا غیرفعال", permissions: [], active: false },
  });
  assert.equal(inactive.status, 201);
  assert.equal(inactive.body.active, 0);
});
