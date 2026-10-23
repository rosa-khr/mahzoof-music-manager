import { Password } from "../shared/password";
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { PageHeader, Field } from "../shared/ui";
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Password, ReactiveFormsModule, PageHeader, Field],
  template: `
    <app-header title="حساب شخصی" subtitle="تغییر رمز عبور حساب شما" />
    @if (error) {
      <p class="alert alert-danger" role="alert">{{ error }}</p>
    }
    <section class="card">
      <h2>تغییر رمز عبور</h2>
      <form [formGroup]="password" (ngSubmit)="changePassword()">
        <div class="form-grid">
          <app-field
            ><input
              id="oldpass"
              type="password"
              appPassword
              autocomplete="current-password"
              formControlName="currentPassword"
              required
            /><label for="oldpass">رمز فعلی</label></app-field
          >
          <app-field
            ><input
              id="newpass"
              type="password"
              appPassword
              autocomplete="new-password"
              formControlName="newPassword"
              minlength="8"
              maxlength="256"
              required
            /><label for="newpass">رمز جدید (حداقل ۸ نویسه)</label></app-field
          >
        </div>
        <button class="btn btn-primary" [disabled]="busy || password.invalid">
          تغییر رمز و پایان نشست‌ها
        </button>
      </form>
    </section>
  `,
})
export class Account {
  api = inject(Api);
  fb = inject(FormBuilder);
  cdr = inject(ChangeDetectorRef);
  busy = false;
  error = "";
  password = this.fb.nonNullable.group({
    currentPassword: ["", Validators.required],
    newPassword: [
      "",
      [Validators.required, Validators.minLength(8), Validators.maxLength(256)],
    ],
  });
  async changePassword() {
    if (this.busy || this.password.invalid) return;
    this.busy = true;
    this.error = "";
    try {
      await this.api.post("/auth/password", this.password.getRawValue());
      this.api.clear();
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
