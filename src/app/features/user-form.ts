import { confirmUserChange } from "../shared/confirm";
import { Password } from "../shared/password";
import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import { Staff, STAFF_ROLES } from "../core/staff";
import { PageHeader, Field } from "../shared/ui";
import { Switch } from "../shared/switch";
import { ResetPasswordModal } from "../shared/reset-password-modal";
import { Icon } from "../shared/icon";
import { Select2 } from "../shared/select2";
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Password,
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    Field,
    Switch,
    Select2,
    ResetPasswordModal,
    Icon,
  ],
  template: `
    <app-header
      [title]="editing ? 'ویرایش کاربر' : 'ثبت کاربر'"
      subtitle="مدیریت امنیت"
    >
      @if (editing && user) {
        <button
          type="button"
          class="btn btn-light"
          [disabled]="busy"
          (click)="resetTarget = user"
        >
          <app-icon name="resetKey" />ریست رمز عبور
        </button>
      }
      <a class="btn btn-light" routerLink="/users"
        >بازگشت به فهرست</a
      ></app-header
    >
    @if (error) {
      <p role="alert" class="alert alert-danger">{{ error }}</p>
    }
    @if (message) {
      <p role="status" class="alert alert-success">{{ message }}</p>
    }
    @if (loading) {
      <p role="status">در حال دریافت اطلاعات…</p>
    }
    @if (!loading && (!editing || user)) {
      <form class="student-editor card" [formGroup]="form" (ngSubmit)="save()">
        <fieldset class="student-editor-layout" [disabled]="busy">
          <div class="student-editor-main">
            <section class="student-form-section">
              <header><h2>اطلاعات کاربر</h2></header>
              <div class="form-grid">
                <app-field
                  ><input
                    id="staffname"
                    formControlName="username"
                    dir="ltr"
                    autocomplete="off"
                    maxlength="80"
                    required
                  /><label for="staffname">نام کاربری *</label></app-field
                >
                <app-field
                  ><select appSelect2 id="staffrole" formControlName="role">
                    @for (role of roles; track role.key) {
                      <option
                        [value]="role.key"
                        [disabled]="!role.active && role.key !== user?.role"
                      >
                        {{ role.title }}{{ role.active ? "" : " (غیرفعال)" }}
                      </option>
                    }</select
                  ><label for="staffrole">نقش *</label></app-field
                >
                @if (!editing) {
                  <app-field
                    ><input
                      id="staffpass"
                      type="password"
                      appPassword
                      autocomplete="new-password"
                      formControlName="password"
                      minlength="8"
                      maxlength="256"
                      required
                    /><label for="staffpass"
                      >رمز اولیه (حداقل ۸ نویسه) *</label
                    ></app-field
                  >
                }
              </div>
            </section>
          </div>
          <div class="student-editor-side">
            <section class="student-form-section">
              <header><h2>وضعیت حساب</h2></header>
              <app-switch
                formControlName="active"
                label="فعال بودن حساب"
                onText="فعال"
                offText="قفل‌شده"
              />
              <p class="form-text">
                حساب قفل‌شده اجازه ورود ندارد. ویرایش حساب نشست‌های قبلی آن را
                پایان می‌دهد.
              </p>
            </section>
          </div>
        </fieldset>
        @if (form.invalid && form.touched) {
          <p role="alert" class="text-danger">
            نام کاربری الزامی و حداکثر ۸۰ نویسه است؛ رمز اولیه باید ۸ تا ۲۵۶
            نویسه باشد.
          </p>
        }
        <footer class="student-editor-actions">
          <a routerLink="/users" class="btn btn-light">انصراف</a
          ><button class="btn btn-primary" [disabled]="busy">
            {{
              busy ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ایجاد کاربر"
            }}
          </button>
        </footer>
      </form>
      @if (resetTarget) {
        <app-reset-password-modal
          [user]="resetTarget"
          (closed)="closeReset()"
          (saved)="passwordSaved($event)"
        />
      }
    }
  `,
})
export class UserForm {
  api = inject(Api);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  editing = !!this.route.snapshot.paramMap.get("id");
  user: Staff | null = null;
  loading = false;
  busy = false;
  error = "";
  message = "";
  resetTarget: Staff | null = null;
  roles: { key: string; title: string; active: boolean }[] = [];
  form = this.fb.nonNullable.group({
    username: ["", [Validators.required, Validators.maxLength(80)]],
    role: "secretary",
    active: true,
    password: [
      "",
      [Validators.required, Validators.minLength(8), Validators.maxLength(256)],
    ],
  });
  async ngOnInit() {
    this.loading = true;
    if (this.editing) {
      this.form.controls.password.clearValidators();
      this.form.controls.password.updateValueAndValidity();
    }
    try {
      this.roles = (
        await this.api.get<{ code: string; name: string; active: number }[]>(
          "/users/role-options",
        )
      ).map((r) => ({ key: r.code, title: r.name, active: !!r.active }));
      if (this.editing) {
        this.user = await this.api.get<Staff>(
          "/users/" + this.route.snapshot.paramMap.get("id"),
        );
        this.form.patchValue({ ...this.user, active: !!this.user.active });
      }
      if (this.route.snapshot.queryParamMap.has("password"))
        this.resetTarget = this.user;
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy) return;
    this.busy = true;
    this.error = "";
    this.message = "";
    try {
      const v = this.form.getRawValue();
      if (this.editing) {
        const title =
          !!this.user!.active !== v.active
            ? v.active
              ? "فعال‌کردن حساب کاربر؟"
              : "قفل‌کردن حساب کاربر؟"
            : "ذخیره تغییرات کاربر؟";
        const accepted = await confirmUserChange(
          title,
          "تغییرات حساب «" +
            this.user!.username +
            "» ذخیره می‌شود و نشست‌های قبلی او پایان می‌یابد.",
        );
        if (!accepted) return;
      }
      if (this.editing)
        await this.api.patch("/users/" + this.user!.id, {
          username: v.username,
          role: v.role,
          active: v.active,
          version: this.user!.version,
        });
      else await this.api.post("/users", v);
      if (this.editing && this.user!.id === this.api.user()?.id)
        this.api.clear();
      else await this.router.navigate(["/users"], { state: { saved: true } });
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  closeReset() {
    this.resetTarget = null;
    if (this.route.snapshot.queryParamMap.has("password"))
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { password: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
  }
  passwordSaved(saved: Staff) {
    this.user = saved;
    this.closeReset();
    if (saved.id === this.api.user()?.id) this.api.clear();
    else this.message = "رمز عبور ریست شد و نشست‌های قبلی پایان یافتند.";
  }
}
