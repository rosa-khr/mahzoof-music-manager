import { Select2 } from "../shared/select2";
import {
  Component,
  inject,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { Subject, Term } from "../core/models";
import { Field, jalaliToday, toIso } from "../shared/ui";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-term-form",
  standalone: true,
  imports: [Select2, ReactiveFormsModule, Field],
  template: `<section class="card action-panel">
    <h2>{{ old ? "تمدید با مشخصات همین ترم" : "ترم خصوصی جدید" }}</h2>
    <p class="text-secondary">
      مشخصات قابل ویرایش‌اند. پرداخت‌ها و جلسات ترم قبل کپی نمی‌شوند.
    </p>
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="form-grid">
        <app-field
          ><select
            appSelect2
            id="tsubject"
            formControlName="subjectId"
            required
          >
            <option value="">انتخاب کنید</option>
            @for (s of subjects; track s.id) {
              <option [value]="s.id">{{ s.name }}</option>
            }</select
          ><label for="tsubject">واحد آموزشی *</label></app-field
        ><app-field
          ><input
            id="quota"
            formControlName="quota"
            type="number"
            min="1"
            max="1000"
            required
            placeholder=" "
          /><label for="quota">سهم جلسات *</label></app-field
        ><app-field
          ><input
            id="duration"
            formControlName="durationMinutes"
            type="number"
            min="1"
            max="1440"
            placeholder=" "
          /><label for="duration">مدت جلسه (دقیقه، اختیاری)</label></app-field
        ><app-field
          ><select appSelect2 id="tmode" formControlName="mode">
            <option value="onsite">حضوری</option>
            <option value="online">آنلاین</option></select
          ><label for="tmode">شیوه برگزاری</label></app-field
        ><app-field
          ><input
            id="tlocation"
            formControlName="location"
            placeholder=" "
          /><label for="tlocation"
            >محل آموزش (برای حضوری لازم)</label
          ></app-field
        ><app-field
          ><select appSelect2 id="tformat" formControlName="courseFormat">
            <option value="normal">عادی</option>
            <option value="masterclass">مسترکلاس</option></select
          ><label for="tformat">قالب دوره</label></app-field
        ><app-field
          ><select appSelect2 id="currency" formControlName="currency">
            <option value="TOMAN">تومان</option>
            <option value="USD">دلار</option></select
          ><label for="currency">ارز ترم *</label></app-field
        ><app-field
          ><input
            id="amount"
            formControlName="amount"
            inputmode="decimal"
            placeholder=" "
            required
            dir="ltr"
          /><label for="amount">مبلغ پایه (ارز انتخاب‌شده) *</label></app-field
        >
        @if (api.user()?.admin) {
          <app-field
            ><input
              id="discount"
              formControlName="discount"
              inputmode="decimal"
              placeholder=" "
              dir="ltr"
            /><label for="discount">تخفیف</label></app-field
          >
        }
        <app-field>
          <textarea
            id="treason"
            formControlName="reason"
            placeholder=" "
          ></textarea
          ><label for="treason">دلیل تخفیف یا رایگان بودن</label></app-field
        ><app-field
          ><input
            id="registered"
            formControlName="registeredOn"
            placeholder=" "
            required
            dir="ltr"
            aria-describedby="jalali-hint"
          /><label for="registered">تاریخ ثبت‌نام شمسی *</label></app-field
        ><app-field
          ><input
            id="start"
            formControlName="startDate"
            placeholder=" "
            dir="ltr"
          /><label for="start">شروع شمسی (اختیاری)</label></app-field
        ><app-field
          ><input
            id="end"
            formControlName="endDate"
            placeholder=" "
            dir="ltr"
          /><label for="end">پایان شمسی (اختیاری)</label></app-field
        ><app-field
          ><input
            id="due"
            formControlName="dueDate"
            placeholder=" "
            dir="ltr"
          /><label for="due">موعد پرداخت شمسی (اختیاری)</label></app-field
        >
      </div>
      <p id="jalali-hint" class="form-text">
        قالب تاریخ شمسی: ۱۴۰۵/۰۷/۲۷ • مدرس: شهرام محذوف • ساختار: خصوصی
      </p>
      @if (error) {
        <p class="alert alert-danger" role="alert">{{ error }}</p>
      }
      <div class="actions">
        <button class="btn btn-primary" [disabled]="busy">
          {{ busy ? "در حال ذخیره…" : "ثبت ترم" }}</button
        ><button type="button" class="btn btn-light" (click)="cancel.emit()">
          انصراف
        </button>
      </div>
    </form>
  </section>`,
})
export class TermForm implements OnInit {
  cdr = inject(ChangeDetectorRef);
  @Input() studentId = 0;
  @Input() old: Term | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  api = inject(Api);
  fb = inject(FormBuilder);
  subjects: Subject[] = [];
  busy = false;
  error = "";
  form = this.fb.nonNullable.group({
    subjectId: ["", Validators.required],
    quota: [4, [Validators.required, Validators.min(1)]],
    durationMinutes: "",
    mode: "onsite",
    location: "آموزشگاه محذوف",
    courseFormat: "normal",
    currency: "TOMAN",
    amount: ["", Validators.required],
    discount: "0",
    reason: "",
    registeredOn: jalaliToday(),
    startDate: "",
    endDate: "",
    dueDate: "",
  });
  async ngOnInit() {
    try {
      this.subjects = await this.api.get<Subject[]>("/subjects");
    } catch (e) {
      this.error = errorMessage(e);
    }
    if (this.old) {
      const t = this.old;
      this.form.patchValue({
        subjectId: String(t.subject_id),
        quota: t.quota,
        durationMinutes: t.duration_minutes ? String(t.duration_minutes) : "",
        mode: t.mode,
        location: t.location,
        courseFormat: t.course_format,
        currency: t.invoice?.currency || "TOMAN",
        amount: t.invoice
          ? String(
              t.invoice.base_minor / (t.invoice.currency === "USD" ? 100 : 1),
            )
          : "",
        discount: "0",
      });
      this.form.controls.subjectId.disable();
    }

    this.cdr.markForCheck();
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy) {
      this.error = "فیلدهای الزامی و سهم جلسات را بررسی کنید.";
      return;
    }
    this.error = "";
    this.busy = true;
    try {
      const v = this.form.getRawValue();
      const body = {
        ...v,
        quota: Number(v.quota),
        registeredOn: toIso(v.registeredOn),
        startDate: toIso(v.startDate),
        endDate: toIso(v.endDate),
        dueDate: toIso(v.dueDate),
      };
      await this.api.post(
        this.old
          ? `/terms/${this.old.id}/renew`
          : `/students/${this.studentId}/terms`,
        body,
      );
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
