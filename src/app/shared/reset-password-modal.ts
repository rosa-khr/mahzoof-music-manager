import { Password } from "./password";
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { Staff } from "../core/staff";
import { Field } from "./ui";
import { Icon } from "./icon";
@Component({
  selector: "app-reset-password-modal",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Password, ReactiveFormsModule, Field, Icon],
  template: `
    <dialog
      #dialog
      class="password-modal"
      aria-labelledby="reset-title"
      aria-describedby="reset-description"
      (close)="closed.emit()"
      (cancel)="cancel($event)"
      (click)="backdrop($event)"
    >
      <header class="password-modal-header">
        <h2 id="reset-title"><app-icon name="resetKey" />ریست رمز عبور</h2>
        <button
          type="button"
          class="icon-button"
          aria-label="بستن پنجره ریست رمز"
          [disabled]="busy"
          (click)="dismiss()"
        >
          <app-icon name="close" />
        </button>
      </header>
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="password-modal-body">
          <p class="reset-account">
            کاربر: <bdi>{{ user.username }}</bdi>
          </p>
          <p id="reset-description" class="form-text">
            با ثبت رمز جدید، تمام نشست‌های قبلی این کاربر پایان می‌یابند. وضعیت
            قفل حساب تغییر نمی‌کند.
          </p>
          <fieldset [disabled]="busy">
            <app-field
              ><input
                id="resetpass"
                type="password"
                appPassword
                autocomplete="new-password"
                formControlName="password"
                minlength="8"
                maxlength="256"
                required
                autofocus
              /><label for="resetpass"
                >رمز جدید (حداقل ۸ نویسه) *</label
              ></app-field
            >
            <app-field
              ><input
                id="resetconfirm"
                type="password"
                appPassword
                autocomplete="new-password"
                formControlName="confirm"
                maxlength="256"
                required
              /><label for="resetconfirm">تکرار رمز جدید *</label></app-field
            >
          </fieldset>
          @if (error) {
            <p role="alert" class="alert alert-danger">{{ error }}</p>
          }
        </div>
        <footer class="password-modal-footer">
          <button
            type="button"
            class="btn btn-light"
            [disabled]="busy"
            (click)="dismiss()"
          >
            انصراف</button
          ><button class="btn btn-primary" [disabled]="busy">
            {{ busy ? "در حال ثبت…" : "ریست رمز و پایان نشست‌ها" }}
          </button>
        </footer>
      </form>
    </dialog>
  `,
})
export class ResetPasswordModal {
  @Input({ required: true }) user!: Staff;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Staff>();
  @ViewChild("dialog", { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  api = inject(Api);
  fb = inject(FormBuilder);
  cdr = inject(ChangeDetectorRef);
  busy = false;
  error = "";
  form = this.fb.nonNullable.group({
    password: [
      "",
      [Validators.required, Validators.minLength(8), Validators.maxLength(256)],
    ],
    confirm: ["", Validators.required],
  });
  ngAfterViewInit() {
    this.dialog.nativeElement.showModal();
  }
  ngOnDestroy() {
    this.form.reset();
    this.dialog.nativeElement.close();
  }
  dismiss() {
    if (!this.busy) this.dialog.nativeElement.close();
  }
  cancel(event: Event) {
    if (this.busy) event.preventDefault();
  }
  backdrop(event: MouseEvent) {
    if (event.target !== this.dialog.nativeElement) return;
    const r = this.dialog.nativeElement.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      this.dismiss();
  }
  async save() {
    if (this.busy) return;
    this.form.markAllAsTouched();
    this.error = "";
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      this.error = "رمز جدید باید ۸ تا ۲۵۶ نویسه باشد و تکرار آن الزامی است.";
      return;
    }
    if (v.password !== v.confirm) {
      this.error = "تکرار رمز با رمز جدید برابر نیست.";
      return;
    }
    this.busy = true;
    try {
      const saved = await this.api.post<Staff>(
        "/users/" + this.user.id + "/reset-password",
        { password: v.password, version: this.user.version },
      );
      this.form.reset();
      this.saved.emit(saved);
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
