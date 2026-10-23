import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { ColDef } from "ag-grid-community";
import { Api, errorMessage } from "../core/api";
import { RoleRecord } from "../core/roles";
import { DataGrid, actionColumn, statusCell } from "../shared/data-grid";
import { PageHeader } from "../shared/ui";
import { Icon } from "../shared/icon";
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataGrid, PageHeader, Icon],
  template: `
    <app-header title="نقش‌ها" subtitle="مدیریت امنیت"
      ><a routerLink="/roles/new" class="btn btn-primary"
        ><app-icon name="plus" />ثبت نقش</a
      ></app-header
    >
    @if (error) {
      <p role="alert" class="alert alert-danger">
        {{ error
        }}<button type="button" class="btn btn-light btn-sm" (click)="load()">
          تلاش مجدد
        </button>
      </p>
    }
    @if (message) {
      <p class="alert alert-success" role="status">{{ message }}</p>
    }
    <app-data-grid
      title="نقش‌ها"
      [rows]="rows"
      [columns]="columns"
      [loading]="loading"
      stateKey="roles"
    />
  `,
})
export class Roles {
  api = inject(Api);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  rows: RoleRecord[] = [];
  loading = false;
  error = "";
  message = history.state?.saved ? "نقش ذخیره شد." : "";
  columns: ColDef<RoleRecord>[] = [
    { field: "name", headerName: "نام نقش", minWidth: 200 },
    {
      field: "active",
      headerName: "وضعیت نقش",
      minWidth: 150,
      filterValueGetter: (p) => (p.data?.active ? "فعال" : "غیرفعال"),
      cellRenderer: (p: { data?: RoleRecord }) =>
        p.data ? statusCell(p.data.active ? "active" : "inactive") : "",
    },
    actionColumn<RoleRecord>(
      (r) => [
        {
          label: "ویرایش نقش " + r.name,
          icon: "edit",
          href: `/roles/${r.id}/edit`,
          run: () => void this.router.navigate(["/roles", r.id, "edit"]),
        },
      ],
      90,
    ),
  ];
  ngOnInit() {
    void this.load();
  }
  async load() {
    this.loading = true;
    this.error = "";
    try {
      this.rows = await this.api.get<RoleRecord[]>("/roles");
    } catch (e) {
      this.error = errorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
