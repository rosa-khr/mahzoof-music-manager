import {
  Component,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  ColDef,
  GridApi,
  GridOptions,
  IGetRowsParams,
} from "ag-grid-community";
import { Api, errorMessage } from "../core/api";
import { BaseResource, BaseRecord } from "../core/base-data";
import { DataGrid, actionColumn, statusColumn } from "../shared/data-grid";
import { PageHeader } from "../shared/ui";
import { Icon } from "../shared/icon";
import { Toasts } from "../shared/toast";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataGrid, PageHeader, Icon],
  template: `<app-header
      [title]="resource.title"
      subtitle="اطلاعات پایه • جست‌وجو و فیلتر داخل ستون‌های جدول"
    >
      @if (resource.key !== "session-statuses") {
        <a
          class="btn btn-primary"
          [routerLink]="[path, 'new']"
          [queryParams]="route.snapshot.queryParams"
          ><app-icon name="plus" />ثبت {{ resource.singular }}</a
        >
      }
    </app-header>
    @if (error) {
      <p class="alert alert-danger" role="alert">
        {{ error }}
        <button class="btn btn-light btn-sm" (click)="load()">تلاش مجدد</button>
      </p>
    }
    <app-data-grid
      [title]="'فهرست ' + resource.title"
      [columns]="columns"
      [options]="options"
      [total]="total"
      [loading]="loading"
      [stateKey]="'base-' + resource.key"
      (ready)="ready($event)"
    />`,
})
export class BaseDataList {
  route = inject(ActivatedRoute);
  router = inject(Router);
  api = inject(Api);
  toasts = inject(Toasts);
  cdr = inject(ChangeDetectorRef);
  resource = this.route.snapshot.data["resource"] as BaseResource;
  path = "/base-data/" + this.resource.key;
  error = "";
  total = 0;
  loading = false;
  grid?: GridApi<BaseRecord>;
  restoring = true;
  requestVersion = 0;
  pendingPage: number | null = null;
  columns: ColDef<BaseRecord>[] = [
    {
      field: "name",
      headerName:
        this.resource.key === "instructors"
          ? "مدرس (نام یا تماس)"
          : this.resource.nameLabel,
      minWidth: this.resource.key === "instructors" ? 250 : 230,
      ...(this.resource.key === "instructors"
        ? {
            cellRenderer: (
              p: import("ag-grid-community").ICellRendererParams<BaseRecord>,
            ) => {
              if (!p.data) return "";
              const row = document.createElement("div");
              row.className = "grid-student-identity";
              if (p.data.photo_url) {
                const image = document.createElement("img");
                image.src = p.data.photo_url;
                image.alt = "";
                image.loading = "lazy";
                row.append(image);
              } else {
                const avatar = document.createElement("span");
                avatar.className =
                  "grid-student-avatar student-avatar-placeholder";
                avatar.setAttribute("aria-hidden", "true");
                row.append(avatar);
              }
              const name = document.createElement("span");
              name.className = "grid-student-name";
              name.textContent = p.data.name;
              row.append(name);
              return row;
            },
          }
        : {}),
    },
    ...(this.resource.key === "session-statuses"
      ? [
          {
            field: "code" as const,
            headerName: "کد ثابت",
            minWidth: 170,
            cellClass: "grid-ltr",
          },
        ]
      : []),
    ...(this.resource.key === "teaching-types"
      ? [
          {
            field: "requires_academy" as const,
            headerName: "آموزشگاه",
            minWidth: 190,
            valueGetter: (
              p: import("ag-grid-community").ValueGetterParams<BaseRecord>,
            ) =>
              p.data?.requires_academy == null
                ? "تعیین نشده"
                : p.data.requires_academy
                  ? "نیاز به آموزشگاه"
                  : "بدون آموزشگاه",
          },
        ]
      : []),
    ...(this.resource.key === "payment-methods"
      ? [
          {
            field: "settlement_type" as const,
            headerName: "شیوه تسویه",
            minWidth: 160,
            valueGetter: (
              p: import("ag-grid-community").ValueGetterParams<BaseRecord>,
            ) =>
              ({ single: "یکجا", installment: "اقساطی", free: "بدون شهریه" })[
                p.data?.settlement_type || "single"
              ],
          },
          {
            field: "payment_currency" as const,
            headerName: "نوع پرداخت",
            minWidth: 150,
            valueGetter: (
              p: import("ag-grid-community").ValueGetterParams<BaseRecord>,
            ) =>
              p.data?.payment_currency === "rial"
                ? "ریالی"
                : p.data?.payment_currency === "foreign"
                  ? "ارزی"
                  : "—",
          },
          {
            field: "installment_count" as const,
            headerName: "تعداد اقساط",
            minWidth: 150,
            valueFormatter: (
              p: import("ag-grid-community").ValueFormatterParams<BaseRecord>,
            ) =>
              p.value == null
                ? "—"
                : new Intl.NumberFormat("fa-IR").format(p.value),
          },
        ]
      : []),
    ...(this.resource.key === "instruments"
      ? [
          {
            field: "english_name" as const,
            headerName: "نام انگلیسی ساز",
            minWidth: 180,
            cellClass: "grid-ltr",
          },
          {
            field: "rate_toman_30" as const,
            headerName: "نرخ ۳۰ دقیقه تومان",
            minWidth: 190,
            filter: "agNumberColumnFilter",
            valueFormatter: (
              p: import("ag-grid-community").ValueFormatterParams<BaseRecord>,
            ) =>
              p.value == null
                ? "ثبت نشده"
                : new Intl.NumberFormat("fa-IR").format(p.value),
          },
          {
            field: "rate_usd_cents_30" as const,
            headerName: "نرخ ۳۰ دقیقه دلار",
            minWidth: 180,
            filter: "agNumberColumnFilter",
            valueFormatter: (
              p: import("ag-grid-community").ValueFormatterParams<BaseRecord>,
            ) =>
              p.value == null
                ? "ثبت نشده"
                : new Intl.NumberFormat("fa-IR", {
                    minimumFractionDigits: 2,
                  }).format(p.value / 100),
          },
        ]
      : []),
    ...(this.resource.phone
      ? [
          {
            field: "phone" as const,
            headerName: "شماره تماس",
            minWidth: 180,
            cellClass: "grid-ltr",
          },
        ]
      : []),
    ...(this.resource.key === "instructors"
      ? [
          {
            field: "instrument_names" as const,
            headerName: "سازهای تخصصی",
            minWidth: 240,
            tooltipField: "instrument_names" as const,
          },
        ]
      : []),
    ...(this.resource.key !== "instructors"
      ? [
          {
            field: "notes",
            headerName: "توضیحات",
            minWidth: 240,
            tooltipField: "notes",
          } as ColDef<BaseRecord>,
        ]
      : []),
    statusColumn<BaseRecord>("status"),
    actionColumn<BaseRecord>((r) => [
      ...(this.resource.key === "instructors"
        ? [
            {
              label: "باز کردن پرونده",
              icon: "eye" as const,
              href: this.path + "/" + r.id + (location.search || ""),
              run: () =>
                void this.router.navigate([this.path, r.id], {
                  queryParams: this.route.snapshot.queryParams,
                }),
            },
          ]
        : []),
      {
        label: "ویرایش " + this.resource.singular,
        icon: "edit",
        href: this.path + "/" + r.id + "/edit" + (location.search || ""),
        run: () =>
          void this.router.navigate([this.path, r.id, "edit"], {
            queryParams: this.route.snapshot.queryParams,
          }),
      },
    ]),
  ];
  options: GridOptions<BaseRecord> = {
    rowModelType: "infinite",
    cacheBlockSize: 100,
    maxBlocksInCache: 3,
    maxConcurrentDatasourceRequests: 1,
    onPaginationChanged: (e) => {
      if (e.newPage) this.syncUrl();
    },
    onSortChanged: () => this.syncUrl(),
    onFilterChanged: () => this.syncUrl(),
  };
  ready(grid: GridApi<BaseRecord>) {
    this.grid = grid;
    const q = this.route.snapshot.queryParamMap;
    grid.setGridOption(
      "paginationPageSize",
      [10, 25, 50, 100].includes(Number(q.get("size")))
        ? Number(q.get("size"))
        : 10,
    );
    try {
      grid.setFilterModel(JSON.parse(q.get("filters") || "{}"));
      const sort = JSON.parse(q.get("sort") || "[]") as {
        colId: string;
        sort: "asc" | "desc";
      }[];
      grid.applyColumnState({ state: sort, defaultState: { sort: null } });
    } catch {
      /* invalid saved query uses grid defaults */
    }
    this.restoring = false;
    this.load();
  }
  load() {
    if (!this.grid) return;
    const p = Number(this.route.snapshot.queryParamMap.get("page"));
    this.pendingPage =
      Number.isSafeInteger(p) && p > 0 ? Math.min(p - 1, 100000) : 0;
    const version = ++this.requestVersion;
    this.grid.setGridOption("datasource", {
      getRows: (params) => void this.rows(params, version),
    });
  }
  async rows(params: IGetRowsParams<BaseRecord>, version: number) {
    this.loading = true;
    this.error = "";
    this.cdr.markForCheck();
    try {
      const data = await this.api.get<{ items: BaseRecord[]; total: number }>(
        "/base-data/" +
          this.resource.key +
          "?" +
          new URLSearchParams({
            startRow: String(params.startRow),
            endRow: String(params.endRow),
            filterModel: JSON.stringify(params.filterModel),
            sortModel: JSON.stringify(params.sortModel),
          }),
      );
      if (version !== this.requestVersion) return;
      this.total = data.total;
      params.successCallback(data.items, data.total);
      if (this.pendingPage !== null) {
        const p = this.pendingPage;
        this.pendingPage = null;
        this.grid?.paginationGoToPage(
          Math.min(
            p,
            Math.max(
              0,
              Math.ceil(
                data.total / (this.grid?.paginationGetPageSize() || 10),
              ) - 1,
            ),
          ),
        );
      }
      if (data.total === 0) this.grid?.showNoRowsOverlay();
      else this.grid?.hideOverlay();
      this.syncUrl();
    } catch (e) {
      if (version === this.requestVersion) {
        this.error = errorMessage(e);
        this.toasts.show(this.error, "error");
        params.failCallback();
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }
  syncUrl() {
    if (!this.grid || this.restoring) return;
    const sort = this.grid
      .getColumnState()
      .filter((c) => c.sort)
      .sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0))
      .map((c) => ({ colId: c.colId, sort: c.sort }));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: this.grid.paginationGetCurrentPage() + 1,
        size: this.grid.paginationGetPageSize(),
        filters: Object.keys(this.grid.getFilterModel()).length
          ? JSON.stringify(this.grid.getFilterModel())
          : null,
        sort: sort.length ? JSON.stringify(sort) : null,
      },
      replaceUrl: true,
    });
  }
}
