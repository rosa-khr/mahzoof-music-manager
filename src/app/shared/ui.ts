import { Component, Input, Pipe, PipeTransform } from "@angular/core";
import jalaali from "jalaali-js";
import { RouterLink } from "@angular/router";
@Component({
  selector: "app-field",
  standalone: true,
  template: '<div class="form-field"><ng-content /></div>',
})
export class Field {}
@Component({
  selector: "app-header",
  standalone: true,
  imports: [RouterLink],
  template:
    '<header class="page-header"><div class="page-heading"><h1>{{title}}</h1><nav class="breadcrumb-trail" aria-label="مسیر صفحه"><a routerLink="/">پیشخوان</a><span aria-hidden="true">•</span><span>{{title}}</span></nav><p class="page-subtitle">{{subtitle}}</p></div><div class="page-actions"><ng-content /></div></header>',
})
export class PageHeader {
  @Input() title = "";
  @Input() subtitle = "";
}
@Component({
  selector: "app-badge",
  standalone: true,
  template:
    '<span class="status" [attr.data-status]="value">{{labels[value] || value}}</span>',
})
export class Badge {
  @Input() value = "";
  labels: Record<string, string> = {
    reserved: "رزرو",
    present: "حاضر",
    absent: "غایب",
    cancelled: "کنسل‌شده",
    current: "جاری",
    completed: "تکمیل‌شده",
    planned: "برنامه‌ریزی‌شده",
    paused: "متوقف",
    unpaid: "پرداخت‌نشده",
    partial: "پرداخت جزئی",
    settled: "تسویه‌شده",
    active: "فعال",
    inactive: "غیرفعال",
    archived: "بایگانی",
  };
}
@Pipe({ name: "money", standalone: true })
export class Money implements PipeTransform {
  transform(value: number | undefined, currency = "TOMAN") {
    return value == null
      ? "—"
      : new Intl.NumberFormat("fa-IR", {
          maximumFractionDigits: currency === "USD" ? 2 : 0,
        }).format(value / (currency === "USD" ? 100 : 1)) +
          " " +
          (currency === "USD" ? "دلار" : "تومان");
  }
}
@Pipe({ name: "persianDate", standalone: true })
export class PersianDate implements PipeTransform {
  transform(
    value: string | null | undefined,
    zone = "Asia/Tehran",
    time = false,
  ) {
    if (!value) return "ثبت نشده";
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: zone,
      dateStyle: "medium",
      ...(time ? { timeStyle: "short" as const } : {}),
    }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value));
  }
}
export function isoToday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const p = (t: string) => parts.find((v) => v.type === t)!.value;
  return `${p("year")}-${p("month")}-${p("day")}`;
}
export function jalaliToday() {
  return toJalali(isoToday());
}
export function toJalali(value: string | null | undefined) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  const j = jalaali.toJalaali(y, m, d);
  return `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
}
export function toIso(value: string) {
  if (!value) return "";
  const normalized = value.replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
  );
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) throw Error("تاریخ شمسی را با قالب ۱۴۰۵/۰۷/۲۷ وارد کنید");
  const [y, m, d] = match.slice(1).map(Number);
  if (!jalaali.isValidJalaaliDate(y, m, d))
    throw Error("تاریخ شمسی نامعتبر است");
  const g = jalaali.toGregorian(y, m, d);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}
