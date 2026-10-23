import { all, one, run, transaction, audit } from "./db.mjs";
import { assert, text, integer, choice } from "./validation.mjs";
import { parseGridJson, gridCondition } from "./student-grid.mjs";

const columns = "id,name,address,phone,website,social_media,active,version";

function record(db, id) {
  const row = one(db, `SELECT ${columns} FROM subjects WHERE id=?`, id);
  assert(row, "واحد آموزشی یافت نشد", 404);
  return { ...row, status: row.active ? "active" : "inactive" };
}

function validUrl(value, label) {
  if (!value) return;
  let url;
  try {
    url = new URL(value);
  } catch {
    assert(false, `${label} نامعتبر است`);
  }
  assert(["http:", "https:"].includes(url.protocol), `${label} نامعتبر است`);
}

function validate(body) {
  assert(
    body && typeof body === "object" && !Array.isArray(body),
    "اطلاعات فرم نامعتبر است",
  );
  const name = text(body.name, "نام واحد آموزشی", 150, true);
  const address = text(body.address, "آدرس", 500);
  const phone = text(body.phone, "شماره تلفن", 30);
  const website = text(body.website, "وب‌سایت", 300);
  const socialMedia = text(body.socialMedia, "آدرس شبکه اجتماعی", 300);
  const status = choice(
    body.status ?? "active",
    ["active", "inactive"],
    "وضعیت",
  );
  if (phone)
    assert(/^[+0-9۰-۹ ()-]{6,30}$/.test(phone), "شماره تلفن نامعتبر است");
  validUrl(website, "نشانی وب‌سایت");
  return { name, address, phone, website, socialMedia, status };
}

export function installSubjects(app, db) {
  app.get("/api/subject-catalog", (req, res) => {
    const fields = {
      name: "name",
      address: "address",
      phone: "phone",
      website: "website",
      social_media: "social_media",
      status: "CASE active WHEN 1 THEN 'فعال' ELSE 'غیرفعال' END",
    };
    const offset = integer(req.query.startRow ?? 0, "شروع ردیف", 0, 10000000);
    const limit = integer(
      Number(req.query.endRow ?? offset + 100) - offset,
      "تعداد ردیف",
      1,
      100,
    );
    const filters = parseGridJson(req.query.filterModel, {});
    const sort = parseGridJson(req.query.sortModel, []);
    const args = [];
    const clauses = [];
    assert(
      filters && typeof filters === "object" && !Array.isArray(filters),
      "فیلتر نامعتبر است",
    );
    for (const [field, model] of Object.entries(filters)) {
      assert(Object.hasOwn(fields, field), "ستون فیلتر نامعتبر است");
      clauses.push(gridCondition(fields[field], model, args));
    }
    assert(Array.isArray(sort) && sort.length <= 4, "مرتب‌سازی نامعتبر است");
    const order = sort.map((item) => {
      assert(
        item && Object.hasOwn(fields, item.colId),
        "ستون مرتب‌سازی نامعتبر است",
      );
      return `${fields[item.colId]} ${choice(item.sort, ["asc", "desc"], "جهت مرتب‌سازی").toUpperCase()}`;
    });
    order.push("id DESC");
    const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
    const rows = all(
      db,
      `SELECT ${columns} FROM subjects${where} ORDER BY ${order.join(",")} LIMIT ? OFFSET ?`,
      ...args,
      limit,
      offset,
    ).map((row) => ({ ...row, status: row.active ? "active" : "inactive" }));
    res.json({
      items: rows,
      total: one(db, `SELECT COUNT(*) n FROM subjects${where}`, ...args).n,
      startRow: offset,
    });
  });

  app.get("/api/subject-catalog/:id", (req, res) =>
    res.json(record(db, integer(req.params.id, "شناسه"))),
  );

  app.post("/api/subject-catalog", (req, res) => {
    const v = validate(req.body);
    const id = transaction(db, () => {
      assert(
        !one(db, "SELECT 1 FROM subjects WHERE lower(name)=lower(?)", v.name),
        "واحد آموزشی با این نام قبلاً ثبت شده است",
        409,
      );
      const id = Number(
        run(
          db,
          "INSERT INTO subjects(name,address,phone,website,social_media,active) VALUES(?,?,?,?,?,?)",
          v.name,
          v.address,
          v.phone,
          v.website,
          v.socialMedia,
          v.status === "active" ? 1 : 0,
        ).lastInsertRowid,
      );
      audit(db, req.user, "subject-created", id, { status: v.status });
      return id;
    });
    res.status(201).json(record(db, id));
  });

  app.patch("/api/subject-catalog/:id", (req, res) => {
    const id = integer(req.params.id, "شناسه");
    const version = integer(req.body.version, "نسخه");
    const v = validate(req.body);
    transaction(db, () => {
      const old = record(db, id);
      assert(
        old.version === version,
        "این اطلاعات تغییر کرده است؛ صفحه را دوباره باز کنید",
        409,
      );
      assert(
        !one(
          db,
          "SELECT 1 FROM subjects WHERE lower(name)=lower(?) AND id<>?",
          v.name,
          id,
        ),
        "واحد آموزشی با این نام قبلاً ثبت شده است",
        409,
      );
      run(
        db,
        "UPDATE subjects SET name=?,address=?,phone=?,website=?,social_media=?,active=?,version=version+1 WHERE id=?",
        v.name,
        v.address,
        v.phone,
        v.website,
        v.socialMedia,
        v.status === "active" ? 1 : 0,
        id,
      );
      audit(db, req.user, "subject-updated", id, {
        status: v.status,
        version: version + 1,
      });
    });
    res.json(record(db, id));
  });

  app.delete("/api/subject-catalog/:id", (req, res) => {
    const id = integer(req.params.id, "شناسه");
    const version = integer(req.query.version, "نسخه");
    transaction(db, () => {
      const old = record(db, id);
      assert(
        old.version === version,
        "این اطلاعات تغییر کرده است؛ فهرست را دوباره بارگذاری کنید",
        409,
      );
      const hasHistory =
        one(db, "SELECT 1 FROM enrollments WHERE subject_id=? LIMIT 1", id) ||
        one(
          db,
          "SELECT 1 FROM class_offerings WHERE subject_id=? OR academy_id=? LIMIT 1",
          id,
          id,
        ) ||
        one(
          db,
          "SELECT 1 FROM student_education_preferences WHERE academy_id=? LIMIT 1",
          id,
        );
      assert(
        !hasHistory,
        "این آموزشگاه سابقه آموزشی دارد و قابل حذف نیست؛ آن را غیرفعال کنید",
        409,
      );
      run(db, "DELETE FROM subjects WHERE id=?", id);
      audit(db, req.user, "subject-deleted", id, { name: old.name, version });
    });
    res.json({ ok: true });
  });
}
