import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase, one } from "../db.mjs";
import { createApp } from "../app.mjs";
import { createUser } from "../auth.mjs";
import { calculateTuition } from "../tuition.mjs";
import { sanitizePolicyHtml } from "../simplified-flow.mjs";
import { localToInstant, endTime, proposeSessions } from '../../shared/class-time.js';

let db, server, base, admin, accountant;
const origin = "http://localhost:4200";
async function call(path, { method = "GET", body, user = admin, key } = {}) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      Cookie: user.cookie,
      "X-CSRF-Token": user.csrf,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test("tuition calculation uses the 30-minute rate and exact discount rules", () => {
  assert.deepEqual(
    calculateTuition(
      { currency: "TOMAN", durationMinutes: 45, quota: 4, discountType: "percent", discountPercent: 10 },
      { rate_toman_30: 500_000 },
    ),
    { currency: "TOMAN", rate: 500_000, duration: 45, quota: 4, gross: 3_000_000, discountType: "percent", discountValue: 10, discount: 300_000, net: 2_700_000 },
  );
  assert.equal(
    calculateTuition(
      { currency: "TOMAN", durationMinutes: 45, quota: 4, discountType: "fixed", discountAmount: "200000" },
      { rate_toman_30: 500_000 },
    ).net,
    2_800_000,
  );
  assert.throws(() => calculateTuition({ currency: "USD", durationMinutes: 30, quota: 1, discountType: "percent", discountPercent: 101 }, { rate_usd_cents_30: 1000 }));
  assert.throws(() => calculateTuition({ currency: "TOMAN", durationMinutes: 30, quota: 1 }, {}), /تعرفه ثبت نشده/);
});

test("policy sanitizer removes executable markup while preserving basic Persian formatting", () => {
  const value = sanitizePolicyHtml('<p onclick="x()">قانون <strong>مهم</strong></p><script>alert(1)</script>');
  assert.equal(value, "<p>قانون <strong>مهم</strong></p>");
});
test('weekly suggestions handle midnight and real daylight saving transitions',()=>{
  assert.equal(endTime('23:45',45),'00:30 (روز بعد)');
  assert.equal(localToInstant('2026-01-01','17:00','Asia/Tehran'),'2026-01-01T13:30:00.000Z');
  assert.throws(()=>localToInstant('2026-03-29','02:30','Europe/Berlin'),/وجود ندارد/);
  assert.throws(()=>localToInstant('2026-10-25','02:30','Europe/Berlin'),/دو بار/);
  const rows=proposeSessions('2026-03-22',2,[{weekday:0,startTime:'10:00',durationMinutes:45,timezone:'Europe/Berlin'}]);
  assert.equal(rows[0].startsAt,'2026-03-22T09:00:00.000Z');assert.equal(rows[1].startsAt,'2026-03-29T08:00:00.000Z');
});

test("calculated term snapshots price, schedule and policy; full receipt is idempotent", async (t) => {
  db = openDatabase(":memory:");
  createUser(db, "flow-admin", "Test-Password-2026", "admin");
  createUser(db, "flow-accountant", "Test-Password-2026", "accountant");
  server = createApp(db, { origin }).listen(0, "127.0.0.1");
  t.after(() => { server.closeAllConnections(); server.close(); db.close(); });
  await new Promise((resolve) => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  for (const [name, target] of [
    ["flow-admin", "admin"],
    ["flow-accountant", "accountant"],
  ]) {
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username: name, password: "Test-Password-2026" }),
    });
    const body = await response.json();
    const session = {
      cookie: response.headers.get("set-cookie").split(";")[0],
      csrf: body.csrf,
    };
    if (target === "admin") admin = session;
    else accountant = session;
  }
  const add = async (resource, body) => {
    const result = await call("/base-data/" + resource, { method: "POST", body });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body.id;
  };
  const instrumentId = await add("instruments", { name: "پیانوی تعرفه‌دار", rateToman30: "500000" });
  const instructorId = await add("instructors", { firstName: "شهرام", lastName: "محذوف", instrumentIds: [instrumentId] });
  const teachingTypeId = await add("teaching-types", { name: "حضوری ساده", requiresAcademy: true });
  const academy = await call("/subject-catalog", { method: "POST", body: { name: "شعبه اصلی" } });
  const policyList = await call("/registration-policies");
  assert.equal(policyList.status, 200);
  const draft = policyList.body.items[0];
  assert.equal((await call(`/registration-policies/${draft.id}`, { method: 'PATCH', body: { title: draft.title, contentHtml: draft.content_html, effectiveOn: '2026-01-01' } })).status, 200);
  assert.equal((await call(`/registration-policies/${draft.id}/publish`, { method: "POST", body: {} })).status, 200);
  const created = await call("/students", {
    method: "POST",
    body: { firstName: "هنرجوی", lastName: "محاسبه", phone: "09121234567", contactOwner: "student", instrumentId, instructorId, teachingTypeId, academyId: academy.body.id, structure: "private", registrationGoal: "یادگیری حرفه‌ای", artisticHistory: "مقدماتی", interviewNotes: "آماده شروع" },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const term = await call(`/students/${created.body.id}/terms`, {
    method: "POST",
    body: {
      instrumentId, instructorId, teachingTypeId, academyId: academy.body.id,
      structure: "private", currency: "TOMAN", durationMinutes: 45, quota: 4,
      discountType: "percent", discountPercent: 10, reason: "تخفیف مجاز",
      registeredOn: "2026-10-20", startDate: "2026-10-24", endDate: "2026-11-14",
      schedules: [{ weekday: 6, startTime: "17:00", durationMinutes: 45, timezone: "Asia/Tehran" }],
    },
  });
  assert.equal(term.status, 201, JSON.stringify(term.body));
  assert.equal(term.body.invoice.base_minor, 3_000_000);
  assert.equal(term.body.invoice.total_minor, 2_700_000);
  assert.equal(term.body.invoice.settlement_flow, "full");
  assert.equal(term.body.discount_type, "percent");
  assert.equal(term.body.schedules[0].start_time, "17:00");
  assert.ok(term.body.policy_id);
  const policyAcceptances = await call(`/students/${created.body.id}/policy-acceptances`);
  assert.equal(policyAcceptances.status, 200);
  assert.equal(policyAcceptances.body.items[0].term_id, term.body.id);
  assert.equal(policyAcceptances.body.items[0].acceptance_id, null);
  const accepted = await call(`/students/${created.body.id}/policy-acceptances`, {
    method: "POST",
    body: { termId: term.body.id, policyId: term.body.policy_id, accepted: true },
  });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
  assert.equal(accepted.body.statement, "قوانین را مطالعه کرده‌ام و پذیرفته‌ام.");
  assert.equal((await call(`/students/${created.body.id}/policy-acceptances`, {
    method: "POST",
    body: { termId: term.body.id, policyId: term.body.policy_id, accepted: true },
  })).status, 200);
  assert.equal(one(db, "SELECT COUNT(*) n FROM student_policy_acceptances").n, 1);
  assert.equal((await call(`/students/${created.body.id}/policy-acceptances`, {
    method: "POST",
    body: { termId: term.body.id, policyId: term.body.policy_id, accepted: false },
  })).status, 422);
  assert.equal((await call(`/students/${created.body.id}/policy-acceptances`, { user: accountant })).status, 403);
  const paymentBody = { studentId: created.body.id, invoiceId: term.body.invoice.id, receivedOn: "2026-10-20", method: "cash", reference: "TEST" };
  let receipt = await call("/full-tuition-payments", { method: "POST", body: paymentBody, key: "full-tuition-test-2026", user: accountant });
  assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
  receipt = await call("/full-tuition-payments", { method: "POST", body: paymentBody, key: "full-tuition-test-2026", user: accountant });
  assert.equal(receipt.status, 200);
  assert.equal(one(db, "SELECT COUNT(*) n FROM payments").n, 1);
  assert.equal((await call("/full-tuition-payments", { method: "POST", body: paymentBody, key: "full-tuition-second-2026", user: accountant })).status, 409);
  const print = await call(`/students/${created.body.id}/print-data?termId=${term.body.id}`);
  assert.equal(print.status, 200);
  assert.equal(print.body.schedules[0].duration_minutes, 45);
  assert.equal(print.body.term.academy, academy.body.name);
  assert.equal(print.body.term.number, 1);
  assert.equal(print.body.student.registration_goal, "یادگیری حرفه‌ای");
  assert.equal(print.body.student.artistic_history, "مقدماتی");
  assert.equal(print.body.student.interview_notes, "آماده شروع");
  assert.equal(print.body.student.internal_notes, undefined);
  assert.equal(print.body.policy.status, "published");
  db.prepare("UPDATE student_terms SET policy_id=NULL WHERE id=?").run(term.body.id);
  const legacyPrint = await call(`/students/${created.body.id}/print-data?termId=${term.body.id}`);
  assert.equal(legacyPrint.status, 200);
  assert.equal(legacyPrint.body.policy.id, term.body.policy_id);
  assert.equal(legacyPrint.body.policy_fallback, true);
  db.prepare("UPDATE student_terms SET policy_id=? WHERE id=?").run(term.body.policy_id, term.body.id);
  await t.test('retry payload mismatch, settled-term protection, explicit void and amendment history',async()=>{
    assert.equal((await call('/full-tuition-payments',{method:'POST',key:'full-tuition-test-2026',body:{...paymentBody,reference:'DIFFERENT'},user:accountant})).status,409);
    assert.equal((await call(`/students/${created.body.id}/print-data?termId=${term.body.id}`,{user:accountant})).status,403);
    const amendment={version:term.body.version,baseRate:'500000',durationMinutes:45,quota:4,discountType:'fixed',discountAmount:'200000',reason:'اصلاح مصوب'};
    assert.equal((await call(`/terms/${term.body.id}/tuition`,{method:'PATCH',body:amendment})).status,409);
    const paymentId=one(db,'SELECT id FROM payments').id;
    assert.equal((await call(`/payments/${paymentId}/void`,{method:'POST',body:{reason:'اصلاح روش دریافت'},user:accountant})).status,403);
    assert.equal((await call(`/payments/${paymentId}/void`,{method:'POST',body:{reason:'اصلاح روش دریافت'}})).status,200);
    const changed=await call(`/terms/${term.body.id}/tuition`,{method:'PATCH',body:amendment});assert.equal(changed.status,200,JSON.stringify(changed.body));assert.equal(changed.body.invoice.total_minor,2800000);
    assert.equal((await call(`/terms/${term.body.id}/tuition`,{method:'PATCH',body:amendment})).status,409);
    const receipt=await call('/full-tuition-payments',{method:'POST',body:paymentBody,key:'full-tuition-receipt-after-void',user:accountant});assert.equal(receipt.status,201,JSON.stringify(receipt.body));
    assert.equal((await call(`/students/${created.body.id}/workflow-history`)).body.items.some(row=>row.action==='term-tuition-amended'),true);
  });
  await t.test('group membership shares reservations but attendance and quota remain independent',async()=>{
    const student2=await call('/students',{method:'POST',body:{firstName:'عضو',lastName:'دوم گروه',phone:'09121234567'}});assert.equal(student2.status,201);
    const body={instrumentId,instructorId,teachingTypeId,academyId:academy.body.id,structure:'group',currency:'TOMAN',durationMinutes:45,quota:4,discountType:'none',registeredOn:'2026-10-20',startDate:'2026-10-24',endDate:'2026-11-14',schedules:[{weekday:6,startTime:'17:00',durationMinutes:45,timezone:'Asia/Tehran'}]};
    const first=await call(`/students/${created.body.id}/terms`,{method:'POST',body});assert.equal(first.status,201,JSON.stringify(first.body));
    const second=await call(`/students/${student2.body.id}/terms`,{method:'POST',body:{...body,groupTermId:first.body.id,schedules:[]}});assert.equal(second.status,201,JSON.stringify(second.body));assert.equal(first.body.term_id,second.body.term_id);
    const reserved=await call(`/terms/${first.body.id}/sessions`,{method:'POST',key:'shared-group-reservation-2026',body:{startsAt:'2026-01-01T10:00:00Z',timezone:'Asia/Tehran'}});assert.equal(reserved.status,201,JSON.stringify(reserved.body));
    const a=reserved.body.sessions[0];assert.equal(a.group_members.length,2);
    const changed=await call(`/attendance/${a.id}`,{method:'PATCH',body:{version:a.version,status:'absent',reason:'غیبت هنرجو',counts:false}});assert.equal(changed.status,200,JSON.stringify(changed.body));assert.equal(changed.body.counters.consumed,1);
    const other=(await call(`/students/${student2.body.id}`)).body.terms[0];assert.equal(other.counters.consumed,0);assert.equal(other.sessions[0].status,'reserved');
    const move=await call(`/sessions/${a.session_id}`,{method:'PATCH',body:{version:a.version,startsAt:'2026-01-02T10:00:00Z',timezone:'Asia/Tehran'}});assert.notEqual(move.status,200);
  });
  await t.test('new attendance applies cancellation actor policy and preserves replacement chain',async()=>{
    const create=await call(`/terms/${term.body.id}/sessions`,{method:'POST',key:'simple-teacher-cancellation-2026',body:{startsAt:'2026-01-03T10:00:00Z',timezone:'Asia/Tehran'}});assert.equal(create.status,201,JSON.stringify(create.body));
    const a=create.body.sessions[0];let cancelled=await call(`/attendance/${a.id}`,{method:'PATCH',body:{version:a.version,status:'cancelled',reason:'عدم حضور مدرس',cancelledBy:'teacher'}});assert.equal(cancelled.status,200,JSON.stringify(cancelled.body));assert.equal(cancelled.body.sessions[0].counts,0);
    const replacement=await call(`/terms/${term.body.id}/sessions`,{method:'POST',key:'simple-teacher-replacement-2026',body:{startsAt:'2026-01-04T10:00:00Z',timezone:'Asia/Tehran',replacementFor:a.session_id}});assert.equal(replacement.status,201,JSON.stringify(replacement.body));
    const old=cancelled.body.sessions[0];assert.equal((await call(`/attendance/${old.id}`,{method:'PATCH',body:{version:old.version,status:'present'}})).status,409);
    const newAttendance=replacement.body.sessions.find(s=>s.replacement_for===a.session_id);
    assert.equal((await call(`/attendance/${newAttendance.id}`,{method:'PATCH',body:{version:newAttendance.version,status:'cancelled',reason:'درخواست هنرجو',cancelledBy:'student'}})).status,422);
    const studentCancel=await call(`/attendance/${newAttendance.id}`,{method:'PATCH',body:{version:newAttendance.version,status:'cancelled',reason:'درخواست هنرجو',cancelledBy:'student',counts:true}});assert.equal(studentCancel.status,200,JSON.stringify(studentCancel.body));assert.equal(studentCancel.body.counters.consumed,1);
  });
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
