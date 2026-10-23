import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { openDatabase, one } from "../db.mjs";
import { createUser } from "../auth.mjs";
import { createApp } from "../app.mjs";

let db, server, base, admin, secretary, accountant, image;
const origin = "http://localhost:4200";
async function call(
  path,
  { method = "GET", data, file, user = admin, multipart = false } = {},
) {
  let body;
  const headers = { Origin: origin };
  if (user)
    Object.assign(headers, { Cookie: user.cookie, "X-CSRF-Token": user.csrf });
  if (multipart) {
    body = new FormData();
    body.append("data", JSON.stringify(data));
    if (file)
      body.append(
        "photo",
        new Blob([file.bytes], { type: file.type || "image/png" }),
        "photo.png",
      );
  } else if (data) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }
  const response = await fetch(base + "/api" + path, { method, headers, body });
  const result = response.headers.get("content-type")?.includes("image/")
    ? Buffer.from(await response.arrayBuffer())
    : await response.json();
  return { status: response.status, body: result, headers: response.headers };
}
const fields = {
  firstName: "آوا",
  lastName: "آزمایشی",
  phone: "+989121234567",
  subjectId: 1,
  history: "new",
};
before(async () => {
  db = openDatabase(":memory:");
  for (const role of ["admin", "secretary", "accountant"])
    createUser(db, role, "Test-Password-2026", role);
  server = createApp(db, { origin }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  const login = async (role) => {
    const r = await call("/auth/login", {
      method: "POST",
      user: null,
      data: { username: role, password: "Test-Password-2026" },
    });
    assert.equal(r.status, 200);
    return {
      cookie: r.headers.get("set-cookie").split(";")[0],
      csrf: r.body.csrf,
    };
  };
  admin = await login("admin");
  secretary = await login("secretary");
  accountant = await login("accountant");
  image = await sharp({
    create: { width: 1200, height: 600, channels: 3, background: "#d9dde3" },
  })
    .png()
    .toBuffer();
});
after(() => {
  server.close();
  db.close();
});

test("multipart create, private resized photo, versioned edit, replacement and deletion", async () => {
  let r = await call("/students", {
    method: "POST",
    multipart: true,
    data: fields,
    file: { bytes: image },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  let s = r.body;
  assert.equal(s.version, 1);
  assert.ok(s.photo_url);
  let p = await call(s.photo_url.replace("/api", ""));
  assert.equal(p.status, 200);
  assert.equal(p.headers.get("cache-control"), "private, no-store");
  const meta = await sharp(p.body).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 400);
  assert.equal(
    (await call(`/students/${s.id}/photo`, { user: null })).status,
    401,
  );
  const t = await call(`/students/${s.id}/terms`, {
    method: "POST",
    data: {
      subjectId: 1,
      quota: 4,
      amount: "8000000",
      currency: "TOMAN",
      registeredOn: "2026-10-19",
      location: "آموزشگاه",
    },
  });
  assert.equal(t.status, 201);
  r = await call(`/students/${s.id}`, {
    method: "PATCH",
    user: secretary,
    multipart: true,
    data: { ...fields, version: 1, firstName: "مهتاب", status: "inactive" },
    file: { bytes: image },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.version, 2);
  assert.equal(r.body.first_name, "مهتاب");
  assert.equal(r.body.status, "inactive");
  assert.notEqual(r.body.photo_url, s.photo_url);
  s = r.body;
  assert.equal(s.terms[0].id, t.body.id);
  const stale = await call(`/students/${s.id}`, {
    method: "PATCH",
    data: { ...fields, version: 1, removePhoto: true },
  });
  assert.equal(stale.status, 409);
  assert.equal((await call(`/students/${s.id}`)).body.photo_url, s.photo_url);
  r = await call(`/students/${s.id}`, {
    method: "PATCH",
    multipart: true,
    data: { ...fields, version: 2, firstName: "مهتاب", removePhoto: true },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.photo_url, null);
  assert.equal((await call(`/students/${s.id}/photo`)).status, 404);
  const search = await call("/students?q=" + encodeURIComponent("مهتاب"));
  assert.ok(search.body.items.some((x) => x.id === s.id));
  assert.equal(
    one(db, "SELECT COUNT(*) n FROM student_photos WHERE student_id=?", s.id).n,
    0,
  );
});
test("upload validation and permissions reject invalid requests without partial records", async () => {
  const count = () => one(db, "SELECT COUNT(*) n FROM students").n;
  const initial = count();
  for (const file of [
    { bytes: Buffer.from("corrupt") },
    {
      bytes: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>',
      ),
    },
    { bytes: image, type: "image/svg+xml" },
    { bytes: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]) {
    assert.equal(
      (
        await call("/students", {
          method: "POST",
          multipart: true,
          data: fields,
          file,
        })
      ).status,
      422,
    );
  }
  assert.equal(
    (
      await call("/students", {
        method: "POST",
        multipart: true,
        data: { ...fields, firstName: "" },
        file: { bytes: image },
      })
    ).status,
    422,
  );
  assert.equal(count(), initial);
  assert.equal(
    (
      await call("/students", {
        method: "POST",
        user: accountant,
        multipart: true,
        data: fields,
        file: { bytes: image },
      })
    ).status,
    403,
  );
  const s = (await call("/students", { method: "POST", data: fields })).body;
  assert.equal(
    (
      await call(`/students/${s.id}`, {
        method: "PATCH",
        user: accountant,
        multipart: true,
        data: { ...fields, version: 1 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(`/students/${s.id}`, {
        method: "PATCH",
        data: { ...fields, version: 1, phone: "", missingContactReason: "" },
      })
    ).status,
    422,
  );
  assert.equal((await call(`/students/${s.id}`)).body.version, 1);
});
test("editing shared guardian preserves sibling contacts and education history", async () => {
  const original = {
    ...fields,
    phone: "",
    guardianName: "سرپرست مشترک",
    guardianPhone: "+989120000123",
  };
  const a = (await call("/students", { method: "POST", data: original })).body;
  const b = (await call("/students", { method: "POST", data: original })).body;
  assert.equal(a.guardians[0].id, b.guardians[0].id);
  const r = await call(`/students/${a.id}`, {
    method: "PATCH",
    data: {
      ...original,
      version: 1,
      guardianId: a.guardians[0].id,
      guardianName: "سرپرست اصلاح‌شده",
      guardianPhone: "+989120000456",
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.guardians[0].phone, "+989120000456");
  const sibling = (await call(`/students/${b.id}`)).body;
  assert.equal(sibling.guardians[0].phone, original.guardianPhone);
  assert.equal(sibling.guardians[0].name, original.guardianName);
  assert.deepEqual(r.body.enrollments, a.enrollments);
  assert.equal(r.body.terms.length, 0);
});

test("student editor adds a selected instrument as one independent learning path", async () => {
  const student = (await call("/students", { method: "POST", data: fields })).body;
  const instrument = (
    await call("/base-data/instruments", {
      method: "POST",
      data: { name: "ساز افزوده‌شده در ویرایش" },
    })
  ).body;
  let edited = await call(`/students/${student.id}`, {
    method: "PATCH",
    data: { ...fields, version: 1, instrumentId: instrument.id },
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.enrollments.length, 2);
  assert.equal(
    edited.body.enrollments.some((path) => path.instrument_id === instrument.id),
    true,
  );
  edited = await call(`/students/${student.id}`, {
    method: "PATCH",
    data: { ...fields, version: 2, instrumentId: instrument.id },
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(
    edited.body.enrollments.filter(
      (path) => path.instrument_id === instrument.id,
    ).length,
    1,
  );
});

test("student age and address persist, validate atomically, preserve legacy edits and respect privacy", async () => {
  let r = await call("/students", {
    method: "POST",
    data: { ...fields, age: 24, address: "تهران، خیابان موسیقی" },
  });
  assert.equal(r.status, 201);
  const id = r.body.id;
  assert.equal(r.body.age, 24);
  assert.equal(r.body.address, "تهران، خیابان موسیقی");
  r = await call(`/students/${id}`, {
    method: "PATCH",
    data: { ...fields, version: 1 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.age, 24);
  assert.equal(r.body.address, "تهران، خیابان موسیقی");
  for (const age of [-1, 131, 1.5, true, "abc"]) {
    assert.equal(
      (
        await call(`/students/${id}`, {
          method: "PATCH",
          data: { ...fields, version: 2, age, address: "نباید ذخیره شود" },
        })
      ).status,
      422,
    );
    assert.equal(
      (await call("/students", { method: "POST", data: { ...fields, age } }))
        .status,
      422,
    );
  }
  const saved = (await call(`/students/${id}`)).body;
  assert.equal(saved.version, 2);
  assert.equal(saved.address, "تهران، خیابان موسیقی");
  const privateView = (await call(`/students/${id}`, { user: accountant }))
    .body;
  assert.equal(privateView.age, undefined);
  assert.equal(privateView.address, undefined);
  r = await call(`/students/${id}`, {
    method: "PATCH",
    data: { ...fields, version: 2, age: null, address: "" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.age, null);
  assert.equal(r.body.address, "");
});
