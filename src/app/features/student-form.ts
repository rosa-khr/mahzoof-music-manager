import { Profile } from "./profile";
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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import { Student, Subject } from "../core/models";
import { Field, PageHeader, jalaliToday, toIso } from "../shared/ui";
import { Datepicker } from "../shared/datepicker";
import { Icon } from "../shared/icon";
import {
  EducationFields,
  EducationOptions,
  educationControls,
  emptyEducationOptions,
} from "../shared/education-fields";

function contactRequired(control: AbstractControl): ValidationErrors | null {
  return control.get("phone")?.value?.trim() ||
    control.get("guardianPhone")?.value?.trim()
    ? null
    : { contactRequired: true };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Profile,
    Switch,
    Select2,
    ReactiveFormsModule,
    RouterLink,
    Field,
    PageHeader,
    Icon,
    EducationFields,
    Datepicker,
  ],
  template: `<app-header
      [title]="editing ? 'ویرایش هنرجو' : 'ثبت هنرجو'"
      subtitle="اطلاعات پرونده و تصویر هنرجو"
    >
      <a routerLink="/students" class="btn btn-light"
        ><app-icon name="chevron" />بازگشت به فهرست</a
      >
    </app-header>
    @if (editing) { <nav
      class="tabs student-management-tabs"
      role="tablist"
      aria-label="بخش‌های مدیریت هنرجو"
    >
      @for (item of studentTabs; track item.key) {
        @if (item.key !== "finance" || api.user()?.finance) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab === item.key"
            [class.active]="activeTab === item.key"
            (click)="selectTab(item.key)"
          >
            {{ item.label }}
          </button>
        }
      }
    </nav> }
    @if (loading) {
      <p role="status" class="loading-state">در حال دریافت اطلاعات هنرجو…</p>
    }
    @if (error) {
      <p role="alert" class="alert alert-danger">{{ error }}</p>
    }
    @if (!loading && (!editing || student)) {
      <form
        class="student-editor card"
        [hidden]="editing && activeTab !== 'info'"
        [formGroup]="form"
        (ngSubmit)="save()"
      >
        <div [hidden]="activeTab !== 'info'">
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
                      id="el"
                      formControlName="englishLast"
                      placeholder=" "
                      dir="ltr"
                      maxlength="100"
                    /><label for="el">نام خانوادگی انگلیسی</label></app-field
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
                      id="national-id"
                      formControlName="nationalId"
                      placeholder=" "
                      maxlength="80"
                    /><label for="national-id"
                      >کد ملی یا شناسه خارجی</label
                    ></app-field
                  >
                  <app-field
                    ><input
                      id="student-age"
                      formControlName="age"
                      type="number"
                      min="0"
                      max="130"
                      inputmode="numeric"
                    /><label for="student-age">سن (سال)</label></app-field
                  >
                </div>
              </section>
              <section class="student-form-section">
                <header><h2>اطلاعات تماس</h2></header>
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
                  <app-field
                    ><select appSelect2 id="contact-owner" formControlName="contactOwner">
                      <option value="student">هنرجو</option>
                      <option value="parent">والد یا سرپرست</option>
                      <option value="other">سایر</option></select
                    ><label for="contact-owner">صاحب شماره تماس *</label></app-field
                  >
                </div>
                @if (form.hasError("contactRequired") && form.touched) {
                  <p class="text-danger" role="alert">
                    شماره تماس هنرجو یا سرپرست را وارد کنید.
                  </p>
                }
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
              <details class="student-form-accordion">
                <summary>اطلاعات تکمیلی <small>اختیاری</small></summary>
                <div class="form-grid">
                  <app-field><select appSelect2 id="gender" formControlName="gender"><option value="">ثبت نشده</option><option value="female">زن</option><option value="male">مرد</option><option value="other">سایر</option></select><label for="gender">جنسیت</label></app-field>
                  <app-field><input id="landline" formControlName="landline" type="tel" dir="ltr" /><label for="landline">تلفن ثابت</label></app-field>
                  <app-field><select appSelect2 id="country-scope" formControlName="countryScope"><option value="iran">ایران</option><option value="other">سایر کشورها</option></select><label for="country-scope">کشور</label></app-field>
                  @if (form.controls.countryScope.value === "other") {
                    <app-field><input id="other-country" formControlName="otherCountry" placeholder=" " maxlength="100" required /><label for="other-country">نام کشور *</label></app-field>
                  }
                  <app-field><input id="city" formControlName="city" /><label for="city">شهر</label></app-field>
                  <app-field><input id="student-timezone" formControlName="timezone" dir="ltr" /><label for="student-timezone">منطقه زمانی هنرجو (IANA)</label></app-field>
                  <app-field><input id="education-level" formControlName="educationLevel" /><label for="education-level">تحصیلات</label></app-field>
                  <app-field><select appSelect2 id="acquaintance-method" formControlName="acquaintanceMethod"><option value="">انتخاب کنید</option><option value="instagram">اینستاگرام</option><option value="website">سایت</option><option value="referrer">معرف</option></select><label for="acquaintance-method">شیوه آشنایی با آموزشگاه</label></app-field>
                  @if (form.controls.acquaintanceMethod.value === "referrer") {
                    <app-field><input id="referrer-name" formControlName="referrerName" placeholder=" " maxlength="500" required /><label for="referrer-name">نام معرف *</label></app-field>
                  }
                </div>
                <app-field>
                  <textarea
                    id="student-address"
                    formControlName="address"
                    maxlength="2000"
                  ></textarea
                  ><label for="student-address">آدرس</label></app-field
                >
                <app-field><textarea id="internal-notes" formControlName="internalNotes"></textarea><label for="internal-notes">یادداشت داخلی (چاپ نمی‌شود)</label></app-field>
              </details>
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
                    <span
                      class="student-photo-avatar student-avatar-placeholder"
                      aria-hidden="true"
                    ></span>
                    <span>عکس هنرجو هنوز انتخاب نشده است.</span>
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
        </div>
        <section class="student-form-section student-education-box">
          <header>
            <div>
              <h2>اطلاعات ساز و مسیر آموزشی</h2>
              <small>برای هر ساز یک مسیر مستقل ساخته می‌شود؛ پرونده شخصی هنرجو تکرار نمی‌شود.</small>
            </div>
          </header>
          <div class="instrument-selection-block">
            <div class="instrument-goal-row">
              <app-field>
                <select appSelect2 id="student-instrument" formControlName="instrumentId" (change)="instrumentChanged()">
                  <option value="">انتخاب کنید</option>
                  @for (item of educationOptions.instruments; track item.id) {
                    <option [value]="item.id">{{ item.name }}</option>
                  }
                </select>
                <label for="student-instrument">{{ editing ? "انتخاب یا افزودن ساز" : "ساز" }}</label>
              </app-field>
              <app-field><input id="registration-goal" formControlName="registrationGoal" /><label for="registration-goal">هدف ثبت‌نام</label></app-field>
            </div>
            @if (editing) {
              @if (student?.enrollments?.length) {
                <div class="student-current-instruments">
                  <small>سازهای ثبت‌شده</small>
                  @for (path of student!.enrollments; track path.id) {
                    <span>{{ path.subject }}</span>
                  }
                </div>
              }
              <p class="form-text">انتخاب ساز جدید، یک مسیر آموزشی مستقل به همین پرونده اضافه می‌کند.</p>
            } @else {
              <app-education-fields
                [group]="form"
                [options]="educationOptions"
                [paymentRequired]="false"
                [selectionRequired]="false"
                [showInstrument]="false"
              />
            }
          </div>
          @if (!editing) {
            <div class="form-grid">
              <app-field><select appSelect2 id="student-structure" formControlName="structure"><option value="private">خصوصی</option><option value="group">گروهی</option></select><label for="student-structure">نوع کلاس</label></app-field>
              <app-field><select appSelect2 id="audience-group" formControlName="audienceGroup"><option value="">تعیین نشده</option><option value="child">خردسال</option><option value="teen">نوجوان</option><option value="adult">بزرگسال</option></select><label for="audience-group">گروه آموزشی</label></app-field>
              <app-field><input id="registration-date" appDatepicker formControlName="registrationDate" dir="ltr" /><label for="registration-date">تاریخ ثبت‌نام</label></app-field>
            </div>
          }
          <div class="education-notes-grid">
            <app-field><textarea id="artistic-history" formControlName="artisticHistory"></textarea><label for="artistic-history">پیشینه هنری</label></app-field>
            <app-field><textarea id="interview-notes" formControlName="interviewNotes"></textarea><label for="interview-notes">مصاحبه</label></app-field>
          </div>
          @if (!editing) {
            <p class="form-text">انتخاب ساز در تشکیل اولیه پرونده اختیاری است؛ ترم و پرداخت نیز اجباری نیستند.</p>
          }
        </section>
        @if (!editing) {
          @if (activeTab === "attendance" || activeTab === "finance") {
            <p class="empty">
              ابتدا اطلاعات فردی و واحد آموزشی را ثبت کنید؛ سپس جلسات، حضور و
              غیاب و شهریه ترم در همین تب‌ها در دسترس‌اند.
            </p>
          }
        }
        @if (form.invalid && form.touched) {
          <p class="text-danger">فیلدهای الزامی را تکمیل کنید.</p>
        }
        @if (duplicates.length) {
          <section class="alert alert-warning"><p>پرونده با همین نام وجود دارد. برای ثبت‌نام جدیدِ همان هنرجو، پرونده موجود را باز کنید.</p>
            @for(item of duplicates;track item.id){<a [routerLink]="['/students',item.id]">{{item.code}} • {{item.first_name}} {{item.last_name}}</a>}
            <app-switch formControlName="confirmDistinct" label="بررسی کردم؛ این هنرجو شخص دیگری است" />
          </section>
        }
        <footer class="student-editor-actions">
          <span>فیلدهای ستاره‌دار الزامی هستند.</span
          ><a
            class="btn btn-light"
            [routerLink]="editing ? ['/students', student?.id] : ['/students']"
            >انصراف</a
          >@if (!editing) {
            <button type="button" class="btn btn-light" [disabled]="busy || !!photoError" (click)="save(true)">ذخیره و چاپ پرونده</button>
          }
          <button class="btn btn-primary" [disabled]="busy || !!photoError">
            <app-icon name="save" />{{
              busy
                ? "در حال ذخیره…"
                : editing
                  ? "ذخیره تغییرات"
                  : "ذخیره"
            }}
          </button>
        </footer>
      </form>
      @if (editing && activeTab !== "info") {
        <app-student-profile [embedded]="true" [initialTab]="activeTab" />
      }
    }`,
})
export class StudentForm implements OnInit, OnDestroy {
  api = inject(Api);
  cdr = inject(ChangeDetectorRef);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  editing = !!this.route.snapshot.paramMap.get("id");
  studentTabs = [
    { key: "info", label: "اطلاعات فردی" },
    { key: "terms", label: "اطلاعات ساز و جلسه" },
    { key: "attendance", label: "حضور و غیاب" },
    { key: "finance", label: "مالی" },
  ];
  activeTab = "info";
  selectTab(tab: string) {
    this.activeTab = tab;
  }
  student: Student | null = null;
  subjects: Subject[] = [];
  educationOptions = emptyEducationOptions();
  loading = false;
  busy = false;
  error = "";
  photoError = "";
  preview = "";
  file: File | null = null;
  removePhoto = false;
  dragging = false;
  objectUrl = "";
  requestKey = crypto.randomUUID();
  private submitted = '';
  duplicates: Student[]=[];
  form = this.fb.nonNullable.group({
    firstName: ["", Validators.required],
    lastName: ["", Validators.required],
    englishFirst: "",
    englishLast: "",
    phone: "",
    contactOwner: "student",
    age: [
      "",
      [Validators.min(0), Validators.max(130), Validators.pattern(/^\d*$/)],
    ],
    address: ["", Validators.maxLength(2000)],
    gender: "",
    nationalId: "",
    landline: "",
    countryScope: "iran",
    otherCountry: "",
    city: "",
    timezone: 'Asia/Tehran',
    educationLevel: "",
    artisticHistory: "",
    acquaintanceMethod: "",
    referrerName: "",
    registrationGoal: "",
    interviewNotes: "",
    internalNotes: "",
    audienceGroup: "",
    registrationDate: jalaliToday(),
    structure: "private",
    subjectId: "",
    ...educationControls(),
    guardianName: "",
    guardianPhone: "",
    guardianRelationship: "سرپرست",
    history: "unknown",
    missingContactReason: "",
    status: "active",
    confirmDistinct: false,
  });
  setArchived(archived: boolean) {
    this.form.controls.status.setValue(archived ? "archived" : "inactive");
    this.form.controls.status.markAsDirty();
  }
  instrumentChanged() {
    const instrumentId = Number(this.form.controls.instrumentId.value);
    const defaultTeacher = this.educationOptions.instructors.find(
      (item) =>
        item.instrument_ids.includes(instrumentId) &&
        item.name.replace(/\s+/g, " ").trim() === "شهرام محذوف",
    );
    this.form.controls.instructorId.setValue(
      defaultTeacher ? String(defaultTeacher.id) : "",
    );
  }
  async ngOnInit() {
    this.loading = true;
    this.form.controls.countryScope.valueChanges.subscribe(() =>
      this.updateCountryValidation(),
    );
    this.form.controls.acquaintanceMethod.valueChanges.subscribe(() =>
      this.updateReferrerValidation(),
    );
    this.updateCountryValidation();
    this.updateReferrerValidation();
    if (this.editing) {
      this.form.controls.subjectId.clearValidators();
      this.form.controls.subjectId.updateValueAndValidity();
    }
    try {
      this.educationOptions = await this.api.get<EducationOptions>(
        "/students/education-options",
      );
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
          instrumentId: String(s.enrollments[0]?.instrument_id || ""),
          contactOwner: s.contact_owner || "student",
          age: s.age == null ? "" : String(s.age),
          address: s.address || "",
          gender: s.gender || "",
          nationalId: s.national_id || "",
          landline: s.landline || "",
          countryScope:
            !s.country || s.country.trim() === "ایران" ? "iran" : "other",
          otherCountry:
            !s.country || s.country.trim() === "ایران" ? "" : s.country,
          city: s.city || "",
          timezone: s.timezone,
          educationLevel: s.education_level || "",
          artisticHistory: s.artistic_history || "",
          acquaintanceMethod: this.acquaintanceMethod(s.referral_source || ""),
          referrerName: this.referrerName(s.referral_source || ""),
          registrationGoal: s.registration_goal || "",
          interviewNotes: s.interview_notes || "",
          internalNotes: s.internal_notes || "",
          audienceGroup: s.audience_group || "",
          guardianName: g?.name || "",
          guardianPhone: g?.phone || "",
          guardianRelationship: g?.relationship || "سرپرست",
          history: s.history,
          missingContactReason: s.missing_contact_reason,
          status: s.status,
        });
        if (s.phone || g?.phone) this.form.addValidators(contactRequired);
        this.preview = s.photo_url || "";
      } else {
        this.form.addValidators(contactRequired);
      }
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
  updateCountryValidation() {
    const control = this.form.controls.otherCountry;
    control.setValidators(
      this.form.controls.countryScope.value === "other"
        ? [Validators.required, Validators.maxLength(100)]
        : [Validators.maxLength(100)],
    );
    control.updateValueAndValidity({ emitEvent: false });
  }
  updateReferrerValidation() {
    const control = this.form.controls.referrerName;
    control.setValidators(
      this.form.controls.acquaintanceMethod.value === "referrer"
        ? [Validators.required, Validators.maxLength(500)]
        : [Validators.maxLength(500)],
    );
    control.updateValueAndValidity({ emitEvent: false });
  }
  acquaintanceMethod(value: string) {
    const normalized = value.trim();
    if (normalized === "اینستاگرام") return "instagram";
    if (normalized === "سایت") return "website";
    return normalized ? "referrer" : "";
  }
  referrerName(value: string) {
    const normalized = value.trim();
    return normalized.startsWith("معرف:")
      ? normalized.slice("معرف:".length).trim()
      : ["اینستاگرام", "سایت"].includes(normalized)
        ? ""
        : normalized;
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
  async save(printAfter = false) {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy || this.photoError) {
      if (
        !this.editing &&
        [
          "instrumentId",
          "instructorId",
          "teachingTypeId",
          "academyId",
          "paymentMethodId",
        ].some((key) => this.form.get(key)?.invalid)
      )
        this.activeTab = "terms";
      else this.activeTab = "info";
      return;
    }
    this.busy = true;
    this.error = "";
    try {
      if(!this.editing&&!this.submitted){const v=this.form.getRawValue();this.duplicates=(await this.api.get<{items:Student[]}>(`/students/duplicate-options?${new URLSearchParams({firstName:v.firstName,lastName:v.lastName})}`)).items;if(this.duplicates.length&&!v.confirmDistinct){this.error='پرونده مشابه را بررسی کنید.';return;}}
      const data = {
        ...this.form.getRawValue(),
        country:
          this.form.controls.countryScope.value === "iran"
            ? "ایران"
            : this.form.controls.otherCountry.value.trim(),
        referralSource:
          this.form.controls.acquaintanceMethod.value === "instagram"
            ? "اینستاگرام"
            : this.form.controls.acquaintanceMethod.value === "website"
              ? "سایت"
              : this.form.controls.acquaintanceMethod.value === "referrer"
                ? `معرف: ${this.form.controls.referrerName.value.trim()}`
                : "",
        registrationDate: toIso(this.form.controls.registrationDate.value),
        removePhoto: this.removePhoto,
        ...(this.student
          ? {
              version: this.student.version,
              guardianId: this.student.guardians[0]?.id,
            }
          : {}),
      };
      const body = new FormData();
      body.append("data", JSON.stringify(data));
      if (this.file) body.append("photo", this.file);
      const fingerprint = JSON.stringify(data) + (this.file ? `${this.file.name}:${this.file.size}:${this.file.lastModified}` : '');
      if (!this.editing && this.submitted && this.submitted !== fingerprint)
        throw Error('نتیجه درخواست قبلی مشخص نیست؛ ابتدا فهرست هنرجویان را بررسی کنید یا همان اطلاعات را دوباره ارسال کنید.');
      this.submitted = fingerprint;
      const saved = this.editing
        ? await this.api.patch<Student>("/students/" + this.student!.id, body)
        : await this.api.post<Student>("/students", body, this.requestKey);
      await this.router.navigate(
        printAfter ? ["/students", saved.id, "print"] : ["/students", saved.id],
      );
    } catch (e) {
      this.error = e instanceof Error && !('error' in e) ? e.message : errorMessage(e);
      if ((e as {status?:number}).status && (e as {status:number}).status < 500 && (e as {status:number}).status !== 409) this.submitted = '';
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
