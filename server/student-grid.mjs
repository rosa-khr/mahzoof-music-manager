import { all, one } from "./db.mjs";
import { assert, integer, text, choice, normalize } from "./validation.mjs";

const fields = {
  code: "code",
  name: "first_name || ' ' || last_name",
  search: "first_name || ' ' || last_name",
  phone: "phone",
  status:
    "CASE status WHEN 'active' THEN 'فعال' WHEN 'inactive' THEN 'غیرفعال' ELSE 'بایگانی' END",
};
function json(value, fallback) {
  if (value == null) return fallback;
  assert(
    typeof value === "string" && value.length <= 8000,
    "فیلتر یا مرتب‌سازی نامعتبر است",
  );
  try {
    return JSON.parse(value);
  } catch {
    assert(false, "فیلتر یا مرتب‌سازی نامعتبر است");
  }
}
const normalized = (sql) => `replace(replace(lower(${sql}),'ي','ی'),'ك','ک')`;
export { json as parseGridJson, condition as gridCondition };
function condition(sql, model, args) {
  assert(
    model && typeof model === "object" && !Array.isArray(model),
    "فیلتر نامعتبر است",
  );
  if (model.operator) {
    choice(model.operator, ["AND", "OR"], "ترکیب فیلتر");
    const conditions = model.conditions || [model.condition1, model.condition2];
    assert(
      Array.isArray(conditions) &&
        conditions.length >= 1 &&
        conditions.length <= 2,
      "شرط فیلتر نامعتبر است",
    );
    assert(
      conditions.every((c) => c && !c.operator),
      "شرط تو در تو مجاز نیست",
    );
    return (
      "(" +
      conditions
        .map((c) => condition(sql, c, args))
        .join(" " + model.operator + " ") +
      ")"
    );
  }
  choice(model.filterType, ["text"], "نوع فیلتر");
  choice(
    model.type,
    [
      "contains",
      "notContains",
      "equals",
      "notEqual",
      "startsWith",
      "endsWith",
      "blank",
      "notBlank",
    ],
    "عملگر فیلتر",
  );
  if (model.type === "blank") return `(${sql} IS NULL OR ${sql}='')`;
  if (model.type === "notBlank") return `(${sql} IS NOT NULL AND ${sql}!='')`;
  const value = normalize(text(model.filter, "مقدار فیلتر", 100)).replace(
    /[\\%_]/g,
    "\\$&",
  );
  const patterns = {
    contains: `%${value}%`,
    notContains: `%${value}%`,
    equals: value,
    notEqual: value,
    startsWith: `${value}%`,
    endsWith: `%${value}`,
  };
  args.push(patterns[model.type]);
  return `${normalized(sql)} ${["notContains", "notEqual"].includes(model.type) ? "NOT LIKE" : "LIKE"} ? ESCAPE '\\'`;
}
export function studentGrid(db, query) {
  const page = integer(query.page || 1, "صفحه", 1, 100000);
  const block = query.startRow !== undefined;
  const offset = block
    ? integer(query.startRow, "شروع ردیف", 0, 10000000)
    : (page - 1) * 20;
  const limit = block
    ? integer(Number(query.endRow) - offset, "تعداد ردیف", 1, 100)
    : 20;
  const q = "%" + normalize(text(query.q, "جستجو", 100)) + "%";
  const status = text(query.status, "وضعیت", 20);
  if (status) choice(status, ["active", "inactive", "archived"], "وضعیت");
  const clauses = ["search_text LIKE ?", "(?='' OR status=?)"];
  const args = [q, status, status];
  const filters = json(query.filterModel, {});
  assert(
    filters && typeof filters === "object" && !Array.isArray(filters),
    "فیلتر نامعتبر است",
  );
  for (const [key, model] of Object.entries(filters)) {
    assert(Object.hasOwn(fields, key), "ستون فیلتر نامعتبر است");
    clauses.push(
      condition(key === "search" ? "search_text" : fields[key], model, args),
    );
  }
  const sort = json(query.sortModel, []);
  assert(Array.isArray(sort) && sort.length <= 4, "مرتب‌سازی نامعتبر است");
  const order = sort.map((item) => {
    assert(
      item && Object.hasOwn(fields, item.colId),
      "ستون مرتب‌سازی نامعتبر است",
    );
    choice(item.sort, ["asc", "desc"], "جهت مرتب‌سازی");
    return `${fields[item.colId]} ${item.sort.toUpperCase()}`;
  });
  order.push("id DESC");
  const where = "WHERE " + clauses.join(" AND ");
  return {
    items: all(
      db,
      `SELECT id,code,first_name,last_name,phone,status,(SELECT revision FROM student_photos WHERE student_id=students.id) photo_revision FROM students ${where} ORDER BY ${order.join(",")} LIMIT ? OFFSET ?`,
      ...args,
      limit,
      offset,
    ).map(({ photo_revision, ...row }) => ({
      ...row,
      photo_url: photo_revision
        ? `/api/students/${row.id}/photo?v=${photo_revision}`
        : null,
    })),
    total: one(db, `SELECT COUNT(*) n FROM students ${where}`, ...args).n,
    page,
    startRow: offset,
  };
}
