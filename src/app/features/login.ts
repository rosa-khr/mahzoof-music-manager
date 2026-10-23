import { Password } from "../shared/password";
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { Field } from "../shared/ui";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Password, ReactiveFormsModule, Field],
  template: `<main class="login-page">
    <section class="card login-card">
      <p class="eyebrow">آموزشگاه موسیقی شهرام محذوف</p>
      <h1>ورود به پنل کارکنان</h1>
      <p class="text-secondary">برای رسیدگی به کارهای امروز وارد شوید.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <app-field
          ><input
            id="username"
            formControlName="username"
            autocomplete="username"
            placeholder=" "
            required
            dir="ltr"
          /><label for="username">نام کاربری</label></app-field
        ><app-field
          ><input
            id="password"
            type="password"
            appPassword
            formControlName="password"
            autocomplete="current-password"
            placeholder=" "
            required
          /><label for="password">رمز عبور</label></app-field
        >
        @if (error) {
          <p role="alert" class="alert alert-danger">{{ error }}</p>
        }
        <button class="btn btn-primary w-100" [disabled]="busy || form.invalid">
          {{ busy ? "در حال ورود…" : "ورود" }}
        </button>
      </form>
    </section>
  </main>`,
})
export class Login {
  cdr = inject(ChangeDetectorRef);
  api = inject(Api);
  fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    username: ["", Validators.required],
    password: ["", Validators.required],
  });
  error = "";
  busy = false;
  async submit() {
    if (this.form.invalid || this.busy) return;
    this.busy = true;
    this.error = "";
    try {
      await this.api.login(this.form.getRawValue());
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
