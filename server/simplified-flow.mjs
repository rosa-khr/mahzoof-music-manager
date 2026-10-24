import { all, one, run, transaction, audit } from "./db.mjs";
import { requireRole } from "./auth.mjs";
import {
  assert,
  choice,
  date,
  integer,
  money,
  text,
  timezone,
} from "./validation.mjs";
import { financial, termView } from "./education.mjs";
import { dateInZone } from "./dates.mjs";
import { hashToken } from "./auth.mjs";
export { calculateTuition } from "./tuition.mjs";

const DEFAULT_POLICY = `<ol><li>عدم حضور مدرس، جلسه جبرانی دارد.</li><li>در صورت انصراف هنرجو، شهریه مسترد نمی‌شود.</li><li>غیبت هنرجو یک جلسه محسوب می‌شود و جبرانی ندارد.</li><li>هنرجو ۱۰ دقیقه پیش از کلاس در آموزشگاه حاضر باشد.</li></ol>`;
const ACCEPTANCE_STATEMENT = "قوانین را مطالعه کرده‌ام و پذیرفته‌ام.";

export function sanitizePolicyHtml(value) {
  let html = text(value, "متن قوانین", 30000, true);
  const allowed = new Set([
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
  ]);
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi,
      "",
    )
    .replace(/<[^>]*>/g, (tag) => {
      const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
      if (!match) return "";
      const name = match[2].toLowerCase();
      if (!allowed.has(name)) return "";
      return match[1] ? `</${name}>` : name === "br" ? "<br>" : `<${name}>`;
    });
  assert(html.replace(/<[^>]+>/g, "").trim(), "متن قوانین خالی است");
  return html;
}

function ensureDraft(db, user) {
  if (one(db, "SELECT 1 FROM registration_policies LIMIT 1")) return;
  run(
    db,
    "INSERT INTO registration_policies(version,title,content_html,effective_on,status,created_by) VALUES(1,?,?,?,?,?)",
    "قوانین ثبت‌نام آموزشگاه",
    DEFAULT_POLICY,
    dateInZone(),
    "draft",
    user.id,
  );
}

function schedule(body) {
  assert(Array.isArray(body.schedules) && body.schedules.length <= 14, "برنامه هفتگی نامعتبر است");
  return body.schedules.map((item) => ({
    weekday: integer(item.weekday, "روز هفته", 0, 6),
    startTime: (() => {
      const value = text(item.startTime, "ساعت شروع", 5, true);
      assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(value), "ساعت شروع نامعتبر است");
      return value;
    })(),
    durationMinutes: integer(item.durationMinutes ?? body.durationMinutes ?? 30, "مدت جلسه", 1, 1440),
    timezone: timezone(item.timezone || body.timezone || "Asia/Tehran"),
  }));
}

export function installSimplifiedFlow(app, db) {
  app.get("/api/registration-policies", (req, res) => {
    ensureDraft(db, req.user);
    res.json({ items: all(db, "SELECT * FROM registration_policies ORDER BY version DESC") });
  });
  app.post("/api/registration-policies", (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const b = req.body;
    const id = transaction(db, () => {
      ensureDraft(db, req.user);
      assert(!one(db, "SELECT 1 FROM registration_policies WHERE status='draft'"), "ابتدا پیش‌نویس موجود را منتشر کنید", 409);
      const version = one(db, "SELECT COALESCE(MAX(version),0)+1 n FROM registration_policies").n;
      const id = Number(run(db, "INSERT INTO registration_policies(version,title,content_html,effective_on,status,created_by) VALUES(?,?,?,?,\'draft\',?)", version, text(b.title, "عنوان", 200, true), sanitizePolicyHtml(b.contentHtml), date(b.effectiveOn, true), req.user.id).lastInsertRowid);
      audit(db, req.user, "registration-policy-created", id, { version });
      return id;
    });
    res.status(201).json(one(db, "SELECT * FROM registration_policies WHERE id=?", id));
  });
  app.patch("/api/registration-policies/:id", (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const id = integer(req.params.id, "قانون");
    transaction(db, () => {
      const old = one(db, "SELECT * FROM registration_policies WHERE id=?", id);
      assert(old, "نسخه قوانین یافت نشد", 404);
      assert(old.status === "draft", "نسخه منتشرشده تغییرناپذیر است", 409);
      run(db, "UPDATE registration_policies SET title=?,content_html=?,effective_on=? WHERE id=?", text(req.body.title, "عنوان", 200, true), sanitizePolicyHtml(req.body.contentHtml), date(req.body.effectiveOn, true), id);
      audit(db, req.user, "registration-policy-updated", id, {});
    });
    res.json(one(db, "SELECT * FROM registration_policies WHERE id=?", id));
  });
  app.post("/api/registration-policies/:id/publish", (req, res) => {
    requireRole(req, ["admin"]);
    const id = integer(req.params.id, "قانون");
    transaction(db, () => {
      const policy = one(db, "SELECT * FROM registration_policies WHERE id=?", id);
      assert(policy?.status === "draft", "فقط پیش‌نویس قابل انتشار است", 409);
      run(db, "UPDATE registration_policies SET status='published',published_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", id);
      audit(db, req.user, "registration-policy-published", id, { version: policy.version });
    });
    res.json(one(db, "SELECT * FROM registration_policies WHERE id=?", id));
  });

  app.get("/api/students/:id/policy-acceptances", (req, res) => {
    assert(req.user.education, "مشاهده پذیرش قوانین نیازمند دسترسی آموزشی است", 403);
    const studentId = integer(req.params.id, "هنرجو");
    assert(one(db, "SELECT 1 FROM students WHERE id=?", studentId), "هنرجو یافت نشد", 404);
    const items = all(
      db,
      `SELECT st.id term_id, st.number term_number, i.name instrument,
              p.id policy_id, p.version policy_version, p.title policy_title,
              p.content_html, p.effective_on, p.status policy_status,
              a.id acceptance_id, a.statement, a.accepted_at,
              u.username recorded_by_username
         FROM student_terms st
         JOIN enrollments e ON e.id=st.enrollment_id
         JOIN terms t ON t.id=st.term_id
         JOIN class_offerings c ON c.id=t.offering_id
         LEFT JOIN instruments i ON i.id=COALESCE(c.instrument_id,e.instrument_id)
         JOIN registration_policies p ON p.id=st.policy_id
         LEFT JOIN student_policy_acceptances a
           ON a.student_term_id=st.id AND a.policy_id=p.id
         LEFT JOIN users u ON u.id=a.recorded_by
        WHERE e.student_id=?
        ORDER BY st.id DESC`,
      studentId,
    );
    res.json({ items, statement: ACCEPTANCE_STATEMENT });
  });

  app.post("/api/students/:id/policy-acceptances", (req, res) => {
    assert(req.user.education, "ثبت پذیرش قوانین نیازمند دسترسی آموزشی است", 403);
    const studentId = integer(req.params.id, "هنرجو");
    const termId = integer(req.body.termId, "ترم");
    const policyId = integer(req.body.policyId, "نسخه قوانین");
    assert(req.body.accepted === true, "تأیید مطالعه و پذیرش قوانین الزامی است");
    const term = one(db, "SELECT st.id,e.student_id,st.policy_id FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id WHERE st.id=?", termId);
    assert(term && term.student_id === studentId, "ترم متعلق به این هنرجو نیست", 404);
    assert(term.policy_id === policyId, "نسخه قوانین با نسخه متصل به ترم یکسان نیست", 409);
    const policy = one(db, "SELECT status FROM registration_policies WHERE id=?", policyId);
    assert(policy?.status === "published", "فقط نسخه منتشرشده قوانین قابل پذیرش است", 409);
    let created = false;
    let acceptance;
    transaction(db, () => {
      acceptance = one(db, "SELECT * FROM student_policy_acceptances WHERE student_term_id=? AND policy_id=?", termId, policyId);
      if (acceptance) return;
      const id = Number(run(db, "INSERT INTO student_policy_acceptances(student_id,student_term_id,policy_id,statement,recorded_by) VALUES(?,?,?,?,?)", studentId, termId, policyId, ACCEPTANCE_STATEMENT, req.user.id).lastInsertRowid);
      audit(db, req.user, "registration-policy-accepted", id, { studentId, termId, policyId });
      acceptance = one(db, "SELECT * FROM student_policy_acceptances WHERE id=?", id);
      created = true;
    });
    res.status(created ? 201 : 200).json(acceptance);
  });

  app.get("/api/settings/letterhead", (_req, res) => {
    const row = one(db, "SELECT * FROM academy_letterhead WHERE id=1");
    res.json({ ...row, visible_fields: JSON.parse(row.visible_fields) });
  });
  app.patch("/api/settings/letterhead", (req, res) => {
    requireRole(req, ["admin"]);
    const b = req.body;
    assert(Array.isArray(b.visibleFields) && b.visibleFields.length <= 10, "موارد قابل نمایش نامعتبر است");
    const allowed = ["name_en", "manager", "phone", "mobile", "address", "website", "instagram", "subtitle"];
    assert(b.visibleFields.every((v) => allowed.includes(v)), "مورد نمایش نامعتبر است");
    transaction(db, () => {
      const old = one(db, "SELECT * FROM academy_letterhead WHERE id=1");
      assert(integer(b.version, "نسخه") === old.version, "تنظیمات تغییر کرده است", 409);
      run(db, "UPDATE academy_letterhead SET name_fa=?,name_en=?,manager=?,phone=?,mobile=?,address=?,website=?,instagram=?,subtitle=?,visible_fields=?,version=version+1 WHERE id=1", text(b.nameFa, "نام فارسی", 200, true), text(b.nameEn, "نام انگلیسی", 200), text(b.manager, "مسئول", 150), text(b.phone, "تلفن ثابت", 50), text(b.mobile, "تلفن همراه", 50), text(b.address, "نشانی", 1000), text(b.website, "وب‌سایت", 300), text(b.instagram, "اینستاگرام", 200), text(b.subtitle, "زیرعنوان", 300), JSON.stringify(b.visibleFields));
      audit(db, req.user, "letterhead-updated", 1, { version: old.version + 1 });
    });
    const row = one(db, "SELECT * FROM academy_letterhead WHERE id=1");
    res.json({ ...row, visible_fields: JSON.parse(row.visible_fields) });
  });

  app.post("/api/full-tuition-payments", (req, res) => {
    requireRole(req, ["admin", "accountant"]);
    const b = req.body, key = text(req.headers["idempotency-key"], "شناسه درخواست", 100, true);
    assert(key.length >= 16, "شناسه درخواست کوتاه است");
    const requestHash = hashToken(JSON.stringify(b));
    let result;
    transaction(db, () => {
      const replay = one(db, "SELECT p.* FROM payments p WHERE p.idempotency_key=?", key);
      if (replay) {
        assert(replay.request_hash === requestHash && replay.actor_id === req.user.id, 'شناسه درخواست با محتوای متفاوت استفاده شده است', 409);
        result = { id: replay.id, replayed: true }; return;
      }
      const invoice = one(db, "SELECT * FROM invoices WHERE id=?", integer(b.invoiceId, "صورتحساب"));
      assert(invoice && invoice.student_id === integer(b.studentId, "هنرجو"), "صورتحساب متعلق به هنرجو نیست");
      const view = financial(db, invoice);
      assert(view.total_minor > 0, "برای این ترم مبلغی قابل دریافت نیست");
      assert(view.balance_minor === view.total_minor && view.allocated_minor === 0, "این ترم تسویه شده یا سابقه دریافت جزئی دارد", 409);
      assert(!one(db, "SELECT 1 FROM full_tuition_receipts WHERE invoice_id=? AND voided_at IS NULL", invoice.id), "شهریه این ترم قبلاً دریافت شده است", 409);
      const receivedOn = date(b.receivedOn, true);
      assert(receivedOn <= dateInZone(), "تاریخ دریافت در آینده نیست");
      const method = choice(b.method, ["cash", "bank", "other"], "روش دریافت");
      const bank = b.bankAccountId ? integer(b.bankAccountId, "حساب بانکی") : null;
      if (method === "bank") assert(bank && one(db, "SELECT 1 FROM bank_accounts WHERE id=? AND currency=? AND active=1", bank, invoice.currency), "حساب مقصد فعال و هم‌ارز لازم است");
      else assert(bank === null, "حساب مقصد فقط برای انتقال بانکی است");
      const paymentId = Number(run(db, "INSERT INTO payments(student_id,currency,amount_minor,received_on,method,bank_account_id,reference,notes,actor_id,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)", invoice.student_id, invoice.currency, view.total_minor, receivedOn, method, bank, text(b.reference, "پیگیری", 100), text(b.notes, "توضیحات", 1000), req.user.id, key, requestHash).lastInsertRowid);
      run(db, "INSERT INTO payment_allocations(payment_id,invoice_id,student_id,currency,amount_minor) VALUES(?,?,?,?,?)", paymentId, invoice.id, invoice.student_id, invoice.currency, view.total_minor);
      run(db, "INSERT INTO full_tuition_receipts(invoice_id,payment_id) VALUES(?,?) ON CONFLICT(invoice_id) DO UPDATE SET payment_id=excluded.payment_id,voided_at=NULL,void_reason='',void_actor_id=NULL", invoice.id, paymentId);
      audit(db, req.user, "full-tuition-received", paymentId, { invoiceId: invoice.id, amount: view.total_minor, currency: invoice.currency });
      result = { id: paymentId, amount_minor: view.total_minor, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });

  app.get("/api/students/:id/print-data", (req, res) => {
    assert(req.user.education, 'چاپ پرونده نیازمند دسترسی آموزشی است', 403);
    const studentId = integer(req.params.id, "هنرجو");
    const termId = req.query.termId ? integer(req.query.termId, "ترم") : null;
    const student = one(db, "SELECT * FROM students WHERE id=?", studentId);
    assert(student, "هنرجو یافت نشد", 404);
    const term = termId
      ? termView(db, termId, req.user.role)
      : {
          id: null,
          student_id: studentId,
          registered_on: student.first_registered,
          subject: "",
          teacher: "",
          mode: "",
          location: "",
          structure: "private",
          quota: "",
          duration_minutes: "",
          invoice: null,
          policy_id: null,
        };
    assert(term.student_id === studentId, "ترم متعلق به هنرجو نیست", 404);
    const guardians = all(db, "SELECT g.*,sg.relationship FROM guardians g JOIN student_guardians sg ON sg.guardian_id=g.id WHERE sg.student_id=?", studentId);
    const policyId = termId ? term.policy_id : student.policy_id;
    const policy = policyId
      ? one(db, 'SELECT * FROM registration_policies WHERE id=?', policyId)
      : one(
          db,
          `SELECT * FROM registration_policies
            WHERE status='published'
            ORDER BY CASE WHEN effective_on<=? THEN 0 ELSE 1 END,
                     CASE WHEN effective_on<=? THEN effective_on END DESC,
                     published_at DESC, version DESC
            LIMIT 1`,
          term.registered_on || student.first_registered || dateInZone(),
          term.registered_on || student.first_registered || dateInZone(),
        );
    const letterhead = one(db, "SELECT * FROM academy_letterhead WHERE id=1");
    res.json({ student: { ...student, internal_notes: undefined }, guardians, term, schedules: termId ? all(db, "SELECT * FROM term_schedules WHERE student_term_id=? ORDER BY weekday,start_time", termId) : [], policy, policy_fallback: !policyId && !!policy, letterhead: { ...letterhead, visible_fields: JSON.parse(letterhead.visible_fields) } });
  });
}
