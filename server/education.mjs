import {
  studentUpload,
  studentPersonal,
  studentPhoto,
  saveStudentPhoto,
  photoUrl,
  installStudentEditor,
} from "./student-editor.mjs";
import { studentGrid } from "./student-grid.mjs";
import { dateInZone } from "./dates.mjs";
import { one, all, run, transaction, audit } from "./db.mjs";
import {
  assert,
  text,
  integer,
  choice,
  date,
  money,
  timezone,
  normalize,
  latinDigits,
} from "./validation.mjs";
import { requireRole, hashToken } from "./auth.mjs";
import {
  educationSelection,
  saveEducationPreferences,
  createTuitionPlan,
  installmentView,
  attendanceDetails,
  installWorkflowOptions,
} from "./student-workflow.mjs";
import { calculateTuition } from "./tuition.mjs";
import { requestReplay, saveRequest } from './workflow-requests.mjs';
import { proposeSessions } from '../shared/class-time.js';
function replacementConflicts(db, sessionId, studentTermId) {
  return (
    one(
      db,
      `WITH RECURSIVE edges(a,b) AS (SELECT id,replacement_for FROM sessions WHERE replacement_for IS NOT NULL UNION ALL SELECT replacement_for,id FROM sessions WHERE replacement_for IS NOT NULL), chain(id) AS (SELECT ? UNION SELECT edges.b FROM edges JOIN chain ON edges.a=chain.id) SELECT COUNT(*) n FROM attendance WHERE student_term_id=? AND session_id IN (SELECT id FROM chain) AND session_id!=? AND (counts=1 OR status='reserved')`,
      sessionId,
      studentTermId,
      sessionId,
    ).n > 0
  );
}
export function counters(db, id) {
  const st = one(db, "SELECT * FROM student_terms WHERE id=?", id);
  assert(st, "ترم یافت نشد", 404);
  const rows = all(
    db,
    "SELECT status,COUNT(*) n,SUM(counts) consumed FROM attendance WHERE student_term_id=? GROUP BY status",
    id,
  );
  const counts = {
    quota: st.quota,
    present: 0,
    absent: 0,
    cancelled: 0,
    reserved: 0,
    consumed: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.n;
    counts.consumed += row.consumed;
  }
  counts.remaining = st.quota - counts.consumed;
  counts.schedulable = counts.remaining - counts.reserved;
  return counts;
}
export function financial(db, invoice) {
  const allocated = one(
    db,
    "SELECT COALESCE(SUM(a.amount_minor),0) total FROM payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE a.invoice_id=? AND p.status='confirmed'",
    invoice.id,
  ).total;
  const total = invoice.base_minor - invoice.discount_minor;
  const balance = total - allocated;
  const installments = installmentView(db, invoice.id, allocated);
  return {
    ...invoice,
    installments,
    total_minor: total,
    allocated_minor: allocated,
    balance_minor: balance,
    financial_status:
      total === 0 && invoice.settlement_flow === 'full' ? 'no_due' : balance === 0 ? "settled" : allocated > 0 ? "partial" : "unpaid",
    overdue:
      installments.some((i) => i.overdue) ||
      (!!invoice.due_date && invoice.due_date < dateInZone() && balance > 0),
  };
}
export function termView(db, id, role) {
  const st = one(
    db,
    `SELECT st.*,e.student_id,e.subject_id,COALESCE(c.instrument_id,e.instrument_id) instrument_id,COALESCE(i.name,s.name) subject,t.registered_on,t.start_date,t.end_date,t.duration_minutes,c.mode,c.location,c.course_format,c.teacher,c.structure,c.instructor_id,c.teaching_type_id,c.academy_id,tt.name teaching_type,academy.name academy FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id JOIN terms t ON t.id=st.term_id JOIN class_offerings c ON c.id=t.offering_id LEFT JOIN subjects s ON s.id=e.subject_id LEFT JOIN instruments i ON i.id=COALESCE(c.instrument_id,e.instrument_id) LEFT JOIN teaching_types tt ON tt.id=c.teaching_type_id LEFT JOIN subjects academy ON academy.id=c.academy_id WHERE st.id=?`,
    id,
  );
  assert(st, "ترم یافت نشد", 404);
  if (["admin", "accountant"].includes(role))
    st.invoice = financial(
      db,
      one(db, "SELECT * FROM invoices WHERE student_term_id=?", id),
    );
  if (["admin", "secretary"].includes(role)) {
    st.counters = counters(db, id);
    st.schedules = all(
      db,
      "SELECT * FROM term_schedules WHERE student_term_id=? ORDER BY weekday,start_time",
      id,
    );
    st.sessions = all(
      db,
      "SELECT a.*,s.starts_at,s.timezone,COALESCE(s.duration_minutes,(SELECT duration_minutes FROM terms WHERE id=s.term_id)) duration_minutes,s.replacement_for,(SELECT workflow_version FROM student_terms WHERE id=a.student_term_id) workflow_version FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.student_term_id=? ORDER BY s.starts_at,s.id",
      id,
    );
    if (st.structure === 'group') for (const row of st.sessions) {
      row.group_members=all(db,'SELECT a.id,a.version,a.status,s.first_name,s.last_name FROM attendance a JOIN student_terms st ON st.id=a.student_term_id JOIN enrollments e ON e.id=st.enrollment_id JOIN students s ON s.id=e.student_id WHERE a.session_id=? ORDER BY a.id',row.session_id);
    }
  } else {
    for (const key of [
      "mode",
      "location",
      "teacher",
      "duration_minutes",
      "quota",
      "status",
      "course_format",
      "start_date",
      "end_date",
      "instructor_id",
      "teaching_type_id",
      "academy_id",
      "teaching_type",
      "workflow_version",
    ])
      delete st[key];
  }
  if (!['admin','accountant'].includes(role)) {
    delete st.base_rate_minor_30; delete st.discount_value; delete st.currency_snapshot;
  }
  return st;
}
export function studentView(db, id, role) {
  const student = one(db, "SELECT * FROM students WHERE id=?", id);
  assert(student, "هنرجو یافت نشد", 404);
  student.possible_duplicates = all(
    db,
    "SELECT id,code,first_name,last_name FROM students WHERE id!=? AND search_text LIKE ? AND (?='' OR search_text LIKE ?) LIMIT 5",
    id,
    "%" + normalize(student.first_name + " " + student.last_name) + "%",
    student.phone,
    "%" + normalize(student.phone) + "%",
  );
  delete student.search_text;
  student.photo_url = photoUrl(db, id);
  student.guardians = all(
    db,
    "SELECT g.*,sg.relationship FROM guardians g JOIN student_guardians sg ON sg.guardian_id=g.id WHERE sg.student_id=?",
    id,
  );
  student.enrollments = all(
    db,
    "SELECT e.*,COALESCE(i.name,s.name) subject FROM enrollments e LEFT JOIN subjects s ON s.id=e.subject_id LEFT JOIN instruments i ON i.id=e.instrument_id WHERE student_id=?",
    id,
  ).map((enrollment) => ({
    ...enrollment,
    settings:
      one(
        db,
        "SELECT * FROM enrollment_settings WHERE enrollment_id=?",
        enrollment.id,
      ) || null,
    schedules: all(
      db,
      "SELECT * FROM weekly_schedules WHERE enrollment_id=? AND active=1 ORDER BY weekday,start_time",
      enrollment.id,
    ),
  }));
  if (role==='secretary')for(const enrollment of student.enrollments)if(enrollment.settings){delete enrollment.settings.rate_toman_30;delete enrollment.settings.rate_usd_cents_30;}
  if (["admin", "secretary"].includes(role))
    student.education_preferences =
      one(
        db,
        "SELECT * FROM student_education_preferences WHERE student_id=?",
        id,
      ) || null;
  student.terms = all(
    db,
    "SELECT st.id FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id WHERE e.student_id=? ORDER BY st.id DESC",
    id,
  ).map((v) => termView(db, v.id, role));
  if (!["admin", "secretary"].includes(role)) {
    for (const key of [
      "history",
      "missing_contact_reason",
      "timezone",
      "first_registered",
      "created_at",
      "address",
      "age",
      "birth_date", "gender", "national_id", "landline", "education_level",
      "artistic_history", "referral_source", "registration_goal", "interview_notes",
      "internal_notes", "country", "city", "audience_group", "policy_id",
    ])
      delete student[key];
    for (const enrollment of student.enrollments) {
      delete enrollment.settings;
      delete enrollment.schedules;
    }
  }
  if (["admin", "accountant"].includes(role)) {
    student.payments = all(
      db,
      "SELECT p.*,p.amount_minor-COALESCE((SELECT SUM(amount_minor) FROM payment_allocations a WHERE a.payment_id=p.id),0) credit_minor FROM payments p WHERE student_id=? ORDER BY p.id DESC",
      id,
    );
    student.balances = ["TOMAN", "USD"].map((currency) => ({
      currency,
      debt_minor: student.terms
        .filter((t) => t.invoice.currency === currency)
        .reduce((v, t) => v + t.invoice.balance_minor, 0),
      credit_minor: student.payments
        .filter((p) => p.currency === currency && p.status === "confirmed")
        .reduce((v, p) => v + p.credit_minor, 0),
    }));
  }
  return student;
}
export function createTerm(db, user, studentId, b, renewedFrom = null) {
  assert(
    one(db, "SELECT 1 FROM students WHERE id=? AND status='active'", studentId),
    "هنرجو فعال نیست",
  );
  const calculatedFlow =
    b.discountType !== undefined || b.baseRate !== undefined;
  const selection = b.instrumentId
    ? educationSelection(db, b, { paymentRequired: !calculatedFlow })
    : null;
  const subjectId = selection ? null : integer(b.subjectId, "واحد آموزشی");
  if (!selection)
    assert(
      one(db, "SELECT 1 FROM subjects WHERE id=? AND active=1", subjectId),
      "واحد آموزشی غیرفعال است",
    );
  let enrollment = one(
    db,
    selection
      ? "SELECT * FROM enrollments WHERE student_id=? AND instrument_id=?"
      : "SELECT * FROM enrollments WHERE student_id=? AND subject_id=?",
    studentId,
    selection?.instrumentId ?? subjectId,
  );
  if (renewedFrom && selection) {
    const prior = one(
      db,
      "SELECT e.*,c.instrument_id offering_instrument FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id JOIN terms t ON t.id=st.term_id JOIN class_offerings c ON c.id=t.offering_id WHERE st.id=?",
      renewedFrom,
    );
    assert(prior && prior.student_id === studentId, "مسیر تمدید ناسازگار است");
    assert(
      !(prior.instrument_id || prior.offering_instrument) ||
        (prior.instrument_id || prior.offering_instrument) ===
          selection.instrumentId,
      "ساز در تمدید قابل تغییر نیست",
    );
    enrollment = prior;
  }
  if (!enrollment) {
    const id = run(
      db,
      selection
        ? "INSERT INTO enrollments(student_id,instrument_id) VALUES(?,?)"
        : "INSERT INTO enrollments(student_id,subject_id) VALUES(?,?)",
      studentId,
      selection?.instrumentId ?? subjectId,
    ).lastInsertRowid;
    enrollment = { id };
  }
  const instrument = selection
    ? one(
        db,
        "SELECT rate_toman_30,rate_usd_cents_30 FROM instruments WHERE id=?",
        selection.instrumentId,
      )
    : null;
  const pathSettings=one(db,'SELECT * FROM enrollment_settings WHERE enrollment_id=?',enrollment.id);
  const defaults={...instrument,rate_toman_30:pathSettings?.rate_toman_30??instrument?.rate_toman_30,rate_usd_cents_30:pathSettings?.rate_usd_cents_30??instrument?.rate_usd_cents_30};
  const quote = calculatedFlow ? calculateTuition({...b,durationMinutes:b.durationMinutes||pathSettings?.duration_minutes||30}, defaults) : null;
  const currency = quote?.currency || choice(b.currency, ["TOMAN", "USD"], "ارز"),
    base = quote?.gross ?? money(b.amount, currency),
    discount = quote?.discount ?? money(b.discount || "0", currency),
    reason = text(b.reason, "دلیل", 1000);
  if (
    calculatedFlow &&
    b.baseRate !== undefined &&
    b.baseRate !== "" &&
    quote.rate !==
      (quote.currency === "USD"
        ? defaults.rate_usd_cents_30
        : defaults.rate_toman_30)
  ) {
    requireRole({ user }, ["admin"]);
    assert(reason, "دلیل نرخ اختصاصی لازم است");
  }
  assert(discount <= base, "تخفیف بیش از مبلغ است");
  if (discount) {
    requireRole({ user }, ["admin"]);
    assert(reason, "دلیل تخفیف لازم است");
  }
  if (base === discount) {
    assert(reason, "ترم رایگان نیازمند دلیل است");
    if (calculatedFlow) {
      requireRole({user}, ['admin']);
      assert(b.confirmZero === true, 'شهریه صفر نیازمند تأیید صریح مدیر است');
    }
  }
  const quota = quote?.quota ?? integer(b.quota ?? 4, "سهم جلسات", 1, 1000),
    mode = selection
      ? selection.mode
      : choice(b.mode || "onsite", ["onsite", "online"], "شیوه برگزاری"),
    location = selection
      ? selection.location
      : text(b.location, "محل", 200, mode === "onsite"),
    format = choice(
      b.courseFormat || "normal",
      ["normal", "masterclass"],
      "قالب دوره",
    );
  const registered = date(b.registeredOn, true),
    start = date(b.startDate),
    end = date(b.endDate);
  assert(!start || !end || end >= start, "پایان پیش از شروع است");
  const duration = quote?.duration ?? (b.durationMinutes
    ? integer(b.durationMinutes, "مدت", 1, 1440)
    : null);
  if (renewedFrom) {
    const old = one(db, "SELECT * FROM student_terms WHERE id=?", renewedFrom);
    assert(
      old && old.enrollment_id === enrollment.id,
      "مسیر تمدید ناسازگار است",
    );
    assert(
      !one(db, "SELECT 1 FROM student_terms WHERE renewed_from=?", renewedFrom),
      "این ترم قبلاً تمدید شده است",
      409,
    );
  }
  const structure = choice(b.structure || "private", ["private", "group"], "نوع کلاس");
  const group = b.groupTermId ? one(db,"SELECT st.*,t.duration_minutes,t.start_date,t.end_date,t.offering_id,c.instrument_id,c.instructor_id,c.teaching_type_id,c.academy_id,c.structure FROM student_terms st JOIN terms t ON t.id=st.term_id JOIN class_offerings c ON c.id=t.offering_id WHERE st.id=? AND c.structure='group' AND st.status IN ('current','planned')",integer(b.groupTermId,'کلاس مشترک')) : null;
  if (b.groupTermId) {
    assert(group && structure==='group','کلاس مشترک فعال را انتخاب کنید');
    assert(selection && group.instrument_id===selection.instrumentId && group.instructor_id===selection.instructorId && group.teaching_type_id===selection.teachingTypeId && group.academy_id===selection.academyId,'مشخصات کلاس باید با گروه مشترک یکسان باشد');
    assert(duration===group.duration_minutes && start===group.start_date && end===group.end_date,'تاریخ و مدت کلاس از گروه مشترک خوانده می‌شود');
    assert(b.reserveProposed!==true,'جلسات گروه از برنامه مشترک خوانده می‌شوند');
  }
  const offering = group?.offering_id || run(
    db,
    "INSERT INTO class_offerings(subject_id,mode,location,course_format,instrument_id,structure) VALUES(?,?,?,?,?,?)",
    subjectId,
    mode,
    location,
    format,
    selection?.instrumentId ?? null,
    structure,
  ).lastInsertRowid;
  if (selection && !group)
    run(
      db,
      "UPDATE class_offerings SET instrument_id=?,instructor_id=?,teaching_type_id=?,academy_id=?,teacher=? WHERE id=?",
      selection.instrumentId,
      selection.instructorId,
      selection.teachingTypeId,
      selection.academyId,
      selection.instructor.name,
      offering,
    );
  const term = group?.term_id || run(
    db,
    "INSERT INTO terms(offering_id,registered_on,start_date,end_date,duration_minutes) VALUES(?,?,?,?,?)",
    offering,
    registered,
    start,
    end,
    duration,
  ).lastInsertRowid;
  const number = one(
    db,
    "SELECT COALESCE(MAX(number),0)+1 n FROM student_terms WHERE enrollment_id=?",
    enrollment.id,
  ).n;
  const id = Number(
    run(
      db,
      "INSERT INTO student_terms(term_id,enrollment_id,number,quota,renewed_from) VALUES(?,?,?,?,?)",
      term,
      enrollment.id,
      number,
      quota,
      renewedFrom,
    ).lastInsertRowid,
  );
  if (selection)
    run(db, "UPDATE student_terms SET workflow_version=? WHERE id=?", calculatedFlow ? 3 : 2, id);
  const policy = one(
    db,
    "SELECT id FROM registration_policies WHERE status='published' AND effective_on<=? ORDER BY effective_on DESC,version DESC LIMIT 1",
    registered,
  );
  if(calculatedFlow)assert(policy,'ابتدا مدیر نسخه قوانین ثبت‌نام را با تاریخ اثرگذاری مناسب منتشر کند');
  if (policy) run(db, 'UPDATE enrollments SET policy_id=COALESCE(policy_id,?) WHERE id=?', policy.id, enrollment.id);
  if (calculatedFlow)
    run(
      db,
      "UPDATE student_terms SET discount_type=?,discount_value=?,base_rate_minor_30=?,currency_snapshot=?,policy_id=? WHERE id=?",
      quote.discountType,
      quote.discountValue,
      quote.rate,
      quote.currency,
      policy?.id || null,
      id,
    );
  const invoiceResult = run(
    db,
    "INSERT INTO invoices(student_term_id,student_id,currency,base_minor,discount_minor,reason,due_date) VALUES(?,?,?,?,?,?,?)",
    id,
    studentId,
    currency,
    base,
    discount,
    reason,
    date(b.dueDate),
  );
  if (selection && !calculatedFlow)
    createTuitionPlan(
      db,
      Number(invoiceResult.lastInsertRowid),
      b,
      selection,
      base - discount,
      currency,
    );
  if (calculatedFlow) {
    run(
      db,
      "UPDATE invoices SET settlement_type=?,payment_method_name='',payment_method_id=NULL,settlement_flow='full' WHERE id=?",
      quote.net === 0 ? "free" : "single",
      Number(invoiceResult.lastInsertRowid),
    );
    const schedules = group ? all(db,'SELECT weekday,start_time startTime,duration_minutes durationMinutes,timezone FROM term_schedules WHERE student_term_id=?',group.id) : Array.isArray(b.schedules)
      ? b.schedules
      : all(
          db,
          "SELECT weekday,start_time startTime,duration_minutes durationMinutes,timezone FROM weekly_schedules WHERE enrollment_id=? AND active=1 ORDER BY weekday,start_time",
          enrollment.id,
        );
    assert(schedules.length <= 14, "برنامه هفتگی نامعتبر است");
    if (!group && Array.isArray(b.schedules))
      run(
        db,
        "UPDATE weekly_schedules SET active=0,version=version+1 WHERE enrollment_id=? AND active=1",
        enrollment.id,
      );
    for (const item of schedules) {
      const weekday = integer(item.weekday, "روز هفته", 0, 6),
        startTime = text(item.startTime, "ساعت شروع", 5, true),
        rowDuration = integer(item.durationMinutes || duration, "مدت جلسه", 1, 1440),
        rowTimezone = timezone(item.timezone || b.timezone || "Asia/Tehran");
      assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime), "ساعت شروع نامعتبر است");
      run(db, "INSERT INTO term_schedules(student_term_id,weekday,start_time,duration_minutes,timezone) VALUES(?,?,?,?,?)", id, weekday, startTime, rowDuration, rowTimezone);
      if (!group && Array.isArray(b.schedules))
        run(
          db,
          "INSERT INTO weekly_schedules(enrollment_id,weekday,start_time,duration_minutes,timezone,effective_from) VALUES(?,?,?,?,?,?)",
          enrollment.id,
          weekday,
          startTime,
          rowDuration,
          rowTimezone,
          start,
        );
    }
    if (b.reserveProposed === true) {
      assert(start && schedules.length, 'برای پیشنهاد جلسات، شروع ترم و برنامه کلاس لازم است');
      const proposed = proposeSessions(start, quota, schedules);
      assert(Array.isArray(b.proposedSessions) && b.proposedSessions.length === proposed.length && b.proposedSessions.every((p, i) => p.startsAt === proposed[i].startsAt), 'برنامه پیشنهادی تغییر کرده است؛ دوباره بازبینی کنید');
      for (const row of proposed) {
        const sid = run(db, 'INSERT INTO sessions(term_id,starts_at,timezone,duration_minutes) VALUES(?,?,?,?)', term, row.startsAt, row.timezone, duration).lastInsertRowid;
        run(db, "INSERT INTO attendance(session_id,student_term_id,reason,requested_by) VALUES(?,?,?,'academy')", sid, id, 'رزرو پس از بازبینی برنامه ترم');
      }
    }
    if (group) {
      const existing=all(db,"SELECT s.id FROM sessions s WHERE s.term_id=? AND s.starts_at>? AND EXISTS(SELECT 1 FROM attendance a WHERE a.session_id=s.id AND a.status='reserved') ORDER BY s.starts_at",term,new Date().toISOString());
      assert(existing.length<=quota,'تعداد جلسات رزرو گروه بیش از سهم این هنرجو است');
      for(const row of existing)run(db,"INSERT INTO attendance(session_id,student_term_id,reason,requested_by) VALUES(?,?,?,'academy')",row.id,id,'عضویت در کلاس گروهی');
    }
  }
  run(
    db,
    "UPDATE students SET first_registered=CASE WHEN history='new' AND (first_registered IS NULL OR first_registered>?) THEN ? ELSE first_registered END WHERE id=?",
    registered,
    registered,
    studentId,
  );
  audit(db, user, renewedFrom ? "term-renewed" : "term-created", id, {
    renewedFrom,
    quota,
    currency,
    base,
    discount,
    discountType: quote?.discountType || "legacy",
    rate: quote?.rate ?? null,
  });
  return id;
}
export function installEducation(app, db) {
  installWorkflowOptions(app, db);
  app.get("/api/subjects", (req, res) =>
    res.json(all(db, "SELECT * FROM subjects WHERE active=1 ORDER BY id")),
  );
  app.get("/api/students", (req, res) => res.json(studentGrid(db, req.query)));
  app.post("/api/students", studentUpload, async (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const b = req.body;
    const replay = requestReplay(db, req, 'student', { ...b, photoHash: req.file ? hashToken(req.file.buffer) : null });
    if (replay?.targetId) return res.json(studentView(db, replay.targetId, req.user.role));
    const photo = await studentPhoto(req);
    const personal = studentPersonal(b);
    const id = transaction(db, () => {
      const first = text(b.firstName, "نام فارسی", 100, true),
        last = text(b.lastName, "نام خانوادگی فارسی", 100, true),
        phone = latinDigits(text(b.phone, "شماره تماس", 30)),
        gName = text(b.guardianName, "نام سرپرست", 150),
        gPhone = latinDigits(text(b.guardianPhone, "تماس سرپرست", 30)),
        reason = text(b.missingContactReason, "دلیل نبود تماس", 1000);
      for (const p of [phone, gPhone])
        if (p) assert(/^\+?[0-9 ()-]{6,30}$/.test(p), "شماره تماس نامعتبر است");
      assert(!gPhone || gName, "نام سرپرست لازم است");
      assert(phone || gPhone, "راه تماس هنرجو یا والد را وارد کنید");
      const selection = b.instrumentId && b.instructorId && b.teachingTypeId
        ? educationSelection(db, b, { paymentRequired: false })
        : null;
      const basicInstrument = b.instrumentId ? integer(b.instrumentId, 'ساز') : null;
      if (basicInstrument) assert(one(db, "SELECT 1 FROM instruments WHERE id=? AND status='active'", basicInstrument), 'ساز فعال را انتخاب کنید');
      const subject = selection || !b.subjectId
        ? null
        : integer(b.subjectId, "واحد موردنظر");
      if (!selection && subject)
        assert(
          one(db, "SELECT 1 FROM subjects WHERE id=? AND active=1", subject),
          "واحد آموزشی نامعتبر است",
        );
      const ef = text(b.englishFirst, "نام انگلیسی", 100),
        el = text(b.englishLast, "نام خانوادگی انگلیسی", 100);
      const tz = timezone(b.timezone || "Asia/Tehran");
      const search = normalize([first, last, ef, el, phone, gPhone].join(" "));
      const id = Number(
        run(
          db,
          "INSERT INTO students(first_name,last_name,english_first,english_last,phone,timezone,history,missing_contact_reason,search_text,address,age,contact_owner,birth_date,gender,national_id,landline,country,city,education_level,artistic_history,referral_source,registration_goal,interview_notes,internal_notes,audience_group,first_registered) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          first,
          last,
          ef,
          el,
          phone,
          tz,
          choice(b.history || "unknown", ["new", "old", "unknown"], "سابقه"),
          reason,
          search,
          personal.address,
          personal.age,
          personal.contactOwner,
          personal.birthDate,
          personal.gender,
          personal.nationalId,
          personal.landline,
          personal.country,
          personal.city,
          personal.educationLevel,
          personal.artisticHistory,
          personal.referralSource,
          personal.registrationGoal,
          personal.interviewNotes,
          personal.internalNotes,
          personal.audienceGroup,
          date(b.registrationDate),
        ).lastInsertRowid,
      );
      const code = "M-" + String(id).padStart(6, "0");
      run(
        db,
        "UPDATE students SET code=?,search_text=?,status=? WHERE id=?",
        code,
        search + " " + code.toLowerCase(),
        choice(
          b.status || "active",
          ["active", "inactive", "archived"],
          "وضعیت",
        ),
        id,
      );
      if (gName) {
        let g = gPhone
          ? one(
              db,
              "SELECT * FROM guardians WHERE name=? AND phone=?",
              gName,
              gPhone,
            )
          : null;
        if (!g)
          g = {
            id: run(
              db,
              "INSERT INTO guardians(name,phone) VALUES(?,?)",
              gName,
              gPhone,
            ).lastInsertRowid,
          };
        run(
          db,
          "INSERT INTO student_guardians VALUES(?,?,?)",
          id,
          g.id,
          text(b.guardianRelationship || "سرپرست", "نسبت", 80),
        );
      }
      if (selection || subject || basicInstrument) {
        const enrollmentId = Number(run(
          db,
          selection || basicInstrument
            ? "INSERT INTO enrollments(student_id,instrument_id) VALUES(?,?)"
            : "INSERT INTO enrollments(student_id,subject_id) VALUES(?,?)",
          id,
          selection?.instrumentId ?? basicInstrument ?? subject,
        ).lastInsertRowid);
        if (selection) {
          if (selection.paymentMethodId)
            saveEducationPreferences(db, id, selection);
          run(db, "INSERT INTO enrollment_settings(enrollment_id,instructor_id,teaching_type_id,academy_id,mode,structure,duration_minutes,timezone) VALUES(?,?,?,?,?,?,?,?)", enrollmentId, selection.instructorId, selection.teachingTypeId, selection.academyId, selection.mode, choice(b.structure || "private", ["private","group"], "نوع کلاس"), b.durationMinutes ? integer(b.durationMinutes, "مدت", 1, 1440) : 30, timezone(b.timezone || "Asia/Tehran"));
        }
      }
      saveStudentPhoto(db, id, photo);
      const policy = one(db, "SELECT id FROM registration_policies WHERE status='published' AND effective_on<=? ORDER BY effective_on DESC,version DESC LIMIT 1", date(b.registrationDate) || dateInZone());
      if (policy) run(db, 'UPDATE students SET policy_id=? WHERE id=?', policy.id, id);
      saveRequest(db, req, replay, 'student', id);
      audit(db, req.user, "student-created", id, {});
      return id;
    });
    res.status(201).json(studentView(db, id, req.user.role));
  });
  installStudentEditor(app, db, studentView);
  app.get("/api/students/:id", (req, res) =>
    res.json(studentView(db, integer(req.params.id, "شناسه"), req.user.role)),
  );
  app.post("/api/students/:id/terms", (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const scope = 'term:' + integer(req.params.id, 'شناسه');
    const replay = requestReplay(db, req, scope);
    if (replay?.targetId) return res.json(termView(db, replay.targetId, req.user.role));
    const id = transaction(db, () => {
      const id = createTerm(db, req.user, integer(req.params.id, "شناسه"), req.body);
      saveRequest(db, req, replay, scope, id);
      return id;
    });
    res.status(201).json(termView(db, id, req.user.role));
  });
  app.post("/api/terms/:id/renew", (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const old = one(
      db,
      "SELECT st.*,e.student_id FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id WHERE st.id=?",
      integer(req.params.id, "شناسه"),
    );
    assert(old, "ترم یافت نشد", 404);
    const scope = 'renew:' + old.id;
    const replay = requestReplay(db, req, scope);
    if (replay?.targetId) return res.json(termView(db, replay.targetId, req.user.role));
    const id = transaction(db, () =>
      { const id = createTerm(db, req.user, old.student_id, req.body, old.id);
        saveRequest(db, req, replay, scope, id); return id; },
    );
    res.status(201).json(termView(db, id, req.user.role));
  });
  app.post("/api/terms/:id/sessions", (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const id = integer(req.params.id, "شناسه"),
      b = req.body,
      key = text(req.headers["idempotency-key"], "شناسه درخواست", 100, true);
    assert(key.length >= 16, "شناسه درخواست کوتاه است");
    const requestHash = hashToken(JSON.stringify(b));
    transaction(db, () => {
      const prior = one(
        db,
        "SELECT * FROM sessions WHERE idempotency_key=?",
        key,
      );
      if (prior) {
        const target = one(
          db,
          "SELECT term_id FROM student_terms WHERE id=?",
          id,
        );
        assert(
          target &&
            target.term_id === prior.term_id &&
            prior.request_hash === requestHash,
          "شناسه درخواست متفاوت است",
          409,
        );
        return;
      }
      const st = one(db, "SELECT * FROM student_terms WHERE id=?", id);
      assert(st, "ترم یافت نشد", 404);
      const detail = attendanceDetails(b, st.workflow_version === 2);
      assert(
        st.status === "current" || st.status === "planned",
        "ترم قابل رزرو نیست",
      );
      assert(counters(db, id).schedulable > 0, "ظرفیت رزرو تکمیل است", 409);
      assert(
        typeof b.startsAt === "string" &&
          /^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(b.startsAt) &&
          Number.isFinite(Date.parse(b.startsAt)),
        "زمان واقعی جلسه نامعتبر است",
      );
      const starts = new Date(b.startsAt).toISOString();
      const tz = timezone(b.timezone || "Asia/Tehran");
      const replacement = b.replacementFor
        ? integer(b.replacementFor, "جلسه قبلی")
        : null;
      if (replacement) {
        const old = one(
          db,
          "SELECT a.* FROM attendance a WHERE a.session_id=? AND a.student_term_id=?",
          replacement,
          id,
        );
        assert(
          old &&
            ["cancelled", "absent"].includes(old.status) &&
            old.counts === 0,
          "جایگزین فقط برای جلسه مصرف‌نشده همین ترم ممکن است",
        );
        assert(
          !replacementConflicts(db, replacement, id),
          "زنجیره جایگزین نوبت فعال یا مصرف‌شده دارد",
          409,
        );
      }
      const sid = run(
        db,
        "INSERT INTO sessions(term_id,starts_at,timezone,duration_minutes,replacement_for,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?)",
        st.term_id,
        starts,
        tz,
        b.durationMinutes ? integer(b.durationMinutes, "مدت", 1, 1440) : null,
        replacement,
        key,
        requestHash,
      ).lastInsertRowid;
      const offering = one(db,'SELECT c.structure FROM terms t JOIN class_offerings c ON c.id=t.offering_id WHERE t.id=?',st.term_id);
      const members = offering.structure==='group' && !replacement ? all(db,"SELECT id FROM student_terms WHERE term_id=? AND status IN ('current','planned')",st.term_id) : [{id}];
      for (const member of members) {
        assert(counters(db,member.id).schedulable>0,'سهم رزرو یکی از اعضای گروه تکمیل است',409);
        run(db,'INSERT INTO attendance(session_id,student_term_id,reason,requested_by,justified) VALUES(?,?,?,?,?)',sid,member.id,detail.reason,detail.actor,detail.justified);
      }
      audit(db, req.user, "session-reserved", sid, {
        studentTerm: id,
        replacement,
        reason: detail.reason,
        requestedBy: detail.actor,
        justified: detail.justified,
      });
    });
    res.status(201).json(termView(db, id, req.user.role));
  });
  app.patch("/api/sessions/:id", (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const sid = integer(req.params.id, "جلسه"),
      b = req.body;
    const stid = transaction(db, () => {
      const a = b.attendanceId ? one(db,'SELECT * FROM attendance WHERE session_id=? AND id=?',sid,integer(b.attendanceId,'حضور')) : one(db, "SELECT * FROM attendance WHERE session_id=?", sid);
      assert(a, "جلسه یافت نشد", 404);
      assert(a.status === "reserved", "فقط نوبت رزرو قابل جابه‌جایی تاریخ است");
      assert(
        a.version === integer(b.version, "نسخه"),
        "جلسه تغییر کرده است",
        409,
      );
      assert(
        typeof b.startsAt === "string" &&
          /^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(b.startsAt) &&
          Number.isFinite(Date.parse(b.startsAt)),
        "زمان نامعتبر است",
      );
      const old = one(db, "SELECT * FROM sessions WHERE id=?", sid);
      const members=all(db,'SELECT id,version,status FROM attendance WHERE session_id=? ORDER BY id',sid);
      if(members.length>1) {
        requireRole(req,['admin']);
        assert(b.confirmGroup===true && Array.isArray(b.groupVersions),'تغییر برنامه گروه نیازمند بازبینی اعضا و تأیید مدیر است');
        assert(members.every(m=>m.status==='reserved'),'جلسه دارای حضور ثبت‌شده است؛ تغییر جمعی ممکن نیست');
        assert(JSON.stringify(members.map(m=>({id:m.id,version:m.version})))===JSON.stringify(b.groupVersions),'وضعیت گروه تغییر کرده است؛ تازه‌سازی کنید',409);
      }
      const workflow = one(
        db,
        "SELECT workflow_version FROM student_terms WHERE id=?",
        a.student_term_id,
      );
      const detail = attendanceDetails(b, workflow.workflow_version === 2, a);
      run(
        db,
        "UPDATE sessions SET starts_at=?,timezone=?,duration_minutes=? WHERE id=?",
        new Date(b.startsAt).toISOString(),
        timezone(b.timezone || "Asia/Tehran"),
        b.durationMinutes ? integer(b.durationMinutes, "مدت", 1, 1440) : null,
        sid,
      );
      run(
        db,
        "UPDATE attendance SET reason=?,requested_by=?,justified=?,version=version+1 WHERE id=?",
        detail.reason,
        detail.actor,
        detail.justified,
        a.id,
      );
      for(const member of members.filter(m=>m.id!==a.id))run(db,'UPDATE attendance SET version=version+1 WHERE id=?',member.id);
      audit(db, req.user, "reservation-edited", sid, {
        before: old.starts_at,
        after: b.startsAt,
        reason: detail.reason,
        requestedBy: detail.actor,
        justified: detail.justified,
      });
      return a.student_term_id;
    });
    res.json(termView(db, stid, req.user.role));
  });
  app.patch("/api/attendance/:id", (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const id = integer(req.params.id, "شناسه"),
      b = req.body;
    const stid = transaction(db, () => {
      const a = one(
        db,
        "SELECT a.*,s.starts_at FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.id=?",
        id,
      );
      assert(a, "جلسه یافت نشد", 404);
      assert(
        a.version === integer(b.version, "نسخه"),
        "جلسه هم‌زمان تغییر کرده؛ تازه‌سازی کنید",
        409,
      );
      const status = choice(
          b.status,
          ["reserved", "present", "absent", "cancelled"],
          "وضعیت",
        ),
        reason = text(b.reason, "دلیل", 1000);
      let counts = status === "present" ? 1 : 0;
      let cancelledBy = "";
      const workflow = one(
        db,
        "SELECT workflow_version FROM student_terms WHERE id=?",
        a.student_term_id,
      );
      const details = attendanceDetails(
        b,
        workflow.workflow_version === 2 && status !== "present",
      );
      if (status === "absent") {
        if (workflow.workflow_version >= 3) {
          assert(reason, 'توضیح غیبت لازم است');
          counts = 1;
        } else {
          assert(typeof b.counts === "boolean" && reason, "برای غیبت انتخاب صریح مصرف و دلیل لازم است");
          counts = b.counts ? 1 : 0;
        }
      }
      if (status === "cancelled") {
        assert(reason, "دلیل کنسلی لازم است");
        cancelledBy = choice(
          b.cancelledBy,
          ["teacher", "student", "academy", "other"],
          "لغوکننده",
        );
        if (workflow.workflow_version >= 3 && cancelledBy === 'student') {
          assert(typeof b.counts === 'boolean', 'برای کنسلی هنرجو تصمیم صریح کسر سهم لازم است');
          counts = b.counts ? 1 : 0;
        }
      }
      if (["present", "absent"].includes(status))
        assert(
          Date.parse(a.starts_at) <= Date.now(),
          "ثبت نتیجه برای جلسه آینده ممکن نیست",
        );
      if (counts === 1 || status === "reserved")
        assert(
          !replacementConflicts(db, a.session_id, a.student_term_id),
          "جلسه مرتبط در زنجیره جایگزین رزرو یا مصرف شده است؛ ابتدا آن را تعیین تکلیف کنید",
          409,
        );
      run(
        db,
        "UPDATE attendance SET status=?,counts=?,reason=?,cancelled_by=?,requested_by=?,justified=?,version=version+1 WHERE id=?",
        status,
        counts,
        reason,
        cancelledBy,
        status === "present" ? "" : details.actor,
        status === "present" ? null : details.justified,
        id,
      );
      const c = counters(db, a.student_term_id);
      assert(
        c.remaining >= 0 && c.schedulable >= 0,
        "مصرف یا رزرو از سهم بیشتر می‌شود؛ نوبت‌های متعارض را اصلاح کنید",
        409,
      );
      run(
        db,
        "UPDATE student_terms SET status=CASE WHEN ?=0 THEN 'completed' WHEN status='completed' THEN 'current' ELSE status END WHERE id=?",
        c.remaining,
        a.student_term_id,
      );
      audit(db, req.user, "attendance-updated", id, {
        before: { status: a.status, counts: a.counts },
        after: {
          status,
          counts,
          reason,
          cancelledBy,
          requestedBy: details.actor,
          justified: details.justified,
        },
      });
      return a.student_term_id;
    });
    res.json(termView(db, stid, req.user.role));
  });
}
