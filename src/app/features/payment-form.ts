import { Select2 } from "../shared/select2";
import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { Term } from "../core/models";
import { Field, Money, jalaliToday, toIso } from "../shared/ui";
import { Datepicker } from "../shared/datepicker";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-payment-form",
  standalone: true,
  imports: [Select2, ReactiveFormsModule, Field, Money, Datepicker],
  template: `<section class="card action-panel">
    <h2>ثبت دریافت کامل شهریه</h2>
    @if (createdPaymentId) { <p class="alert alert-success">دریافت شهریه در سرور ثبت شد. بارگذاری رسید انجام نشده است؛ می‌توانید دوباره تلاش کنید یا بدون فایل ادامه دهید.</p> }
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="form-grid">
        <app-field
          ><select
            appSelect2
            id="pay-term"
            formControlName="termId"
            required
            (change)="changed()"
          >
            <option value="">انتخاب کنید</option>
            @for (t of terms; track t.id) {
              @if (t.invoice && t.invoice.settlement_type !== "free") {
                <option [value]="t.id" [disabled]="t.invoice.financial_status !== 'unpaid'">
                {{ t.subject }} • ترم {{ t.number }} • مانده
                {{ t.invoice.balance_minor | money: t.invoice.currency }}
                </option>
              }
            }</select
          ><label for="pay-term">ترم و صورتحساب مقصد *</label></app-field
        ><app-field
          ><input
            id="pay-amount"
            formControlName="amount"
            required
            inputmode="decimal"
            placeholder=" "
            dir="ltr"
            readonly
          /><label for="pay-amount">مبلغ دریافت در ارز ترم *</label></app-field
        ><app-field
          ><input
            id="received"
            appDatepicker
            formControlName="receivedOn"
            required
            placeholder=" "
            dir="ltr"
          /><label for="received">تاریخ دریافت واقعی شمسی *</label></app-field
        ><app-field
          ><select appSelect2 id="method" formControlName="method">
            <option value="cash">نقدی</option>
            <option value="bank">انتقال بانکی</option>
            <option value="other">سایر</option></select
          ><label for="method">روش دریافت</label></app-field
        >
        @if (form.controls.method.value === "bank") {
          <app-field
            ><select appSelect2 id="bank" formControlName="bankAccountId">
              <option value="">انتخاب حساب</option>
              @for (b of banks; track b.id) {
                @if (b.currency === selected?.invoice?.currency) {
                  <option [value]="b.id">{{ b.title }}</option>
                }
              }</select
            ><label for="bank">حساب مقصد *</label></app-field
          >
        }
        <app-field
          ><input
            id="reference"
            formControlName="reference"
            placeholder=" "
          /><label for="reference">شماره پیگیری</label></app-field
        ><app-field>
          <textarea
            id="pnotes"
            formControlName="notes"
            placeholder=" "
          ></textarea
          ><label for="pnotes">توضیحات دریافت</label></app-field
        >
      </div>
      <label>رسید اختیاری<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" (change)="receiptFile = $any($event.target).files?.[0] || null" /></label>
      <p class="form-text">
        مبلغ نهایی پس از تخفیف فقط‌خواندنی است. ثبت موفق سرور، همان ترم را
        کامل تسویه می‌کند و دریافت دوم پذیرفته نمی‌شود.
      </p>
      @if (error) {
        <p role="alert" class="alert alert-danger">{{ error }}</p>
      }
      <div class="actions">
        <button class="btn btn-primary" [disabled]="busy">
          {{ busy ? "در حال ثبت…" : "ثبت دریافت کامل شهریه" }}</button
        ><button
          type="button"
          class="btn btn-light"
          [disabled]="busy"
          (click)="cancel.emit()"
        >
          انصراف
        </button>
        @if (createdPaymentId) { <button type="button" class="btn btn-light" (click)="saved.emit()">ادامه بدون فایل رسید</button> }
      </div>
    </form>
  </section>`,
})
export class PaymentForm implements OnInit {
  cdr = inject(ChangeDetectorRef);
  @Input() studentId = 0;
  @Input() terms: Term[] = [];
  @Input() initialTerm = 0;
  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  api = inject(Api);
  fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    termId: ["", Validators.required],
    amount: ["", Validators.required],
    receivedOn: jalaliToday(),
    method: "cash",
    bankAccountId: "",
    reference: "",
    notes: "",
  });
  banks: { id: number; title: string; currency: string }[] = [];
  busy = false;
  error = "";
  key = crypto.randomUUID();
  submittedBody: unknown = null;
  receiptFile:File|null=null;
  createdPaymentId=0;
  get selected() {
    return this.terms.find(
      (t) => t.id === Number(this.form.controls.termId.value),
    );
  }
  async ngOnInit() {
    if (this.initialTerm)
      this.form.patchValue({ termId: String(this.initialTerm) });
    this.changed();
    try {
      this.banks = await this.api.get<typeof this.banks>("/bank-accounts");
    } catch (e) {
      this.error = errorMessage(e);
    }

    this.cdr.markForCheck();
  }
  changed() {
    this.form.controls.bankAccountId.setValue("");
    const invoice = this.selected?.invoice;
    if (invoice)
      this.form.controls.amount.setValue(
        String(
          invoice.total_minor /
            (invoice.currency === "USD" ? 100 : 1),
        ),
      );
  }
  async save() {
    if (this.form.invalid || this.busy || !this.selected?.invoice) {
      this.error = "ترم و مبلغ را انتخاب کنید.";
      return;
    }
    this.busy = true;
    this.error = "";
    try {
      const v = this.form.getRawValue();
      const body = {
        ...v,
        studentId: this.studentId,
        invoiceId: this.selected.invoice.id,
        currency: this.selected.invoice.currency,
        receivedOn: toIso(v.receivedOn),
        bankAccountId: v.method === "bank" ? v.bankAccountId : null,
      };
      const fingerprint = JSON.stringify(body);
      if (this.submittedBody !== null && this.submittedBody !== fingerprint) {
        this.error =
          "درخواست قبلی نتیجه قطعی ندارد. ابتدا پرونده را تازه‌سازی و دریافت‌ها را بررسی کنید؛ همان اطلاعات را برای تلاش مجدد نگه دارید.";
        return;
      }
      this.submittedBody = fingerprint;
      if(!this.createdPaymentId){const result=await this.api.post<{id:number}>("/full-tuition-payments", body, this.key);this.createdPaymentId=result.id;}
      if(this.receiptFile){const upload=new FormData();upload.append('file',this.receiptFile);upload.append('kind','receipt');upload.append('paymentId',String(this.createdPaymentId));upload.append('termId',String(this.selected!.id));await this.api.post(`/students/${this.studentId}/documents`,upload);}
      this.saved.emit();
    } catch (e) {
      this.error =
        e instanceof Error && !("error" in e) ? e.message : errorMessage(e);
      const status = (e as { status?: number }).status;
      if (status && status < 500 && status !== 409) this.submittedBody = null;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
