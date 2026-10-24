import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { proposeSessions, endTime } from '../../../shared/class-time.js';
import { Switch } from '../shared/switch';
import { Select2 } from "../shared/select2";
import { Api, errorMessage } from "../core/api";
import { Student, Term } from "../core/models";
import { Field, Money, jalaliToday, toIso, toJalali } from "../shared/ui";
import { Datepicker } from "../shared/datepicker";
import { weeklyTermEnd } from "../shared/jalali-date";
import {
  EducationFields,
  EducationOptions,
  educationControls,
  emptyEducationOptions,
} from "../shared/education-fields";

const digits = (v: string) =>
  v
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
function minor(value: string, currency: string) {
  const v = digits(value);
  if (!(currency === "USD" ? /^\d+(\.\d{1,2})?$/ : /^\d+$/).test(v)) return NaN;
  const [whole, fraction = ""] = v.split(".");
  return (
    Number(whole) * (currency === "USD" ? 100 : 1) +
    (currency === "USD" ? Number(fraction.padEnd(2, "0")) : 0)
  );
}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-term-form",
  standalone: true,
  imports: [
    Select2,
    ReactiveFormsModule,
    Field,
    Money,
    EducationFields,
    Datepicker,
    Switch,
  ],
  template: `<section class="card action-panel">
    <h2>{{ old ? "تمدید ترم" : "ترم جدید" }}</h2>
    <nav class="tabs" aria-label="مراحل ثبت ترم">
      @for (label of steps; track $index) {
        <button
          type="button"
          [class.active]="step === $index"
          (click)="go($index)"
        >
          {{ $index + 1 }}. {{ label }}
        </button>
      }
    </nav>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div [hidden]="step !== 0">
        <app-education-fields
          [group]="form"
          [options]="options"
          [paymentRequired]="false"
        />
        <div class="form-grid">
          <app-field
            ><select id="term-structure" appSelect2 formControlName="structure">
              <option value="private">خصوصی</option>
              <option value="group">گروهی</option></select
            ><label for="term-structure">نوع کلاس *</label></app-field
          >
        </div>
        @if (form.controls.structure.value === 'group') {
          <app-field><select appSelect2 id="shared-group" formControlName="groupTermId" (change)="groupChanged()"><option value="">کلاس گروهی جدید</option>@for(group of groups;track group.id){<option [value]="group.id">{{group.subject}} • {{group.teacher}} • گروه {{group.term_id}}</option>}</select><label for="shared-group">کلاس مشترک</label></app-field>
          <p class="form-text">در انتخاب گروه موجود، برنامه مشترک خوانده می‌شود؛ وضعیت حضور و شهریه هر عضو مستقل می‌ماند.</p>
        }
        @if (old) {
          <p class="form-text">
            {{ old.subject }} • ترم قبلی {{ old.number }}؛ جلسات و دریافت‌های
            قبلی کپی نمی‌شوند.
          </p>
        }
      </div>
      <div [hidden]="step !== 1" class="form-grid">
        <app-field
          ><input
            id="quota"
            formControlName="quota"
            inputmode="numeric"
            required
          /><label for="quota">تعداد جلسات *</label></app-field
        >
        <app-field
          ><input
            id="duration"
            formControlName="durationMinutes"
            inputmode="numeric"
          /><label for="duration">مدت جلسه (دقیقه)</label></app-field
        >
        <app-field
          ><input
            id="registered"
            appDatepicker
            formControlName="registeredOn"
            required
            dir="ltr"
          /><label for="registered">تاریخ ثبت‌نام شمسی *</label></app-field
        >
        <app-field
          ><input
            id="start"
            appDatepicker
            formControlName="startDate"
            dir="ltr"
          /><label for="start">تاریخ اولین جلسه *</label></app-field
        >
        <app-field
          ><input
            id="end"
            appDatepicker
            formControlName="endDate"
            dir="ltr"
          /><label for="end">پایان شمسی</label></app-field
        >
      </div>
      @if (step === 1) {
        <p class="form-text">
          تاریخ شروع، جلسه اول است. تاریخ همه جلسات بر اساس برنامه هفتگی ساخته
          می‌شود و پس از تأیید شما مستقیماً در جدول حضور و غیاب قرار می‌گیرد.
        </p>
        @if (endManuallyEdited && endSuggestion) {
          <button
            type="button"
            class="btn btn-light btn-sm"
            (click)="resetEndSuggestion()"
          >
            استفاده از پایان پیشنهادی {{ endSuggestion }}
          </button>
        }
        <h3>برنامه کلاس</h3>
        <p class="form-text">روز، ساعت و مدت کلاس را برای ساخت ردیف‌های جلسات مشخص کنید.</p>
        <div formArrayName="schedules">
          @for (row of form.controls.schedules.controls; track row; let i = $index) {
            <div class="form-grid" [formGroupName]="i">
              <app-field
                ><select appSelect2 [id]="'schedule-day-' + i" formControlName="weekday">
                  @for (day of weekdays; track day.value) {
                    <option [value]="day.value">{{ day.label }}</option>
                  }</select
                ><label [for]="'schedule-day-' + i">روز هفته</label></app-field
              >
              <app-field
                ><input [id]="'schedule-time-' + i" type="time" formControlName="startTime" dir="ltr" />
                <label [for]="'schedule-time-' + i">ساعت شروع</label></app-field
              >
              <app-field
                ><input [id]="'schedule-duration-' + i" inputmode="numeric" formControlName="durationMinutes" />
                <label [for]="'schedule-duration-' + i">مدت (دقیقه)</label></app-field
              >
              <app-field
                ><input [id]="'schedule-zone-' + i" formControlName="timezone" dir="ltr" />
                <label [for]="'schedule-zone-' + i">منطقه زمانی</label></app-field
              >
              <span>پایان: {{ endTime(row.controls.startTime.value, row.controls.durationMinutes.value) }}</span>
              <button type="button" class="btn btn-light btn-sm" [disabled]="!!form.controls.groupTermId.value" (click)="removeSchedule(i)">حذف نوبت</button>
            </div>
          }
        </div>
        @if (!form.controls.groupTermId.value) { <button type="button" class="btn btn-light btn-sm" (click)="addSchedule()">افزودن نوبت هفتگی</button> }
        @if (sessionSuggestions.length && !form.controls.groupTermId.value) {
          <div class="schedule-suggestions">
            <h3>جلساتی که در جدول حضور و غیاب ثبت می‌شوند</h3>
            <ol>@for (item of sessionSuggestions; track item) { <li>{{ item }}</li> }</ol>
            <p class="form-text">تاریخ‌ها را بررسی کنید؛ ثبت آن‌ها بدون تأیید شما انجام نمی‌شود.</p>
            <app-switch formControlName="reserveProposed" label="تاریخ جلسات را بررسی کردم؛ همه همراه ترم در جدول ثبت شوند *" />
          </div>
        }
      }
      <section [hidden]="step !== 2">
        <div class="form-grid">
            <app-field
              ><select id="currency" appSelect2 formControlName="currency">
                <option value="TOMAN">تومان (ریالی)</option>
                <option value="USD">دلار (ارزی)</option></select
              ><label for="currency">واحد پول *</label></app-field
            >
            <app-field
              ><input
                id="base-rate"
                formControlName="baseRate"
                inputmode="decimal"
                dir="ltr"
                [readOnly]="!api.user()?.admin"
              /><label for="base-rate">نرخ پایه یک جلسه ۳۰ دقیقه‌ای *</label></app-field
            >
            @if (api.user()?.admin) {
              <app-field
                ><select id="discount-type" appSelect2 formControlName="discountType" (change)="discountChanged()">
                  <option value="none">بدون تخفیف</option>
                  <option value="percent">درصدی</option>
                  <option value="fixed">مبلغ ثابت</option></select
                ><label for="discount-type">نوع تخفیف</label></app-field
              >
              @if (form.controls.discountType.value === "percent") {
                <app-field><input id="discount-percent" formControlName="discountPercent" inputmode="numeric" dir="ltr" /><label for="discount-percent">درصد تخفیف</label></app-field>
              }
              @if (form.controls.discountType.value === "fixed") {
                <app-field><input id="discount-amount" formControlName="discountAmount" inputmode="decimal" dir="ltr" /><label for="discount-amount">مبلغ تخفیف</label></app-field>
              }
            }
              <app-field
                ><input
                  id="due"
                  appDatepicker
                  formControlName="dueDate"
                  dir="ltr"
                /><label for="due">سررسید شمسی</label></app-field
              >
          <app-field>
            <textarea id="treason" formControlName="reason"></textarea
            ><label for="treason">{{
              net === 0 ? "دلیل شهریه صفر *" : "دلیل تخفیف یا نرخ اختصاصی"
            }}</label></app-field
          >
        </div>
        <dl class="details">
          <dt>شهریه قبل از تخفیف</dt><dd>{{ gross | money: form.controls.currency.value }}</dd>
          <dt>مبلغ کسرشده</dt><dd>{{ discountMinor | money: form.controls.currency.value }}</dd>
          <dt>شهریه نهایی</dt><dd>{{ net | money: form.controls.currency.value }}</dd>
        </dl>
        @if (net === 0 && api.user()?.admin) {
          <app-switch formControlName="confirmZero" label="شهریه صفر این ترم را تأیید می‌کنم" />
        }
      </section>
      @if (step === 3) {
        <dl class="details">
          <dt>ساز و مدرس</dt>
          <dd>
            {{ name("instruments", form.controls.instrumentId.value) }} •
            {{ name("instructors", form.controls.instructorId.value) }}
          </dd>
          <dt>برگزاری</dt>
          <dd>
            {{ deliveryName }} •
            {{
              form.controls.mode.value === "onsite"
                ? name("academies", form.controls.academyId.value)
                : "آنلاین"
            }}
          </dd>
          <dt>جلسات</dt>
          <dd>
            {{ form.controls.quota.value }} جلسه •
            {{ form.controls.durationMinutes.value || "مدت تعیین نشده" }}
          </dd>
          @if (!form.controls.groupTermId.value) {
            <dt>ثبت در حضور و غیاب</dt>
            <dd>{{ proposed.length }} جلسه تأییدشده</dd>
          }
          <dt>تخفیف</dt>
          <dd>{{ discountLabel }}</dd>
          <dt>شهریه نهایی</dt>
          <dd>{{ net | money: form.controls.currency.value }}</dd>
          @if (old?.invoice; as invoice) {
            <dt>مانده ترم قبل</dt>
            <dd>{{ invoice.balance_minor | money: invoice.currency }}</dd>
          }
        </dl>
        <p class="form-text">
          پس از تأیید، ترم و تعهد شهریه ثبت می‌شوند؛ دریافت پول جداگانه ثبت
          خواهد شد.
        </p>
      }
      @if (error) {
        <p class="alert alert-danger" role="alert">{{ error }}</p>
      }
      <div class="actions">
        @if (step > 0) {
          <button type="button" class="btn btn-light" (click)="step = step - 1">
            مرحله قبل
          </button>
        }
        <button class="btn btn-primary" [disabled]="busy">
          {{ busy ? "در حال ثبت…" : step === 3 ? "تأیید و ثبت ترم" : "ادامه" }}
        </button>
        <button type="button" class="btn btn-light" (click)="cancel.emit()">
          انصراف
        </button>
      </div>
    </form>
  </section>`,
})
export class TermForm implements OnInit, OnDestroy {
  @Input() studentId = 0;
  @Input() old: Term | null = null;
  @Input() defaults: Student["education_preferences"] = null;
  @Input() enrollments: Student['enrollments'] = [];
  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  api = inject(Api);
  fb = inject(FormBuilder);
  cdr = inject(ChangeDetectorRef);
  options = emptyEducationOptions();
  steps = ["آموزش", "جلسات", "شهریه", "بررسی نهایی"];
  weekdays = [
    { value: "6", label: "شنبه" },
    { value: "0", label: "یکشنبه" },
    { value: "1", label: "دوشنبه" },
    { value: "2", label: "سه‌شنبه" },
    { value: "3", label: "چهارشنبه" },
    { value: "4", label: "پنجشنبه" },
    { value: "5", label: "جمعه" },
  ];
  step = 0;
  busy = false;
  endTime = endTime;
  key = crypto.randomUUID();
  groups: any[] = [];
  private submitted = '';
  error = "";
  subscription = new Subscription();
  endSuggestion = "";
  endManuallyEdited = false;
  form = this.fb.nonNullable.group({
    ...educationControls(),
    structure: "private",
    groupTermId: '',
    quota: "4",
    durationMinutes: "30",
    currency: "TOMAN",
    baseRate: "",
    discountType: "none",
    discountPercent: "",
    discountAmount: "",
    reason: "",
    registeredOn: jalaliToday(),
    startDate: "",
    endDate: "",
    dueDate: "",
    confirmZero: false,
    reserveProposed: false,
    installments: this.fb.array<ReturnType<typeof this.installment>>([]),
    schedules: this.fb.array<ReturnType<typeof this.scheduleRow>>([]),
  });
  installment() {
    return this.fb.nonNullable.group({ amount: "", dueDate: "" });
  }
  scheduleRow() {
    return this.fb.nonNullable.group({
      weekday: "6",
      startTime: "",
      durationMinutes: "30",
      timezone: "Asia/Tehran",
    });
  }
  addSchedule() {
    this.form.controls.schedules.push(this.scheduleRow());
  }
  removeSchedule(index: number) {
    this.form.controls.schedules.removeAt(index);
  }
  get sessionSuggestions() {
    const rows = this.form.controls.schedules.getRawValue().filter((r) => r.startTime);
    if (!rows.length || !this.form.controls.startDate.value) return [];
    let iso: string;
    try { iso = toIso(this.form.controls.startDate.value); } catch { return []; }
    const quota = Number(digits(this.form.controls.quota.value));
    if (!Number.isInteger(quota) || quota < 1) return [];
    const start = new Date(`${iso}T00:00:00Z`), found: { date: string; time: string; zone: string }[] = [];
    for (let offset = 0; offset < 370 && found.length < quota; offset++) {
      const day = new Date(start); day.setUTCDate(start.getUTCDate() + offset);
      for (const row of rows.filter((r) => Number(r.weekday) === day.getUTCDay()))
        found.push({ date: day.toISOString().slice(0, 10), time: row.startTime, zone: row.timezone });
      found.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    }
    return found.slice(0, quota).map((item) => `${toJalali(item.date)}، ${item.time} (${item.zone})`);
  }
  get proposed() {
    const value = this.form.getRawValue();
    if (!value.startDate) return [];
    return proposeSessions(toIso(value.startDate), Number(digits(value.quota)), value.schedules.filter(r=>r.startTime));
  }
  get method() {
    return this.options.paymentMethods.find(
      (m) => m.id === Number(this.form.controls.paymentMethodId.value),
    );
  }
  get rateMinor() {
    const entered = this.form.controls.baseRate.value;
    if (entered) return minor(entered, this.form.controls.currency.value);
    const instrument = this.options.instruments.find(
      (item) => item.id === Number(this.form.controls.instrumentId.value),
    );
    return this.form.controls.currency.value === "USD"
      ? instrument?.rate_usd_cents_30 ?? NaN
      : instrument?.rate_toman_30 ?? NaN;
  }
  get gross() {
    const rate=this.rateMinor,duration=Number(digits(this.form.controls.durationMinutes.value||'30')),quota=Number(digits(this.form.controls.quota.value||'4'));
    if(![rate,duration,quota].every(Number.isSafeInteger))return NaN;
    return Number((BigInt(rate)*BigInt(duration)*BigInt(quota)+15n)/30n);
  }
  get discountMinor() {
    if (this.form.controls.discountType.value === "percent")
      {const rate=this.rateMinor,duration=Number(digits(this.form.controls.durationMinutes.value||'30')),quota=Number(digits(this.form.controls.quota.value||'4')),percent=Number(digits(this.form.controls.discountPercent.value||'0'));
       if(![rate,duration,quota].every(Number.isSafeInteger)||!Number.isFinite(percent)||percent<0||percent>100)return NaN;
       return this.gross-Number((BigInt(rate)*BigInt(duration)*BigInt(quota)*BigInt(10000-Math.round(percent*100))+150000n)/300000n);}
    if (this.form.controls.discountType.value === "fixed")
      return minor(
        this.form.controls.discountAmount.value || "0",
        this.form.controls.currency.value,
      );
    return 0;
  }
  get net() {
    return this.gross - this.discountMinor;
  }
  get discountLabel() {
    const type = this.form.controls.discountType.value;
    return type === "none"
      ? "بدون تخفیف"
      : type === "percent"
        ? `${this.form.controls.discountPercent.value || 0} درصد`
        : "مبلغ ثابت";
  }
  discountChanged() {
    this.form.controls.discountPercent.setValue("");
    this.form.controls.discountAmount.setValue("");
  }
  name(key: "instruments" | "instructors" | "academies", id: string) {
    return (
      this.options[key].find((r) => r.id === Number(id))?.name || "انتخاب نشده"
    );
  }
  get deliveryName() {
    return (
      this.options.teachingTypes.find(
        (item) => item.id === Number(this.form.controls.teachingTypeId.value),
      )?.name || ""
    );
  }
  async ngOnInit() {
    this.subscription.add(
      this.form.controls.startDate.valueChanges.subscribe(() =>
        this.updateEndSuggestion(),
      ),
    );
    this.subscription.add(
      this.form.controls.quota.valueChanges.subscribe(() =>
        this.updateEndSuggestion(),
      ),
    );
    this.subscription.add(
      this.form.controls.endDate.valueChanges.subscribe((value) => {
        try {
          this.endManuallyEdited =
            !!value && toIso(value) !== toIso(this.endSuggestion);
        } catch {
          this.endManuallyEdited = !!value;
        }
      }),
    );
    try {
      this.options = await this.api.get<EducationOptions>(
        "/students/education-options",
      );
      this.groups = (await this.api.get<{items:any[]}>('/students/group-options')).items;
      const d = this.defaults,
        t = this.old;
      if (d || t)
        this.form.patchValue({
          instrumentId: String(t?.instrument_id || d?.instrument_id || ""),
          instructorId: String(t?.instructor_id || d?.instructor_id || ""),
          teachingTypeId: String(
            t?.teaching_type_id || d?.teaching_type_id || "",
          ),
          academyId: String(t?.academy_id || d?.academy_id || ""),
          paymentMethodId: String(
            t?.invoice?.payment_method_id || d?.payment_method_id || "",
          ),
          quota: String(t?.quota || 4),
          durationMinutes: t?.duration_minutes
            ? String(t.duration_minutes)
            : "30",
          baseRate: t?.base_rate_minor_30 != null
            ? String(
                t.base_rate_minor_30 /
                  (t.invoice?.currency === "USD" ? 100 : 1),
              )
            : "",
          currency: t?.invoice?.currency || "TOMAN",
          discountType: "none",
        });
      if (t?.instrument_id) this.form.controls.instrumentId.disable();
      if (!this.form.controls.instrumentId.value && this.enrollments.length === 1) {
        this.form.controls.instrumentId.setValue(String(this.enrollments[0].instrument_id || ''));
      }
      this.applyDefaults();
      this.subscription.add(this.form.controls.instrumentId.valueChanges.subscribe(()=>this.applyDefaults()));
      this.subscription.add(this.form.controls.currency.valueChanges.subscribe(()=>this.fillRate()));
      this.subscription.add(this.form.controls.structure.valueChanges.subscribe(value=>{if(value!=='group' && this.form.controls.groupTermId.value){this.form.controls.groupTermId.setValue('');this.groupChanged();}}));
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.cdr.markForCheck();
    }
  }
  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
  applyDefaults() {
    const enrollment = this.enrollments.find(e=>e.instrument_id===Number(this.form.controls.instrumentId.value));
    const settings = enrollment?.settings;
    const defaultTeacher = this.options.instructors.find(i=>i.instrument_ids.includes(Number(this.form.controls.instrumentId.value)) && i.name.trim()==='شهرام محذوف');
    this.form.patchValue({
      instructorId: String(this.old?.instructor_id || settings?.['instructor_id'] || this.form.controls.instructorId.value || defaultTeacher?.id || ''),
      teachingTypeId: String(this.old?.teaching_type_id || settings?.['teaching_type_id'] || this.form.controls.teachingTypeId.value || ''),
      academyId: String(this.old?.academy_id || settings?.['academy_id'] || this.form.controls.academyId.value || ''),
      durationMinutes: String(settings?.['duration_minutes'] || this.old?.duration_minutes || 30),
    });
    const rows = this.old?.schedules || enrollment?.schedules || [];
    this.form.controls.schedules.clear();
    for (const row of rows) {
      const control = this.scheduleRow();
      control.patchValue({weekday:String(row.weekday),startTime:row.start_time,durationMinutes:String(row.duration_minutes),timezone:row.timezone});
      this.form.controls.schedules.push(control);
    }
    this.fillRate();
  }
  groupChanged() {
    const group=this.groups.find(g=>g.id===Number(this.form.controls.groupTermId.value));
    const keys=['instrumentId','instructorId','teachingTypeId','academyId','durationMinutes','startDate','endDate'] as const;
    if(group) {
      this.form.patchValue({structure:'group',instrumentId:String(group.instrument_id),instructorId:String(group.instructor_id),teachingTypeId:String(group.teaching_type_id),academyId:String(group.academy_id||''),durationMinutes:String(group.duration_minutes),quota:String(group.quota),startDate:toJalali(group.start_date),endDate:toJalali(group.end_date),reserveProposed:false},{emitEvent:false});
      this.form.controls.schedules.clear();for(const row of group.schedules){const control=this.scheduleRow();control.patchValue({weekday:String(row.weekday),startTime:row.start_time,durationMinutes:String(row.duration_minutes),timezone:row.timezone});this.form.controls.schedules.push(control);}
      for(const key of keys)this.form.controls[key].disable();this.form.controls.schedules.disable();this.fillRate();
    }else{for(const key of keys)this.form.controls[key].enable();this.form.controls.schedules.enable();if(this.old?.instrument_id)this.form.controls.instrumentId.disable();}
  }
  fillRate() {
    const instrument = this.options.instruments.find(i=>i.id===Number(this.form.controls.instrumentId.value));
    const enrollment = this.enrollments.find(e=>e.instrument_id===instrument?.id);
    const usd = this.form.controls.currency.value === 'USD';
    const specific = enrollment?.settings?.[usd?'rate_usd_cents_30':'rate_toman_30'];
    const rate = specific ?? (usd?instrument?.rate_usd_cents_30:instrument?.rate_toman_30);
    this.form.controls.baseRate.setValue(rate==null?'':String(Number(rate)/(usd?100:1)));
  }
  private updateEndSuggestion() {
    try {
      this.endSuggestion = weeklyTermEnd(
        this.form.controls.startDate.value,
        this.form.controls.quota.value,
      );
    } catch {
      this.endSuggestion = "";
    }
    if (!this.endManuallyEdited)
      this.form.controls.endDate.setValue(this.endSuggestion, {
        emitEvent: false,
      });
  }
  resetEndSuggestion() {
    this.endManuallyEdited = false;
    this.updateEndSuggestion();
  }
  syncPlan() {
    const method = this.method,
      rows = this.form.controls.installments;
    const n =
      method?.settlement_type === "installment"
        ? method.installment_count || 0
        : 0;
    while (rows.length < n) rows.push(this.installment());
    while (rows.length > n) rows.removeAt(rows.length - 1);
    if (method?.payment_currency)
      this.form.controls.currency.setValue(
        method.payment_currency === "rial" ? "TOMAN" : "USD",
      );
  }
  split() {
    const n = this.form.controls.installments.length,
      total = this.net;
    if (!n || !Number.isSafeInteger(total) || total < n) {
      this.error = "ابتدا مبلغ شهریه و تخفیف را درست وارد کنید.";
      return;
    }
    const base = Math.floor(total / n),
      factor = this.form.controls.currency.value === "USD" ? 100 : 1;
    this.form.controls.installments.controls.forEach((r, i) =>
      r.controls.amount.setValue(
        String((base + (i < total % n ? 1 : 0)) / factor),
      ),
    );
  }
  validate(stage: number) {
    const v = this.form.getRawValue();
    if (
      stage === 0 &&
      (!v.instrumentId ||
        !v.instructorId ||
        !v.teachingTypeId ||
        !v.mode ||
        (v.mode === "onsite" && !v.academyId))
    )
      throw Error(
        "ساز، مدرس، شیوه برگزاری و آموزشگاه حضوری را مشخص کنید.",
      );
    if (stage === 1) {
      if (
        !Number.isInteger(Number(digits(v.quota))) ||
        Number(digits(v.quota)) < 1
      )
        throw Error("تعداد جلسات را وارد کنید.");
      toIso(v.registeredOn);
      if (!v.registeredOn) throw Error("تاریخ ثبت‌نام را مشخص کنید.");
      if (!v.startDate) throw Error("تاریخ اولین جلسه را مشخص کنید.");
      if (!v.groupTermId && !v.schedules.some((row) => !!row.startTime))
        throw Error("روز و ساعت برنامه کلاس را مشخص کنید.");
      const start = toIso(v.startDate),
        end = toIso(v.endDate);
      if (start && end && end < start)
        throw Error("پایان ترم نمی‌تواند قبل از شروع باشد.");
      if (!v.groupTermId && this.proposed.length !== Number(digits(v.quota)))
        throw Error("تاریخ همه جلسات قابل محاسبه نیست؛ برنامه کلاس را بررسی کنید.");
      if (!v.groupTermId && !v.reserveProposed)
        throw Error("برای ثبت ترم، تاریخ جلسات را بازبینی و تأیید کنید.");
    }
    if (stage === 2) {
      if (
        !Number.isSafeInteger(this.net) ||
        !Number.isSafeInteger(this.gross) ||
        this.gross < 0 ||
        this.net < 0
      )
        throw Error("نرخ پایه، مدت، تعداد جلسات و تخفیف را بررسی کنید.");
      if (
        v.discountType === "percent" &&
        (!/^\d+(\.\d{1,2})?$/.test(digits(v.discountPercent)) ||
          Number(digits(v.discountPercent)) < 0 ||
          Number(digits(v.discountPercent)) > 100)
      )
        throw Error("درصد تخفیف باید بین صفر تا صد باشد.");
      if (
        (this.net === 0 || v.discountType !== "none") &&
        !v.reason.trim()
      )
        throw Error("دلیل تخفیف یا بدون شهریه را وارد کنید.");
      if (this.net === 0 && (!this.api.user()?.admin || !v.confirmZero)) throw Error('شهریه صفر نیازمند تأیید مدیر است.');
    }
  }
  go(next: number) {
    this.error = "";
    try {
      if (next > this.step)
        for (let i = this.step; i < next; i++) this.validate(i);
      this.step = next;
    } catch (e) {
      this.error = (e as Error).message;
    }
  }
  async save() {
    if (this.busy) return;
    if (this.step < 3) {
      this.go(this.step + 1);
      return;
    }
    this.error = "";
    try {
      for (let i = 0; i < 3; i++) this.validate(i);
      this.busy = true;
      const v = this.form.getRawValue();
      const body = {
          ...v,
          baseRate: digits(v.baseRate),
          discountPercent: digits(v.discountPercent),
          discountAmount: digits(v.discountAmount),
          registeredOn: toIso(v.registeredOn),
          startDate: toIso(v.startDate),
          endDate: toIso(v.endDate),
          dueDate: toIso(v.dueDate),
          schedules: v.schedules.filter(r=>!!r.startTime).map(r=>({...r,weekday:digits(r.weekday),durationMinutes:digits(r.durationMinutes)})),
          proposedSessions: v.reserveProposed ? this.proposed : [],
      };
      const fingerprint = JSON.stringify(body);
      if(this.submitted && this.submitted !== fingerprint) throw Error('درخواست قبلی نتیجه قطعی ندارد؛ همان اطلاعات را دوباره ارسال کنید یا پرونده را بررسی کنید.');
      this.submitted = fingerprint;
      await this.api.post(
        this.old
          ? "/terms/" + this.old.id + "/renew"
          : "/students/" + this.studentId + "/terms",
        body, this.key,
      );
      this.saved.emit();
    } catch (e) {
      this.error =
        e instanceof Error && !("error" in e) ? e.message : errorMessage(e);
      const status = (e as {status?:number}).status;
      if(status && status<500 && status!==409) this.submitted='';
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
