import {
  Component,
  Input,
  Pipe,
  PipeTransform,
  ElementRef,
  inject,
  AfterViewInit,
} from "@angular/core";
export { isoToday, jalaliToday, toJalali, toIso } from "./jalali-date";
import { RouterLink, Router } from "@angular/router";
import { MENU_GROUPS } from "../core/navigation";
@Component({
  selector: "app-field",
  standalone: true,
  template: '<div class="form-field"><ng-content /></div>',
})
export class Field implements AfterViewInit {
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  ngAfterViewInit() {
    // A blank native placeholder lets CSS track empty, filled and autofilled values,
    // including Reactive Forms writes and password reveal, without another value accessor.
    const control = this.element.nativeElement.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >("input, textarea");
    if (control) control.placeholder = " ";
  }
}
@Component({
  selector: "app-header",
  standalone: true,
  imports: [RouterLink],
  template:
    '<header class="page-header"><div class="page-heading"><h1>{{title}}</h1><nav class="breadcrumb-trail" aria-label="مسیر صفحه"><a routerLink="/">پیشخوان</a>@if(section && section !== "میز کار") {<span aria-hidden="true">/</span><span>{{section}}</span>}<span aria-hidden="true">/</span><span aria-current="page">{{title}}</span></nav><p class="page-subtitle">{{subtitle}}</p></div><div class="page-actions"><ng-content /></div></header>',
})
export class PageHeader {
  private router = inject(Router);
  get section() {
    const path = this.router.url.split("?")[0];
    return MENU_GROUPS.find((g) =>
      g.items.some(
        (item) =>
          item.path !== "/" &&
          (path === item.path || path.startsWith(item.path + "/")),
      ),
    )?.title;
  }
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
    no_due: "بدون مبلغ قابل دریافت",
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
