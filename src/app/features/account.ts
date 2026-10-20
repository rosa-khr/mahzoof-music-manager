import { switchCell } from "../shared/switch";
import { Select2 } from "../shared/select2";
import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { Api, errorMessage } from "../core/api";
import { DataGrid } from "../shared/data-grid";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageHeader, Field } from "../shared/ui";
interface Staff {
  id: number;
  username: string;
  role: string;
  active: number;
}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Select2, ReactiveFormsModule, PageHeader, Field, DataGrid],
  template: `<app-header
      title="حساب و دسترسی‌ها"
      subtitle="امنیت نشست و کاربران کارکنان"
    />
    @if (error) {
      <p class="alert alert-danger" role="alert">{{ error }}</p>
    }
    @if (message) {
      <p class="alert alert-success" role="status">{{ message }}</p>
    }
    <section class="card">
      <h2>تغییر رمز عبور</h2>
      <form [formGroup]="password" (ngSubmit)="changePassword()">
        <div class="form-grid">
          <app-field
            ><input
              id="oldpass"
              type="password"
              autocomplete="current-password"
              formControlName="currentPassword"
              placeholder=" "
              required
            /><label for="oldpass">رمز فعلی</label></app-field
          ><app-field
            ><input
              id="newpass"
              type="password"
              autocomplete="new-password"
              formControlName="newPassword"
              minlength="12"
              placeholder=" "
              required
            /><label for="newpass">رمز جدید (حداقل ۱۲ نویسه)</label></app-field
          >
        </div>
        <button class="btn btn-primary" [disabled]="busy || password.invalid">
          تغییر رمز و پایان نشست‌ها
        </button>
      </form>
    </section>
    @if (api.user()?.admin) {
      <section class="card">
        <h2>کاربر جدید</h2>
        <form [formGroup]="staff" (ngSubmit)="create()">
          <div class="form-grid">
            <app-field
              ><input
                id="staffname"
                formControlName="username"
                placeholder=" "
                autocomplete="off"
                required
              /><label for="staffname">نام کاربری</label></app-field
            ><app-field
              ><input
                id="staffpass"
                formControlName="password"
                type="password"
                placeholder=" "
                autocomplete="new-password"
                minlength="12"
                required
              /><label for="staffpass"
                >رمز اولیه (حداقل ۱۲ نویسه)</label
              ></app-field
            ><app-field
              ><select appSelect2 id="role" formControlName="role">
                <option value="secretary">منشی</option>
                <option value="accountant">حسابدار</option>
                <option value="admin">مدیر</option></select
              ><label for="role">نقش</label></app-field
            >
          </div>
          <button class="btn btn-primary" [disabled]="busy || staff.invalid">
            ایجاد کاربر
          </button>
        </form>
      </section>
      <section class="card">
        <h2>کاربران</h2>
        <app-data-grid
          title="کاربران"
          [rows]="users"
          [columns]="columns"
          stateKey="staff"
        />
      </section>
    }`,
})
export class Account implements OnInit {
  cdr = inject(ChangeDetectorRef);
  api = inject(Api);
  fb = inject(FormBuilder);
  password = this.fb.nonNullable.group({
    currentPassword: ["", Validators.required],
    newPassword: ["", [Validators.required, Validators.minLength(12)]],
  });
  staff = this.fb.nonNullable.group({
    username: ["", Validators.required],
    password: ["", [Validators.required, Validators.minLength(12)]],
    role: "secretary",
  });
  columns: ColDef<Staff>[] = [
    { field: "username", headerName: "نام کاربری", minWidth: 200 },
    {
      field: "role",
      headerName: "نقش",
      valueFormatter: (p) => this.roles[p.value] || p.value,
      filterValueGetter: (p) => this.roles[p.data?.role || ""] || "",
      minWidth: 160,
    },
    {
      field: "active",
      headerName: "وضعیت",
      valueFormatter: (p) => (p.value ? "فعال" : "غیرفعال"),
      filterValueGetter: (p) => (p.data?.active ? "فعال" : "غیرفعال"),
      cellRenderer: (p: ICellRendererParams<Staff>) =>
        p.data
          ? switchCell(
              "فعال بودن " + p.data.username,
              !!p.data.active,
              (input) => {
                const user = p.data!;
                if (this.busy) {
                  input.checked = !!user.active;
                  return;
                }
                input.disabled = true;
                void this.toggle(user).finally(() => {
                  input.checked = !!user.active;
                  input.disabled = false;
                });
              },
            )
          : "",
      minWidth: 150,
    },
  ];
  users: Staff[] = [];
  busy = false;
  error = "";
  message = "";
  roles: Record<string, string> = {
    admin: "مدیر",
    secretary: "منشی",
    accountant: "حسابدار",
  };
  ngOnInit() {
    if (this.api.user()?.admin) void this.load();
  }
  async load() {
    try {
      this.users = await this.api.get<Staff[]>("/users");
    } catch (e) {
      this.error = errorMessage(e);
    }

    this.cdr.markForCheck();
  }
  async changePassword() {
    if (this.busy || this.password.invalid) return;
    await this.perform(async () => {
      await this.api.post("/auth/password", this.password.getRawValue());
      this.api.clear();
    });
  }
  async create() {
    if (this.busy || this.staff.invalid) return;
    await this.perform(async () => {
      await this.api.post("/users", this.staff.getRawValue());
      this.staff.reset({ role: "secretary" });
      await this.load();
      this.message = "کاربر ایجاد شد.";
    });
  }
  async toggle(u: Staff) {
    if (!confirm("تغییر وضعیت کاربر و پایان نشست‌های او تأیید می‌شود؟")) return;
    await this.perform(async () => {
      await this.api.patch("/users/" + u.id, {
        role: u.role,
        active: !u.active,
      });
      if (u.id === this.api.user()?.id) this.api.clear();
      else await this.load();
    });
  }
  async perform(fn: () => Promise<void>) {
    this.busy = true;
    this.error = "";
    this.message = "";
    try {
      await fn();
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
