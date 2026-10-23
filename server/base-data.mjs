import { all, one, run, transaction, audit } from "./db.mjs";
import { requireMenu } from "./permissions.mjs";
import { requireRole } from './auth.mjs';
import {
  assert,
  text,
  integer,
  choice,
  normalize,
  latinDigits,
  money,
} from "./validation.mjs";
import { parseGridJson, gridCondition } from "./student-grid.mjs";

// Tables and field expressions are server-owned; request keys never become SQL.
const resources = {
  "payment-methods": {
    table: "payment_methods",
    title: "شیوه پرداخت",
    payment: true,
  },
  "teaching-types": {
    table: "teaching_types",
    title: "شیوه برگزاری",
    delivery: true,
  },
  instructors: {
    table: "instructors",
    title: "مدرس",
    phone: true,
    instructor: true,
  },
  instruments: {
    table: "instruments",
    title: "ساز",
    english: true,
    pricing: true,
  },
  "session-statuses": {
    table: "session_statuses",
    title: "وضعیت جلسه",
    fixed: true,
  },
};
function config(req) {
  requireMenu(req, "/base-data/" + req.params.resource);
  assert(
    Object.hasOwn(resources, req.params.resource),
    "بخش اطلاعات پایه یافت نشد",
    404,
  );
  return resources[req.params.resource];
}
const baseColumns = (c) =>
  `id,name,notes,status,version,created_at${c.phone ? ",phone" : ""}${c.english ? ",english_name" : ""}${c.fixed ? ",code" : ""}${c.instructor ? ",first_name,last_name,(SELECT json_group_array(instrument_id) FROM instructor_instruments ii WHERE ii.instructor_id=instructors.id) instrument_ids,(SELECT group_concat(i.name, ', ') FROM instructor_instruments ii JOIN instruments i ON i.id=ii.instrument_id WHERE ii.instructor_id=instructors.id) instrument_names,(SELECT revision FROM instructor_photos p WHERE p.instructor_id=instructors.id) photo_revision" : ""}`;
const columns = (c) =>
  baseColumns(c) +
  (c.payment ? ",settlement_type,payment_currency,installment_count" : "") +
  (c.delivery ? ",requires_academy" : "") +
  (c.pricing ? ",rate_toman_30,rate_usd_cents_30" : "");
function shapeRecord(row, c) {
  if (!c.instructor) return row;
  return {
    ...row,
    instrument_ids: JSON.parse(row.instrument_ids || "[]"),
    photo_url: row.photo_revision
      ? `/api/instructors/${row.id}/photo?v=${row.photo_revision}`
      : null,
  };
}
function record(db, c, id) {
  const row = one(db, `SELECT ${columns(c)} FROM ${c.table} WHERE id=?`, id);
  assert(row, `${c.title} یافت نشد`, 404);
  return shapeRecord(row, c);
}
function validate(c, body) {
  assert(
    body && typeof body === "object" && !Array.isArray(body),
    "اطلاعات فرم نامعتبر است",
  );
  if (c.delivery && body.requiresAcademy !== undefined)
    assert(
      typeof body.requiresAcademy === "boolean",
      "نیاز به آموزشگاه را مشخص کنید",
    );
  const firstName = c.instructor
      ? text(body.firstName ?? body.name, "نام", 100, true)
      : undefined,
    lastName = c.instructor
      ? text(body.lastName, "نام خانوادگی", 100)
      : undefined,
    name = text(
      c.instructor && body.firstName !== undefined
        ? `${firstName} ${lastName}`.trim()
        : body.name,
      "عنوان",
      150,
      true,
    ),
    notes = text(body.notes, "توضیحات", 2000),
    status = choice(body.status ?? "active", ["active", "inactive"], "وضعیت");
  const phone = c.phone ? latinDigits(text(body.phone, "شماره تماس", 30)) : "";
  if (c.fixed) assert(status === "active", "چهار وضعیت جلسه باید فعال بمانند");
  if (phone)
    assert(/^\+?[0-9 ()-]{6,30}$/.test(phone), "شماره تماس نامعتبر است");
  let instrumentIds;
  if (c.instructor && body.instrumentIds !== undefined) {
    assert(
      Array.isArray(body.instrumentIds) && body.instrumentIds.length <= 20,
      "فهرست سازهای تخصصی نامعتبر است",
    );
    instrumentIds = body.instrumentIds.map((id) =>
      integer(id, "ساز", 1, 1000000),
    );
    assert(
      new Set(instrumentIds).size === instrumentIds.length,
      "ساز تکراری است",
    );
  }
  let settlementType, paymentCurrency, installmentCount;
  let rateToman30, rateUsd30;
  if (c.pricing) {
    rateToman30 =
      body.rateToman30 === "" || body.rateToman30 == null
        ? null
        : integer(body.rateToman30, "تعرفه تومان", 0, 1000000000000);
    rateUsd30 =
      body.rateUsd30 === "" || body.rateUsd30 == null
        ? null
        : money(body.rateUsd30, "USD");
  }
  if (c.payment) {
    settlementType = choice(
      body.settlementType,
      ["single", "installment", "free"],
      "شیوه تسویه",
    );
    if (settlementType === "free") {
      assert(notes.trim().length > 0, "توضیح بدون شهریه الزامی است");
      paymentCurrency = null;
    } else {
      paymentCurrency = choice(
        body.paymentCurrency,
        ["rial", "foreign"],
        "نوع پرداخت",
      );
    }
    installmentCount =
      settlementType === "installment"
        ? integer(
            String(body.installmentCount ?? "")
              .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
              .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))),
            "تعداد اقساط",
            2,
          )
        : null;
  }
  return {
    settlementType,
    paymentCurrency,
    installmentCount,
    name,
    key: normalize(name).replace(/\s+/g, " "),
    requiresAcademy: body.requiresAcademy,
    notes,
    status,
    phone,
    firstName,
    lastName,
    instrumentIds,
    englishName:
      c.english && body.englishName !== undefined
        ? text(body.englishName, "نام انگلیسی ساز", 150)
        : undefined,
    rateToman30,
    rateUsd30,
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
      ...(c.instructor
        ? {
            instrument_names:
              "COALESCE((SELECT group_concat(i.name, ', ') FROM instructor_instruments ii JOIN instruments i ON i.id=ii.instrument_id WHERE ii.instructor_id=instructors.id),'')",
          }
        : {}),
      ...(c.english ? { english_name: "english_name" } : {}),
      ...(c.pricing
        ? {
            rate_toman_30: "rate_toman_30",
            rate_usd_cents_30: "rate_usd_cents_30",
          }
        : {}),
      ...(c.fixed ? { code: "code" } : {}),
      ...(c.delivery
        ? {
            requires_academy:
              "CASE requires_academy WHEN 1 THEN 'نیاز به آموزشگاه' WHEN 0 THEN 'بدون آموزشگاه' ELSE 'تعیین نشده' END",
          }
        : {}),
      ...(c.payment
        ? {
            settlement_type:
              "CASE settlement_type WHEN 'single' THEN 'یکجا' WHEN 'installment' THEN 'اقساطی' ELSE 'بدون شهریه' END",
            payment_currency:
              "CASE payment_currency WHEN 'rial' THEN 'ریالی' WHEN 'foreign' THEN 'ارزی' ELSE '' END",
            installment_count: "installment_count",
          }
        : {}),
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
      ).map((row) => shapeRecord(row, c)),
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
    if(c.pricing && (v.rateToman30!==null || v.rateUsd30!==null))requireRole(req,['admin']);
    const id = transaction(db, () => {
      if (c.instructor && v.instrumentIds)
        for (const instrumentId of v.instrumentIds)
          assert(
            one(
              db,
              "SELECT 1 FROM instruments WHERE id=? AND status='active'",
              instrumentId,
            ),
            "فقط سازهای فعال قابل انتخاب هستند",
          );
      const fields = ["name", "name_key", "notes", "status"],
        args = [v.name, v.key, v.notes, v.status];
      if (c.delivery) {
        fields.push("requires_academy");
        args.push(v.requiresAcademy === false ? 0 : 1);
      }
      if (c.payment) {
        fields.push("settlement_type", "payment_currency", "installment_count");
        args.push(v.settlementType, v.paymentCurrency, v.installmentCount);
      }
      if (c.instructor) {
        fields.push("first_name", "last_name");
        args.push(v.firstName, v.lastName);
      }
      if (c.phone) {
        fields.push("phone");
        args.push(v.phone);
      }
      if (c.english) {
        fields.push("english_name");
        args.push(v.englishName ?? "");
      }
      if (c.pricing) {
        fields.push("rate_toman_30", "rate_usd_cents_30");
        args.push(v.rateToman30, v.rateUsd30);
      }
      const id = Number(
        run(
          db,
          `INSERT INTO ${c.table}(${fields.join(",")}) VALUES(${fields.map(() => "?").join(",")})`,
          ...args,
        ).lastInsertRowid,
      );
      if (c.instructor && v.instrumentIds)
        for (const instrumentId of v.instrumentIds)
          run(
            db,
            "INSERT INTO instructor_instruments(instructor_id,instrument_id) VALUES(?,?)",
            id,
            instrumentId,
          );
      audit(db, req.user, `${req.params.resource}-created`, id, {
        status: v.status,
        ...(c.pricing?{rateToman30:v.rateToman30,rateUsd30:v.rateUsd30}:{}),
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
      if (c.delivery && v.requiresAcademy !== undefined) {
        updates.push("requires_academy=?");
        args.push(v.requiresAcademy ? 1 : 0);
      }
      if (c.payment) {
        updates.push(
          "settlement_type=?",
          "payment_currency=?",
          "installment_count=?",
        );
        args.push(v.settlementType, v.paymentCurrency, v.installmentCount);
      }
      if (c.instructor) {
        updates.push("first_name=?", "last_name=?");
        args.push(
          req.body.firstName === undefined ? old.first_name : v.firstName,
          req.body.lastName === undefined ? old.last_name : v.lastName,
        );
        if (v.instrumentIds) {
          for (const instrumentId of v.instrumentIds)
            assert(
              one(
                db,
                "SELECT 1 FROM instruments WHERE id=? AND (status='active' OR EXISTS (SELECT 1 FROM instructor_instruments WHERE instructor_id=? AND instrument_id=?))",
                instrumentId,
                id,
                instrumentId,
              ),
              "فقط سازهای فعال قابل انتخاب هستند",
            );
          run(
            db,
            "DELETE FROM instructor_instruments WHERE instructor_id=?",
            id,
          );
          for (const instrumentId of v.instrumentIds)
            run(
              db,
              "INSERT INTO instructor_instruments(instructor_id,instrument_id) VALUES(?,?)",
              id,
              instrumentId,
            );
        }
      }
      if (c.phone) {
        updates.push("phone=?");
        args.push(v.phone);
      }
      if (c.english && v.englishName !== undefined) {
        updates.push("english_name=?");
        args.push(v.englishName);
      }
      if (c.pricing) {
        const toman=req.body.rateToman30===undefined?old.rate_toman_30:v.rateToman30;
        const usd=req.body.rateUsd30===undefined?old.rate_usd_cents_30:v.rateUsd30;
        if(toman!==old.rate_toman_30 || usd!==old.rate_usd_cents_30)requireRole(req,['admin']);
        updates.push("rate_toman_30=?", "rate_usd_cents_30=?");
        args.push(toman,usd);
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
        ...(c.pricing?{before:{toman:old.rate_toman_30,usd:old.rate_usd_cents_30},after:{toman:req.body.rateToman30===undefined?old.rate_toman_30:v.rateToman30,usd:req.body.rateUsd30===undefined?old.rate_usd_cents_30:v.rateUsd30}}:{}),
      });
    });
    res.json(record(db, c, id));
  });
}
