import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, one } from "../db.mjs";
import { createApp } from "../app.mjs";
import { createUser } from "../auth.mjs";

let db, server, base, admin, secretary, accountant;
const origin = "http://localhost:4200";

async function request(path, { method = "GET", body, user = admin } = {}) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      ...(user ? { Cookie: user.cookie, "X-CSRF-Token": user.csrf } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  db = openDatabase(":memory:");
  for (const role of ["admin", "secretary", "accountant"])
    createUser(db, "subjects-" + role, "Test-Password-2026", role);
  server = createApp(db, { origin }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  const login = async (role) => {
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "subjects-" + role,
        password: "Test-Password-2026",
      }),
    });
    const body = await response.json();
    return {
      cookie: response.headers.get("set-cookie").split(";")[0],
      csrf: body.csrf,
    };
  };
  admin = await login("admin");
  secretary = await login("secretary");
  accountant = await login("accountant");
});

after(() => {
  server.close();
  db.close();
});

test("educational units preserve legacy rows and allow optional contact details", async () => {
  const legacy = await request("/subject-catalog/1");
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.name, "پیانو");
  for (const field of ["address", "phone", "website", "social_media"])
    assert.equal(legacy.body[field], "");

  let response = await request("/subject-catalog", {
    method: "POST",
    body: { name: "واحد شمال" },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const id = response.body.id;
  assert.equal(response.body.version, 1);
  assert.equal(response.body.status, "active");

  response = await request(`/subject-catalog/${id}`, {
    method: "PATCH",
    user: secretary,
    body: {
      name: "واحد شمال",
      address: "تهران، خیابان نمونه",
      phone: "+982112345678",
      website: "https://example.com",
      socialMedia: "https://instagram.com/example",
      status: "inactive",
      version: 1,
    },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.address, "تهران، خیابان نمونه");
  assert.equal(response.body.social_media, "https://instagram.com/example");
  assert.equal(response.body.status, "inactive");
  assert.equal(response.body.version, 2);
  assert.equal(
    (await request("/subjects")).body.some((item) => item.id === id),
    false,
  );
});

test("educational unit validation, concurrency and permissions are enforced", async () => {
  assert.equal(
    (await request("/subject-catalog", { method: "POST", body: { name: "" } }))
      .status,
    422,
  );
  assert.equal(
    (
      await request("/subject-catalog", {
        method: "POST",
        body: { name: "وب نامعتبر", website: "example.com" },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await request("/subject-catalog", {
        method: "POST",
        body: { name: "تلفن نامعتبر", phone: "abc" },
      })
    ).status,
    422,
  );
  for (const [path, method] of [
    ["/subject-catalog", "GET"],
    ["/subject-catalog/1", "GET"],
    ["/subject-catalog", "POST"],
    ["/subject-catalog/1", "PATCH"],
    ["/subject-catalog/1?version=1", "DELETE"],
  ])
    assert.equal(
      (
        await request(path, {
          method,
          user: accountant,
          body:
            method === "GET"
              ? undefined
              : { name: "ممنوع", status: "active", version: 1 },
        })
      ).status,
      403,
    );
  const original = one(db, "SELECT version FROM subjects WHERE id=1").version;
  assert.equal(
    (
      await request("/subject-catalog/1", {
        method: "PATCH",
        body: { name: "پیانو", status: "active", version: original },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/subject-catalog/1", {
        method: "PATCH",
        body: { name: "پیانو", status: "active", version: original },
      })
    ).status,
    409,
  );
});

test("unused educational units can be deleted but historical records are preserved", async () => {
  let response = await request("/subject-catalog", {
    method: "POST",
    body: { name: "آموزشگاه قابل حذف" },
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const created = response.body;

  response = await request(
    `/subject-catalog/${created.id}?version=${created.version}`,
    { method: "DELETE", user: secretary },
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(
    one(db, "SELECT 1 FROM subjects WHERE id=?", created.id),
    undefined,
  );
  assert.equal(
    one(
      db,
      "SELECT action FROM audit_log WHERE target=? ORDER BY id DESC",
      String(created.id),
    ).action,
    "subject-deleted",
  );

  const studentId = Number(
    db
      .prepare(
        "INSERT INTO students(first_name,last_name,search_text) VALUES('حفظ','سابقه','حفظ سابقه')",
      )
      .run().lastInsertRowid,
  );
  db.prepare("INSERT INTO enrollments(student_id,subject_id) VALUES(?,1)").run(
    studentId,
  );
  const historicalVersion = one(
    db,
    "SELECT version FROM subjects WHERE id=1",
  ).version;
  response = await request(`/subject-catalog/1?version=${historicalVersion}`, {
    method: "DELETE",
  });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /سابقه آموزشی/);
  assert.ok(one(db, "SELECT 1 FROM subjects WHERE id=1"));
});
