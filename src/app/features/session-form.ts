import { Switch } from "../shared/switch";
import { localToInstant } from '../../../shared/class-time.js';
import { Datepicker } from "../shared/datepicker";
import { SessionReason, reasonControls } from "../shared/session-reason";
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
  imports: [Select2, ReactiveFormsModule, Field, SessionReason, Datepicker, Switch],
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
            appDatepicker
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
          /><label for="session-time">ساعت شروع در منطقه انتخابی *</label></app-field
        ><app-field><input id="session-zone" formControlName="timezone" dir="ltr" /><label for="session-zone">منطقه زمانی IANA *</label></app-field
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
      @if (selected?.workflow_version !== 3) { <app-session-reason [group]="form" /> }
      @if ((editing?.group_members?.length || 0) > 1) {
        <p class="alert alert-warning">این جلسه بین اعضای زیر مشترک است. تغییر زمان برای همه اعمال می‌شود.</p>
        <p>@for(member of editing!.group_members!;track member.id){<span class="chip">{{member.first_name}} {{member.last_name}}</span>}</p>
        <app-switch formControlName="confirmGroup" label="اعضای متأثر را بازبینی کردم و تغییر مشترک را تأیید می‌کنم" />
      }
      <p class="form-text">
        ساعت در منطقه زمانی انتخاب‌شده ثبت می‌شود. ساعت تهران و هنرجو در جدول جلسات نمایش داده می‌شود.
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
        timeZone: a.timezone,
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
        timezone: a.timezone,
        durationMinutes: a.duration_minutes ? String(a.duration_minutes) : "",
        reason: a.reason,
        requestedBy: a.requested_by || a.cancelled_by || "",
        justified: a.justified == null ? "" : a.justified ? "yes" : "no",
      });
      this.form.controls.termId.disable();
    }
  }
  @Input() terms: Term[] = [];
  @Input() set replacementFor(value:number){this.form.controls.replacementFor.setValue(value?String(value):'');}
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
    timezone: 'Asia/Tehran',
    confirmGroup: false,
    replacementFor: "",
    ...reasonControls(),
  });
  busy = false;
  error = "";
  get selected() { return this.terms.find(t=>t.id===Number(this.form.controls.termId.value)); }
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
      const instant = localToInstant(day, v.time, v.timezone);
      const body = {
        confirmGroup:v.confirmGroup,
        attendanceId:this.editing?.id,
        groupVersions:this.editing?.group_members?.map(m=>({id:m.id,version:m.version})),
        reason: v.reason,
        requestedBy: v.requestedBy,
        justified: v.justified === "yes",
        startsAt: instant,
        timezone: v.timezone,
        durationMinutes: v.durationMinutes || this.selected?.duration_minutes,
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
  imports: [Switch, Select2, ReactiveFormsModule, Field, SessionReason],
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
        @if ((form.controls.status.value === "absent" && !simplified) || (form.controls.status.value === 'cancelled' && simplified && form.controls.requestedBy.value === 'student')) {
          <div>
            <app-switch
              formControlName="counts"
              onValue="yes"
              offValue="no"
              label="کسر سهم جلسه *"
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
      </div>
      @if (form.controls.status.value !== "present") {
        @if (!simplified) { <app-session-reason [group]="form" /> }
        @else {
          @if (form.controls.status.value === 'cancelled') {
            <app-field><select appSelect2 id="cancel-actor" formControlName="requestedBy"><option value="">انتخاب کنید</option><option value="teacher">مدرس</option><option value="student">هنرجو</option><option value="academy">آموزشگاه</option><option value="other">سایر</option></select><label for="cancel-actor">عامل کنسلی *</label></app-field>
          }
          @if (form.controls.status.value !== 'reserved') {
            <app-field><textarea id="attendance-reason" formControlName="reason"></textarea><label for="attendance-reason">توضیحات *</label></app-field>
          }
          @if (form.controls.status.value === 'absent') { <p>غیبت یک جلسه محسوب می‌شود و جبرانی ندارد.</p> }
        }
      }
      <p class="form-text">
        رزرو مصرف ندارد. لغو مدرس بدون کسر سهم و نیازمند جبرانی است. تغییرات با سابقه ثبت می‌شوند.
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
  get simplified() { return (this.attendance.workflow_version || 1) >= 3; }
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
    cancelledBy: "",
    ...reasonControls(),
  });
  busy = false;
  error = "";
  async ngOnInit() {
    const changedStatus =
      !!this.initialStatus && this.initialStatus !== this.attendance.status;
    this.form.patchValue({
      status: this.initialStatus || this.attendance.status,
      reason: changedStatus ? "" : this.attendance.reason,
      cancelledBy: this.attendance.cancelled_by,
      requestedBy: changedStatus
        ? ""
        : this.attendance.requested_by || this.attendance.cancelled_by || "",
      justified: changedStatus
        ? ""
        : this.attendance.justified == null
          ? ""
          : this.attendance.justified
            ? "yes"
            : "no",
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
    if (
      !this.simplified && v.status !== "present" &&
      (!v.reason.trim() || !v.requestedBy || !v.justified)
    ) {
      this.error = "شخص درخواست‌کننده، وضعیت دلیل و توضیح را مشخص کنید.";
      return;
    }
    if (v.status === "absent" && ((!this.simplified && !v.counts) || !v.reason.trim())) {
      this.error = "اثر غیبت و دلیل را مشخص کنید.";
      return;
    }
    if (this.simplified && v.status==='cancelled' && (!v.requestedBy || !v.reason.trim() || (v.requestedBy==='student' && !v.counts))) { this.error='عامل کنسلی، توضیح و تصمیم کسر سهم هنرجو را مشخص کنید.'; return; }
    this.busy = true;
    this.error = "";
    try {
      await this.api.patch(`/attendance/${this.attendance.id}`, {
        ...v,
        cancelledBy: v.status === "cancelled" ? v.requestedBy : "",
        justified: v.status === "present" ? undefined : v.justified === "yes",
        version: this.attendance.version,
        ...(['absent','cancelled'].includes(v.status) ? { counts: this.simplified && v.status==='absent' ? true : v.counts === "yes" } : {}),
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
