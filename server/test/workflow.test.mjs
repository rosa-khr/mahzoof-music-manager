import { randomUUID } from "node:crypto";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, one, run } from "../db.mjs";
import { createUser } from "../auth.mjs";
import { createApp } from "../app.mjs";
import { money } from "../validation.mjs";
let db, server, base;
const origin = "http://localhost:4200";
before(async () => {
  db = openDatabase(":memory:");
  for (const role of ["admin", "secretary", "accountant"])
    createUser(db, role, "Test-Password-2026", role);
  server = createApp(db, { origin }).listen(0, "127.0.0.1");
  await new Promise((resolve, reject) =>
    server.once("listening", resolve).once("error", reject),
  );
  base = "http://127.0.0.1:" + server.address().port;
});
after(() => {
  server.close();
  db.close();
});
async function call(
  path,
  { method = "GET", body, user, key, headers = {} } = {},
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(user ? { Cookie: user.cookie, "X-CSRF-Token": user.csrf } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json(), headers: r.headers };
}
async function login(role = "admin") {
  const r = await call("/auth/login", {
    method: "POST",
    body: { username: role, password: "Test-Password-2026" },
  });
  assert.equal(r.status, 200);
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    csrf: r.body.csrf,
  };
}
async function student(user, extra = {}) {
  const r = await call("/students", {
    method: "POST",
    user,
    body: {
      firstName: "کیان",
      lastName: "موسیقی",
      phone: "+989121234567",
      subjectId: 1,
      history: "new",
      ...extra,
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
async function term(user, s, extra = {}) {
  const r = await call(`/students/${s.id}/terms`, {
    method: "POST",
    user,
    body: {
      subjectId: 1,
      quota: 4,
      amount: "8000000",
      currency: "TOMAN",
      registeredOn: "2026-10-19",
      mode: "onsite",
      location: "آموزشگاه محذوف",
      ...extra,
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
async function reserve(user, t, extra = {}) {
  const r = await call(`/terms/${t.id}/sessions`, {
    method: "POST",
    user,
    key: randomUUID(),
    body: {
      startsAt: "2026-01-01T10:00:00Z",
      timezone: "Asia/Tehran",
      ...extra,
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
async function mark(user, a, status, extra = {}) {
  return call(`/attendance/${a.id}`, {
    method: "PATCH",
    user,
    body: { version: a.version, status, ...extra },
  });
}
test("complete private workflow: partial payment, reserve, absence, cancellation, completion, renewal retains debt", async () => {
  const user = await login(),
    s = await student(user),
    t = await term(user, s);
  const body = {
    studentId: s.id,
    invoiceId: t.invoice.id,
    currency: "TOMAN",
    amount: "5000000",
    receivedOn: "2026-10-19",
    method: "cash",
  };
  const pay = await call("/payments", {
    method: "POST",
    user,
    body,
    key: "workflow-payment-0001",
  });
  assert.equal(pay.status, 201);
  const repeat = await call("/payments", {
    method: "POST",
    user,
    body,
    key: "workflow-payment-0001",
  });
  assert.equal(repeat.body.id, pay.body.id);
  let current = (await call(`/students/${s.id}`, { user })).body.terms[0];
  assert.equal(current.invoice.balance_minor, 3000000);
  assert.equal(current.invoice.financial_status, "partial");
  current = await reserve(user, t);
  let a = current.sessions[0];
  assert.equal((await mark(user, a, "absent")).status, 422);
  let result = await mark(user, a, "absent", {
    counts: false,
    reason: "غیبت بدون مصرف",
  });
  assert.equal(result.body.counters.consumed, 0);
  current = await reserve(user, t, { replacementFor: a.session_id });
  let replacement = current.sessions.find(
    (v) => v.replacement_for === a.session_id,
  );
  result = await mark(user, replacement, "present");
  assert.equal(result.body.counters.consumed, 1);
  current = await reserve(user, t);
  a = current.sessions.at(-1);
  assert.equal((await mark(user, a, "cancelled")).status, 422);
  result = await mark(user, a, "cancelled", {
    reason: "لغو مدرس",
    cancelledBy: "teacher",
  });
  assert.equal(result.body.counters.consumed, 1);
  for (let i = 0; i < 3; i++) {
    current = await reserve(user, t);
    a = current.sessions.find((v) => v.status === "reserved");
    result = await mark(
      user,
      a,
      i === 0 ? "absent" : "present",
      i === 0 ? { counts: true, reason: "با انتخاب صریح" } : {},
    );
    assert.equal(result.status, 200);
  }
  current = result.body;
  assert.equal(current.status, "completed");
  assert.equal(current.counters.remaining, 0);
  assert.equal(current.invoice.balance_minor, 3000000);
  assert.equal(
    (
      await call(`/terms/${t.id}/sessions`, {
        method: "POST",
        user,
        key: randomUUID(),
        body: { startsAt: "2026-01-01T10:00:00Z" },
      })
    ).status,
    422,
  );
  const renewBody = {
    subjectId: 1,
    quota: 4,
    amount: "9000000",
    currency: "TOMAN",
    registeredOn: "2026-10-19",
    location: "آموزشگاه محذوف",
  };
  let renewal = await call(`/terms/${t.id}/renew`, {
    method: "POST",
    user,
    body: renewBody,
  });
  assert.equal(renewal.status, 201);
  assert.equal(renewal.body.number, 2);
  assert.equal(renewal.body.sessions.length, 0);
  assert.equal(renewal.body.invoice.allocated_minor, 0);
  assert.equal(
    (
      await call(`/terms/${t.id}/renew`, {
        method: "POST",
        user,
        body: renewBody,
      })
    ).status,
    409,
  );
  a = current.sessions.find((v) => v.status === "present");
  const correction = await mark(user, a, "cancelled", {
    reason: "اصلاح ثبت",
    cancelledBy: "other",
  });
  assert.equal(correction.body.status, "current");
  assert.equal(correction.body.counters.remaining, 1);
  assert.ok(
    one(
      db,
      "SELECT COUNT(*) n FROM audit_log WHERE action='attendance-updated'",
    ).n >= 6,
  );
});
test("quota protects concurrent reservations and stale attendance corrections", async () => {
  const user = await login(),
    s = await student(user),
    t = await term(user, s, { quota: 1 });
  const requests = await Promise.all(
    [1, 2].map(() =>
      call(`/terms/${t.id}/sessions`, {
        method: "POST",
        user,
        key: randomUUID(),
        body: { startsAt: "2026-01-01T10:00:00Z", timezone: "Asia/Tehran" },
      }),
    ),
  );
  assert.deepEqual(requests.map((r) => r.status).sort(), [201, 409]);
  const a = requests.find((r) => r.status === 201).body.sessions[0];
  assert.equal((await mark(user, a, "present")).status, 200);
  assert.equal((await mark(user, a, "present")).status, 409);
});
test("payments: concurrent idempotency, overpayment credit, mixed currency/ownership rejection, decimal exactness", async () => {
  const user = await login(),
    s = await student(user),
    t = await term(user, s, { currency: "USD", amount: "80.25" });
  const body = {
    studentId: s.id,
    invoiceId: t.invoice.id,
    currency: "USD",
    amount: "100.50",
    receivedOn: "2026-10-19",
    method: "cash",
  };
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      call("/payments", {
        method: "POST",
        user,
        body,
        key: "concurrent-payment-0001",
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 201]);
  const profile = (await call(`/students/${s.id}`, { user })).body;
  assert.equal(profile.terms[0].invoice.balance_minor, 0);
  assert.equal(profile.payments[0].credit_minor, 2025);
  assert.equal(profile.payments.length, 1);
  assert.equal(
    (
      await call("/payments", {
        method: "POST",
        user,
        body: { ...body, amount: "1" },
        key: "concurrent-payment-0001",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/payments", {
        method: "POST",
        user,
        body: { ...body, currency: "TOMAN" },
        key: "currency-mismatch-0001",
      })
    ).status,
    422,
  );
  const other = await student(user);
  assert.equal(
    (
      await call("/payments", {
        method: "POST",
        user,
        body: { ...body, studentId: other.id },
        key: "student-mismatch-0001",
      })
    ).status,
    422,
  );
  assert.equal(money("0.29", "USD"), 29);
  assert.throws(() => money("1.001", "USD"));
  assert.throws(() => money("1.2", "TOMAN"));
  assert.throws(() => money("-1", "USD"));
});
test("server permissions and field minimization, origin, CSRF and unauthenticated access", async () => {
  const admin = await login(),
    s = await student(admin),
    t = await term(admin, s),
    sec = await login("secretary"),
    acc = await login("accountant");
  assert.equal((await call("/students")).status, 401);
  assert.equal(
    (
      await call("/students", {
        method: "POST",
        user: admin,
        body: {},
        headers: { Origin: "https://attacker.invalid" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/students", {
        method: "POST",
        user: { ...admin, csrf: "bad" },
        body: {},
      })
    ).status,
    403,
  );
  const p = (await call(`/students/${s.id}`, { user: sec })).body;
  assert.equal(p.terms[0].invoice, undefined);
  assert.equal(p.payments, undefined);
  assert.equal(p.balances, undefined);
  assert.equal(
    (
      await call("/payments", {
        method: "POST",
        user: sec,
        body: {},
        key: "forbidden-payment-0001",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(`/terms/${t.id}/sessions`, {
        method: "POST",
        user: acc,
        body: {},
      })
    ).status,
    403,
  );
  const ap = (await call(`/students/${s.id}`, { user: acc })).body;
  assert.equal(ap.terms[0].sessions, undefined);
  assert.equal(ap.history, undefined);
  assert.equal((await call("/users", { user: sec })).status, 403);
  const dash = await call("/today", { user: sec });
  assert.equal(dash.body.debts, undefined);
  assert.equal(dash.headers.get("cache-control"), "no-store");
});
test("Persian normalization, shared guardian, unknown history, no fabricated term", async () => {
  const user = await login();
  const s = await student(user, {
    firstName: "كيوان",
    phone: "",
    guardianName: "سرپرست مشترک",
    guardianPhone: "+989120000000",
    history: "unknown",
  });
  await student(user, {
    phone: "",
    guardianName: "سرپرست مشترک",
    guardianPhone: "+989120000000",
  });
  assert.equal(s.terms.length, 0);
  assert.equal(s.first_registered, null);
  const search = await call("/students?q=" + encodeURIComponent("کیوان"), {
    user,
  });
  assert.ok(search.body.items.some((x) => x.id === s.id));
  assert.equal(
    one(db, "SELECT COUNT(*) n FROM guardians WHERE phone='+989120000000'").n,
    1,
  );
});
test("last admin cannot be disabled; disabling staff revokes active session", async () => {
  const admin = await login(),
    sec = await login("secretary");
  const users = (await call("/users", { user: admin })).body;
  const a = users.find((u) => u.role === "admin"),
    s = users.find((u) => u.role === "secretary");
  assert.equal(
    (
      await call(`/users/${a.id}`, {
        method: "PATCH",
        user: admin,
        body: { role: "admin", active: false },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`/users/${s.id}`, {
        method: "PATCH",
        user: admin,
        body: { role: "secretary", active: false },
      })
    ).status,
    200,
  );
  assert.equal((await call("/auth/me", { user: sec })).status, 401);
});
test("login is rate limited and invalid calendar dates rejected", async () => {
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call("/auth/login", {
          method: "POST",
          body: { username: "missing", password: "incorrect" },
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",
        body: { username: "missing", password: "incorrect" },
      })
    ).status,
    429,
  );
  const user = await login(),
    s = await student(user);
  const bad = await call(`/students/${s.id}/terms`, {
    method: "POST",
    user,
    body: {
      subjectId: 1,
      quota: 4,
      amount: "1",
      currency: "TOMAN",
      registeredOn: "2026-02-30",
      location: "آموزشگاه",
    },
  });
  assert.equal(bad.status, 422);
});
test("reservation date edits are versioned, timezone aware and do not consume quota", async () => {
  const user = await login(),
    s = await student(user),
    t = await term(user, s);
  let r = await reserve(user, t, {
    startsAt: "2026-03-29T01:30:00+01:00",
    timezone: "Europe/Berlin",
  });
  const a = r.sessions[0];
  assert.equal(a.starts_at, "2026-03-29T00:30:00.000Z");
  const edit = {
    version: a.version,
    startsAt: "2026-03-29T03:30:00+02:00",
    timezone: "Europe/Berlin",
    durationMinutes: 45,
  };
  r = await call(`/sessions/${a.session_id}`, {
    method: "PATCH",
    user,
    body: edit,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.sessions[0].starts_at, "2026-03-29T01:30:00.000Z");
  assert.equal(r.body.counters.consumed, 0);
  assert.equal(r.body.counters.reserved, 1);
  assert.equal(
    (
      await call(`/sessions/${a.session_id}`, {
        method: "PATCH",
        user,
        body: edit,
      })
    ).status,
    409,
  );
});
test("no oversubscription on correction when another reservation fills capacity; transaction rolls back", async () => {
  const user = await login(),
    s = await student(user),
    t = await term(user, s, { quota: 1 });
  let r = await reserve(user, t);
  const a = r.sessions[0];
  r = await mark(user, a, "absent", { counts: false, reason: "بدون مصرف" });
  await reserve(user, t);
  const correction = await mark(user, r.body.sessions[0], "present");
  assert.equal(correction.status, 409);
  const view = (await call(`/students/${s.id}`, { user })).body.terms[0];
  assert.equal(view.counters.consumed, 0);
  assert.equal(view.counters.reserved, 1);
  assert.equal(view.sessions.find((v) => v.id === a.id).status, "absent");
});
test("reservation retry after lost response reuses same session and capacity", async () => {
  const user = await login(),
    s = await student(user),
    t = await term(user, s, { quota: 1 });
  const body = { startsAt: "2026-01-01T10:00:00Z", timezone: "Asia/Tehran" },
    key = randomUUID();
  const results = await Promise.all(
    [1, 2].map(() =>
      call(`/terms/${t.id}/sessions`, { method: "POST", user, body, key }),
    ),
  );
  for (const r of results) {
    assert.equal(r.status, 201);
    assert.equal(r.body.sessions.length, 1);
    assert.equal(r.body.counters.reserved, 1);
  }
  assert.equal(results[0].body.sessions[0].id, results[1].body.sessions[0].id);
});
test("replacement chain cannot consume predecessor and replacement twice even with spare quota", async () => {
  const user = await login(),
    s = await student(user),
    t = await term(user, s);
  let r = await reserve(user, t);
  const original = r.sessions[0];
  r = await mark(user, original, "cancelled", {
    reason: "جابه‌جایی",
    cancelledBy: "teacher",
  });
  const old = r.body.sessions[0];
  r = await reserve(user, t, { replacementFor: old.session_id });
  const replacement = r.sessions.find(
    (a) => a.replacement_for === old.session_id,
  );
  assert.equal((await mark(user, old, "present")).status, 409);
  assert.equal((await mark(user, replacement, "present")).status, 200);
  assert.equal((await mark(user, old, "present")).status, 409);
});
