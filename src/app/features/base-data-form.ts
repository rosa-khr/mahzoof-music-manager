import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { BaseResource, BaseRecord } from "../core/base-data";
import { PageHeader, Field } from "../shared/ui";
import { Switch } from "../shared/switch";
import { Icon } from "../shared/icon";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, PageHeader, Field, Switch, Icon],
  template: `<app-header
      [title]="(editing ? 'ویرایش ' : 'ثبت ') + resource.singular"
      [subtitle]="'اطلاعات پایه • ' + resource.title"
    >
      <a class="btn btn-light" [routerLink]="path" [queryParams]="listQuery"
        >بازگشت به فهرست</a
      >
    </app-header>
    @if (error) {
      <p class="alert alert-danger" role="alert">{{ error }}</p>
    }
    @if (loading) {
      <p class="loading-state" role="status">در حال دریافت اطلاعات…</p>
    }
    @if (!loading && (!editing || record)) {
      <form class="student-editor card" [formGroup]="form" (ngSubmit)="save()">
        <fieldset class="student-editor-layout" [disabled]="busy">
          <div class="student-editor-main">
            <section class="student-form-section">
              <header>
                <h2>اطلاعات {{ resource.singular }}</h2>
              </header>
              <div class="form-grid">
                <app-field
                  ><input
                    id="base-name"
                    formControlName="name"
                    placeholder=" "
                    maxlength="150"
                    required
                  /><label for="base-name"
                    >{{ resource.nameLabel }} *</label
                  ></app-field
                >
                @if (resource.key === "instruments") {
                  <app-field>
                    <input
                      id="instrument-english-name"
                      formControlName="englishName"
                      dir="ltr"
                      maxlength="150"
                      autocomplete="off"
                    />
                    <label for="instrument-english-name">نام انگلیسی ساز</label>
                  </app-field>
                }
                @if (resource.phone) {
                  <app-field
                    ><input
                      id="base-phone"
                      formControlName="phone"
                      placeholder=" "
                      type="tel"
                      dir="ltr"
                      maxlength="30"
                    /><label for="base-phone">شماره تماس</label></app-field
                  >
                }
              </div>
              <app-field>
                <textarea
                  id="base-notes"
                  formControlName="notes"
                  placeholder=" "
                  maxlength="2000"
                ></textarea
                ><label for="base-notes">توضیحات</label></app-field
              >
            </section>
          </div>
          <div class="student-editor-side">
            <section class="student-form-section student-form-settings">
              <header><h2>وضعیت</h2></header>
              @if (resource.key !== "session-statuses") {
                <app-switch
                  formControlName="status"
                  onValue="active"
                  offValue="inactive"
                  label="وضعیت"
                />
              }
              @if (resource.key === "session-statuses") {
                <p class="form-text">
                  کد وضعیت: <bdi>{{ record?.code }}</bdi>
                </p>
                <p class="form-text">
                  چهار وضعیت و اثر آن‌ها بر سهم ترم ثابت‌اند؛ عنوان و توضیحات
                  قابل ویرایش هستند.
                </p>
              }
              @if (resource.key !== "session-statuses") {
                <p class="form-text">
                  برای نگهداری سوابق، رکوردهای غیرقابل استفاده را غیرفعال کنید.
                </p>
              }
            </section>
          </div>
        </fieldset>
        @if (form.invalid && form.touched) {
          <p class="text-danger" role="alert">
            عنوان الزامی است و باید حداکثر ۱۵۰ نویسه باشد.
          </p>
        }
        <footer class="student-editor-actions">
          <span>فیلدهای ستاره‌دار الزامی هستند.</span>
          <a class="btn btn-light" [routerLink]="path" [queryParams]="listQuery"
            >انصراف</a
          >
          <button class="btn btn-primary" [disabled]="busy">
            <app-icon name="save" />{{
              busy
                ? "در حال ذخیره…"
                : editing
                  ? "ذخیره تغییرات"
                  : "ثبت و بازگشت"
            }}
          </button>
        </footer>
      </form>
    }`,
})
export class BaseDataForm implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  api = inject(Api);
  cdr = inject(ChangeDetectorRef);
  fb = inject(FormBuilder);
  resource = this.route.snapshot.data["resource"] as BaseResource;
  path = "/base-data/" + this.resource.key;
  endpoint = this.path;
  editing = !!this.route.snapshot.paramMap.get("id");
  listQuery = Object.fromEntries(
    Object.entries(this.route.snapshot.queryParams).filter(([key]) =>
      ["page", "size", "filters", "sort"].includes(key),
    ),
  );
  loading = false;
  busy = false;
  error = "";
  record: BaseRecord | null = null;
  form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(150)]],
    phone: "",
    englishName: ["", Validators.maxLength(150)],
    notes: ["", Validators.maxLength(2000)],
    status: "active",
  });
  async ngOnInit() {
    if (!this.editing) return;
    this.loading = true;
    try {
      this.record = await this.api.get<BaseRecord>(
        this.endpoint + "/" + this.route.snapshot.paramMap.get("id"),
      );
      this.form.patchValue({
        ...this.record,
        phone: this.record.phone || "",
        englishName: this.record.english_name || "",
      });
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.busy || this.form.invalid) return;
    this.busy = true;
    this.error = "";
    try {
      const body = {
        ...this.form.getRawValue(),
        ...(this.record ? { version: this.record.version } : {}),
      };
      if (this.editing)
        await this.api.patch(this.endpoint + "/" + this.record!.id, body);
      else await this.api.post(this.endpoint, body);
      await this.router.navigate([this.path], {
        queryParams: this.listQuery,
        state: { saved: true },
      });
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
