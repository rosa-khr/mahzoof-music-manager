import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { all, one, run, transaction, audit } from "./db.mjs";
import { requireRole } from "./auth.mjs";
import {
  ApiError,
  assert,
  text,
  integer,
  choice,
  timezone,
  normalize,
  latinDigits,
  date,
} from "./validation.mjs";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 1,
    fieldSize: 16384,
    parts: 2,
  },
}).single("photo");
export function studentUpload(req, res, next) {
  requireRole(req, ["admin", "secretary"]);
  if (!req.is("multipart/form-data")) return next();
  upload(req, res, (err) => {
    if (err)
      return next(
        new ApiError(
          422,
          err.code === "LIMIT_FILE_SIZE"
            ? "حجم عکس باید حداکثر ۵ مگابایت باشد"
            : "فایل یا اطلاعات آپلود نامعتبر است",
        ),
      );
    try {
      assert(typeof req.body.data === "string", "اطلاعات فرم ارسال نشده است");
      req.body = JSON.parse(req.body.data);
      assert(
        req.body && typeof req.body === "object" && !Array.isArray(req.body),
        "اطلاعات فرم نامعتبر است",
      );
      next();
    } catch (e) {
      next(
        e instanceof ApiError
          ? e
          : new ApiError(422, "اطلاعات فرم نامعتبر است"),
      );
    }
  });
}
export async function studentPhoto(req) {
  assert(
    req.body && typeof req.body === "object" && !Array.isArray(req.body),
    "اطلاعات فرم نامعتبر است",
  );
  assert(
    req.body.removePhoto === undefined ||
      typeof req.body.removePhoto === "boolean",
    "درخواست حذف عکس نامعتبر است",
  );
  assert(
    !(req.file && req.body.removePhoto),
    "عکس جدید و حذف عکس هم‌زمان مجاز نیست",
  );
  if (!req.file) return req.body.removePhoto ? null : undefined;
  assert(
    ["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype),
    "عکس باید JPG، PNG یا WebP باشد",
  );
  try {
    const image = sharp(req.file.buffer, {
      limitInputPixels: 16_000_000,
      failOn: "warning",
    });
    const meta = await image.metadata();
    assert(
      ["jpeg", "png", "webp"].includes(meta.format) && !(meta.pages > 1),
      "فقط عکس ثابت JPG، PNG یا WebP مجاز است",
    );
    return await image
      .rotate()
      .resize({
        width: 800,
        height: 800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      422,
      "عکس قابل خواندن نیست یا ابعاد آن بیش از ۱۶ مگاپیکسل است",
    );
  }
}
export function saveStudentPhoto(db, id, photo) {
  if (photo === undefined) return;
  if (photo === null) {
    run(db, "DELETE FROM student_photos WHERE student_id=?", id);
    return;
  }
  run(
    db,
    "INSERT INTO student_photos(student_id,data,revision) VALUES(?,?,?) ON CONFLICT(student_id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')",
    id,
    photo,
    randomUUID(),
  );
}
export function photoUrl(db, id) {
  const photo = one(
    db,
    "SELECT revision FROM student_photos WHERE student_id=?",
    id,
  );
  return photo ? `/api/students/${id}/photo?v=${photo.revision}` : null;
}
export function studentPersonal(body, old = {}) {
  const address =
    body.address === undefined
      ? old.address || ""
      : text(body.address, "آدرس", 2000);
  const value =
    body.age === undefined
      ? old.age
      : typeof body.age === "string"
        ? latinDigits(body.age)
        : body.age;
  let age = null;
  if (value !== undefined && value !== null && value !== "") {
    assert(
      typeof value === "number" ||
        (typeof value === "string" && /^\d+$/.test(value)),
      "سن نامعتبر است",
    );
    age = integer(value, "سن", 0, 130);
  }
  return {
    address,
    age,
    contactOwner: choice(
      body.contactOwner ?? old.contact_owner ?? "student",
      ["student", "parent", "other"],
      "صاحب شماره تماس",
    ),
    birthDate:
      body.birthDate === undefined
        ? old.birth_date || null
        : date(body.birthDate),
    gender: choice(
      body.gender ?? old.gender ?? "",
      ["", "female", "male", "other"],
      "جنسیت",
    ),
    nationalId: text(
      body.nationalId ?? old.national_id,
      "کد ملی یا شناسه خارجی",
      80,
    ),
    landline: latinDigits(text(body.landline ?? old.landline, "تلفن ثابت", 30)),
    country: text(body.country ?? old.country, "کشور", 100),
    city: text(body.city ?? old.city, "شهر", 100),
    educationLevel: text(
      body.educationLevel ?? old.education_level,
      "تحصیلات",
      300,
    ),
    artisticHistory: text(
      body.artisticHistory ?? old.artistic_history,
      "پیشینه هنری",
      2000,
    ),
    referralSource: text(
      body.referralSource ?? old.referral_source,
      "معرف",
      500,
    ),
    registrationGoal: text(
      body.registrationGoal ?? old.registration_goal,
      "هدف ثبت‌نام",
      1000,
    ),
    interviewNotes: text(
      body.interviewNotes ?? old.interview_notes,
      "مصاحبه",
      2000,
    ),
    internalNotes: text(
      body.internalNotes ?? old.internal_notes,
      "یادداشت داخلی",
      2000,
    ),
    audienceGroup: choice(
      body.audienceGroup ?? old.audience_group ?? "",
      ["", "child", "teen", "adult"],
      "گروه آموزشی",
    ),
  };
}
export function installStudentEditor(app, db, view) {
  app.get("/api/students/:id/photo", (req, res) => {
    const id = integer(req.params.id, "هنرجو");
    const photo = one(
      db,
      "SELECT data FROM student_photos WHERE student_id=?",
      id,
    );
    assert(photo, "عکسی برای هنرجو ثبت نشده است", 404);
    res
      .set({
        "Cache-Control": "private, no-store",
        Pragma: "no-cache",
        "Content-Type": "image/webp",
        "Content-Disposition": `inline; filename="student-${id}.webp"`,
        Vary: "Cookie",
      })
      .send(Buffer.from(photo.data));
  });
  app.patch("/api/students/:id", studentUpload, async (req, res) => {
    const id = integer(req.params.id, "هنرجو");
    const photo = await studentPhoto(req);
    transaction(db, () => {
      const old = one(db, "SELECT * FROM students WHERE id=?", id);
      assert(old, "هنرجو یافت نشد", 404);
      assert(
        integer(req.body.version, "نسخه") === old.version,
        "اطلاعات هنرجو تغییر کرده است؛ صفحه را دوباره باز کنید",
        409,
      );
      const b = req.body;
      const personal = studentPersonal(b, old);
      const first = text(b.firstName, "نام فارسی", 100, true),
        last = text(b.lastName, "نام خانوادگی فارسی", 100, true),
        ef = text(b.englishFirst, "نام انگلیسی", 100),
        el = text(b.englishLast, "نام خانوادگی انگلیسی", 100),
        phone = latinDigits(text(b.phone, "شماره تماس", 30)),
        gName = text(b.guardianName, "نام سرپرست", 150),
        gPhone = latinDigits(text(b.guardianPhone, "تماس سرپرست", 30)),
        reason = text(b.missingContactReason, "دلیل نبود تماس", 1000);
      for (const p of [phone, gPhone])
        if (p) assert(/^\+?[0-9 ()-]{6,30}$/.test(p), "شماره تماس نامعتبر است");
      assert(!gPhone || gName, "نام سرپرست لازم است");
      const guardians = all(
        db,
        "SELECT g.*,sg.relationship FROM guardians g JOIN student_guardians sg ON sg.guardian_id=g.id WHERE sg.student_id=? ORDER BY g.id",
        id,
      );
      const target =
        b.guardianId == null
          ? guardians[0]?.id
          : integer(b.guardianId, "سرپرست");
      if (target)
        assert(
          guardians.some((g) => g.id === target),
          "سرپرست متعلق به این پرونده نیست",
          422,
        );
      const otherGuardians = guardians.filter((g) => g.id !== target);
      if (!phone && !gPhone && !otherGuardians.some((g) => !!g.phone)) {
        const previouslyHadContact =
          !!old.phone || guardians.some((guardian) => !!guardian.phone);
        assert(
          !previouslyHadContact,
          "راه تماس هنرجو یا والد را وارد کنید",
        );
      }
      if (target)
        run(
          db,
          "DELETE FROM student_guardians WHERE student_id=? AND guardian_id=?",
          id,
          target,
        );
      if (gName) {
        let guardian = gPhone
          ? one(
              db,
              "SELECT id FROM guardians WHERE name=? AND phone=?",
              gName,
              gPhone,
            )
          : null;
        if (!guardian)
          guardian = {
            id: run(
              db,
              "INSERT INTO guardians(name,phone) VALUES(?,?)",
              gName,
              gPhone,
            ).lastInsertRowid,
          };
        run(
          db,
          "INSERT INTO student_guardians(student_id,guardian_id,relationship) VALUES(?,?,?) ON CONFLICT(student_id,guardian_id) DO UPDATE SET relationship=excluded.relationship",
          id,
          guardian.id,
          text(b.guardianRelationship || "سرپرست", "نسبت", 80),
        );
      }
      const contacts = all(
        db,
        "SELECT g.phone FROM guardians g JOIN student_guardians sg ON sg.guardian_id=g.id WHERE sg.student_id=?",
        id,
      ).map((g) => g.phone);
      const status = choice(
        b.status ?? old.status,
        ["active", "inactive", "archived"],
        "وضعیت",
      );
      if (b.instrumentId) {
        const instrumentId = integer(b.instrumentId, "ساز");
        assert(
          one(
            db,
            "SELECT 1 FROM instruments WHERE id=? AND status='active'",
            instrumentId,
          ),
          "ساز فعال را انتخاب کنید",
        );
        run(
          db,
          "INSERT OR IGNORE INTO enrollments(student_id,instrument_id) VALUES(?,?)",
          id,
          instrumentId,
        );
      }
      run(
        db,
        "UPDATE students SET first_name=?,last_name=?,english_first=?,english_last=?,phone=?,timezone=?,history=?,missing_contact_reason=?,status=?,search_text=?,address=?,age=?,contact_owner=?,birth_date=?,gender=?,national_id=?,landline=?,country=?,city=?,education_level=?,artistic_history=?,referral_source=?,registration_goal=?,interview_notes=?,internal_notes=?,audience_group=?,version=version+1 WHERE id=?",
        first,
        last,
        ef,
        el,
        phone,
        timezone(b.timezone || old.timezone),
        choice(b.history ?? old.history, ["new", "old", "unknown"], "سابقه"),
        reason,
        status,
        normalize(
          [first, last, ef, el, phone, ...contacts, old.code].join(" "),
        ),
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
        id,
      );
      saveStudentPhoto(db, id, photo);
      audit(db, req.user, "student-updated", id, {
        version: old.version + 1,
        status,
        photoChanged: photo !== undefined,
      });
    });
    res.json(view(db, id, req.user.role));
  });
  app.delete("/api/students/:id", (req, res) => {
    requireRole(req, ["admin"]);
    const id = integer(req.params.id, "هنرجو");
    const version = integer(req.query.version, "نسخه");
    transaction(db, () => {
      const student = one(db, "SELECT * FROM students WHERE id=?", id);
      assert(student, "هنرجو یافت نشد", 404);
      assert(
        student.version === version,
        "اطلاعات هنرجو تغییر کرده است؛ فهرست را دوباره بارگذاری کنید",
        409,
      );
      const hasHistory =
        one(
          db,
          "SELECT 1 FROM student_terms st JOIN enrollments e ON e.id=st.enrollment_id WHERE e.student_id=? LIMIT 1",
          id,
        ) ||
        one(db, "SELECT 1 FROM invoices WHERE student_id=? LIMIT 1", id) ||
        one(db, "SELECT 1 FROM payments WHERE student_id=? LIMIT 1", id) ||
        one(
          db,
          "SELECT 1 FROM private_documents WHERE student_id=? LIMIT 1",
          id,
        );
      assert(
        !hasHistory,
        "این هنرجو سابقه آموزشی، مالی یا سند خصوصی دارد و قابل حذف نیست؛ وضعیت پرونده را بایگانی کنید",
        409,
      );
      const guardianIds = all(
        db,
        "SELECT guardian_id FROM student_guardians WHERE student_id=?",
        id,
      ).map((row) => row.guardian_id);
      run(
        db,
        "DELETE FROM weekly_schedules WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id=?)",
        id,
      );
      run(
        db,
        "DELETE FROM enrollment_settings WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id=?)",
        id,
      );
      run(db, "DELETE FROM enrollments WHERE student_id=?", id);
      run(
        db,
        "DELETE FROM student_education_preferences WHERE student_id=?",
        id,
      );
      run(db, "DELETE FROM student_photos WHERE student_id=?", id);
      run(db, "DELETE FROM student_guardians WHERE student_id=?", id);
      run(db, "DELETE FROM students WHERE id=?", id);
      for (const guardianId of guardianIds)
        run(
          db,
          "DELETE FROM guardians WHERE id=? AND NOT EXISTS(SELECT 1 FROM student_guardians WHERE guardian_id=?)",
          guardianId,
          guardianId,
        );
      audit(db, req.user, "student-deleted", id, {
        code: student.code,
        name: `${student.first_name} ${student.last_name}`.trim(),
        version,
      });
    });
    res.json({ ok: true });
  });
}
