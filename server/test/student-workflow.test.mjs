import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, one, run } from "../db.mjs";
import { createApp } from "../app.mjs";
import { createUser } from "../auth.mjs";
let db, server, base, admin, secretary, accountant, refs, student, term;
const origin = "http://localhost:4200";
async function call(path, { method = "GET", body, user = admin, key } = {}) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      ...(user ? { Cookie: user.cookie, "X-CSRF-Token": user.csrf } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
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
  for (const role of ["admin", "secretary", "accountant"]) {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username: role, password: "Test-Password-2026" }),
    });
    const b = await r.json(),
      session = {
        cookie: r.headers.get("set-cookie").split(";")[0],
        csrf: b.csrf,
      };
    if (role === "admin") admin = session;
    else if (role === "secretary") secretary = session;
    else accountant = session;
  }
  const add = async (resource, body) => {
    const r = await call("/base-data/" + resource, { method: "POST", body });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.id;
  };
  const instrumentId = await add("instruments", { name: "ساز جدید" });
  const instructorId = await add("instructors", {
    firstName: "مدرس",
    lastName: "جدید",
    instrumentIds: [instrumentId],
    phone: "۰۹۱۲۸۴۵۲۹۲۰",
  });
  const teachingTypeId = await add("teaching-types", { name: "تدریس تخصصی" });
  const paymentMethodId = await add("payment-methods", {
    name: "دو قسط ریالی",
    settlementType: "installment",
    installmentCount: 2,
    paymentCurrency: "rial",
  });
  const academy = await call("/subject-catalog", {
    method: "POST",
    body: { name: "آموزشگاه واقعی" },
  });
  refs = {
    instrumentId,
    instructorId,
    teachingTypeId,
    paymentMethodId,
    academyId: academy.body.id,
    mode: "onsite",
  };
});
after(() => {
  server.close();
  db.close();
});

test("new student uses independent instrument and academy with server-validated selections", async () => {
  const body = {
    ...refs,
    firstName: "هنرجو",
    lastName: "گردش جدید",
    phone: "۰۹۱۲۸۴۵۲۹۲۰",
  };
  let r = await call("/students", {
    method: "POST",
    body: { ...body, academyId: "", mode: "online" },
  });
  assert.equal(r.status, 422);
  assert.equal(one(db, "SELECT count(*) n FROM students").n, 0);
  r = await call("/students", { method: "POST", body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  student = r.body;
  assert.equal(student.phone, "09128452920");
  assert.equal(student.enrollments[0].subject_id, null);
  assert.equal(student.enrollments[0].instrument_id, refs.instrumentId);
  assert.equal(student.education_preferences.academy_id, refs.academyId);
  assert.equal(
    (await call("/students/education-options", { user: accountant })).status,
    403,
  );
  assert.equal(one(db, "SELECT count(*) n FROM payments").n, 0);
});
const termBody = () => ({
  ...refs,
  quota: 2,
  durationMinutes: 45,
  amount: "۱۰۰",
  currency: "TOMAN",
  registeredOn: "2026-10-20",
  installments: [
    { amount: "۶۰", dueDate: "2026-10-20" },
    { amount: "۴۰", dueDate: "2026-11-20" },
  ],
});
test("new terms validate exact installment totals and rollback atomically", async () => {
  let r = await call(`/students/${student.id}/terms`, {
    method: "POST",
    body: {
      ...termBody(),
      installments: [
        { amount: "60", dueDate: "2026-10-20" },
        { amount: "41", dueDate: "2026-11-20" },
      ],
    },
  });
  assert.equal(r.status, 422);
  assert.equal(one(db, "SELECT count(*) n FROM terms").n, 0);
  r = await call(`/students/${student.id}/terms`, {
    method: "POST",
    body: termBody(),
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  term = r.body;
  assert.equal(term.subject, "ساز جدید");
  assert.equal(term.location, "آموزشگاه واقعی");
  assert.equal(term.invoice.balance_minor, 100);
  assert.deepEqual(
    term.invoice.installments.map((i) => i.amount_minor),
    [60, 40],
  );
  assert.equal(term.invoice.overdue, true);
  assert.equal(one(db, "SELECT count(*) n FROM payments").n, 0);
  assert.equal(
    (
      await call(`/students/${student.id}/terms`, {
        method: "POST",
        body: { ...termBody(), currency: "USD" },
      })
    ).status,
    422,
  );
});
test("reservation and attendance require actor, reason and explicit justification without implicit quota decisions", async () => {
  const path = `/terms/${term.id}/sessions`,
    key = "workflow-reservation-2026";
  const body = { startsAt: "2026-01-01T10:00:00Z", timezone: "Asia/Tehran" };
  let r = await call(path, { method: "POST", key, body });
  assert.equal(r.status, 422);
  r = await call(path, {
    method: "POST",
    key,
    body: {
      ...body,
      reason: "هماهنگی هنرجو",
      requestedBy: "student",
      justified: false,
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  let a = r.body.sessions[0];
  assert.equal(a.justified, 0);
  assert.equal(r.body.counters.consumed, 0);
  r = await call(`/attendance/${a.id}`, {
    method: "PATCH",
    body: {
      version: a.version,
      status: "absent",
      reason: "بیماری",
      requestedBy: "student",
      justified: true,
    },
  });
  assert.equal(r.status, 422);
  r = await call(`/attendance/${a.id}`, {
    method: "PATCH",
    body: {
      version: a.version,
      status: "absent",
      counts: false,
      reason: "بیماری",
      requestedBy: "student",
      justified: true,
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  a = r.body.sessions[0];
  assert.equal(r.body.counters.consumed, 0);
  r = await call(`/attendance/${a.id}`, {
    method: "PATCH",
    body: {
      version: a.version,
      status: "cancelled",
      reason: "لغو مدرس",
      requestedBy: "teacher",
      cancelledBy: "teacher",
      justified: true,
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sessions[0].requested_by, "teacher");
  assert.equal(r.body.counters.consumed, 0);
  assert.equal(
    (
      await call(`/attendance/${a.id}`, {
        method: "PATCH",
        body: { version: a.version, status: "present" },
      })
    ).status,
    409,
  );
});
test("real receipts update installment balances FIFO, remain idempotent and preserve financial privacy", async () => {
  const body = {
    studentId: student.id,
    invoiceId: term.invoice.id,
    currency: "TOMAN",
    amount: "۴۰",
    receivedOn: "2026-10-20",
    method: "cash",
  };
  let r = await call("/payments", {
    method: "POST",
    body,
    key: "workflow-receipt-2026",
    user: secretary,
  });
  assert.equal(r.status, 403);
  r = await call("/payments", {
    method: "POST",
    body,
    key: "workflow-receipt-2026",
    user: accountant,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await call("/payments", {
    method: "POST",
    body,
    key: "workflow-receipt-2026",
    user: accountant,
  });
  assert.equal(r.status, 200);
  const view = (await call("/students/" + student.id)).body;
  assert.deepEqual(
    view.terms[0].invoice.installments.map((i) => i.balance_minor),
    [20, 40],
  );
  assert.equal(view.payments.length, 1);
  const education = (await call("/students/" + student.id, { user: secretary }))
    .body;
  assert.equal(education.terms[0].invoice, undefined);
  assert.equal(education.payments, undefined);
  const finance = (await call("/students/" + student.id, { user: accountant }))
    .body;
  assert.equal(finance.education_preferences, undefined);
  assert.equal(finance.terms[0].sessions, undefined);
  assert.equal(finance.terms[0].instructor_id, undefined);
});
test("renewals keep debt and numbering, copy no payments or sessions; free tuition requires a reason", async () => {
  let r = await call(`/terms/${term.id}/renew`, {
    method: "POST",
    body: termBody(),
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.number, 2);
  assert.equal(r.body.sessions.length, 0);
  assert.equal(r.body.invoice.allocated_minor, 0);
  assert.equal(
    (await call("/students/" + student.id)).body.terms.find(
      (t) => t.id === term.id,
    ).invoice.balance_minor,
    60,
  );
  const free = await call("/base-data/payment-methods", {
    method: "POST",
    body: { name: "بورسیه", settlementType: "free", notes: "تعریف بورسیه" },
  });
  const b = {
    ...termBody(),
    paymentMethodId: free.body.id,
    amount: "0",
    installments: [],
  };
  assert.equal(
    (await call(`/students/${student.id}/terms`, { method: "POST", body: b }))
      .status,
    422,
  );
  r = await call(`/students/${student.id}/terms`, {
    method: "POST",
    body: { ...b, reason: "بورسیه همین هنرجو" },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.invoice.balance_minor, 0);
  assert.equal(r.body.invoice.installments.length, 0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("legacy renewal links an explicitly selected instrument without rewriting old terms", async () => {
  const created = await call("/students", {
    method: "POST",
    body: {
      firstName: "هنرجو",
      lastName: "سابق",
      phone: "09121234567",
      subjectId: 1,
    },
  });
  const legacy = await call("/students/" + created.body.id + "/terms", {
    method: "POST",
    body: {
      subjectId: 1,
      quota: 1,
      currency: "TOMAN",
      amount: "100",
      mode: "onsite",
      location: "محل سابق",
      registeredOn: "2026-10-20",
    },
  });
  assert.equal(legacy.status, 201);
  const renewed = await call("/terms/" + legacy.body.id + "/renew", {
    method: "POST",
    body: { ...termBody(), quota: 1 },
  });
  assert.equal(renewed.status, 201, JSON.stringify(renewed.body));
  assert.equal(renewed.body.number, 2);
  assert.equal(renewed.body.subject, "ساز جدید");
  const view = (await call("/students/" + created.body.id)).body;
  assert.equal(
    view.terms.find((t) => t.id === legacy.body.id).subject,
    "پیانو",
  );
  const today = await call("/today");
  assert.equal(today.status, 200);
  assert.equal(
    today.body.actionTerms.find((t) => t.id === renewed.body.id).subject,
    "ساز جدید",
  );
});

test("delivery method alone controls academy requirement and forged mode cannot bypass it", async () => {
  const delivery = await call("/base-data/teaching-types", {
    method: "POST",
    body: { name: "برگزاری بدون محل", requiresAcademy: false },
  });
  assert.equal(delivery.status, 201);
  assert.equal(delivery.body.requires_academy, 0);
  const body = {
    ...refs,
    teachingTypeId: delivery.body.id,
    firstName: "هنرجو",
    lastName: "آنلاین",
    phone: "09121234567",
    mode: "onsite",
    academyId: "",
  };
  const created = await call("/students", { method: "POST", body });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.education_preferences.mode, "online");
  assert.equal(created.body.education_preferences.academy_id, null);
  const term = await call("/students/" + created.body.id + "/terms", {
    method: "POST",
    body: {
      ...termBody(),
      teachingTypeId: delivery.body.id,
      academyId: "",
      mode: "onsite",
    },
  });
  assert.equal(term.status, 201, JSON.stringify(term.body));
  assert.equal(term.body.mode, "online");
  assert.equal(term.body.location, "");
  run(
    db,
    "UPDATE teaching_types SET requires_academy=NULL WHERE id=?",
    delivery.body.id,
  );
  const invalid = await call("/students", { method: "POST", body });
  assert.equal(invalid.status, 422);
  assert.match(invalid.body.error, /تعیین نشده/);
  const updated = await call("/base-data/teaching-types/" + delivery.body.id, {
    method: "PATCH",
    body: {
      name: "برگزاری بدون محل",
      version: delivery.body.version,
      requiresAcademy: false,
    },
  });
  assert.equal(updated.status, 200);
});
