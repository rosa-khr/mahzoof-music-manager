import { all, one, run, transaction, audit } from "./db.mjs";
import { requireRole } from "./auth.mjs";
import { assert, text, integer, choice, normalize } from "./validation.mjs";
import { parseGridJson, gridCondition } from "./student-grid.mjs";

// Tables and field expressions are server-owned; request keys never become SQL.
const resources = {
  "teaching-types": { table: "teaching_types", title: "نوع تدریس" },
  instructors: { table: "instructors", title: "مدرس", phone: true },
  instruments: { table: "instruments", title: "ساز", english: true },
  "session-statuses": {
    table: "session_statuses",
    title: "وضعیت جلسه",
    fixed: true,
  },
};
function config(req) {
  requireRole(req, ["admin", "secretary"]);
  assert(
    Object.hasOwn(resources, req.params.resource),
    "بخش اطلاعات پایه یافت نشد",
    404,
  );
  return resources[req.params.resource];
}
const columns = (c) =>
  `id,name,notes,status,version,created_at${c.phone ? ",phone" : ""}${c.english ? ",english_name" : ""}${c.fixed ? ",code" : ""}`;
function record(db, c, id) {
  const row = one(db, `SELECT ${columns(c)} FROM ${c.table} WHERE id=?`, id);
  assert(row, `${c.title} یافت نشد`, 404);
  return row;
}
function validate(c, body) {
  assert(
    body && typeof body === "object" && !Array.isArray(body),
    "اطلاعات فرم نامعتبر است",
  );
  const name = text(body.name, "عنوان", 150, true),
    notes = text(body.notes, "توضیحات", 2000),
    status = choice(body.status ?? "active", ["active", "inactive"], "وضعیت");
  const phone = c.phone ? text(body.phone, "شماره تماس", 30) : "";
  if (c.fixed) assert(status === "active", "چهار وضعیت جلسه باید فعال بمانند");
  if (phone)
    assert(/^\+?[0-9 ()-]{6,30}$/.test(phone), "شماره تماس نامعتبر است");
  return {
    name,
    key: normalize(name).replace(/\s+/g, " "),
    notes,
    status,
    phone,
    englishName:
      c.english && body.englishName !== undefined
        ? text(body.englishName, "نام انگلیسی ساز", 150)
        : undefined,
  };
}
export function installBaseData(app, db) {
  app.get("/api/base-data/:resource", (req, res) => {
    const c = config(req),
      q = req.query;
    const fields = {
      name: "name",
      notes: "notes",
      status: "CASE status WHEN 'active' THEN 'فعال' ELSE 'غیرفعال' END",
      ...(c.phone ? { phone: "phone" } : {}),
      ...(c.english ? { english_name: "english_name" } : {}),
      ...(c.fixed ? { code: "code" } : {}),
    };
    const offset = integer(q.startRow ?? 0, "شروع ردیف", 0, 10000000);
    const limit = integer(
      Number(q.endRow ?? offset + 100) - offset,
      "تعداد ردیف",
      1,
      100,
    );
    const filters = parseGridJson(q.filterModel, {}),
      sort = parseGridJson(q.sortModel, []),
      args = [],
      clauses = [];
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
      return (
        fields[item.colId] +
        " " +
        choice(item.sort, ["asc", "desc"], "جهت مرتب‌سازی").toUpperCase()
      );
    });
    order.push("id DESC");
    const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
    res.json({
      items: all(
        db,
        `SELECT ${columns(c)} FROM ${c.table}${where} ORDER BY ${order.join(",")} LIMIT ? OFFSET ?`,
        ...args,
        limit,
        offset,
      ),
      total: one(db, `SELECT COUNT(*) n FROM ${c.table}${where}`, ...args).n,
      startRow: offset,
    });
  });
  app.get("/api/base-data/:resource/:id", (req, res) => {
    const c = config(req);
    res.json(record(db, c, integer(req.params.id, "شناسه")));
  });
  app.post("/api/base-data/:resource", (req, res) => {
    const c = config(req);
    assert(
      !c.fixed,
      "وضعیت‌های جلسه چهار مورد ثابت‌اند؛ عنوان و توضیحات آن‌ها قابل ویرایش است",
      405,
    );
    const v = validate(c, req.body);
    const id = transaction(db, () => {
      const fields = ["name", "name_key", "notes", "status"],
        args = [v.name, v.key, v.notes, v.status];
      if (c.phone) {
        fields.push("phone");
        args.push(v.phone);
      }
      if (c.english) {
        fields.push("english_name");
        args.push(v.englishName ?? "");
      }
      const id = Number(
        run(
          db,
          `INSERT INTO ${c.table}(${fields.join(",")}) VALUES(${fields.map(() => "?").join(",")})`,
          ...args,
        ).lastInsertRowid,
      );
      audit(db, req.user, `${req.params.resource}-created`, id, {
        status: v.status,
      });
      return id;
    });
    res.status(201).json(record(db, c, id));
  });
  app.patch("/api/base-data/:resource/:id", (req, res) => {
    const c = config(req),
      id = integer(req.params.id, "شناسه"),
      v = validate(c, req.body),
      version = integer(req.body.version, "نسخه");
    transaction(db, () => {
      const old = record(db, c, id);
      if (c.fixed)
        assert(
          req.body.code === undefined || req.body.code === old.code,
          "کد وضعیت جلسه قابل تغییر نیست",
        );
      assert(
        old.version === version,
        "این اطلاعات تغییر کرده است؛ صفحه را دوباره باز کنید",
        409,
      );
      const updates = ["name=?", "name_key=?", "notes=?", "status=?"],
        args = [v.name, v.key, v.notes, v.status];
      if (c.phone) {
        updates.push("phone=?");
        args.push(v.phone);
      }
      if (c.english && v.englishName !== undefined) {
        updates.push("english_name=?");
        args.push(v.englishName);
      }
      run(
        db,
        `UPDATE ${c.table} SET ${updates.join(",")},version=version+1 WHERE id=?`,
        ...args,
        id,
      );
      audit(db, req.user, `${req.params.resource}-updated`, id, {
        status: v.status,
        version: version + 1,
      });
    });
    res.json(record(db, c, id));
  });
}
