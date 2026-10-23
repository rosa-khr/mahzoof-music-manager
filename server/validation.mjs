export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, message, status = 422) {
  if (!condition) throw new ApiError(status, message);
}
export function text(value, label, max = 500, required = false) {
  assert(value == null || typeof value === "string", `${label} نامعتبر است`);
  const v = (value || "").trim();
  assert(
    v.length <= max && (!required || v.length > 0),
    `${label} الزامی یا بیش از حد طولانی است`,
  );
  return v;
}
export function integer(value, label, min = 1, max = 10000) {
  if (typeof value === "string") value = latinDigits(value);
  assert(
    Number.isSafeInteger(Number(value)) &&
      Number(value) >= min &&
      Number(value) <= max,
    `${label} نامعتبر است`,
  );
  return Number(value);
}
export function choice(value, values, label) {
  assert(values.includes(value), `${label} نامعتبر است`);
  return value;
}
export function date(value, required = false) {
  if (!value && !required) return null;
  assert(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value,
    "تاریخ نامعتبر است",
  );
  return value;
}
export function timezone(value) {
  assert(
    typeof value === "string" &&
      /^(UTC|[A-Za-z_]+\/[A-Za-z_+0-9-]+(?:\/[A-Za-z_+-]+)?)$/.test(value),
    "منطقه زمانی IANA لازم است",
  );
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    throw new ApiError(422, "منطقه زمانی نامعتبر است");
  }
  return value;
}
export function money(value, currency) {
  choice(currency, ["TOMAN", "USD"], "ارز");
  const v = latinDigits(String(value ?? ""));
  assert(
    currency === "USD" ? /^\d+(\.\d{1,2})?$/.test(v) : /^\d+$/.test(v),
    "مبلغ باید مثبت و با دقت مجاز ارز باشد",
  );
  const [whole, fraction = ""] = v.split(".");
  const result =
    Number(whole) * (currency === "USD" ? 100 : 1) +
    (currency === "USD" ? Number(fraction.padEnd(2, "0")) : 0);
  assert(
    Number.isSafeInteger(result) && result <= 1000000000000,
    "مبلغ خارج از محدوده است",
  );
  return result;
}
export const normalize = (v) =>
  v.normalize("NFKC").replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
export const latinDigits = (v) =>
  v
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
