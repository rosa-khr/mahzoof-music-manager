import { Component, Input, OnInit, OnChanges, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Select2 } from "./select2";
import { Field } from "./ui";

export interface EducationOptions {
  instruments: {
    id: number;
    name: string;
    rate_toman_30?: number | null;
    rate_usd_cents_30?: number | null;
  }[];
  instructors: { id: number; name: string; instrument_ids: number[] }[];
  teachingTypes: {
    id: number;
    name: string;
    requires_academy: number | null;
  }[];
  academies: { id: number; name: string }[];
  paymentMethods: {
    id: number;
    name: string;
    settlement_type: string;
    payment_currency: string | null;
    installment_count: number | null;
  }[];
}
export const emptyEducationOptions = (): EducationOptions => ({
  instruments: [],
  instructors: [],
  teachingTypes: [],
  academies: [],
  paymentMethods: [],
});
export const educationControls = () => ({
  instrumentId: "",
  instructorId: "",
  teachingTypeId: "",
  academyId: "",
  paymentMethodId: "",
  mode: "",
});

@Component({
  selector: "app-education-fields",
  standalone: true,
  imports: [ReactiveFormsModule, Select2, Field],
  template: `<div class="form-grid" [formGroup]="group">
      @if (showInstrument) {
      <app-field
        ><select
          id="education-instrument"
          appSelect2
          formControlName="instrumentId"
          [required]="selectionRequired"
          (change)="instrumentChanged()"
        >
          <option value="">انتخاب کنید</option>
          @for (item of options.instruments; track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }</select
        ><label for="education-instrument">ساز *</label></app-field
      >
      }
      <app-field
        ><select
          id="education-instructor"
          appSelect2
          formControlName="instructorId"
          [required]="selectionRequired"
        >
          <option value="">انتخاب کنید</option>
          @for (item of instructors; track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }</select
        ><label for="education-instructor">مدرس *</label></app-field
      >
      <app-field
        ><select
          id="education-type"
          appSelect2
          formControlName="teachingTypeId"
          [required]="selectionRequired"
        >
          <option value="">انتخاب کنید</option>
          @for (item of options.teachingTypes; track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }</select
        ><label for="education-type">شیوه برگزاری *</label></app-field
      >
      @if (group.get("mode")?.value === "onsite") {
        <app-field
          ><select
            id="education-academy"
            appSelect2
            formControlName="academyId"
            required
          >
            <option value="">انتخاب کنید</option>
            @for (item of options.academies; track item.id) {
              <option [value]="item.id">{{ item.name }}</option>
            }</select
          ><label for="education-academy">آموزشگاه *</label></app-field
        >
      }
      @if (paymentRequired) { <app-field
        ><select
          id="education-payment"
          appSelect2
          formControlName="paymentMethodId"
          [required]="paymentRequired"
        >
          <option value="">انتخاب کنید</option>
          @for (item of options.paymentMethods; track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }</select
        ><label for="education-payment"
          >شیوه پرداخت{{ paymentRequired ? " *" : "" }}</label
        ></app-field
      > }
    </div>
    @if (
      !options.instruments.length ||
      !options.teachingTypes.length ||
      (paymentRequired && !options.paymentMethods.length) ||
      !options.instructors.length
    ) {
      <p class="form-text">
        برای ثبت، ساز، مدرس متخصص، شیوه برگزاری و شیوه پرداخت فعال باید تعریف
        شده باشند.
      </p>
    }
    @if (delivery && delivery.requires_academy === null) {
      <p class="alert alert-warning" role="alert">
        نیاز به آموزشگاه برای این شیوه برگزاری تعیین نشده است؛ آن را در اطلاعات
        پایه مشخص کنید.
      </p>
    }`,
})
export class EducationFields implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) group!: FormGroup;
  @Input() options = emptyEducationOptions();
  @Input() paymentRequired = true;
  @Input() selectionRequired = true;
  @Input() showInstrument = true;
  private subscription?: Subscription;
  get delivery() {
    return this.options.teachingTypes.find(
      (item) => item.id === Number(this.group?.get("teachingTypeId")?.value),
    );
  }
  ngOnInit() {
    this.subscription = this.group
      .get("teachingTypeId")
      ?.valueChanges.subscribe(() => this.syncMode());
    this.syncMode();
  }
  ngOnChanges() {
    if (this.group) this.syncMode();
  }
  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
  private syncMode() {
    const required = this.delivery?.requires_academy;
    const mode = required == null ? "" : required ? "onsite" : "online";
    if (this.group.get("mode")?.value !== mode)
      this.group.get("mode")?.setValue(mode);
  }
  get instructors() {
    return this.options.instructors.filter((item) =>
      item.instrument_ids.includes(
        Number(this.group.get("instrumentId")?.value),
      ),
    );
  }
  instrumentChanged() {
    const defaultTeacher = this.instructors.find((item) => item.name.replace(/\s+/g, ' ').trim() === 'شهرام محذوف');
    this.group.get("instructorId")?.setValue(defaultTeacher ? String(defaultTeacher.id) : "");
  }
}
