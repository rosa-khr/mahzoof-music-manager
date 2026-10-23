import jalaali from "jalaali-js";

export const dateDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
export function isoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${p("year")}-${p("month")}-${p("day")}`;
}
export function jalaliToday() {
  return toJalali(isoToday());
}
export function toJalali(value: string | null | undefined) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number),
    j = jalaali.toJalaali(y, m, d);
  return `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
}
export function toIso(value: string) {
  if (!value) return "";
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(
    dateDigits(value.trim()),
  );
  if (!match) throw Error("تاریخ شمسی را با قالب ۱۴۰۵/۰۷/۲۷ وارد کنید");
  const [y, m, d] = match.slice(1).map(Number);
  if (!jalaali.isValidJalaaliDate(y, m, d))
    throw Error("تاریخ شمسی نامعتبر است");
  const g = jalaali.toGregorian(y, m, d);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}
/** Start is the first session, so one weekly session ends on the start itself. */
export function weeklyTermEnd(start: string, count: string | number) {
  const quota = Number(dateDigits(String(count)));
  if (!start || !Number.isSafeInteger(quota) || quota < 1 || quota > 1000)
    return "";
  const day = new Date(toIso(start) + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() + 7 * (quota - 1));
  return toJalali(day.toISOString().slice(0, 10));
}
