import { Switch } from "../shared/switch";
import { Select2 } from "../shared/select2";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import { Student, Subject } from "../core/models";
import { Field, PageHeader } from "../shared/ui";
import { Icon } from "../shared/icon";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Switch,
    Select2,
    ReactiveFormsModule,
    RouterLink,
    Field,
    PageHeader,
    Icon,
  ],
  template: `<app-header
      [title]="editing ? 'ویرایش هنرجو' : 'ثبت هنرجو'"
      subtitle="اطلاعات پرونده و تصویر هنرجو"
    >
      <a routerLink="/students" class="btn btn-light"
        ><app-icon name="chevron" />بازگشت به فهرست</a
      >
    </app-header>
    @if (loading) {
      <p role="status" class="loading-state">در حال دریافت اطلاعات هنرجو…</p>
    }
    @if (error) {
      <p role="alert" class="alert alert-danger">{{ error }}</p>
    }
    @if (!loading && (!editing || student)) {
      <form class="student-editor card" [formGroup]="form" (ngSubmit)="save()">
        <fieldset [disabled]="busy" class="student-editor-layout">
          <div class="student-editor-main">
            <section class="student-form-section">
              <header>
                <h2>اطلاعات اصلی</h2>
                <small>نام و نام خانوادگی را مطابق پرونده وارد کنید.</small>
              </header>
              <div class="form-grid">
                <app-field
                  ><input
                    id="first"
                    formControlName="firstName"
                    placeholder=" "
                    required
                    maxlength="100"
                  /><label for="first">نام فارسی *</label></app-field
                >
                <app-field
                  ><input
                    id="last"
                    formControlName="lastName"
                    placeholder=" "
                    required
                    maxlength="100"
                  /><label for="last">نام خانوادگی فارسی *</label></app-field
                >
                <app-field
                  ><input
                    id="ef"
                    formControlName="englishFirst"
                    placeholder=" "
                    dir="ltr"
                    maxlength="100"
                  /><label for="ef">نام انگلیسی</label></app-field
                >
                <app-field
                  ><input
                    id="el"
                    formControlName="englishLast"
                    placeholder=" "
                    dir="ltr"
                    maxlength="100"
                  /><label for="el">نام خانوادگی انگلیسی</label></app-field
                >
              </div>
            </section>
            <section class="student-form-section">
              <header><h2>اطلاعات تماس و آموزش</h2></header>
              <div class="form-grid">
                <app-field
                  ><input
                    id="phone"
                    formControlName="phone"
                    type="tel"
                    placeholder=" "
                    dir="ltr"
                    maxlength="30"
                  /><label for="phone">تماس هنرجو</label></app-field
                >
                @if (!editing) {
                  <app-field
                    ><select
                      appSelect2
                      id="subject"
                      formControlName="subjectId"
                      required
                    >
                      <option value="">انتخاب کنید</option>
                      @for (s of subjects; track s.id) {
                        <option [value]="s.id">{{ s.name }}</option>
                      }</select
                    ><label for="subject"
                      >واحد آموزشی موردنظر *</label
                    ></app-field
                  >
                }
              </div>
              @if (editing) {
                <div class="student-subjects">
                  <small>مسیرهای آموزشی</small>
                  @for (e of student?.enrollments; track e.subject_id) {
                    <span class="chip">{{ e.subject }}</span>
                  }
                </div>
              }
              <p class="form-text">
                {{
                  editing
                    ? "ترم‌ها و سوابق آموزشی از پرونده هنرجو مدیریت می‌شوند."
                    : "انتخاب واحد آموزشی، ترم یا صورتحساب ایجاد نمی‌کند."
                }}
              </p>
            </section>
            <details
              class="student-form-accordion"
              [open]="!!student?.guardians?.length"
            >
              <summary>
                والد یا سرپرست
                <small
                  >اختیاری؛ در صورت نداشتن شماره شخصی هنرجو تکمیل شود.</small
                >
              </summary>
              <div class="form-grid">
                <app-field
                  ><input
                    id="gn"
                    formControlName="guardianName"
                    placeholder=" "
                    maxlength="150"
                  /><label for="gn">نام سرپرست</label></app-field
                >
                <app-field
                  ><input
                    id="gp"
                    formControlName="guardianPhone"
                    type="tel"
                    placeholder=" "
                    dir="ltr"
                    maxlength="30"
                  /><label for="gp">تماس سرپرست</label></app-field
                >
                <app-field
                  ><input
                    id="gr"
                    formControlName="guardianRelationship"
                    placeholder=" "
                    maxlength="80"
                  /><label for="gr">نسبت سرپرست</label></app-field
                >
              </div>
            </details>
            @if (api.user()?.admin) {
              <details
                class="student-form-accordion"
                [open]="!!form.controls.missingContactReason.value"
              >
                <summary>ثبت بدون اطلاعات تماس</summary>
                <div class="student-reason">
                  <app-field>
                    <textarea
                      id="missing"
                      formControlName="missingContactReason"
                      placeholder=" "
                      maxlength="1000"
                    ></textarea
                    ><label for="missing"
                      >دلیل ثبت بدون تماس (فقط مدیر)</label
                    ></app-field
                  >
                </div>
              </details>
            }
          </div>
          <div class="student-editor-side">
            <section
              class="student-photo-card"
              [class.dragging]="dragging"
              (dragover)="onDrag($event)"
              (dragleave)="dragging = false"
              (drop)="onDrop($event)"
            >
              <div class="student-photo-preview">
                @if (preview) {
                  <img [src]="preview" alt="عکس هنرجو" />
                } @else {
                  <app-icon name="users" /><span
                    >عکس هنرجو هنوز انتخاب نشده است.</span
                  >
                }
              </div>
              <h2>عکس هنرجو</h2>
              <p>
                JPG، PNG یا WebP تا ۵ مگابایت؛ عکس را انتخاب کنید یا اینجا رها
                کنید.
              </p>
              <input
                id="student-photo"
                class="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                (change)="onFile($event)"
              />
              <label class="btn btn-light w-100" for="student-photo"
                ><app-icon name="upload" />انتخاب عکس هنرجو</label
              >
              @if (preview || photoError) {
                <button
                  type="button"
                  class="btn btn-sm photo-remove"
                  (click)="removeImage()"
                >
                  حذف عکس
                </button>
              }
              @if (photoError) {
                <p class="text-danger" role="alert">{{ photoError }}</p>
              }
              <small>عکس با ذخیره اطلاعات پرونده ثبت می‌شود.</small>
            </section>
            <section class="student-form-section student-form-settings">
              <header><h2>وضعیت پرونده</h2></header>
              @if (form.controls.status.value !== "archived") {
                <app-switch
                  formControlName="status"
                  onValue="active"
                  offValue="inactive"
                  label="فعال بودن هنرجو"
                />
              }
              <app-switch
                label="بایگانی پرونده"
                onText="بایگانی‌شده"
                offText="بایگانی نشده"
                [checked]="form.controls.status.value === 'archived'"
                (checkedChange)="setArchived($event)"
              />
              <app-field
                ><select appSelect2 id="history" formControlName="history">
                  <option value="unknown">نامشخص</option>
                  <option value="new">هنرجوی جدید آموزشگاه</option>
                  <option value="old">سابقه قبلی دارد</option></select
                ><label for="history">سابقه ثبت‌نام</label></app-field
              >
              <div class="student-code-info">
                <small>کد هنرجو</small
                ><b dir="ltr">{{
                  student?.code || "پس از ثبت ساخته می‌شود"
                }}</b>
              </div>
            </section>
          </div>
        </fieldset>
        @if (form.invalid && form.touched) {
          <p class="text-danger">فیلدهای الزامی را تکمیل کنید.</p>
        }
        <footer class="student-editor-actions">
          <span>فیلدهای ستاره‌دار الزامی هستند.</span
          ><a
            class="btn btn-light"
            [routerLink]="editing ? ['/students', student?.id] : ['/students']"
            >انصراف</a
          ><button class="btn btn-primary" [disabled]="busy || !!photoError">
            <app-icon name="save" />{{
              busy
                ? "در حال ذخیره…"
                : editing
                  ? "ذخیره تغییرات"
                  : "ثبت و باز کردن پرونده"
            }}
          </button>
        </footer>
      </form>
    }`,
})
export class StudentForm implements OnInit, OnDestroy {
  api = inject(Api);
  cdr = inject(ChangeDetectorRef);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  editing = !!this.route.snapshot.paramMap.get("id");
  student: Student | null = null;
  subjects: Subject[] = [];
  loading = false;
  busy = false;
  error = "";
  photoError = "";
  preview = "";
  file: File | null = null;
  removePhoto = false;
  dragging = false;
  objectUrl = "";
  form = this.fb.nonNullable.group({
    firstName: ["", Validators.required],
    lastName: ["", Validators.required],
    englishFirst: "",
    englishLast: "",
    phone: "",
    subjectId: ["", Validators.required],
    guardianName: "",
    guardianPhone: "",
    guardianRelationship: "سرپرست",
    history: "unknown",
    missingContactReason: "",
    status: "active",
  });
  setArchived(archived: boolean) {
    this.form.controls.status.setValue(archived ? "archived" : "inactive");
    this.form.controls.status.markAsDirty();
  }
  async ngOnInit() {
    this.loading = true;
    if (this.editing) this.form.controls.subjectId.clearValidators();
    try {
      if (this.editing) {
        this.student = await this.api.get<Student>(
          "/students/" + this.route.snapshot.paramMap.get("id"),
        );
        const s = this.student,
          g = s.guardians[0];
        this.form.patchValue({
          firstName: s.first_name,
          lastName: s.last_name,
          englishFirst: s.english_first,
          englishLast: s.english_last,
          phone: s.phone,
          guardianName: g?.name || "",
          guardianPhone: g?.phone || "",
          guardianRelationship: g?.relationship || "سرپرست",
          history: s.history,
          missingContactReason: s.missing_contact_reason,
          status: s.status,
        });
        this.preview = s.photo_url || "";
      } else this.subjects = await this.api.get<Subject[]>("/subjects");
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.selectImage(file);
    input.value = "";
  }
  onDrag(event: DragEvent) {
    event.preventDefault();
    if (!this.busy) this.dragging = true;
  }
  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging = false;
    if (this.busy) return;
    const file = event.dataTransfer?.files[0];
    if (file) this.selectImage(file);
  }
  selectImage(file: File) {
    if (this.busy) return;
    this.photoError = "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      this.photoError = "عکس باید JPG، PNG یا WebP باشد.";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError = "حجم عکس باید حداکثر ۵ مگابایت باشد.";
      return;
    }
    this.releasePreview();
    this.file = file;
    this.removePhoto = false;
    this.objectUrl = URL.createObjectURL(file);
    this.preview = this.objectUrl;
  }
  removeImage() {
    this.releasePreview();
    this.file = null;
    this.preview = "";
    this.removePhoto = !!this.student?.photo_url;
    this.photoError = "";
  }
  releasePreview() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = "";
  }
  ngOnDestroy() {
    this.releasePreview();
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy || this.photoError) return;
    this.busy = true;
    this.error = "";
    try {
      const data = {
        ...this.form.getRawValue(),
        removePhoto: this.removePhoto,
        ...(this.student
          ? {
              version: this.student.version,
              guardianId: this.student.guardians[0]?.id,
              timezone: this.student.timezone,
            }
          : {}),
      };
      const body = new FormData();
      body.append("data", JSON.stringify(data));
      if (this.file) body.append("photo", this.file);
      const saved = this.editing
        ? await this.api.patch<Student>("/students/" + this.student!.id, body)
        : await this.api.post<Student>("/students", body);
      await this.router.navigate(["/students", saved.id]);
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
