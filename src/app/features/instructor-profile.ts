import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import { BaseRecord } from "../core/base-data";
import { Badge, PageHeader, PersianDate } from "../shared/ui";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, Badge, PersianDate],
  template: `
    <a
      routerLink="/base-data/instructors"
      [queryParams]="listQuery"
      class="back-link student-profile-back"
      >بازگشت به پرونده مدرسین</a
    >
    @if (error) {
      <p class="alert alert-danger" role="alert">
        {{ error }}
        <button class="btn btn-light" (click)="load()">تلاش مجدد</button>
      </p>
    }
    @if (loading) {
      <p class="loading-state" role="status">در حال دریافت پرونده مدرس…</p>
    }
    @if (instructor; as item) {
      <app-header
        class="student-profile-header"
        [title]="displayName(item)"
        subtitle="پرونده مدرس • اطلاعات فردی و تدریس"
      >
        <div class="actions profile-actions profile-actions-header">
          <a
            class="btn btn-primary"
            [routerLink]="['/base-data/instructors', item.id, 'edit']"
            [queryParams]="listQuery"
            >ویرایش مدرس</a
          >
        </div>
      </app-header>

      <div class="student-dossier instructor-dossier">
        <aside class="dossier-sidebar">
          <section class="card dossier-identity">
            @if (item.photo_url) {
              <img
                class="profile-photo dossier-photo"
                [src]="item.photo_url"
                alt="عکس مدرس"
              />
            } @else {
              <span
                class="dossier-avatar student-avatar-placeholder"
                aria-hidden="true"
              ></span>
            }
            <strong class="dossier-name">{{ displayName(item) }}</strong>
            <p class="dossier-english">مدرس آموزشگاه</p>
            <app-badge [value]="item.status" />
            <dl class="dossier-facts">
              <dt>شماره تماس</dt>
              <dd>
                <bdi>{{ item.phone || "ثبت نشده" }}</bdi>
              </dd>
              <dt>تاریخ ایجاد</dt>
              <dd>{{ item.created_at | persianDate }}</dd>
            </dl>
            <div class="dossier-enrollments">
              <small>سازهای تخصصی تدریس</small>
              @for (instrument of instruments(item); track instrument) {
                <span class="chip">{{ instrument }}</span>
              } @empty {
                <span class="text-secondary">ثبت نشده</span>
              }
            </div>
          </section>
        </aside>

        <div class="dossier-content">
          <div class="actions profile-actions profile-actions-content">
            <a
              class="btn btn-primary"
              [routerLink]="['/base-data/instructors', item.id, 'edit']"
              [queryParams]="listQuery"
              >ویرایش مدرس</a
            >
          </div>
          <nav class="tabs" aria-label="بخش‌های پرونده مدرس">
            <button
              type="button"
              [class.active]="tab === 'info'"
              (click)="setTab('info')"
            >
              اطلاعات فردی
            </button>
            <button
              type="button"
              [class.active]="tab === 'teaching'"
              (click)="setTab('teaching')"
            >
              اطلاعات تدریس
            </button>
          </nav>

          @if (tab === "info") {
            <section class="card dossier-section">
              <header><h2>مشخصات مدرس</h2></header>
              <dl class="details dossier-section-body">
                <dt>نام</dt>
                <dd>{{ item.first_name || "ثبت نشده" }}</dd>
                <dt>نام خانوادگی</dt>
                <dd>{{ item.last_name || "ثبت نشده" }}</dd>
                <dt>شماره تماس</dt>
                <dd>
                  <bdi>{{ item.phone || "ثبت نشده" }}</bdi>
                </dd>
                <dt>وضعیت</dt>
                <dd><app-badge [value]="item.status" /></dd>
                <dt>تاریخ ایجاد پرونده</dt>
                <dd>{{ item.created_at | persianDate }}</dd>
              </dl>
            </section>
          } @else {
            <section class="card dossier-section">
              <header><h2>سازهای تخصصی تدریس</h2></header>
              <div class="dossier-section-body instructor-specialties">
                @for (instrument of instruments(item); track instrument) {
                  <span class="chip">{{ instrument }}</span>
                } @empty {
                  <p>هنوز ساز تخصصی برای این مدرس ثبت نشده است.</p>
                }
              </div>
            </section>
            <section class="card dossier-section">
              <header><h2>توضیحات</h2></header>
              <div class="dossier-section-body">
                <p>{{ item.notes || "توضیحی ثبت نشده است." }}</p>
              </div>
            </section>
          }
        </div>
      </div>
    }
  `,
})
export class InstructorProfile implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(Api);
  private cdr = inject(ChangeDetectorRef);
  instructor: BaseRecord | null = null;
  loading = true;
  error = "";
  tab: "info" | "teaching" = "info";
  listQuery = Object.fromEntries(
    Object.entries(this.route.snapshot.queryParams).filter(([key]) =>
      ["page", "size", "filters", "sort"].includes(key),
    ),
  );

  ngOnInit() {
    this.tab =
      this.route.snapshot.queryParamMap.get("tab") === "teaching"
        ? "teaching"
        : "info";
    void this.load();
  }

  async load() {
    this.loading = true;
    this.error = "";
    this.cdr.markForCheck();
    try {
      this.instructor = await this.api.get<BaseRecord>(
        "/base-data/instructors/" + this.route.snapshot.paramMap.get("id"),
      );
    } catch (error) {
      this.error = errorMessage(error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  displayName(item: BaseRecord) {
    return (
      `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.name
    );
  }

  instruments(item: BaseRecord) {
    return (item.instrument_names || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  setTab(tab: "info" | "teaching") {
    this.tab = tab;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === "info" ? null : tab },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
}
