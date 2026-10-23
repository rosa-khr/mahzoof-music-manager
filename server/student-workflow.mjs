import { all, one, run } from "./db.mjs";
import { assert, integer, choice, text, date, money } from "./validation.mjs";
import { dateInZone } from "./dates.mjs";

export function educationSelection(db, b, { paymentRequired = true } = {}) {
  const instrumentId = integer(b.instrumentId, "ساز"),
    instructorId = integer(b.instructorId, "مدرس"),
    teachingTypeId = integer(b.teachingTypeId, "شیوه برگزاری"),
    paymentMethodId = b.paymentMethodId
      ? integer(b.paymentMethodId, "شیوه پرداخت")
      : null;
  assert(
    one(
      db,
      "SELECT 1 FROM instruments WHERE id=? AND status='active'",
      instrumentId,
    ),
    "ساز فعال را انتخاب کنید",
  );
  const instructor = one(
    db,
    "SELECT * FROM instructors WHERE id=? AND status='active'",
    instructorId,
  );
  assert(
    instructor &&
      one(
        db,
        "SELECT 1 FROM instructor_instruments WHERE instructor_id=? AND instrument_id=?",
        instructorId,
        instrumentId,
      ),
    "مدرس فعال و متخصص ساز انتخاب‌شده را مشخص کنید",
  );
  const delivery = one(
    db,
    "SELECT requires_academy FROM teaching_types WHERE id=? AND status='active'",
    teachingTypeId,
  );
  assert(delivery, "شیوه برگزاری فعال را انتخاب کنید");
  assert(
    delivery.requires_academy !== null,
    "نیاز به آموزشگاه برای این شیوه برگزاری در اطلاعات پایه تعیین نشده است",
  );
  const mode = delivery.requires_academy ? "onsite" : "online";
  const paymentMethod = paymentMethodId
    ? one(
        db,
        "SELECT * FROM payment_methods WHERE id=? AND status='active'",
        paymentMethodId,
      )
    : null;
  assert(
    !paymentRequired || paymentMethod,
    "شیوه پرداخت فعال را انتخاب کنید",
  );
  assert(!paymentMethodId || paymentMethod, "شیوه پرداخت فعال را انتخاب کنید");
  const academyId = mode === "onsite" ? integer(b.academyId, "آموزشگاه") : null;
  const academy =
    academyId &&
    one(db, "SELECT * FROM subjects WHERE id=? AND active=1", academyId);
  assert(
    mode !== "onsite" || academy,
    "برای آموزش حضوری آموزشگاه فعال را انتخاب کنید",
  );
  return {
    instrumentId,
    instructorId,
    teachingTypeId,
    paymentMethodId,
    mode,
    academyId,
    instructor,
    paymentMethod,
    location: academy?.name || "",
  };
}

export function saveEducationPreferences(db, studentId, v) {
  assert(v.paymentMethodId, "شیوه پرداخت برای تنظیمات قدیمی لازم است");
  run(
    db,
    "INSERT INTO student_education_preferences(student_id,instrument_id,instructor_id,teaching_type_id,mode,academy_id,payment_method_id) VALUES(?,?,?,?,?,?,?)",
    studentId,
    v.instrumentId,
    v.instructorId,
    v.teachingTypeId,
    v.mode,
    v.academyId,
    v.paymentMethodId,
  );
}

export function createTuitionPlan(db, invoiceId, b, selection, net, currency) {
  const method = selection.paymentMethod;
  assert(
    method.settlement_type === "free" ? net === 0 : net > 0,
    "مبلغ شهریه با شیوه پرداخت سازگار نیست",
  );
  if (method.settlement_type !== "free")
    assert(
      method.payment_currency === (currency === "TOMAN" ? "rial" : "foreign"),
      "نوع پرداخت ریالی/ارزی با واحد پول سازگار نیست",
    );
  run(
    db,
    "UPDATE invoices SET payment_method_id=?,payment_method_name=?,settlement_type=? WHERE id=?",
    method.id,
    method.name,
    method.settlement_type,
    invoiceId,
  );
  if (method.settlement_type !== "installment") {
    assert(!b.installments?.length, "این شیوه پرداخت اقساطی نیست");
    return;
  }
  assert(
    Array.isArray(b.installments) &&
      b.installments.length === method.installment_count,
    "تعداد ردیف اقساط با شیوه پرداخت یکسان نیست",
  );
  let sum = 0,
    previous = "";
  for (const [i, item] of b.installments.entries()) {
    const amount = money(item.amount, currency),
      due = date(item.dueDate, true);
    assert(amount > 0, "مبلغ هر قسط باید بیشتر از صفر باشد");
    assert(due >= previous, "سررسید اقساط باید به ترتیب باشد");
    previous = due;
    sum += amount;
    run(
      db,
      "INSERT INTO invoice_installments(invoice_id,number,amount_minor,due_date) VALUES(?,?,?,?)",
      invoiceId,
      i + 1,
      amount,
      due,
    );
  }
  assert(sum === net, "جمع اقساط باید دقیقاً برابر شهریه نهایی باشد");
}

export function installmentView(db, invoiceId, paid) {
  return all(
    db,
    "SELECT * FROM invoice_installments WHERE invoice_id=? ORDER BY number",
    invoiceId,
  ).map((row) => {
    const allocated = Math.min(paid, row.amount_minor);
    paid -= allocated;
    const balance = row.amount_minor - allocated;
    return {
      ...row,
      allocated_minor: allocated,
      balance_minor: balance,
      financial_status:
        balance === 0 ? "settled" : allocated > 0 ? "partial" : "unpaid",
      overdue: balance > 0 && row.due_date < dateInZone(),
    };
  });
}

export function attendanceDetails(b, required, fallback = {}) {
  const reason = text(b.reason ?? fallback.reason, "دلیل", 1000);
  const actor =
    b.requestedBy ??
    b.cancelledBy ??
    fallback.requested_by ??
    fallback.cancelled_by ??
    "";
  const justified =
    b.justified === undefined ? fallback.justified : b.justified;
  if (actor)
    choice(actor, ["teacher", "student", "academy", "other"], "از طرف چه کسی");
  if (justified != null)
    assert(
      typeof justified === "boolean" || justified === 0 || justified === 1,
      "موجه یا غیرموجه بودن نامعتبر است",
    );
  if (required) {
    assert(reason, "توضیح علت رزرو، کنسلی یا غیبت الزامی است");
    assert(
      typeof justified === "boolean" || justified === 0 || justified === 1,
      "موجه یا غیرموجه بودن را مشخص کنید",
    );
    choice(actor, ["teacher", "student", "academy", "other"], "از طرف چه کسی");
  }
  return {
    reason,
    actor: actor || "",
    justified: justified == null ? null : justified ? 1 : 0,
  };
}

export function installWorkflowOptions(app, db) {
  app.get("/api/students/education-options", (req, res) => {
    assert(req.user.education, "دسترسی آموزشی مجاز نیست", 403);
    res.json({
      instruments: all(
        db,
        "SELECT id,name,rate_toman_30,rate_usd_cents_30 FROM instruments WHERE status='active' ORDER BY name",
      ),
      instructors: all(
        db,
        "SELECT id,name,(SELECT json_group_array(instrument_id) FROM instructor_instruments ii WHERE ii.instructor_id=i.id) instrument_ids FROM instructors i WHERE status='active' ORDER BY name",
      ).map((r) => ({ ...r, instrument_ids: JSON.parse(r.instrument_ids) })),
      teachingTypes: all(
        db,
        "SELECT id,name,requires_academy FROM teaching_types WHERE status='active' ORDER BY name",
      ),
      academies: all(
        db,
        "SELECT id,name FROM subjects WHERE active=1 ORDER BY name",
      ),
      paymentMethods: all(
        db,
        "SELECT id,name,settlement_type,payment_currency,installment_count FROM payment_methods WHERE status='active' ORDER BY name",
      ),
    });
  });
}
