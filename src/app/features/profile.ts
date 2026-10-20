import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  Component,
  inject,
  OnInit,
  DestroyRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ActivatedRoute, RouterLink, Router } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import {
  DataGrid,
  actionColumn,
  statusColumn,
  statusCell,
  statusLabels,
  linesCell,
} from "../shared/data-grid";
import {
  ColDef,
  GridApi,
  GridOptions,
  ICellRendererParams,
} from "ag-grid-community";
import { Student, Term, Attendance, Payment } from "../core/models";
import { PageHeader, Badge, Money, PersianDate } from "../shared/ui";
import { TermForm } from "./term-form";
import { PaymentForm } from "./payment-form";
import { SessionForm, AttendanceForm } from "./session-form";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    PageHeader,
    Badge,
    Money,
    DataGrid,
    PersianDate,
    TermForm,
    PaymentForm,
    SessionForm,
    AttendanceForm,
  ],
  template: `<a routerLink="/students" class="back-link"
      >بازگشت به پرونده هنرجویان</a
    >
    @if (error) {
      <p class="alert alert-danger" role="alert">
        {{ error }}
        <button class="btn btn-light" (click)="load()">تلاش مجدد</button>
      </p>
    }
    @if (loading) {
      <p role="status">در حال دریافت پرونده…</p>
    }
    @if (student; as s) {
      <app-header
        [title]="s.first_name + ' ' + s.last_name"
        [subtitle]="
          s.code +
          ' • ' +
          (s.english_first || '') +
          ' ' +
          (s.english_last || '')
        "
      >
        @if (s.photo_url) {
          <img class="profile-photo" [src]="s.photo_url" alt="عکس هنرجو" />
        }
        <app-badge [value]="s.status"
      /></app-header>
      <section class="card profile-summary">
        <div>
          <span class="eyebrow">تماس هنرجو</span>
          <p dir="ltr">{{ s.phone || "ثبت نشده" }}</p>
          @for (g of s.guardians; track g.phone) {
            <p>
              تماس {{ g.relationship }}: {{ g.name }}
              <bdi>{{ g.phone || "ثبت نشده" }}</bdi>
            </p>
          }
          <p>
            مسیرهای آموزشی:
            @for (e of s.enrollments; track e.subject_id) {
              <span class="chip">{{ e.subject }}</span>
            }
          </p>
          @if (contactIncomplete) {
            <p class="text-danger">اطلاعات تماس ناقص است.</p>
          }
        </div>
        <div>
          @for (b of s.balances; track b.currency) {
            <p>
              بدهی: <b>{{ b.debt_minor | money: b.currency }}</b> • اعتبار:
              {{ b.credit_minor | money: b.currency }}
            </p>
          }
        </div>
      </section>
      @if (s.possible_duplicates.length) {
        <p class="alert alert-warning">
          پرونده مشابه احتمالی پیدا شد؛ قبل از ادامه بررسی کنید.
          @for (d of s.possible_duplicates; track d.id) {
            <a [routerLink]="['/students', d.id]"
              >{{ d.code }} • {{ d.first_name }} {{ d.last_name }}
            </a>
          }
          ادغام خودکار انجام نشده است.
        </p>
      }
      <div class="actions profile-actions">
        @if (api.user()?.education) {
          <a class="btn btn-light" [routerLink]="['/students', s.id, 'edit']"
            >ویرایش هنرجو</a
          >
        }
        @if (api.user()?.education) {
          <button class="btn btn-primary" (click)="open('term')">
            ترم جدید</button
          ><button class="btn btn-outline-primary" (click)="open('session')">
            ثبت جلسه
          </button>
        }
        @if (api.user()?.finance) {
          <button class="btn btn-outline-primary" (click)="open('payment')">
            ثبت پرداخت
          </button>
        }
      </div>
      @if (message) {
        <p class="alert alert-success" role="status">{{ message }}</p>
      }
      @if (action === "term") {
        <app-term-form
          [studentId]="s.id"
          [old]="oldTerm"
          (saved)="saved()"
          (cancel)="close()"
        />
      }
      @if (action === "payment") {
        <app-payment-form
          [studentId]="s.id"
          [terms]="s.terms"
          [initialTerm]="selectedTerm"
          (saved)="saved()"
          (cancel)="close()"
        />
      }
      @if (action === "session") {
        <app-session-form
          [terms]="s.terms"
          [initialTerm]="selectedTerm"
          [reservation]="selectedAttendance"
          (saved)="saved()"
          (cancel)="close()"
        />
      }
      @if (action === "attendance" && selectedAttendance) {
        <app-attendance-form
          [attendance]="selectedAttendance"
          (saved)="saved()"
          (cancel)="close()"
        />
      }
      <nav class="tabs" aria-label="بخش‌های پرونده">
        <button [class.active]="tab === 'info'" (click)="setTab('info')">
          مشخصات</button
        ><button [class.active]="tab === 'terms'" (click)="setTab('terms')">
          ترم‌ها
        </button>
        @if (api.user()?.education) {
          <button
            [class.active]="tab === 'attendance'"
            (click)="setTab('attendance')"
          >
            حضور و غیاب
          </button>
        }
        @if (api.user()?.finance) {
          <button
            [class.active]="tab === 'finance'"
            (click)="setTab('finance')"
          >
            مالی
          </button>
        }
      </nav>
      @if (tab === "info") {
        <section class="card">
          <h2>مشخصات اولیه</h2>
          <dl class="details">
            @if (api.user()?.education) {
              <dt>منطقه زمانی</dt>
              <dd>
                <bdi>{{ s.timezone }}</bdi>
              </dd>
              <dt>اولین ثبت‌نام واقعی</dt>
              <dd>{{ s.first_registered | persianDate }}</dd>
              <dt>سابقه ثبت‌نام</dt>
              <dd>
                {{
                  s.history === "new"
                    ? "هنرجوی جدید"
                    : s.history === "old"
                      ? "دارای سابقه قبلی"
                      : "نامشخص"
                }}
              </dd>
            }
          </dl>
          <p class="text-secondary">
            مدارک، قوانین، اطلاعات تکمیلی و خروجی خلاصه پرونده در مراحل بعد
            تکمیل می‌شوند.
          </p>
        </section>
      }
      @if (tab === "attendance" && api.user()?.education) {
        <app-data-grid
          title="جلسات و حضور و غیاب"
          [rows]="attendanceRows"
          [columns]="attendanceColumns"
          [options]="attendanceOptions"
          stateKey="profile-all-sessions"
          (ready)="restoreAttendanceFilters($event)"
        />
      }
      @if (tab === "terms") {
        @for (t of visibleTerms; track t.id) {
          <section class="card term-card" [attr.id]="'term-' + t.id">
            <div class="term-heading">
              <h2>{{ t.subject }} • ترم {{ t.number }} <small>خصوصی</small></h2>
              <app-badge [value]="t.status" />
            </div>
            @if (t.counters; as c) {
              <div class="counter-grid">
                <span
                  >سهم کل <b>{{ c.quota }}</b></span
                ><span
                  >حاضر <b>{{ c.present }}</b></span
                ><span
                  >غایب <b>{{ c.absent }}</b></span
                ><span
                  >کنسل‌شده <b>{{ c.cancelled }}</b></span
                ><span
                  >رزرو <b>{{ c.reserved }}</b></span
                ><span
                  >مصرف‌شده <b>{{ c.consumed }}</b></span
                ><span
                  >باقی‌مانده <b>{{ c.remaining }}</b></span
                ><span
                  >قابل برنامه‌ریزی <b>{{ c.schedulable }}</b></span
                >
              </div>
              <p class="form-text">
                باقی‌مانده شامل {{ c.reserved }} جلسه رزروشده است.
              </p>
            }
            @if (t.invoice; as i) {
              <div class="invoice-summary">
                <span>شهریه: {{ i.total_minor | money: i.currency }}</span
                ><span
                  >تخصیص‌یافته:
                  {{ i.allocated_minor | money: i.currency }}</span
                ><span
                  >مانده: <b>{{ i.balance_minor | money: i.currency }}</b></span
                ><app-badge [value]="i.financial_status" />
                @if (i.overdue) {
                  <b class="text-danger">سررسیدگذشته</b>
                }
              </div>
            }
            <div class="actions">
              @if (api.user()?.education) {
                <button
                  class="btn btn-sm btn-outline-primary"
                  (click)="open('session', t)"
                >
                  رزرو جلسه
                </button>
                @if (!hasRenewal(t.id)) {
                  <button
                    class="btn btn-sm"
                    [class.btn-primary]="t.status === 'completed'"
                    [class.btn-light]="t.status !== 'completed'"
                    (click)="renew(t)"
                  >
                    تمدید با مشخصات همین ترم
                  </button>
                }
              }
              @if (api.user()?.finance) {
                <button
                  class="btn btn-sm btn-light"
                  (click)="open('payment', t)"
                >
                  ثبت پرداخت
                </button>
              }
            </div>
            @if (api.user()?.education) {
              <h3>جلسات و حضور و غیاب</h3>
              <app-data-grid
                title="جلسات و حضور و غیاب"
                [rows]="t.sessions || emptySessions"
                [columns]="sessionColumns(t.id)"
                stateKey="profile-sessions"
                height="360px"
              />
            }
          </section>
        } @empty {
          <section class="card empty">هنوز ترمی ثبت نشده است.</section>
        }
      }
      @if (tab === "finance") {
        <section class="card">
          <h2>صورتحساب‌ها</h2>
          <app-data-grid
            title="صورتحساب‌ها"
            [rows]="financeTerms"
            [columns]="invoiceColumns"
            stateKey="profile-invoices"
            height="360px"
          />
          <h2 class="mt-4">دریافت‌ها</h2>
          <app-data-grid
            title="دریافت‌ها"
            [rows]="s.payments || emptyPayments"
            [columns]="paymentColumns"
            stateKey="profile-payments"
            height="360px"
          />
          <p class="form-text">
            اعتبار خودکار به ترم بعد تخصیص نمی‌یابد؛ استفاده صریح از اعتبار در
            مرحله مالی تکمیل می‌شود.
          </p>
        </section>
      }
    } `,
})
export class Profile implements OnInit {
  cdr = inject(ChangeDetectorRef);
  api = inject(Api);
  destroy = inject(DestroyRef);
  route = inject(ActivatedRoute);
  router = inject(Router);
  student: Student | null = null;
  emptySessions: Attendance[] = [];
  emptyPayments: Payment[] = [];
  financeTerms: Term[] = [];
  sessionColumnCache = new Map<number, ColDef<Attendance>[]>();
  attendanceRows: Attendance[] = [];
  attendanceTerms = new Map<number, Term>();
  attendanceGrid?: GridApi<Attendance>;
  attendanceColumns: ColDef<Attendance>[] = [];
  attendanceOptions: GridOptions<Attendance> = {
    onFilterChanged: (e) => {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          sessionFilters: Object.keys(e.api.getFilterModel()).length
            ? JSON.stringify(e.api.getFilterModel())
            : null,
          term: null,
        },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    },
  };
  restoreAttendanceFilters(grid: GridApi<Attendance>) {
    this.attendanceGrid = grid;
    const params = this.route.snapshot.queryParamMap;
    try {
      const model = JSON.parse(params.get("sessionFilters") || "{}");
      const term = this.student?.terms.find(
        (t) => t.id === Number(params.get("term")),
      );
      if (term && !model.term)
        model.term = {
          filterType: "text",
          type: "equals",
          filter: term.subject + " • ترم " + term.number,
        };
      grid.setFilterModel(model);
    } catch {
      /* malformed query uses all rows */
    }
  }
  money = new Money();
  date = new PersianDate();
  sessionColumns(termId: number): ColDef<Attendance>[] {
    if (!this.sessionColumnCache.has(termId))
      this.sessionColumnCache.set(termId, [
        {
          field: "session_id",
          headerName: "شماره جلسه",
          minWidth: 150,
          filter: "agNumberColumnFilter",
          cellRenderer: (p: ICellRendererParams<Attendance>) =>
            p.data
              ? linesCell(
                  String(p.data.session_id),
                  p.data.replacement_for
                    ? ["جایگزین " + p.data.replacement_for]
                    : [],
                )
              : "",
        },
        {
          field: "starts_at",
          filterValueGetter: (p) =>
            this.date.transform(p.data?.starts_at, "Asia/Tehran", true),
          headerName: "تاریخ و ساعت تهران",
          minWidth: 260,
          valueFormatter: (p) =>
            this.date.transform(p.value, "Asia/Tehran", true),
          cellRenderer: (p: ICellRendererParams<Attendance>) =>
            p.data
              ? linesCell(
                  this.date.transform(p.data.starts_at, "Asia/Tehran", true),
                  [
                    ...(this.student?.timezone !== "Asia/Tehran"
                      ? [
                          "زمان هنرجو: " +
                            this.date.transform(
                              p.data.starts_at,
                              this.student?.timezone,
                              true,
                            ) +
                            " (" +
                            this.student?.timezone +
                            ")",
                        ]
                      : []),
                    ...(p.data.duration_minutes
                      ? [p.data.duration_minutes + " دقیقه"]
                      : []),
                  ],
                )
              : "",
        },
        {
          ...statusColumn<Attendance>("status"),
          minWidth: 175,
          width: 175,
          maxWidth: 190,
          cellRenderer: (p: ICellRendererParams<Attendance>) =>
            p.data
              ? statusCell(
                  p.data.status,
                  p.data.status === "reserved" && this.isPast(p.data.starts_at)
                    ? "نیازمند تعیین وضعیت"
                    : "",
                )
              : "",
        },
        {
          field: "counts",
          headerName: "مصرف سهم",
          minWidth: 150,
          valueFormatter: (p) => (p.value ? "یک جلسه" : "صفر"),
          filterValueGetter: (p) => (p.data?.counts ? "یک جلسه" : "صفر"),
        },
        {
          field: "reason",
          headerName: "توضیحات",
          minWidth: 230,
          cellRenderer: (p: ICellRendererParams<Attendance>) =>
            p.data
              ? linesCell(
                  p.data.reason || "—",
                  p.data.cancelled_by
                    ? ["لغوکننده: " + this.cancelLabels[p.data.cancelled_by]]
                    : [],
                )
              : "",
        },
        actionColumn<Attendance>((a) => [
          {
            label: "ثبت / اصلاح وضعیت",
            icon: "check",
            run: () => this.edit(a),
          },
          ...(a.status === "reserved"
            ? [
                {
                  label: "ویرایش نوبت",
                  icon: "edit" as const,
                  run: () =>
                    this.editReservation(
                      a,
                      this.student!.terms.find((term) => term.id === termId)!,
                    ),
                },
              ]
            : []),
        ]),
      ]);
    return this.sessionColumnCache.get(termId)!;
  }
  invoiceColumns: ColDef<Term>[] = [
    {
      headerName: "ترم",
      valueGetter: (p) =>
        p.data ? p.data.subject + " • ترم " + p.data.number : "",
      minWidth: 230,
    },
    {
      headerName: "شهریه",
      valueGetter: (p) => p.data?.invoice?.total_minor,
      filter: "agNumberColumnFilter",
      valueFormatter: (p) =>
        this.money.transform(p.value, p.data?.invoice?.currency),
      minWidth: 190,
    },
    {
      headerName: "مانده",
      valueGetter: (p) => p.data?.invoice?.balance_minor,
      filter: "agNumberColumnFilter",
      valueFormatter: (p) =>
        this.money.transform(p.value, p.data?.invoice?.currency),
      minWidth: 190,
    },
    {
      headerName: "وضعیت",
      valueGetter: (p) => p.data?.invoice?.financial_status,
      filterValueGetter: (p) =>
        statusLabels[p.data?.invoice?.financial_status || ""] || "",
      cellRenderer: (p: ICellRendererParams<Term>) => statusCell(p.value || ""),
      minWidth: 140,
    },
    actionColumn<Term>((t) => [
      {
        label: "ثبت پرداخت",
        icon: "wallet",
        run: () => this.open("payment", t),
      },
    ]),
  ];
  paymentColumns: ColDef<Payment>[] = [
    {
      field: "id",
      headerName: "شماره دریافت",
      filter: "agNumberColumnFilter",
      minWidth: 150,
    },
    {
      field: "received_on",
      filterValueGetter: (p) => this.date.transform(p.data?.received_on),
      headerName: "تاریخ واقعی دریافت",
      valueFormatter: (p) => this.date.transform(p.value),
      minWidth: 200,
    },
    {
      field: "amount_minor",
      headerName: "مبلغ",
      filter: "agNumberColumnFilter",
      valueFormatter: (p) => this.money.transform(p.value, p.data?.currency),
      minWidth: 200,
    },
    {
      field: "credit_minor",
      headerName: "اعتبار تخصیص‌نیافته",
      filter: "agNumberColumnFilter",
      valueFormatter: (p) => this.money.transform(p.value, p.data?.currency),
      minWidth: 210,
    },
  ];
  loading = false;
  error = "";
  message = "";
  tab = "terms";
  action = "";
  cancelLabels: Record<string, string> = {
    teacher: "مدرس",
    student: "هنرجو",
    academy: "آموزشگاه",
    other: "سایر",
  };
  oldTerm: Term | null = null;
  selectedTerm = 0;
  selectedAttendance: Attendance | null = null;
  get contactIncomplete() {
    return (
      !this.student?.phone && !this.student?.guardians.some((g) => !!g.phone)
    );
  }
  get visibleTerms() {
    return this.student?.terms || [];
  }
  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      const q = this.route.snapshot.queryParamMap;
      this.tab = q.get("tab") || "terms";
      this.selectedTerm = Number(q.get("term")) || 0;
      void this.load().then(() => {
        const requestedAction = q.get("action");
        if (this.student && requestedAction) {
          const allowed =
            (["term", "session"].includes(requestedAction) &&
              this.api.user()?.education) ||
            (requestedAction === "payment" && this.api.user()?.finance);
          if (allowed) this.open(requestedAction);
          // Consume the entry action so reload/save cannot reopen a stale form.
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { action: null },
            queryParamsHandling: "merge",
            replaceUrl: true,
          });
          this.cdr.markForCheck();
        }
        const id = Number(q.get("attendance"));
        if (id) {
          const a = this.student?.terms
            .flatMap((t) => t.sessions || [])
            .find((a) => a.id === id);
          if (a) this.edit(a);
        }
      });
    });
  }
  async load() {
    this.loading = true;
    this.error = "";
    try {
      this.student = await this.api.get<Student>(
        "/students/" + this.route.snapshot.paramMap.get("id"),
      );
      this.financeTerms = this.student.terms.filter((t) => !!t.invoice);
      this.attendanceTerms.clear();
      this.attendanceRows = this.student.terms.flatMap((t) =>
        (t.sessions || []).map((a) => {
          this.attendanceTerms.set(a.id, t);
          return a;
        }),
      );
      if (!this.attendanceColumns.length)
        this.attendanceColumns = [
          {
            colId: "term",
            headerName: "ترم",
            minWidth: 210,
            valueGetter: (p) => {
              const t = p.data ? this.attendanceTerms.get(p.data.id) : null;
              return t ? t.subject + " • ترم " + t.number : "";
            },
          },
          ...this.sessionColumns(0).slice(0, -1),
          actionColumn<Attendance>((a) => [
            {
              label: "ثبت / اصلاح وضعیت",
              icon: "check",
              run: () => this.edit(a),
            },
            ...(a.status === "reserved"
              ? [
                  {
                    label: "ویرایش نوبت",
                    icon: "edit" as const,
                    run: () =>
                      this.editReservation(a, this.attendanceTerms.get(a.id)!),
                  },
                ]
              : []),
          ]),
        ];
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  setTab(v: string) {
    this.tab = v;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: v, term: this.selectedTerm },
      replaceUrl: true,
    });
  }
  open(v: string, t?: Term) {
    this.selectedAttendance = null;
    this.action = "";
    this.oldTerm = null;
    this.selectedTerm = t?.id || 0;
    this.action = v;
    this.message = "";
    setTimeout(() =>
      document
        .querySelector(".action-panel input,.action-panel select")
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }
  editReservation(a: Attendance, t: Term) {
    this.open("session", t);
    this.selectedAttendance = a;
  }
  renew(t: Term) {
    this.open("term", t);
    this.oldTerm = t;
  }
  edit(a: Attendance) {
    this.action = "attendance";
    this.selectedAttendance = a;
    this.message = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  close() {
    this.action = "";
    this.selectedAttendance = null;
    this.oldTerm = null;
  }
  async saved() {
    this.close();
    this.message = "اطلاعات با موفقیت در سرور ثبت شد.";
    await this.load();
  }
  hasRenewal(id: number) {
    return this.student?.terms.some((t) => t.renewed_from === id);
  }
  isPast(v: string) {
    return Date.parse(v) < Date.now();
  }
}
