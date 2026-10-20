import {
  studentUpload,
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
} from "./validation.mjs";
import { requireRole, hashToken } from "./auth.mjs";
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
  return {
    ...invoice,
    total_minor: total,
    allocated_minor: allocated,
    balance_minor: balance,
    financial_status:
      balance === 0 ? "settled" : allocated > 0 ? "partial" : "unpaid",
    overdue:
      !!invoice.due_date && invoice.due_date < dateInZone() && balance > 0,
  };
}
export function termView(db, id, role) {
  const st = one(
    db,
    `SELECT st.*,e.student_id,e.subject_id,s.name subject,t.registered_on,t.start_date,t.end_date,t.duration_minutes,c.mode,c.location,c.course_format,c.teacher,c.structure FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id JOIN subjects s ON s.id=e.subject_id JOIN terms t ON t.id=st.term_id JOIN class_offerings c ON c.id=t.offering_id WHERE st.id=?`,
    id,
  );
  assert(st, "ترم یافت نشد", 404);
  if (role !== "secretary")
    st.invoice = financial(
      db,
      one(db, "SELECT * FROM invoices WHERE student_term_id=?", id),
    );
  if (role !== "accountant") {
    st.counters = counters(db, id);
    st.sessions = all(
      db,
      "SELECT a.*,s.starts_at,s.timezone,s.duration_minutes,s.replacement_for FROM attendance a JOIN sessions s ON s.id=a.session_id WHERE a.student_term_id=? ORDER BY s.starts_at,s.id",
      id,
    );
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
    ])
      delete st[key];
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
    "SELECT e.*,s.name subject FROM enrollments e JOIN subjects s ON s.id=e.subject_id WHERE student_id=?",
    id,
  );
  student.terms = all(
    db,
    "SELECT st.id FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id WHERE e.student_id=? ORDER BY st.id DESC",
    id,
  ).map((v) => termView(db, v.id, role));
  if (role === "accountant") {
    for (const key of [
      "history",
      "missing_contact_reason",
      "timezone",
      "first_registered",
      "created_at",
    ])
      delete student[key];
  }
  if (role !== "secretary") {
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
  const subjectId = integer(b.subjectId, "واحد آموزشی");
  assert(
    one(db, "SELECT 1 FROM subjects WHERE id=? AND active=1", subjectId),
    "واحد آموزشی غیرفعال است",
  );
  let enrollment = one(
    db,
    "SELECT * FROM enrollments WHERE student_id=? AND subject_id=?",
    studentId,
    subjectId,
  );
  if (!enrollment) {
    const id = run(
      db,
      "INSERT INTO enrollments(student_id,subject_id) VALUES(?,?)",
      studentId,
      subjectId,
    ).lastInsertRowid;
    enrollment = { id };
  }
  const currency = choice(b.currency, ["TOMAN", "USD"], "ارز"),
    base = money(b.amount, currency),
    discount = money(b.discount || "0", currency),
    reason = text(b.reason, "دلیل", 1000);
  assert(discount <= base, "تخفیف بیش از مبلغ است");
  if (discount) {
    requireRole({ user }, ["admin"]);
    assert(reason, "دلیل تخفیف لازم است");
  }
  if (base === discount) assert(reason, "ترم رایگان نیازمند دلیل است");
  const quota = integer(b.quota ?? 4, "سهم جلسات", 1, 1000),
    mode = choice(b.mode || "onsite", ["onsite", "online"], "شیوه برگزاری"),
    location = text(b.location, "محل", 200, mode === "onsite"),
    format = choice(
      b.courseFormat || "normal",
      ["normal", "masterclass"],
      "قالب دوره",
    );
  const registered = date(b.registeredOn, true),
    start = date(b.startDate),
    end = date(b.endDate);
  assert(!start || !end || end >= start, "پایان پیش از شروع است");
  const duration = b.durationMinutes
    ? integer(b.durationMinutes, "مدت", 1, 1440)
    : null;
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
  const offering = run(
    db,
    "INSERT INTO class_offerings(subject_id,mode,location,course_format) VALUES(?,?,?,?)",
    subjectId,
    mode,
    location,
    format,
  ).lastInsertRowid;
  const term = run(
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
  run(
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
  });
  return id;
}
export function installEducation(app, db) {
  app.get("/api/subjects", (req, res) =>
    res.json(all(db, "SELECT * FROM subjects WHERE active=1 ORDER BY id")),
  );
  app.get("/api/students", (req, res) => res.json(studentGrid(db, req.query)));
  app.post("/api/students", studentUpload, async (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const b = req.body;
    const photo = await studentPhoto(req);
    const id = transaction(db, () => {
      const first = text(b.firstName, "نام فارسی", 100, true),
        last = text(b.lastName, "نام خانوادگی فارسی", 100, true),
        phone = text(b.phone, "شماره تماس", 30),
        gName = text(b.guardianName, "نام سرپرست", 150),
        gPhone = text(b.guardianPhone, "تماس سرپرست", 30),
        reason = text(b.missingContactReason, "دلیل نبود تماس", 1000);
      for (const p of [phone, gPhone])
        if (p) assert(/^\+?[0-9 ()-]{6,30}$/.test(p), "شماره تماس نامعتبر است");
      assert(!gPhone || gName, "نام سرپرست لازم است");
      if (!phone && !gPhone) {
        requireRole(req, ["admin"]);
        assert(reason, "دلیل نبود تماس لازم است");
      }
      const subject = integer(b.subjectId, "واحد موردنظر");
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
          "INSERT INTO students(first_name,last_name,english_first,english_last,phone,timezone,history,missing_contact_reason,search_text) VALUES(?,?,?,?,?,?,?,?,?)",
          first,
          last,
          ef,
          el,
          phone,
          tz,
          choice(b.history || "unknown", ["new", "old", "unknown"], "سابقه"),
          reason,
          search,
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
      run(
        db,
        "INSERT INTO enrollments(student_id,subject_id) VALUES(?,?)",
        id,
        subject,
      );
      saveStudentPhoto(db, id, photo);
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
    const id = transaction(db, () =>
      createTerm(db, req.user, integer(req.params.id, "شناسه"), req.body),
    );
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
    const id = transaction(db, () =>
      createTerm(db, req.user, old.student_id, req.body, old.id),
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
      run(
        db,
        "INSERT INTO attendance(session_id,student_term_id) VALUES(?,?)",
        sid,
        id,
      );
      audit(db, req.user, "session-reserved", sid, {
        studentTerm: id,
        replacement,
      });
    });
    res.status(201).json(termView(db, id, req.user.role));
  });
  app.patch("/api/sessions/:id", (req, res) => {
    requireRole(req, ["admin", "secretary"]);
    const sid = integer(req.params.id, "جلسه"),
      b = req.body;
    const stid = transaction(db, () => {
      const a = one(db, "SELECT * FROM attendance WHERE session_id=?", sid);
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
      run(
        db,
        "UPDATE sessions SET starts_at=?,timezone=?,duration_minutes=? WHERE id=?",
        new Date(b.startsAt).toISOString(),
        timezone(b.timezone || "Asia/Tehran"),
        b.durationMinutes ? integer(b.durationMinutes, "مدت", 1, 1440) : null,
        sid,
      );
      run(db, "UPDATE attendance SET version=version+1 WHERE id=?", a.id);
      audit(db, req.user, "reservation-edited", sid, {
        before: old.starts_at,
        after: b.startsAt,
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
      if (status === "absent") {
        assert(
          typeof b.counts === "boolean" && reason,
          "برای غیبت انتخاب صریح مصرف و دلیل لازم است",
        );
        counts = b.counts ? 1 : 0;
      }
      if (status === "cancelled") {
        assert(reason, "دلیل کنسلی لازم است");
        cancelledBy = choice(
          b.cancelledBy,
          ["teacher", "student", "academy", "other"],
          "لغوکننده",
        );
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
        "UPDATE attendance SET status=?,counts=?,reason=?,cancelled_by=?,version=version+1 WHERE id=?",
        status,
        counts,
        reason,
        cancelledBy,
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
        after: { status, counts, reason, cancelledBy },
      });
      return a.student_term_id;
    });
    res.json(termView(db, stid, req.user.role));
  });
}
