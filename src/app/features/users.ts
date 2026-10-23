import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { Api, errorMessage } from "../core/api";
import { Staff, STAFF_ROLES } from "../core/staff";
import { DataGrid, actionColumn, statusCell } from "../shared/data-grid";
import { PageHeader } from "../shared/ui";
import { ResetPasswordModal } from "../shared/reset-password-modal";
import { Icon } from "../shared/icon";
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataGrid, PageHeader, Icon, ResetPasswordModal],
  template: `
    <app-header
      title="مدیریت کاربران"
      subtitle="تعریف و ویرایش کاربران، رمز عبور و قفل حساب"
    >
      <a class="btn btn-primary" routerLink="/users/new"
        ><app-icon name="plus" />ثبت کاربر</a
      >
    </app-header>
    @if (error) {
      <p role="alert" class="alert alert-danger">
        {{ error }}
        <button class="btn btn-light btn-sm" (click)="load()">تلاش مجدد</button>
      </p>
    }
    @if (message) {
      <p role="status" class="alert alert-success">{{ message }}</p>
    }
    <app-data-grid
      title="کاربران"
      [rows]="users"
      [columns]="columns"
      [loading]="loading"
      stateKey="staff"
    />
    @if (resetTarget) {
      <app-reset-password-modal
        [user]="resetTarget"
        (closed)="resetTarget = null"
        (saved)="passwordSaved($event)"
      />
    }
  `,
})
export class Users {
  api = inject(Api);
  router = inject(Router);
  route = inject(ActivatedRoute);
  cdr = inject(ChangeDetectorRef);
  users: Staff[] = [];
  resetTarget: Staff | null = null;
  loading = false;
  error = "";
  message = history.state?.saved ? "اطلاعات کاربر ذخیره شد." : "";
  columns: ColDef<Staff>[] = [
    {
      field: "username",
      headerName: "نام کاربری",
      minWidth: 200,
      cellClass: "grid-ltr",
    },
    {
      field: "role",
      headerName: "نقش",
      minWidth: 160,
      valueFormatter: (p) =>
        p.data?.role_name || STAFF_ROLES[p.value] || p.value,
      filterValueGetter: (p) =>
        p.data?.role_name || STAFF_ROLES[p.data?.role || ""] || "",
    },
    {
      field: "active",
      headerName: "وضعیت حساب",
      minWidth: 150,
      filterValueGetter: (p) => (p.data?.active ? "فعال" : "قفل‌شده"),
      cellRenderer: (p: ICellRendererParams<Staff>) =>
        p.data
          ? statusCell(
              p.data.active ? "active" : "inactive",
              "",
              p.data.active ? "فعال" : "قفل‌شده",
            )
          : "",
    },
    actionColumn<Staff>(
      (u) => [
        {
          label: "ویرایش کاربر " + u.username,
          icon: "edit",
          href: `/users/${u.id}/edit`,
          run: () => void this.edit(u),
        },
        {
          label: "ریست رمز " + u.username,
          icon: "resetKey",
          run: () => {
            this.resetTarget = this.users.find((user) => user.id === u.id) || u;
            this.cdr.markForCheck();
          },
        },
      ],
      110,
    ),
  ];
  ngOnInit() {
    void this.load();
  }
  edit(u: Staff) {
    return this.router.navigate(["/users", u.id, "edit"]);
  }
  async passwordSaved(user: Staff) {
    this.resetTarget = null;
    if (user.id === this.api.user()?.id) this.api.clear();
    else {
      await this.load();
      this.message = "رمز عبور ریست شد و نشست‌های قبلی پایان یافتند.";
      this.cdr.markForCheck();
    }
  }
  async load() {
    this.loading = true;
    this.error = "";
    try {
      this.users = await this.api.get<Staff[]>("/users");
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
