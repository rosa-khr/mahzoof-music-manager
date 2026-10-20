import { Switch } from "../shared/switch";
import {
  SessionStatuses,
  DEFAULT_SESSION_STATUSES,
} from "../core/session-statuses";
import { Select2 } from "../shared/select2";
import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { Term, Attendance } from "../core/models";
import { Field, jalaliToday, toIso, toJalali } from "../shared/ui";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-session-form",
  standalone: true,
  imports: [Select2, ReactiveFormsModule, Field],
  template: `<section class="card action-panel">
    <h2>{{ editing ? "ویرایش نوبت رزرو" : "رزرو جلسه" }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="form-grid">
        <app-field
          ><select
            appSelect2
            id="session-term"
            formControlName="termId"
            required
          >
            <option value="">انتخاب کنید</option>
            @for (t of terms; track t.id) {
              <option [value]="t.id">
                {{ t.subject }} • ترم {{ t.number }} • ظرفیت
                {{ t.counters?.schedulable }}
              </option>
            }</select
          ><label for="session-term">ترم مقصد *</label></app-field
        ><app-field
          ><input
            id="session-date"
            formControlName="day"
            required
            placeholder=" "
            dir="ltr"
          /><label for="session-date">تاریخ شمسی جلسه *</label></app-field
        ><app-field
          ><input
            id="session-time"
            formControlName="time"
            required
            type="time"
          /><label for="session-time">ساعت تهران *</label></app-field
        ><app-field
          ><input
            id="session-duration"
            formControlName="durationMinutes"
            type="number"
            min="1"
            placeholder=" "
          /><label for="session-duration"
            >مدت (دقیقه، اختیاری)</label
          ></app-field
        ><app-field
          ><select appSelect2 id="replacement" formControlName="replacementFor">
            <option value="">جلسه مستقل</option>
            @for (s of replacements; track s.session_id) {
              <option [value]="s.session_id">
                جایگزین جلسه شماره {{ s.session_id }}
              </option>
            }</select
          ><label for="replacement">ارتباط با جلسه قبلی</label></app-field
        >
      </div>
      <p class="form-text">
        ورودی ساعت به وقت تهران است؛ با منطقه Asia/Tehran و زمان UTC ذخیره
        می‌شود. تاریخ نمونه: ۱۴۰۵/۰۷/۲۷
      </p>
      @if (error) {
        <p role="alert" class="alert alert-danger">{{ error }}</p>
      }
      <div class="actions">
        <button class="btn btn-primary" [disabled]="busy">
          {{
            busy ? "در حال ثبت…" : editing ? "ذخیره نوبت" : "ثبت رزرو"
          }}</button
        ><button type="button" class="btn btn-light" (click)="cancel.emit()">
          انصراف
        </button>
      </div>
    </form>
  </section>`,
})
export class SessionForm {
  cdr = inject(ChangeDetectorRef);
  key = crypto.randomUUID();
  editing: Attendance | null = null;
  @Input() set reservation(a: Attendance | null) {
    this.editing = a;
    if (a) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(a.starts_at));
      const p = (t: string) => parts.find((x) => x.type === t)!.value;
      this.form.patchValue({
        day: toJalali(`${p("year")}-${p("month")}-${p("day")}`),
        time: `${p("hour")}:${p("minute")}`,
        durationMinutes: a.duration_minutes ? String(a.duration_minutes) : "",
      });
      this.form.controls.termId.disable();
    }
  }
  @Input() terms: Term[] = [];
  @Input() set initialTerm(v: number) {
    if (v) this.form.patchValue({ termId: String(v) });
  }
  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  api = inject(Api);
  fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    termId: ["", Validators.required],
    day: jalaliToday(),
    time: ["", Validators.required],
    durationMinutes: "",
    replacementFor: "",
  });
  busy = false;
  error = "";
  get replacements() {
    return (
      this.terms
        .find((t) => t.id === Number(this.form.controls.termId.value))
        ?.sessions?.filter(
          (s) => s.counts === 0 && ["absent", "cancelled"].includes(s.status),
        ) || []
    );
  }
  async save() {
    if (this.form.invalid || this.busy) {
      this.error = "ترم، تاریخ و ساعت را تکمیل کنید.";
      return;
    }
    this.busy = true;
    this.error = "";
    try {
      const v = this.form.getRawValue();
      const day = toIso(v.day);
      let instant = new Date(day + "T" + v.time + ":00Z");
      for (let i = 0; i < 2; i++) {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tehran",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(instant);
        const p = (t: string) => parts.find((x) => x.type === t)!.value;
        const rendered = Date.parse(
          `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:00Z`,
        );
        instant = new Date(
          instant.getTime() +
            Date.parse(day + "T" + v.time + ":00Z") -
            rendered,
        );
      }
      const body = {
        startsAt: instant.toISOString(),
        timezone: "Asia/Tehran",
        durationMinutes: v.durationMinutes,
        replacementFor: v.replacementFor,
      };
      if (this.editing)
        await this.api.patch(`/sessions/${this.editing.session_id}`, {
          ...body,
          version: this.editing.version,
        });
      else await this.api.post(`/terms/${v.termId}/sessions`, body, this.key);
      this.saved.emit();
    } catch (e) {
      this.error =
        e instanceof Error && !("error" in e) ? e.message : errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-attendance-form",
  standalone: true,
  imports: [Switch, Select2, ReactiveFormsModule, Field],
  template: `<section class="card action-panel">
    <h2>ثبت وضعیت جلسه شماره {{ attendance.id }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="form-grid">
        <app-field
          ><select appSelect2 id="astatus" formControlName="status">
            @for (option of statusOptions; track option.code) {
              <option [value]="option.code">{{ option.name }}</option>
            }</select
          ><label for="astatus">وضعیت جلسه</label></app-field
        >
        @if (form.controls.status.value === "absent") {
          <div>
            <app-switch
              formControlName="counts"
              onValue="yes"
              offValue="no"
              label="اثر غیبت بر سهم *"
              onText="از سهم ترم کم شود"
              [offText]="
                form.controls.counts.value === ''
                  ? 'تعیین نشده'
                  : 'از سهم ترم کم نشود'
              "
            />
            @if (form.controls.counts.value === "") {
              <p class="form-text">
                محاسبه شدن یا نشدن غیبت را صریحاً مشخص کنید.
              </p>
              <button
                type="button"
                class="btn btn-sm btn-light switch-confirm"
                (click)="form.controls.counts.setValue('no')"
              >
                تأیید بدون کسر سهم
              </button>
            }
          </div>
        }
        @if (form.controls.status.value === "cancelled") {
          <app-field
            ><select appSelect2 id="acancel" formControlName="cancelledBy">
              <option value="">انتخاب کنید</option>
              <option value="teacher">مدرس</option>
              <option value="student">هنرجو</option>
              <option value="academy">آموزشگاه</option>
              <option value="other">سایر</option></select
            ><label for="acancel">لغوکننده *</label></app-field
          >
        }
        <app-field>
          <textarea
            id="areason"
            formControlName="reason"
            placeholder=" "
          ></textarea
          ><label for="areason"
            >دلیل (برای غیبت و کنسلی الزامی)</label
          ></app-field
        >
      </div>
      <p class="form-text">
        حاضر یک جلسه، رزرو و کنسلی صفر جلسه مصرف می‌کنند. تغییرات با سابقه ثبت
        می‌شوند.
      </p>
      @if (error) {
        <p role="alert" class="alert alert-danger">{{ error }}</p>
      }
      <div class="actions">
        <button class="btn btn-primary" [disabled]="busy">
          {{ busy ? "در حال ثبت…" : "تأیید وضعیت" }}</button
        ><button type="button" class="btn btn-light" (click)="cancel.emit()">
          انصراف
        </button>
      </div>
    </form>
  </section>`,
})
export class AttendanceForm {
  catalog = inject(SessionStatuses);
  statusOptions = DEFAULT_SESSION_STATUSES;
  @Input() initialStatus: string | null = null;
  cdr = inject(ChangeDetectorRef);
  @Input({ required: true }) attendance!: Attendance;
  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  api = inject(Api);
  fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    status: "present",
    counts: "",
    reason: "",
    cancelledBy: "",
  });
  busy = false;
  error = "";
  async ngOnInit() {
    this.form.patchValue({
      status: this.initialStatus || this.attendance.status,
      reason: this.attendance.reason,
      cancelledBy: this.attendance.cancelled_by,
      counts:
        this.attendance.status === "absent"
          ? this.attendance.counts
            ? "yes"
            : "no"
          : "",
    });
    try {
      this.statusOptions = await this.catalog.load();
    } catch (e) {
      this.error = errorMessage(e);
    }
    this.cdr.markForCheck();
  }
  async save() {
    if (this.busy) return;
    const v = this.form.getRawValue();
    if (v.status === "absent" && (!v.counts || !v.reason.trim())) {
      this.error = "اثر غیبت و دلیل را مشخص کنید.";
      return;
    }
    this.busy = true;
    this.error = "";
    try {
      await this.api.patch(`/attendance/${this.attendance.id}`, {
        ...v,
        version: this.attendance.version,
        ...(v.status === "absent" ? { counts: v.counts === "yes" } : {}),
      });
      this.saved.emit();
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
