import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import { Icon } from "../shared/icon";
import { Switch } from "../shared/switch";
import { Field, PageHeader } from "../shared/ui";
import { Toasts } from "../shared/toast";
import type { SubjectRecord } from "./subjects";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, PageHeader, Field, Switch, Icon],
  template: `<app-header
      [title]="editing ? 'ویرایش واحد آموزشی' : 'ثبت واحد آموزشی'"
      subtitle="اطلاعات پایه • فقط نام واحد الزامی است"
    >
      <a class="btn btn-light" routerLink="/subjects" [queryParams]="listQuery"
        >بازگشت به فهرست</a
      >
    </app-header>
    @if (loading) {
      <p class="loading-state" role="status">در حال دریافت اطلاعات…</p>
    }
    @if (!loading && (!editing || record)) {
      <form class="student-editor card" [formGroup]="form" (ngSubmit)="save()">
        <fieldset class="student-editor-layout" [disabled]="busy">
          <div class="student-editor-main">
            <section class="student-form-section">
              <header><h2>مشخصات واحد آموزشی</h2></header>
              <div class="form-grid">
                <app-field
                  ><input id="subject-name" formControlName="name" maxlength="150" required /><label for="subject-name"
                    >نام واحد آموزشی *</label
                  ></app-field
                >
                <app-field
                  ><input id="subject-phone" formControlName="phone" type="tel" dir="ltr" maxlength="30" /><label for="subject-phone"
                    >شماره تلفن</label
                  ></app-field
                >
                <app-field
                  ><input id="subject-website" formControlName="website" type="url" dir="ltr" maxlength="300" /><label for="subject-website"
                    >وب‌سایت</label
                  ></app-field
                >
                <app-field
                  ><input id="subject-social" formControlName="socialMedia" dir="ltr" maxlength="300" /><label for="subject-social"
                    >آدرس شبکه اجتماعی</label
                  ></app-field
                >
              </div>
              <app-field
                ><textarea id="subject-address" formControlName="address" maxlength="500"></textarea><label for="subject-address"
                  >آدرس</label
                ></app-field
              >
            </section>
          </div>
          <div class="student-editor-side">
            <section class="student-form-section student-form-settings">
              <header><h2>وضعیت</h2></header>
              <app-switch formControlName="status" onValue="active" offValue="inactive" label="وضعیت" />
              <p class="form-text">برای حفظ سوابق، واحدی که دیگر استفاده نمی‌شود را غیرفعال کنید.</p>
            </section>
          </div>
        </fieldset>
        <footer class="student-editor-actions">
          <span>فقط فیلد ستاره‌دار الزامی است.</span>
          <a class="btn btn-light" routerLink="/subjects" [queryParams]="listQuery">انصراف</a>
          <button class="btn btn-primary" [disabled]="busy">
            <app-icon name="save" />{{ busy ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت و بازگشت" }}
          </button>
        </footer>
      </form>
    }`,
})
export class SubjectForm implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private toasts = inject(Toasts);
  editing = !!this.route.snapshot.paramMap.get("id");
  listQuery = Object.fromEntries(
    Object.entries(this.route.snapshot.queryParams).filter(([key]) =>
      ["page", "size", "filters", "sort"].includes(key),
    ),
  );
  loading = false;
  busy = false;
  error = "";
  record: SubjectRecord | null = null;
  form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(150)]],
    address: ["", Validators.maxLength(500)],
    phone: ["", [Validators.maxLength(30), Validators.pattern(/^[+0-9۰-۹ ()-]{6,30}$/)]],
    website: ["", [Validators.maxLength(300), Validators.pattern(/^https?:\/\/.+/i)]],
    socialMedia: ["", Validators.maxLength(300)],
    status: "active",
  });
  async ngOnInit() {
    if (!this.editing) return;
    this.loading = true;
    try {
      this.record = await this.api.get<SubjectRecord>(
        "/subject-catalog/" + this.route.snapshot.paramMap.get("id"),
      );
      this.form.patchValue({
        name: this.record.name,
        address: this.record.address,
        phone: this.record.phone,
        website: this.record.website,
        socialMedia: this.record.social_media,
        status: this.record.status,
      });
    } catch (error) {
      this.error = errorMessage(error);
      this.toasts.show(this.error, "error");
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.busy) return;
    if (this.form.invalid) {
      this.toasts.show("نام واحد الزامی است. تلفن و وب‌سایت را با قالب معتبر ثبت کنید.", "error");
      return;
    }
    this.busy = true;
    this.error = "";
    try {
      const body = {
        ...this.form.getRawValue(),
        ...(this.record ? { version: this.record.version } : {}),
      };
      if (this.editing)
        await this.api.patch("/subject-catalog/" + this.record!.id, body);
      else await this.api.post("/subject-catalog", body);
      this.toasts.show("اطلاعات با موفقیت ذخیره شد.", "success");
      await this.router.navigate(["/subjects"], {
        queryParams: this.listQuery,
      });
    } catch (error) {
      this.error = errorMessage(error);
      this.toasts.show(this.error, "error");
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
