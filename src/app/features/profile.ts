import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  Component,
  Input,
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
import {
  Student,
  Term,
  Attendance,
  Payment,
  Installment,
} from "../core/models";
import { PageHeader, Badge, Money, PersianDate } from "../shared/ui";
import { TermForm } from "./term-form";
import { PaymentForm } from "./payment-form";
import { SessionForm, AttendanceForm } from "./session-form";
import { SessionStatuses } from "../core/session-statuses";
import { LearningPathEditor } from './learning-path-editor';
import { TermTuitionEditor } from './term-tuition-editor';
import { StudentDocuments } from './student-documents';
import { requestReason } from '../shared/confirm';
@Component({
  selector: "app-student-profile",
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
    LearningPathEditor,
    TermTuitionEditor,
    StudentDocuments,
  ],
  template: `@if (!embedded) {
      <a routerLink="/students" class="back-link student-profile-back"
        >بازگشت به پرونده هنرجویان</a
      >
    }
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
      @if (!embedded) {
        <app-header
          class="student-profile-header"
          [title]="s.first_name + ' ' + s.last_name"
          [subtitle]="'پرونده آموزشی • ' + s.code"
        >
          <div class="actions profile-actions profile-actions-header">
            @if (api.user()?.education) {
              <a
                class="btn btn-light"
                [routerLink]="['/students', s.id, 'edit']"
                >ویرایش هنرجو</a
              ><button class="btn btn-primary" (click)="open('term')">
                ترم جدید</button
              ><button
                class="btn btn-outline-primary"
                (click)="open('session')"
              >
                ثبت جلسه
              </button>
            }
            @if (api.user()?.finance) {
              <button class="btn btn-outline-primary" (click)="open('payment')">
                ثبت پرداخت
              </button>
            }
            <a class="btn btn-light" [routerLink]="['/students', s.id, 'print']">چاپ پرونده</a>
          </div>
        </app-header>
      }
      <div class="student-dossier" [class.student-dossier--embedded]="embedded">
        @if (!embedded) {
          <aside class="dossier-sidebar">
            <section class="card dossier-identity">
              @if (s.photo_url) {
                <img
                  class="profile-photo dossier-photo"
                  [src]="s.photo_url"
                  alt="عکس هنرجو"
                />
              } @else {
                <span
                  class="dossier-avatar student-avatar-placeholder"
                  aria-hidden="true"
                ></span>
              }
              <strong class="dossier-name"
                >{{ s.first_name }} {{ s.last_name }}</strong
              >
              <p class="dossier-english" dir="auto">
                {{
                  s.english_first || s.english_last
                    ? s.english_first + " " + s.english_last
                    : "نام انگلیسی ثبت نشده"
                }}
              </p>
              <app-badge [value]="s.status" />
              <dl class="dossier-facts">
                <dt>کد هنرجو</dt>
                <dd>
                  <bdi>{{ s.code }}</bdi>
                </dd>
                <dt>موبایل</dt>
                <dd>
                  <bdi>{{ s.phone || "ثبت نشده" }}</bdi>
                </dd>
                @if (api.user()?.education) {
                  <dt>تاریخ ایجاد</dt>
                  <dd>{{ s.created_at | persianDate }}</dd>
                }
                @for (g of s.guardians; track g.id) {
                  <dt>{{ g.relationship }}</dt>
                  <dd>
                    {{ g.name
                    }}<small
                      ><bdi>{{ g.phone || "ثبت نشده" }}</bdi></small
                    >
                  </dd>
                }
              </dl>
              @if (contactIncomplete) {
                <p class="text-danger">اطلاعات تماس ناقص است.</p>
              }
              <div class="dossier-enrollments">
                <small>مسیرهای آموزشی</small>
                @for (e of s.enrollments; track e.id) {
                  <span class="chip">{{ e.subject }}</span>
                }
              </div>
            </section>
            @if (api.user()?.finance) {
              <section class="card dossier-balances">
                <h2>خلاصه مالی</h2>
                @for (b of s.balances; track b.currency) {
                  <div>
                    <small>{{ b.currency === "USD" ? "دلار" : "تومان" }}</small>
                    <p>
                      بدهی: <b>{{ b.debt_minor | money: b.currency }}</b>
                    </p>
                    <p>
                      اعتبار: <b>{{ b.credit_minor | money: b.currency }}</b>
                    </p>
                  </div>
                }
              </section>
            }
            <a class="btn btn-light" [routerLink]="['/students', s.id, 'print']">چاپ پرونده</a>
          </aside>
        }
        <div class="dossier-content">
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
          <div class="actions profile-actions profile-actions-content">
            @if (api.user()?.education && !embedded) {
              <a
                class="btn btn-light"
                [routerLink]="['/students', s.id, 'edit']"
                >ویرایش هنرجو</a
              >
            }
            @if (api.user()?.education) {
              <button class="btn btn-primary" (click)="open('term')">
                ترم جدید</button
              ><button
                class="btn btn-outline-primary"
                (click)="open('session')"
              >
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
              [defaults]="s.education_preferences"
              [enrollments]="s.enrollments"
              (saved)="saved()"
              (cancel)="close()"
            />
          }
          @if (action === 'path') {
            <app-learning-path-editor [studentId]="s.id" [path]="selectedPath" (saved)="saved()" (cancel)="close()" />
          }
          @if (action === 'tuition' && oldTerm) {
            <app-term-tuition-editor [term]="oldTerm" (saved)="saved()" (cancel)="close()" />
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
              [replacementFor]="selectedReplacement"
              (saved)="saved()"
              (cancel)="close()"
            />
          }
          @if (action === "attendance" && selectedAttendance) {
            <app-attendance-form
              [attendance]="selectedAttendance"
              [initialStatus]="requestedAttendanceStatus"
              (saved)="saved()"
              (cancel)="close()"
            />
          }
          @if (!embedded) {
            <nav class="tabs" aria-label="بخش‌های پرونده">
              <button [class.active]="tab === 'info'" (click)="setTab('info')">
                مشخصات</button
              ><button
                [class.active]="tab === 'terms'"
                (click)="setTab('terms')"
              >
                ترم‌ها و جلسات
              </button>
              @if (api.user()?.finance) {
                <button
                  [class.active]="tab === 'finance'"
                  (click)="setTab('finance')"
                >
                  شهریه و پرداخت‌ها
                </button>
              }
              <button [class.active]="tab === 'documents'" (click)="setTab('documents')">قوانین و اسناد</button>
            </nav>
          }
          @if (tab === "info") {
            <section class="card">
              <h2>مشخصات اولیه</h2>
              <dl class="details">
                @if (api.user()?.education) {
                  <dt>سن</dt>
                  <dd>{{ s.age == null ? "ثبت نشده" : s.age + " سال" }}</dd>
                  <dt>آدرس</dt>
                  <dd>{{ s.address || "ثبت نشده" }}</dd>
                }
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
              <dl class="details">
                <dt>کشور و شهر</dt><dd>{{ s.country || "—" }} {{ s.city || "" }}</dd>
                <dt>تحصیلات</dt><dd>{{ s.education_level || "—" }}</dd>
                <dt>شیوه آشنایی با آموزشگاه</dt><dd>{{ s.referral_source || "—" }}</dd>
              </dl>
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
            @if (api.user()?.education) {
              <section class="card"><h2>مسیرهای آموزشی و برنامه کلاس</h2>
                <div class="actions"><button class="btn btn-light" (click)="editPath(null)">ثبت‌نام آموزشی جدید</button></div>
                <div class="learning-path-notes">
                  <div><small>هدف ثبت‌نام</small><b>{{ s.registration_goal || "—" }}</b></div>
                  <div><small>پیشینه هنری</small><b>{{ s.artistic_history || "—" }}</b></div>
                  <div><small>مصاحبه</small><b>{{ s.interview_notes || "—" }}</b></div>
                </div>
                <div class="learning-path-list">
                @for (path of s.enrollments; track path.id) {
                  <div class="learning-path-summary"><small>پرونده ساز</small><h3>{{ path.subject }}</h3>
                    @for (row of path.schedules || []; track row.id) { <p>{{ scheduleText(row) }}</p> }
                    @if (path.instrument_id) { <button class="btn btn-light btn-sm" (click)="editPath(path)">ویرایش برنامه و پیش‌فرض‌ها</button> }
                  </div>
                }
                </div>
              </section>
            }
            @for (t of visibleTerms; track t.id) {
              <section class="card term-card" [attr.id]="'term-' + t.id">
                <div class="term-heading">
                  <h2>
                    {{ t.subject }} • ترم {{ t.number }} <small>{{ t.structure === 'group' ? 'گروهی' : 'خصوصی' }}</small>
                  </h2>
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
                @if (api.user()?.education) {
                  <p>
                    {{ t.teacher }} •
                    {{ t.teaching_type || "شیوه برگزاری سابق" }} •
                    {{ t.mode === "online" ? "آنلاین" : t.location }}
                  </p>
                  @for (row of t.schedules || []; track row.id) {
                    <p class="print-schedule">{{ scheduleText(row) }}</p>
                  }
                }
                @if (t.invoice; as i) {
                  <div class="invoice-summary">
                    <span>شهریه: {{ i.total_minor | money: i.currency }}</span
                    ><span
                      >تخصیص‌یافته:
                      {{ i.allocated_minor | money: i.currency }}</span
                    ><span
                      >مانده:
                      <b>{{ i.balance_minor | money: i.currency }}</b></span
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
                      [disabled]="t.invoice?.financial_status !== 'unpaid'"
                    >
                      ثبت پرداخت
                    </button>
                  }
                  @if (api.user()?.admin && t.workflow_version === 3) {
                    <button class="btn btn-sm btn-light" (click)="amendTuition(t)">اصلاح شهریه با سابقه</button>
                  }
                  <a class="btn btn-light btn-sm" [routerLink]="['/students',s.id,'print']" [queryParams]="{term:t.id}">چاپ این ترم</a>
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
              <section class="card dossier-section">
                <header><h2>مسیر آموزشی</h2></header>
                <div class="dossier-section-body">
                  <p>هنوز ترمی ثبت نشده است.</p>
                  <small
                    >ترم‌ها و جلسات هنرجو پس از ثبت ترم در این بخش نمایش داده
                    می‌شوند.</small
                  >
                </div>
              </section>
            }
          }
          @if (!embedded && tab === "terms" && api.user()?.education) {
            <section class="card dossier-section">
              <header><h2>سوابق و اطلاعات فردی</h2></header>
              <dl class="details dossier-section-body">
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
                <dt>اولین ثبت‌نام واقعی</dt>
                <dd>{{ s.first_registered | persianDate }}</dd>
                <dt>سن</dt>
                <dd>{{ s.age == null ? "ثبت نشده" : s.age + " سال" }}</dd>
                <dt>آدرس</dt>
                <dd>{{ s.address || "ثبت نشده" }}</dd>
              </dl>
            </section>
          }
          @if (tab === "finance") {
            <section class="card">
              <h2>خلاصه شهریه</h2>
              @for (summary of tuitionSummaries; track summary.currency) {
                <div class="invoice-summary">
                  <span
                    >شهریه: {{ summary.total | money: summary.currency }}</span
                  >
                  <span
                    >پرداخت‌شده:
                    {{ summary.paid | money: summary.currency }}</span
                  >
                  <span
                    >مانده:
                    {{ summary.balance | money: summary.currency }}</span
                  >
                  @if (summary.next) {
                    <span
                      >قسط بعدی:
                      {{ summary.next.balance_minor | money: summary.currency }}
                      • {{ summary.next.due_date | persianDate }}</span
                    >
                  }
                </div>
              }
              @if (installmentRows.length) {
              <h2>اقساط و تعهدات — سابقه قبلی</h2>
              <p class="form-text">
                دریافت‌های هر ترم به ترتیب اقساط آن تخصیص می‌یابند. ثبت قسط به
                معنی دریافت پول نیست.
              </p>
              <app-data-grid
                title="اقساط و تعهدات"
                [rows]="installmentRows"
                [columns]="installmentColumns"
                stateKey="profile-installments"
                height="360px"
              />
              }
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
                اعتبار خودکار به ترم بعد تخصیص نمی‌یابد؛ استفاده صریح از اعتبار
                در مرحله مالی تکمیل می‌شود.
              </p>
              @if (api.user()?.admin) {
                <h2>تاریخچه اصلاحات مالی</h2>
                <app-data-grid title="تاریخچه مالی" [rows]="historyRows" [columns]="historyColumns" stateKey="student-financial-history" height="300px" />
              }
            </section>
          }
          @if (tab === "documents") {
            <section class="card">
              <h2>قوانین و اسناد پرونده</h2>
              <p>نسخه قوانین هر ثبت‌نام در زمان ساخت ترم به همان ترم متصل می‌شود و در چاپ پرونده نمایش داده می‌شود.</p>
              <div class="actions">
                <a class="btn btn-primary" [routerLink]="['/students', s.id, 'print']">چاپ پرونده و فرم پذیرش</a>
                <a class="btn btn-light" routerLink="/certificate-requests">درخواست مدرک</a>
              </div>
            </section>
            @if (api.user()?.education) { <app-student-documents [student]="s" /> }
          }
        </div>
      </div>
    } `,
})
export class Profile implements OnInit {
  @Input() embedded = false;
  @Input() initialTab = "terms";
  ngOnChanges() {
    if (this.embedded) {
      this.tab = this.initialTab;
      this.close();
    }
  }
  statusCatalog = inject(SessionStatuses);
  pendingAttendance = new Set<number>();
  requestedAttendanceStatus: string | null = null;
  cdr = inject(ChangeDetectorRef);
  api = inject(Api);
  destroy = inject(DestroyRef);
  route = inject(ActivatedRoute);
  router = inject(Router);
  student: Student | null = null;
  selectedPath: Student['enrollments'][number] | null = null;
  selectedReplacement=0;
  historyRows:any[]=[];
  historyColumns:ColDef[]=[{field:'created_at',headerName:'تاریخ',valueFormatter:p=>this.date.transform(p.value,'Asia/Tehran',true),minWidth:220},{field:'action',headerName:'عملیات',valueFormatter:p=>({'term-tuition-amended':'اصلاح شهریه','payment-voided':'ابطال دریافت','full-tuition-received':'دریافت کامل','term-created':'ثبت ترم','term-renewed':'تمدید ترم'} as Record<string,string>)[p.value]||p.value},{field:'summary',headerName:'شرح',minWidth:320,valueFormatter:p=>{try{return JSON.parse(p.value).reason||'';}catch{return '';}}}];
  amendTuition(t:Term){this.open('tuition',t);this.oldTerm=t;}
  async voidPayment(p:Payment){const reason=await requestReason('ابطال دریافت شماره '+p.id);if(!reason)return;try{await this.api.post(`/payments/${p.id}/void`,{reason});await this.load();}catch(e){this.error=errorMessage(e);this.cdr.markForCheck();}}
  editPath(path:Student['enrollments'][number]|null){this.selectedPath=path;this.open('path');}
  emptySessions: Attendance[] = [];
  emptyPayments: Payment[] = [];
  financeTerms: Term[] = [];
  installmentRows: (Installment & {
    termId: number;
    termLabel: string;
    currency: string;
  })[] = [];
  tuitionSummaries: {
    currency: string;
    total: number;
    paid: number;
    balance: number;
    next?: Installment;
  }[] = [];
  installmentColumns: ColDef<
    Installment & { termId: number; termLabel: string; currency: string }
  >[] = [
    { field: "termLabel", headerName: "ترم", minWidth: 200 },
    { field: "number", headerName: "قسط", minWidth: 110 },
    {
      field: "due_date",
      headerName: "سررسید",
      valueFormatter: (p) => this.persianDate.transform(p.value),
      minWidth: 160,
    },
    {
      field: "amount_minor",
      headerName: "مبلغ",
      valueFormatter: (p) => this.money.transform(p.value, p.data?.currency),
      minWidth: 170,
    },
    {
      field: "balance_minor",
      headerName: "مانده",
      valueFormatter: (p) => this.money.transform(p.value, p.data?.currency),
      minWidth: 170,
    },
    {
      headerName: "وضعیت",
      valueGetter: (p) =>
        p.data?.overdue
          ? "سررسیدگذشته"
          : statusLabels[p.data?.financial_status || ""] || "",
      minWidth: 160,
    },
    actionColumn((row) => [
      {
        label: "ثبت دریافت برای ترم",
        icon: "wallet",
        run: () =>
          this.open(
            "payment",
            this.student?.terms.find((t) => t.id === row.termId),
          ),
      },
    ]),
  ];
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
  persianDate = new PersianDate();
  date = new PersianDate();
  attendanceActions(termId: number): ColDef<Attendance> {
    const column = actionColumn<Attendance>(
      (a) => [
        { label: "ثبت / اصلاح وضعیت", icon: "check", run: () => this.edit(a) },
        ...(a.status === "reserved"
          ? [
              {
                label: "ویرایش نوبت",
                icon: "edit" as const,
                run: () =>
                  this.editReservation(
                    a,
                    this.attendanceTerms.get(a.id) ||
                      this.student!.terms.find((t) => t.id === termId)!,
                  ),
              },
            ]
          : []),
        ...(a.status==='cancelled' && a.cancelled_by==='teacher' && a.counts===0 ? [{label:'ثبت جلسه جبرانی',icon:'calendar' as const,run:()=>{const term=this.attendanceTerms.get(a.id)||this.student!.terms.find(t=>t.id===termId)!;this.open('session',term);this.selectedReplacement=a.session_id;this.cdr.markForCheck();}}] : []),
      ],
      210,
    );
    const buttons = column.cellRenderer as (
      params: ICellRendererParams<Attendance>,
    ) => HTMLElement;
    return {
      ...column,
      headerName: "حضور و غیاب / عملیات",
      cellRenderer: (params: ICellRendererParams<Attendance>) => {
        const wrapper = document.createElement("div");
        wrapper.className = "attendance-row-controls";
        if (!params.data) return wrapper;
        const a = params.data,
          radios = document.createElement("div");
        radios.className = "attendance-radios";
        radios.setAttribute("role", "group");
        radios.setAttribute("aria-label", "وضعیت جلسه " + a.session_id);
        const reset = () =>
          radios
            .querySelectorAll<HTMLInputElement>("input")
            .forEach((input) => {
              input.checked = input.value === a.status;
              input.disabled = this.pendingAttendance.has(a.id);
            });
        for (const option of this.statusCatalog.options) {
          const label = document.createElement("label"),
            input = document.createElement("input");
          input.type = "radio";
          input.name = `attendance-${termId}-${a.id}`;
          input.value = option.code;
          input.checked = a.status === option.code;
          input.setAttribute(
            "aria-label",
            option.name + " جلسه " + a.session_id,
          );
          input.addEventListener("change", () => {
            if (this.pendingAttendance.has(a.id)) {
              reset();
              return;
            }
            if (option.code !== "present") {
              reset();
              this.edit(a, option.code);
              this.cdr.markForCheck();
            } else void this.quickAttendance(a, option.code, reset);
          });
          const caption = document.createElement("span");
          caption.textContent = option.name;
          label.title = option.name;
          label.append(input, caption);
          radios.append(label);
        }
        wrapper.append(radios, buttons(params));
        return wrapper;
      },
    };
  }
  async quickAttendance(a: Attendance, status: string, reset: () => void) {
    this.pendingAttendance.add(a.id);
    reset();
    this.error = "";
    this.cdr.markForCheck();
    try {
      await this.api.patch("/attendance/" + a.id, {
        version: a.version,
        status,
      });
      this.message = "وضعیت جلسه با موفقیت ثبت شد.";
      await this.load();
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.pendingAttendance.delete(a.id);
      reset();
      this.cdr.markForCheck();
    }
  }
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
                    ...(p.data.duration_minutes ? ['پایان تهران: '+this.date.transform(new Date(Date.parse(p.data.starts_at)+p.data.duration_minutes*60000).toISOString(),'Asia/Tehran',true)] : []),
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
          filterValueGetter: (p) =>
            this.statusCatalog.options.find((o) => o.code === p.data?.status)
              ?.name || "",
          cellRenderer: (p: ICellRendererParams<Attendance>) =>
            p.data
              ? statusCell(
                  p.data.status,
                  p.data.status === "reserved" && this.isPast(p.data.starts_at)
                    ? "نیازمند تعیین وضعیت"
                    : p.data.status==='cancelled' && p.data.cancelled_by==='teacher' && p.data.counts===0 ? 'نیازمند جبرانی' : '',
                  this.statusCatalog.options.find(
                    (o) => o.code === p.data?.status,
                  )?.name,
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
                  [
                    p.data.requested_by || p.data.cancelled_by
                      ? "از طرف: " +
                        this.cancelLabels[
                          p.data.requested_by || p.data.cancelled_by
                        ]
                      : "",
                    p.data.justified == null
                      ? ""
                      : p.data.justified
                        ? "موجه"
                        : "غیرموجه",
                  ].filter(Boolean),
                )
              : "",
        },
        this.attendanceActions(termId),
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
    statusColumn<Payment>('status'),
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
    actionColumn<Payment>(p=>this.api.user()?.admin && p.status==='confirmed' ? [{label:'ابطال دریافت با دلیل',icon:'trash',run:()=>void this.voidPayment(p)}] : []),
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
  weekdays = [
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه",
    "شنبه",
  ];
  scheduleText(row: {
    weekday: number;
    start_time: string;
    duration_minutes: number;
    timezone: string;
  }) {
    const [hour, minute] = row.start_time.split(":").map(Number);
    const total = hour * 60 + minute + row.duration_minutes;
    const end = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    return `${this.weekdays[row.weekday]}، ${row.start_time} تا ${end}، مدت ${row.duration_minutes} دقیقه (${row.timezone})${total >= 1440 ? "، پایان در روز بعد" : ""}`;
  }
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
      this.tab = this.embedded ? this.initialTab : q.get("tab") || "terms";
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
      if(this.api.user()?.admin)this.historyRows=(await this.api.get<{items:any[]}>(`/students/${this.student.id}/workflow-history`)).items;
      if (this.api.user()?.education) await this.statusCatalog.load();
      this.sessionColumnCache.clear();
      this.attendanceColumns = [];
      this.financeTerms = this.student.terms.filter((t) => !!t.invoice);
      this.installmentRows = this.financeTerms.flatMap((t) =>
        (t.invoice?.installments || []).map((row) => ({
          ...row,
          termId: t.id,
          termLabel: t.subject + " • ترم " + t.number,
          currency: t.invoice!.currency,
        })),
      );
      this.tuitionSummaries = ["TOMAN", "USD"].map((currency) => {
        const invoices = this.financeTerms
          .map((t) => t.invoice!)
          .filter((i) => i.currency === currency);
        return {
          currency,
          total: invoices.reduce((n, i) => n + i.total_minor, 0),
          paid: invoices.reduce((n, i) => n + i.allocated_minor, 0),
          balance: invoices.reduce((n, i) => n + i.balance_minor, 0),
          next: this.installmentRows
            .filter((i) => i.currency === currency && i.balance_minor > 0)
            .sort((a, b) => a.due_date.localeCompare(b.due_date))[0],
        };
      });
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
          this.attendanceActions(0),
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
    this.selectedReplacement=0;
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
  edit(a: Attendance, requestedStatus: string | null = null) {
    this.requestedAttendanceStatus = requestedStatus;
    this.action = "attendance";
    this.selectedAttendance = a;
    this.message = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  close() {
    this.requestedAttendanceStatus = null;
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
