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

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataGrid, PageHeader, Icon],
  template: `<app-header
      [title]="resource.title"
      subtitle="اطلاعات پایه • جست‌وجو و فیلتر داخل ستون‌های جدول"
    >
      <a
        class="btn btn-primary"
        [routerLink]="[path, 'new']"
        [queryParams]="route.snapshot.queryParams"
        ><app-icon name="plus" />ثبت {{ resource.singular }}</a
      >
    </app-header>
    @if (error) {
      <p class="alert alert-danger" role="alert">
        {{ error }}
        <button class="btn btn-light btn-sm" (click)="load()">تلاش مجدد</button>
      </p>
    }
    @if (message) {
      <p class="alert alert-success" role="status">{{ message }}</p>
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
  cdr = inject(ChangeDetectorRef);
  resource = this.route.snapshot.data["resource"] as BaseResource;
  path = "/base-data/" + this.resource.key;
  error = "";
  message = history.state?.saved ? "اطلاعات با موفقیت ذخیره شد." : "";
  total = 0;
  loading = false;
  grid?: GridApi<BaseRecord>;
  restoring = true;
  requestVersion = 0;
  pendingPage: number | null = null;
  columns: ColDef<BaseRecord>[] = [
    { field: "name", headerName: this.resource.nameLabel, minWidth: 230 },
    ...(this.resource.key === "instruments"
      ? [
          {
            field: "english_name" as const,
            headerName: "نام انگلیسی ساز",
            minWidth: 180,
            cellClass: "grid-ltr",
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
    {
      field: "notes",
      headerName: "توضیحات",
      minWidth: 240,
      tooltipField: "notes",
    },
    statusColumn<BaseRecord>("status"),
    actionColumn<BaseRecord>((r) => [
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
