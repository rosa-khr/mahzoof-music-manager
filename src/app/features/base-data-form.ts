import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { BaseResource, BaseRecord } from "../core/base-data";
import { PageHeader, Field } from "../shared/ui";
import { Switch } from "../shared/switch";
import { Icon } from "../shared/icon";
import { Select2 } from "../shared/select2";
import { Toasts } from "../shared/toast";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageHeader,
    Field,
    Switch,
    Icon,
    Select2,
  ],
  template: `<app-header
      [title]="(editing ? 'ویرایش ' : 'ثبت ') + resource.singular"
      [subtitle]="
        resource.key === 'instructors'
          ? 'پرونده مدرس • اطلاعات فردی و تدریس'
          : 'اطلاعات پایه • ' + resource.title
      "
    >
      <a
        class="btn btn-light"
        [routerLink]="cancelPath"
        [queryParams]="listQuery"
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
              <header>
                <h2>
                  {{
                    resource.key === "instructors"
                      ? "اطلاعات مدرس"
                      : "اطلاعات " + resource.singular
                  }}
                </h2>
              </header>
              <div class="form-grid">
                @if (resource.key === "instructors") {
                  <app-field
                    ><input
                      id="instructor-first-name"
                      formControlName="firstName"
                      maxlength="100"
                      required
                    /><label for="instructor-first-name"
                      >نام *</label
                    ></app-field
                  >
                  <app-field
                    ><input
                      id="instructor-last-name"
                      formControlName="lastName"
                      maxlength="100"
                      required
                    /><label for="instructor-last-name"
                      >نام خانوادگی *</label
                    ></app-field
                  >
                  <app-field>
                    <select
                      id="instructor-instruments"
                      formControlName="instrumentIds"
                      appSelect2
                      multiple
                      required
                    >
                      @for (
                        instrument of instrumentChoices;
                        track instrument.id
                      ) {
                        <option [value]="instrument.id">
                          {{ instrument.value }}
                        </option>
                      }
                    </select>
                    <label for="instructor-instruments"
                      >سازهای تخصصی تدریس *</label
                    >
                  </app-field>
                } @else {
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
                }
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
                  <app-field>
                    <input
                      id="instrument-rate-toman"
                      formControlName="rateToman30"
                      [readOnly]="!api.user()?.admin"
                      inputmode="numeric"
                      dir="ltr"
                    />
                    <label for="instrument-rate-toman"
                      >نرخ پایه ۳۰ دقیقه (تومان)</label
                    >
                  </app-field>
                  <app-field>
                    <input
                      id="instrument-rate-usd"
                      formControlName="rateUsd30"
                      [readOnly]="!api.user()?.admin"
                      inputmode="decimal"
                      dir="ltr"
                    />
                    <label for="instrument-rate-usd"
                      >نرخ پایه ۳۰ دقیقه (دلار)</label
                    >
                  </app-field>
                }
                @if (resource.key === "teaching-types") {
                  <div>
                    <app-switch
                      formControlName="requiresAcademy"
                      label="نیاز به آموزشگاه"
                      onText="برای این شیوه، آموزشگاه الزامی است"
                      [offText]="
                        form.controls.requiresAcademy.value === null
                          ? 'تعیین نشده'
                          : 'بدون نیاز به آموزشگاه'
                      "
                    />
                    @if (form.controls.requiresAcademy.value === null) {
                      <button
                        type="button"
                        class="btn btn-light btn-sm"
                        (click)="form.controls.requiresAcademy.setValue(false)"
                      >
                        تأیید بدون نیاز به آموزشگاه
                      </button>
                    }
                  </div>
                }
                @if (resource.key === "payment-methods") {
                  <app-field>
                    <select
                      id="settlement-type"
                      appSelect2
                      formControlName="settlementType"
                    >
                      <option value="single">یکجا</option>
                      <option value="installment">اقساطی</option>
                      <option value="free">بدون شهریه</option>
                    </select>
                    <label for="settlement-type">شیوه تسویه *</label>
                  </app-field>
                  @if (form.controls.settlementType.value !== "free") {
                    <app-field>
                      <select
                        id="payment-currency"
                        appSelect2
                        formControlName="paymentCurrency"
                      >
                        <option value="rial">ریالی</option>
                        <option value="foreign">ارزی</option>
                      </select>
                      <label for="payment-currency">نوع پرداخت *</label>
                    </app-field>
                  }
                  @if (form.controls.settlementType.value === "installment") {
                    <app-field>
                      <input
                        id="installment-count"
                        inputmode="numeric"
                        formControlName="installmentCount"
                        required
                      />
                      <label for="installment-count">تعداد اقساط *</label>
                    </app-field>
                  }
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
                ><label for="base-notes"
                  >توضیحات{{
                    resource.key === "payment-methods" &&
                    form.controls.settlementType.value === "free"
                      ? " *"
                      : ""
                  }}</label
                ></app-field
              >
            </section>
          </div>
          <div class="student-editor-side">
            @if (resource.key === "instructors") {
              <section class="student-photo-card instructor-photo-card">
                <div class="student-photo-preview instructor-photo-preview">
                  @if (photoPreview) {
                    <img [src]="photoPreview" alt="عکس مدرس" />
                  } @else {
                    <span
                      class="student-photo-avatar student-avatar-placeholder"
                      aria-hidden="true"
                    ></span>
                    <span>عکسی انتخاب نشده است.</span>
                  }
                </div>
                <h2>عکس مدرس</h2>
                <p>JPG، PNG یا WebP تا ۵ مگابایت</p>
                <input
                  id="instructor-photo"
                  class="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  (change)="onPhoto($event)"
                />
                <label class="btn btn-light w-100" for="instructor-photo"
                  ><app-icon name="upload" />انتخاب عکس</label
                >
                @if (photoPreview) {
                  <button
                    type="button"
                    class="btn btn-sm btn-light photo-remove"
                    (click)="removeImage()"
                  >
                    حذف عکس
                  </button>
                }
              </section>
            }
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
        <footer class="student-editor-actions">
          <span>فیلدهای ستاره‌دار الزامی هستند.</span>
          <a
            class="btn btn-light"
            [routerLink]="cancelPath"
            [queryParams]="listQuery"
            >انصراف</a
          >
          <button class="btn btn-primary" [disabled]="busy">
            <app-icon name="save" />{{
              busy
                ? "در حال ذخیره…"
                : editing
                  ? "ذخیره تغییرات"
                  : resource.key === "instructors"
                    ? "ثبت و باز کردن پرونده"
                    : "ثبت و بازگشت"
            }}
          </button>
        </footer>
      </form>
    }`,
})
export class BaseDataForm implements OnInit, OnDestroy {
  route = inject(ActivatedRoute);
  router = inject(Router);
  api = inject(Api);
  toasts = inject(Toasts);
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
  instrumentChoices: { id: number; value: string }[] = [];
  photoPreview = "";
  photoFile: File | null = null;
  removePhoto = false;
  private photoObjectUrl = "";
  form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(150)]],
    firstName: ["", Validators.maxLength(100)],
    lastName: ["", Validators.maxLength(100)],
    instrumentIds: [[] as number[]],
    phone: "",
    englishName: ["", Validators.maxLength(150)],
    rateToman30: "",
    rateUsd30: "",
    notes: ["", Validators.maxLength(2000)],
    status: "active",
    settlementType: "single",
    paymentCurrency: "rial",
    installmentCount: "",
    requiresAcademy: this.fb.control<boolean | null>(true),
  });
  async ngOnInit() {
    if (this.resource.key === "instructors") {
      this.form.controls.name.clearValidators();
      this.form.controls.firstName.addValidators(Validators.required);
      this.form.controls.lastName.addValidators(Validators.required);
      this.form.controls.instrumentIds.addValidators(Validators.required);
    } else {
      this.form.controls.firstName.clearValidators();
      this.form.controls.lastName.clearValidators();
      this.form.controls.instrumentIds.clearValidators();
    }
    this.form.controls.name.updateValueAndValidity({ emitEvent: false });
    this.form.controls.firstName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.lastName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.instrumentIds.updateValueAndValidity({
      emitEvent: false,
    });
    if (this.resource.key === "instructors" || this.editing)
      this.loading = true;
    try {
      const requests: Promise<unknown>[] = [];
      if (this.resource.key === "instructors")
        requests.push(
          this.api
            .get<{
              items: { id: number; value: string }[];
            }>(
              "/instructors/instrument-options" +
                (this.editing
                  ? `?instructorId=${this.route.snapshot.paramMap.get("id")}`
                  : ""),
            )
            .then((result) => {
              this.instrumentChoices = result.items;
            }),
        );
      if (this.editing)
        requests.push(
          this.api
            .get<BaseRecord>(
              this.endpoint + "/" + this.route.snapshot.paramMap.get("id"),
            )
            .then((record) => {
              this.record = record;
              this.form.patchValue({
                ...record,
                phone: record.phone || "",
                englishName: record.english_name || "",
                rateToman30:
                  record.rate_toman_30 == null
                    ? ""
                    : String(record.rate_toman_30),
                rateUsd30:
                  record.rate_usd_cents_30 == null
                    ? ""
                    : String(record.rate_usd_cents_30 / 100),
                firstName: record.first_name || "",
                lastName: record.last_name || "",
                instrumentIds: record.instrument_ids || [],
                requiresAcademy:
                  record.requires_academy == null
                    ? null
                    : !!record.requires_academy,
                settlementType: record.settlement_type || "single",
                paymentCurrency: record.payment_currency || "rial",
                installmentCount:
                  record.installment_count == null
                    ? ""
                    : String(record.installment_count),
              });
              this.photoPreview = record.photo_url || "";
            }),
        );
      await Promise.all(requests);
    } catch (e) {
      this.error = errorMessage(e);
      this.toasts.show(this.error, "error");
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  onPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      this.toasts.show("عکس باید JPG، PNG یا WebP باشد.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toasts.show("حجم عکس باید حداکثر ۵ مگابایت باشد.", "error");
      return;
    }
    this.releasePhotoPreview();
    this.photoFile = file;
    this.removePhoto = false;
    this.photoObjectUrl = URL.createObjectURL(file);
    this.photoPreview = this.photoObjectUrl;
  }
  removeImage() {
    this.releasePhotoPreview();
    this.photoFile = null;
    this.photoPreview = "";
    this.removePhoto = !!this.record?.photo_url;
  }
  private releasePhotoPreview() {
    if (this.photoObjectUrl) URL.revokeObjectURL(this.photoObjectUrl);
    this.photoObjectUrl = "";
  }
  ngOnDestroy() {
    this.releasePhotoPreview();
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.busy) return;
    if (
      this.resource.key === "teaching-types" &&
      this.form.controls.requiresAcademy.value === null
    ) {
      this.toasts.show("نیاز به آموزشگاه را مشخص کنید.", "error");
      return;
    }
    if (this.resource.key === "payment-methods") {
      const values = this.form.getRawValue();
      const count = Number(
        values.installmentCount
          .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
          .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))),
      );
      if (
        values.settlementType === "installment" &&
        (!Number.isSafeInteger(count) || count < 2 || count > 10000)
      ) {
        this.toasts.show("تعداد اقساط باید عدد صحیح و حداقل ۲ باشد.", "error");
        return;
      }
      if (values.settlementType === "free" && !values.notes.trim()) {
        this.toasts.show("توضیح بدون شهریه الزامی است.", "error");
        return;
      }
    }
    if (this.form.invalid) {
      this.toasts.show(
        this.resource.key === "instructors"
          ? "نام، نام خانوادگی و دست‌کم یک ساز تخصصی را وارد کنید."
          : "عنوان الزامی است و باید حداکثر ۱۵۰ نویسه باشد.",
        "error",
      );
      return;
    }
    this.busy = true;
    this.error = "";
    try {
      const values = this.form.getRawValue();
      const body = {
        ...values,
        ...(this.resource.key !== "teaching-types"
          ? { requiresAcademy: undefined }
          : {}),
        ...(this.resource.key === "instructors"
          ? { name: `${values.firstName} ${values.lastName}`.trim() }
          : {}),
        ...(this.record ? { version: this.record.version } : {}),
      };
      let saved: BaseRecord;
      if (this.editing)
        saved = await this.api.patch<BaseRecord>(
          this.endpoint + "/" + this.record!.id,
          body,
        );
      else saved = await this.api.post<BaseRecord>(this.endpoint, body);
      if (
        this.resource.key === "instructors" &&
        (this.photoFile || this.removePhoto)
      ) {
        try {
          if (this.photoFile) {
            const photoBody = new FormData();
            photoBody.append("photo", this.photoFile);
            await this.api.post(`/instructors/${saved.id}/photo`, photoBody);
          } else {
            await this.api.delete(`/instructors/${saved.id}/photo`);
          }
        } catch (error) {
          this.record = saved;
          this.editing = true;
          this.toasts.show(
            "اطلاعات مدرس ذخیره شد، اما عکس ذخیره نشد: " + errorMessage(error),
            "error",
          );
          if (!this.route.snapshot.paramMap.get("id")) {
            await this.router.navigate([this.path, saved.id, "edit"], {
              queryParams: this.listQuery,
              replaceUrl: true,
            });
          }
          return;
        }
      }
      this.toasts.show("اطلاعات با موفقیت ذخیره شد.", "success");
      await this.router.navigate(
        this.resource.key === "instructors"
          ? [this.path, saved.id]
          : [this.path],
        { queryParams: this.listQuery },
      );
    } catch (e) {
      this.error = errorMessage(e);
      this.toasts.show(this.error, "error");
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  get cancelPath() {
    return this.resource.key === "instructors" && this.editing && this.record
      ? [this.path, this.record.id]
      : [this.path];
  }
}
