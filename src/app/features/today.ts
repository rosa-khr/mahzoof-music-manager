import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import { Icon } from "../shared/icon";
import { DataGrid, actionColumn, statusColumn } from "../shared/data-grid";
import { ColDef } from "ag-grid-community";
import { Counts } from "../core/models";
import { PageHeader, Money, PersianDate, Badge } from "../shared/ui";
interface Task {
  id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  subject: string;
  starts_at: string;
  student_term_id: number;
  status: string;
  counters?: Counts;
}
interface TodayData {
  activeStudents?: number;
  today?: Task[];
  pending?: Task[];
  actionTerms?: Task[];
  debts?: { currency: string; amount_minor: number }[];
}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, PageHeader, Money, PersianDate, Icon, DataGrid],
  template: `<app-header
      title="کارهای امروز"
      subtitle="نمای کلی آموزشگاه؛ از برنامه امروز تا پیگیری ترم‌ها و دریافت‌ها."
    >
      <span class="date-chip"
        ><app-icon name="calendar" />{{ today | persianDate }}</span
      ><a routerLink="/students" class="btn btn-primary"
        ><app-icon name="users" />پرونده هنرجویان</a
      >
    </app-header>
    @if (error) {
      <p role="alert" class="alert alert-danger">
        {{ error }}
        <button class="btn btn-light" (click)="load()">تلاش مجدد</button>
      </p>
    }
    @if (loading) {
      <p role="status" class="loading-state">در حال دریافت کارها…</p>
    }
    @if (data; as d) {
      <div class="stat-grid">
        @if (d.activeStudents !== undefined) {
          <section class="card metric">
            <div class="metric-top">
              <span>هنرجویان فعال</span><app-icon name="users" />
            </div>
            <strong>{{ number(d.activeStudents) }}</strong
            ><small>پرونده‌های فعال آموزشگاه</small>
          </section>
          <section class="card metric">
            <div class="metric-top">
              <span>جلسات امروز</span><app-icon name="calendar" />
            </div>
            <strong>{{ number(d.today?.length || 0) }}</strong
            ><small>در انتظار ثبت حضور و غیاب</small>
          </section>
          <section class="card metric">
            <div class="metric-top">
              <span>نیازمند تعیین وضعیت</span><app-icon name="clock" />
            </div>
            <strong>{{ number(d.pending?.length || 0) }}</strong
            ><small>جلسات رزروشده گذشته</small>
          </section>
          <section class="card metric">
            <div class="metric-top">
              <span>پیگیری تمدید</span><app-icon name="check" />
            </div>
            <strong>{{ number(d.actionTerms?.length || 0) }}</strong
            ><small>ترم‌های رو به پایان یا تکمیل‌شده</small>
          </section>
        }
      </div>
      @if (api.user()?.education) {
        <div class="dashboard-grid">
          <section class="card schedule-card">
            <app-data-grid
              title="برنامه جلسات امروز"
              [rows]="d.today || emptyTasks"
              [columns]="todayColumns"
              stateKey="today-sessions"
              height="360px"
            />
          </section>
          <section class="card followup-card">
            <app-data-grid
              title="پیگیری حضور و غیاب"
              [rows]="d.pending || emptyTasks"
              [columns]="pendingColumns"
              stateKey="pending-sessions"
              height="360px"
            />
          </section>
        </div>
      }
      <div
        class="dashboard-grid lower-dashboard"
        [class.finance-only]="!api.user()?.education"
      >
        @if (api.user()?.education) {
          <section class="card renewal-card">
            <app-data-grid
              title="ترم‌های نیازمند تمدید"
              [rows]="d.actionTerms || emptyTasks"
              [columns]="termColumns"
              stateKey="renewal-terms"
              height="360px"
            />
          </section>
        }
        @if (api.user()?.finance) {
          <section class="card debt-card">
            <div class="section-heading">
              <div>
                <h2>پیگیری بدهی‌ها</h2>
                <p>مانده فعلی صورتحساب‌های آموزشگاه</p>
              </div>
              <app-icon name="wallet" />
            </div>
            @for (debt of d.debts; track debt.currency) {
              <div class="debt-total">
                <small
                  >جمع مانده ·
                  {{ debt.currency === "USD" ? "دلار" : "تومان" }}</small
                ><strong>{{ debt.amount_minor | money: debt.currency }}</strong>
              </div>
            } @empty {
              <div class="empty-state">
                <span class="empty-icon"><app-icon name="wallet" /></span
                ><b>بدهی ثبت‌شده‌ای وجود ندارد</b>
                <p>مانده صورتحساب‌ها در این بخش نمایش داده می‌شود.</p>
              </div>
            }
            <div class="card-bottom">
              <p>برای بررسی صورتحساب و ثبت دریافت، پرونده هنرجو را باز کنید.</p>
              <a routerLink="/students" class="btn btn-light"
                >پیگیری مالی هنرجویان<app-icon name="chevron"
              /></a>
            </div>
          </section>
        }
      </div>
    }`,
})
export class Today implements OnInit {
  cdr = inject(ChangeDetectorRef);
  api = inject(Api);
  today = new Date().toISOString();
  number(value: number) {
    return new Intl.NumberFormat("fa-IR").format(value);
  }
  time(value: string) {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }
  emptyTasks: Task[] = [];
  date = new PersianDate();
  attendanceAction = (t: Task, label: string) => [
    {
      label,
      icon: "check" as const,
      href:
        "/students/" +
        t.student_id +
        "?" +
        new URLSearchParams({
          tab: "attendance",
          term: String(t.student_term_id),
          attendance: String(t.id),
        }),
    },
  ];
  todayColumns: ColDef<Task>[] = [
    {
      colId: "name",
      headerName: "هنرجو",
      valueGetter: (p) =>
        p.data ? p.data.first_name + " " + p.data.last_name : "",
      minWidth: 200,
    },
    { field: "subject", headerName: "واحد آموزشی", minWidth: 160 },
    {
      field: "starts_at",
      headerName: "ساعت تهران",
      valueFormatter: (p) => this.time(p.value),
      filterValueGetter: (p) => (p.data ? this.time(p.data.starts_at) : ""),
      minWidth: 140,
    },
    actionColumn<Task>((t) => this.attendanceAction(t, "حضور و غیاب")),
  ];
  pendingColumns: ColDef<Task>[] = [
    {
      colId: "name",
      headerName: "هنرجو",
      valueGetter: (p) =>
        p.data ? p.data.first_name + " " + p.data.last_name : "",
      minWidth: 200,
    },
    { field: "subject", headerName: "واحد آموزشی", minWidth: 160 },
    {
      field: "starts_at",
      headerName: "تاریخ و ساعت تهران",
      valueFormatter: (p) => this.date.transform(p.value, "Asia/Tehran", true),
      filterValueGetter: (p) =>
        this.date.transform(p.data?.starts_at, "Asia/Tehran", true),
      minWidth: 240,
    },
    actionColumn<Task>((t) => this.attendanceAction(t, "تعیین وضعیت")),
  ];
  termColumns: ColDef<Task>[] = [
    {
      colId: "name",
      headerName: "هنرجو",
      valueGetter: (p) =>
        p.data ? p.data.first_name + " " + p.data.last_name : "",
      minWidth: 200,
    },
    { field: "subject", headerName: "واحد آموزشی", minWidth: 160 },
    {
      headerName: "باقی‌مانده",
      valueGetter: (p) => p.data?.counters?.remaining,
      filter: "agNumberColumnFilter",
      valueFormatter: (p) => this.number(p.value || 0) + " جلسه",
      minWidth: 150,
    },
    statusColumn<Task>("status"),
    actionColumn<Task>((t) => [
      {
        label: "بررسی و تمدید",
        icon: "renew",
        href:
          "/students/" +
          t.student_id +
          "?" +
          new URLSearchParams({ tab: "terms", term: String(t.id) }),
      },
    ]),
  ];
  data: TodayData | null = null;
  loading = false;
  error = "";
  ngOnInit() {
    void this.load();
  }
  async load() {
    this.loading = true;
    this.error = "";
    try {
      this.data = await this.api.get<TodayData>("/today");
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
