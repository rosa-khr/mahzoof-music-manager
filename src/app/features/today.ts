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
import { ColDef, GridOptions, ICellRendererParams } from "ag-grid-community";
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
      @if (lastUpdated) {
        <span class="dashboard-updated"
          >آخرین دریافت موفق: {{ clock(lastUpdated) }}</span
        >
      }
      <button
        type="button"
        class="btn btn-light"
        [disabled]="loading"
        (click)="load()"
      >
        <app-icon name="renew" />{{ loading ? "در حال دریافت…" : "تازه‌سازی" }}
      </button>
      <span class="date-chip"
        ><app-icon name="calendar" />{{ today | persianDate }}</span
      >
      @if (api.user()?.permissions?.includes("/students") !== false) {
        <a routerLink="/students" class="btn btn-primary"
          ><app-icon name="users" />پرونده هنرجویان</a
        >
      }
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
      <div class="dashboard-categories">
        @if (d.activeStudents !== undefined) {
          <section class="card dashboard-category">
            <header>
              <h2><app-icon name="book" />آموزش</h2>
            </header>
            <div class="category-metric">
              <div>
                <span>هنرجویان فعال</span
                ><small>پرونده‌های فعال آموزشگاه</small>
              </div>
              <strong>{{ number(d.activeStudents) }}</strong>
            </div>
            <div class="category-metric">
              <div>
                <span>ترم‌های نزدیک پایان</span
                ><small>با یک جلسه باقی‌مانده یا کمتر</small>
              </div>
              <strong>{{ number(d.actionTerms?.length || 0) }}</strong>
            </div>
            <a routerLink="/students" class="category-link"
              >مدیریت پرونده هنرجویان<app-icon name="chevron"
            /></a>
          </section>
          <section class="card dashboard-category">
            <header>
              <h2><app-icon name="calendar" />جلسات و حضور و غیاب</h2>
            </header>
            <div class="category-metric">
              <div>
                <span>جلسات رزروشده امروز</span
                ><small>برنامه امروز به وقت تهران</small>
              </div>
              <strong>{{ number(d.today?.length || 0) }}</strong>
            </div>
            <div class="category-metric">
              <div>
                <span>حضور و غیاب ثبت‌نشده</span
                ><small>جلسات گذشته که نیازمند تعیین وضعیت‌اند</small>
              </div>
              <strong>{{ number(d.pending?.length || 0) }}</strong>
            </div>
            <a href="#today-schedule" class="category-link"
              >مشاهده برنامه جلسات<app-icon name="chevron"
            /></a>
          </section>
        }
        @if (api.user()?.finance) {
          <section class="card dashboard-category">
            <header>
              <h2><app-icon name="wallet" />امور مالی</h2>
            </header>
            @for (debt of d.debts; track debt.currency) {
              <div class="category-metric category-money">
                <div>
                  <span>مانده صورتحساب‌ها</span
                  ><small>{{
                    debt.currency === "USD" ? "دلار" : "تومان"
                  }}</small>
                </div>
                <strong>{{ debt.amount_minor | money: debt.currency }}</strong>
              </div>
            } @empty {
              <p class="category-empty">
                صورتحسابی برای نمایش مانده وجود ندارد.
              </p>
            }
            @if (api.user()?.permissions?.includes("/students") !== false) {
              <a routerLink="/students" class="category-link"
                >پیگیری مالی هنرجویان<app-icon name="chevron"
              /></a>
            }
          </section>
        }
      </div>
      @if (api.user()?.education) {
        <section class="card dashboard-attention">
          <header>
            <div>
              <h2><app-icon name="clock" />نیازمند اقدام</h2>
              <p>وضعیت جاری جلسات و ترم‌ها؛ بر اساس اطلاعات ثبت‌شده</p>
            </div>
            <span class="count-label">امروز و وضعیت جاری</span>
          </header>
          <div class="attention-items">
            <a href="#pending-attendance"
              ><span>حضور و غیاب ثبت‌نشده</span
              ><b>{{ number(d.pending?.length || 0) }}</b
              ><app-icon name="chevron"
            /></a>
            <a href="#renewal-terms"
              ><span>ترم‌های نیازمند تمدید</span
              ><b>{{ number(d.actionTerms?.length || 0) }}</b
              ><app-icon name="chevron"
            /></a>
          </div>
        </section>
        <nav class="dashboard-shortcuts" aria-label="دسترسی سریع داشبورد">
          <span>دسترسی سریع</span>
          <a routerLink="/students/new" class="btn btn-light"
            ><app-icon name="users" />ثبت هنرجو</a
          >
          <a routerLink="/students" class="btn btn-light"
            ><app-icon name="book" />ترم و جلسه هنرجویان</a
          >
          @if (api.user()?.finance) {
            <a routerLink="/students" class="btn btn-light"
              ><app-icon name="wallet" />ثبت شهریه در پرونده</a
            >
          }
        </nav>
      }
      <div
        class="dashboard-workspace"
        [class.finance-only]="!api.user()?.education"
      >
        <div class="dashboard-main">
          @if (api.user()?.education) {
            <section class="card schedule-card">
              <app-data-grid
                id="today-schedule"
                title="برنامه جلسات امروز"
                description="ساعت‌ها به وقت تهران • ثبت حضور از عملیات هر جلسه"
                emptyMessage="امروز جلسه رزروشده‌ای وجود ندارد"
                [rowNumbers]="false"
                [rows]="d.today || emptyTasks"
                [columns]="todayColumns"
                [options]="taskGridOptions"
                stateKey="today-sessions"
                [height]="gridHeight(d.today?.length || 0)"
              />
            </section>
            <section class="card renewal-card">
              <app-data-grid
                id="renewal-terms"
                title="ترم‌های نیازمند تمدید"
                description="ترم‌های با یک جلسه باقی‌مانده یا کمتر"
                emptyMessage="ترمی برای پیگیری تمدید وجود ندارد"
                [rowNumbers]="false"
                [rows]="d.actionTerms || emptyTasks"
                [columns]="termColumns"
                [options]="taskGridOptions"
                stateKey="renewal-terms"
                [height]="gridHeight(d.actionTerms?.length || 0)"
              />
            </section>
          }
        </div>
        <div class="dashboard-aside">
          @if (api.user()?.education) {
            <section class="card followup-card">
              <app-data-grid
                id="pending-attendance"
                title="پیگیری حضور و غیاب"
                description="جلسات گذشته که هنوز تعیین وضعیت نشده‌اند"
                emptyMessage="حضور و غیاب عقب‌افتاده‌ای وجود ندارد"
                [rowNumbers]="false"
                [rows]="d.pending || emptyTasks"
                [columns]="pendingColumns"
                [options]="taskGridOptions"
                stateKey="pending-sessions"
                [height]="gridHeight(d.pending?.length || 0)"
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
                  ><strong>{{
                    debt.amount_minor | money: debt.currency
                  }}</strong>
                </div>
              } @empty {
                <div class="empty-state">
                  <span class="empty-icon"><app-icon name="wallet" /></span
                  ><b>بدهی ثبت‌شده‌ای وجود ندارد</b>
                  <p>مانده صورتحساب‌ها در این بخش نمایش داده می‌شود.</p>
                </div>
              }
              <div class="card-bottom">
                <p>
                  برای بررسی صورتحساب و ثبت دریافت، پرونده هنرجو را باز کنید.
                </p>
                <a routerLink="/students" class="btn btn-light"
                  >پیگیری مالی هنرجویان<app-icon name="chevron"
                /></a>
              </div>
            </section>
          }
        </div>
      </div>
    }`,
})
export class Today implements OnInit {
  cdr = inject(ChangeDetectorRef);
  api = inject(Api);
  today = new Date().toISOString();
  lastUpdated: string | null = null;
  clock(value: string) {
    return new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  }
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
  taskGridOptions: GridOptions<Task> = {
    paginationPageSize: 5,
    paginationPageSizeSelector: [5, 10, 25],
    headerHeight: 44,
    floatingFiltersHeight: 34,
  };
  gridHeight(count: number) {
    return `${Math.min(4, Math.max(2, count)) * 60 + 170}px`;
  }
  taskName(p: import("ag-grid-community").ICellRendererParams<Task>) {
    if (!p.data) return "";
    const container = document.createElement("div");
    container.className = "grid-lines";
    const name = document.createElement("b");
    name.textContent = p.data.first_name + " " + p.data.last_name;
    const subject = document.createElement("small");
    subject.textContent = p.data.subject;
    container.append(name, subject);
    return container;
  }
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
      minWidth: 155,
      filterValueGetter: (p) =>
        p.data
          ? `${p.data.first_name} ${p.data.last_name} ${p.data.subject}`
          : "",
      cellRenderer: (p: ICellRendererParams<Task>) => this.taskName(p),
    },
    {
      field: "starts_at",
      headerName: "ساعت تهران",
      valueFormatter: (p) => this.time(p.value),
      filterValueGetter: (p) => (p.data ? this.time(p.data.starts_at) : ""),
      minWidth: 140,
    },
    actionColumn<Task>((t) => this.attendanceAction(t, "حضور و غیاب"), 64),
  ];
  pendingColumns: ColDef<Task>[] = [
    {
      colId: "name",
      headerName: "هنرجو",
      valueGetter: (p) =>
        p.data ? p.data.first_name + " " + p.data.last_name : "",
      minWidth: 155,
      filterValueGetter: (p) =>
        p.data
          ? `${p.data.first_name} ${p.data.last_name} ${p.data.subject}`
          : "",
      cellRenderer: (p: ICellRendererParams<Task>) => this.taskName(p),
    },
    {
      field: "starts_at",
      headerName: "تاریخ و ساعت تهران",
      valueFormatter: (p) => this.date.transform(p.value, "Asia/Tehran", true),
      filterValueGetter: (p) =>
        this.date.transform(p.data?.starts_at, "Asia/Tehran", true),
      minWidth: 140,
    },
    actionColumn<Task>((t) => this.attendanceAction(t, "تعیین وضعیت"), 64),
  ];
  termColumns: ColDef<Task>[] = [
    {
      colId: "name",
      headerName: "هنرجو",
      valueGetter: (p) =>
        p.data ? p.data.first_name + " " + p.data.last_name : "",
      minWidth: 155,
      filterValueGetter: (p) =>
        p.data
          ? `${p.data.first_name} ${p.data.last_name} ${p.data.subject}`
          : "",
      cellRenderer: (p: ICellRendererParams<Task>) => this.taskName(p),
    },
    {
      headerName: "باقی‌مانده",
      valueGetter: (p) => p.data?.counters?.remaining,
      filter: "agNumberColumnFilter",
      valueFormatter: (p) => this.number(p.value || 0) + " جلسه",
      minWidth: 100,
    },
    { ...statusColumn<Task>("status"), minWidth: 95 },
    actionColumn<Task>(
      (t) => [
        {
          label: "بررسی و تمدید",
          icon: "renew",
          href:
            "/students/" +
            t.student_id +
            "?" +
            new URLSearchParams({ tab: "terms", term: String(t.id) }),
        },
      ],
      64,
    ),
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
      this.lastUpdated = new Date().toISOString();
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
