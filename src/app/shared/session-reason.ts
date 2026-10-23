import { Component, Input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Select2 } from "./select2";
import { Field } from "./ui";
@Component({
  selector: "app-session-reason",
  standalone: true,
  imports: [ReactiveFormsModule, Select2, Field],
  template: ` <div class="form-grid" [formGroup]="group">
    <app-field
      ><select
        id="session-requester"
        appSelect2
        formControlName="requestedBy"
        required
      >
        <option value="">انتخاب کنید</option>
        <option value="teacher">مدرس</option>
        <option value="student">هنرجو</option>
        <option value="academy">آموزشگاه</option>
        <option value="other">سایر</option></select
      ><label for="session-requester">از طرف چه کسی؟ *</label></app-field
    >
    <app-field
      ><select
        id="session-justified"
        appSelect2
        formControlName="justified"
        required
      >
        <option value="">انتخاب کنید</option>
        <option value="yes">موجه</option>
        <option value="no">غیرموجه</option></select
      ><label for="session-justified">وضعیت دلیل *</label></app-field
    >
    <app-field>
      <textarea
        id="session-reason"
        formControlName="reason"
        required
        maxlength="1000"
      ></textarea
      ><label for="session-reason">توضیح علت *</label></app-field
    >
  </div>`,
})
export class SessionReason {
  @Input({ required: true }) group!: FormGroup;
}
export const reasonControls = () => ({
  requestedBy: "",
  justified: "",
  reason: "",
});
