import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import { RoleRecord } from "../core/roles";
import { Switch } from "../shared/switch";
import { confirmUserChange } from "../shared/confirm";
import { PageHeader, Field } from "../shared/ui";
import menuCatalog from "../../../shared/menu-permissions.json";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, PageHeader, Field, Switch],
  template: `
    <app-header
      [title]="editing ? 'ویرایش نقش' : 'ثبت نقش'"
      subtitle="مدیریت امنیت"
    >
      <a class="btn btn-light" routerLink="/roles">بازگشت به فهرست</a>
    </app-header>
    @if (error) {
      <p role="alert" class="alert alert-danger">{{ error }}</p>
    }
    @if (loading) {
      <p role="status">در حال دریافت نقش…</p>
    }
    @if (!loading && (!editing || role)) {
      <form class="role-editor card" [formGroup]="form" (ngSubmit)="save()">
        <fieldset [disabled]="busy">
          <section class="role-details">
            <app-field
              ><input
                id="role-name"
                formControlName="name"
                required
                maxlength="100"
              />
              <label for="role-name">نام نقش *</label></app-field
            >
            <app-switch formControlName="active" label="فعال بودن نقش" />
          </section>
          @if (role?.is_admin) {
            <p class="alert alert-info">
              نقش مدیر همیشه فعال است و به همه منوها دسترسی دارد؛ دسترسی‌های آن
              قابل کاهش نیست.
            </p>
          }
          <header class="role-permissions-heading">
            <h2>دسترسی منوها</h2>
            <p class="form-text">
              منوهای مجاز را انتخاب کنید. ذخیره تغییرات، نشست کاربران این نقش را
              پایان می‌دهد. نقش غیرفعال اجازه ورود ندارد.
            </p>
          </header>
          <div class="role-permission-groups">
            @for (group of groups; track group.title; let i = $index) {
              <fieldset
                class="role-permission-group"
                [disabled]="!!role?.is_admin"
              >
                <legend>
                  <label class="permission-checkbox permission-group-title">
                    <input
                      type="checkbox"
                      [disabled]="!!role?.is_admin"
                      [attr.aria-label]="'همه منوهای ' + group.title"
                      [checked]="groupChecked(group.items)"
                      [indeterminate]="groupPartial(group.items)"
                      (change)="toggleGroup(group.items, $event)"
                    />
                    <span>{{ group.title }}</span>
                  </label>
                </legend>
                @for (menu of group.items; track menu.path) {
                  <label class="permission-checkbox">
                    <input
                      type="checkbox"
                      [disabled]="!!role?.is_admin"
                      [checked]="selected.has(menu.path)"
                      [attr.aria-label]="'دسترسی ' + menu.title"
                      (change)="toggle(menu.path, $event)"
                    />
                    <span>{{ menu.title }}</span>
                  </label>
                }
              </fieldset>
            }
          </div>
        </fieldset>
        @if (form.invalid && form.touched) {
          <p role="alert" class="text-danger">
            نام نقش الزامی و حداکثر ۱۰۰ نویسه است.
          </p>
        }
        <footer class="student-editor-actions">
          <a routerLink="/roles" class="btn btn-light">انصراف</a>
          <button class="btn btn-primary" [disabled]="busy">
            {{ busy ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت نقش" }}
          </button>
        </footer>
      </form>
    }
  `,
})
export class RoleForm {
  api = inject(Api);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  editing = !!this.route.snapshot.paramMap.get("id");
  role: RoleRecord | null = null;
  loading = false;
  busy = false;
  error = "";
  selected = new Set<string>();
  menus = menuCatalog;
  groups = [...new Set(menuCatalog.map((m) => m.group))].map((title) => ({
    title,
    items: menuCatalog.filter((m) => m.group === title),
  }));
  form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(100)]],
    active: true,
  });
  groupChecked(items: { path: string }[]) {
    return items.every((m) => this.selected.has(m.path));
  }
  groupPartial(items: { path: string }[]) {
    return (
      !this.groupChecked(items) && items.some((m) => this.selected.has(m.path))
    );
  }
  toggle(path: string, event: Event) {
    if (this.busy || this.role?.is_admin) return;
    if ((event.target as HTMLInputElement).checked) this.selected.add(path);
    else this.selected.delete(path);
    this.cdr.markForCheck();
  }
  toggleGroup(items: { path: string }[], event: Event) {
    if (this.busy || this.role?.is_admin) return;
    const checked = (event.target as HTMLInputElement).checked;
    for (const item of items) {
      if (checked) this.selected.add(item.path);
      else this.selected.delete(item.path);
    }
    this.cdr.markForCheck();
  }
  async ngOnInit() {
    if (!this.editing) return;
    this.loading = true;
    try {
      this.role = await this.api.get<RoleRecord>(
        "/roles/" + this.route.snapshot.paramMap.get("id"),
      );
      this.selected = new Set(this.role.permissions);
      this.form.patchValue({
        name: this.role.name,
        active: !!this.role.active,
      });
      if (this.role.is_admin) this.form.controls.active.disable();
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
    try {
      const data = {
        ...this.form.getRawValue(),
        permissions: this.menus
          .filter((m) => this.selected.has(m.path))
          .map((m) => m.path),
        ...(this.role ? { version: this.role.version } : {}),
      };
      if (
        this.role &&
        !!this.role.active !== data.active &&
        !(await confirmUserChange(
          data.active ? "فعال‌کردن نقش؟" : "غیرفعال‌کردن نقش؟",
          "نشست کاربران این نقش پایان می‌یابد. کاربران نقش غیرفعال امکان ورود ندارند.",
        ))
      )
        return;
      if (this.editing) await this.api.patch("/roles/" + this.role!.id, data);
      else await this.api.post("/roles", data);
      if (this.role?.code === this.api.user()?.role) this.api.clear();
      else await this.router.navigate(["/roles"], { state: { saved: true } });
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
