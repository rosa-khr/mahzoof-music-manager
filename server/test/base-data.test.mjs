import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, one } from "../db.mjs";
import { createApp } from "../app.mjs";
import { createUser } from "../auth.mjs";
let db, server, base, admin, secretary, accountant;
const origin = "http://localhost:4200";
async function call(path, { method = "GET", body, user = admin } = {}) {
  const r = await fetch(base + "/api/base-data" + path, {
    method,
    headers: {
      Origin: origin,
      ...(user ? { Cookie: user.cookie, "X-CSRF-Token": user.csrf } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}
before(async () => {
  db = openDatabase(":memory:");
  for (const role of ["admin", "secretary", "accountant"])
    createUser(db, role, "Test-Password-2026", role);
  server = createApp(db, { origin }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  const login = async (role) => {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username: role, password: "Test-Password-2026" }),
    });
    const b = await r.json();
    return { cookie: r.headers.get("set-cookie").split(";")[0], csrf: b.csrf };
  };
  admin = await login("admin");
  secretary = await login("secretary");
  accountant = await login("accountant");
});
after(() => {
  server.close();
  db.close();
});
for (const resource of ["teaching-types", "instructors", "instruments"]) {
  test(`${resource}: real create, read, versioned edit and deactivate without deleting`, async () => {
    const b = {
      name: "عنوان " + resource,
      notes: "توضیحات",
      status: "active",
      ...(resource === "instructors" ? { phone: "+989121234567" } : {}),
    };
    let r = await call("/" + resource, { method: "POST", body: b });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const id = r.body.id;
    assert.equal(r.body.version, 1);
    assert.equal((await call(`/${resource}/${id}`)).body.name, b.name);
    r = await call(`/${resource}/${id}`, {
      method: "PATCH",
      user: secretary,
      body: {
        ...b,
        name: "ویرایش " + resource,
        status: "inactive",
        version: 1,
      },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.version, 2);
    assert.equal(r.body.status, "inactive");
    assert.equal(
      (
        await call(`/${resource}/${id}`, {
          method: "PATCH",
          body: { ...b, version: 1 },
        })
      ).status,
      409,
    );
    assert.equal((await call(`/${resource}/${id}`)).body.status, "inactive");
    assert.equal((await call(`/${resource}/9999`)).status, 404);
    const listed = await call("/" + resource);
    assert.ok(listed.body.items.some((v) => v.id === id));
    assert.equal(
      (await call("/" + resource, { method: "POST", body: { name: " " } }))
        .status,
      422,
    );
    assert.equal(
      (
        await call(`/${resource}/${id}`, {
          method: "PATCH",
          body: { ...b, version: 2, status: "invalid" },
        })
      ).status,
      422,
    );
    assert.equal((await call(`/${resource}/${id}`)).body.version, 2);
  });
}
test("base data permissions and catalog allowlist protect every method", async () => {
  for (const resource of ["teaching-types", "instructors", "instruments"]) {
    assert.equal((await call("/" + resource, { user: null })).status, 401);
    for (const [path, method] of [
      [`/${resource}`, "GET"],
      [`/${resource}/1`, "GET"],
      [`/${resource}`, "POST"],
      [`/${resource}/1`, "PATCH"],
    ])
      assert.equal(
        (
          await call(path, {
            method,
            user: accountant,
            body: method === "GET" ? undefined : { name: "ممنوع", version: 1 },
          })
        ).status,
        403,
      );
  }
  assert.equal((await call("/users")).status, 404);
  assert.equal(
    (
      await call("/instructors", {
        method: "POST",
        body: { name: "تماس نامعتبر", phone: "abc" },
      })
    ).status,
    422,
  );
});
test("catalog grid filters and sorts full data before paging and normalizes Persian uniqueness", async () => {
  for (let i = 0; i < 125; i++)
    assert.equal(
      (
        await call("/instruments", {
          method: "POST",
          body: { name: "آزمون " + String(i).padStart(3, "0") },
        })
      ).status,
      201,
    );
  const query = new URLSearchParams({
    startRow: "100",
    endRow: "125",
    sortModel: JSON.stringify([{ colId: "name", sort: "asc" }]),
    filterModel: JSON.stringify({
      name: { filterType: "text", type: "startsWith", filter: "آزمون " },
    }),
  });
  const r = await call("/instruments?" + query);
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 125);
  assert.equal(r.body.items.length, 25);
  assert.equal(r.body.items[0].name, "آزمون 100");
  assert.equal(
    (await call("/instruments", { method: "POST", body: { name: "كمانچه" } }))
      .status,
    201,
  );
  assert.equal(
    (await call("/instruments", { method: "POST", body: { name: "کمانچه" } }))
      .status,
    409,
  );
  const filtered = await call(
    "/instruments?" +
      new URLSearchParams({
        filterModel: JSON.stringify({
          name: { filterType: "text", type: "equals", filter: "کمانچه" },
        }),
      }),
  );
  assert.equal(filtered.body.total, 1);
  for (const query of [
    {
      sortModel: JSON.stringify([
        { colId: "name; DROP TABLE users", sort: "asc" },
      ]),
    },
    { filterModel: "[]" },
    {
      filterModel: JSON.stringify({
        phone: { filterType: "text", type: "contains", filter: "1" },
      }),
    },
    { endRow: "101" },
    { sortModel: "invalid" },
  ])
    assert.equal(
      (await call("/instruments?" + new URLSearchParams(query))).status,
      422,
    );
  assert.equal(one(db, "SELECT COUNT(*) n FROM users").n, 3);
  assert.equal(one(db, "SELECT COUNT(*) n FROM subjects").n, 7);
});

test("instrument English name persists, supports grid filters, legacy edits and explicit clearing", async () => {
  const body = {
    name: "ساز دوزبانه",
    englishName: " Violin ",
    status: "active",
  };
  let r = await call("/instruments", { method: "POST", body });
  assert.equal(r.status, 201);
  assert.equal(r.body.english_name, "Violin");
  const id = r.body.id;
  r = await call(`/instruments/${id}`, {
    method: "PATCH",
    body: { name: body.name, version: 1 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.english_name, "Violin");
  r = await call(`/instruments/${id}`, {
    method: "PATCH",
    body: { ...body, version: 2, englishName: "Piano" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.english_name, "Piano");
  const list = await call(
    "/instruments?" +
      new URLSearchParams({
        filterModel: JSON.stringify({
          english_name: { filterType: "text", type: "equals", filter: "piano" },
        }),
      }),
  );
  assert.equal(list.status, 200);
  assert.ok(list.body.items.some((row) => row.id === id));
  r = await call(`/instruments/${id}`, {
    method: "PATCH",
    body: { ...body, version: 3, englishName: "x".repeat(151) },
  });
  assert.equal(r.status, 422);
  assert.equal((await call(`/instruments/${id}`)).body.english_name, "Piano");
  r = await call(`/instruments/${id}`, {
    method: "PATCH",
    body: { ...body, version: 3, englishName: "" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.english_name, "");
  assert.equal(
    (await call("/teaching-types")).body.items[0].english_name,
    undefined,
  );
});
