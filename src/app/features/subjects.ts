import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  ColDef,
  GridApi,
  GridOptions,
  IGetRowsParams,
} from "ag-grid-community";
import { Api, errorMessage } from "../core/api";
import { DataGrid, actionColumn, statusColumn } from "../shared/data-grid";
import { confirmDelete } from "../shared/confirm";
import { Icon } from "../shared/icon";
import { PageHeader } from "../shared/ui";
import { Toasts } from "../shared/toast";

export interface SubjectRecord {
  id: number;
  name: string;
  address: string;
  phone: string;
  website: string;
  social_media: string;
  status: string;
  version: number;
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DataGrid, PageHeader, Icon],
  template: `<app-header
      title="آموزشگاه‌ها"
      subtitle="اطلاعات پایه • اطلاعات تماس و وضعیت واحدها"
    >
      <a class="btn btn-primary" routerLink="/subjects/new"
        ><app-icon name="plus" />ثبت واحد آموزشی</a
      >
    </app-header>
    @if (error) {
      <p class="alert alert-danger" role="alert">
        {{ error }}
        <button class="btn btn-light btn-sm" (click)="load()">تلاش مجدد</button>
      </p>
    }
    <app-data-grid
      title="فهرست آموزشگاه‌ها"
      [columns]="columns"
      [options]="options"
      [total]="total"
      [loading]="loading"
      stateKey="subjects"
      (ready)="ready($event)"
    />`,
})
export class Subjects {
  private api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private toasts = inject(Toasts);
  error = "";
  total = 0;
  loading = false;
  grid?: GridApi<SubjectRecord>;
  restoring = true;
  requestVersion = 0;
  pendingPage: number | null = null;
  deleting = new Set<number>();
  columns: ColDef<SubjectRecord>[] = [
    { field: "name", headerName: "نام واحد آموزشی", minWidth: 210 },
    {
      field: "address",
      headerName: "آدرس",
      minWidth: 240,
      tooltipField: "address",
    },
    {
      field: "phone",
      headerName: "شماره تلفن",
      minWidth: 170,
      cellClass: "grid-ltr",
    },
    {
      field: "website",
      headerName: "وب‌سایت",
      minWidth: 210,
      cellClass: "grid-ltr",
    },
    {
      field: "social_media",
      headerName: "شبکه اجتماعی",
      minWidth: 210,
      cellClass: "grid-ltr",
    },
    statusColumn<SubjectRecord>("status"),
    actionColumn<SubjectRecord>((row) => [
      {
        label: "ویرایش واحد آموزشی",
        icon: "edit",
        href: `/subjects/${row.id}/edit${location.search || ""}`,
        run: () =>
          void this.router.navigate(["/subjects", row.id, "edit"], {
            queryParams: this.route.snapshot.queryParams,
          }),
      },
      {
        label: "حذف آموزشگاه",
        icon: "trash",
        disabled: this.deleting.has(row.id),
        run: () => void this.remove(row),
      },
    ]),
  ];
  options: GridOptions<SubjectRecord> = {
    rowModelType: "infinite",
    cacheBlockSize: 100,
    maxBlocksInCache: 3,
    maxConcurrentDatasourceRequests: 1,
    onPaginationChanged: (e) => e.newPage && this.syncUrl(),
    onSortChanged: () => this.syncUrl(),
    onFilterChanged: () => this.syncUrl(),
  };
  async remove(row: SubjectRecord) {
    if (
      !(await confirmDelete(
        "حذف آموزشگاه",
        `آیا از حذف «${row.name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`,
      ))
    )
      return;
    this.deleting.add(row.id);
    this.grid?.refreshCells({ force: true });
    try {
      await this.api.delete(
        `/subject-catalog/${row.id}?version=${row.version}`,
      );
      this.toasts.show("آموزشگاه با موفقیت حذف شد", "success");
      this.load();
    } catch (error) {
      const message = errorMessage(error);
      this.toasts.show(message, "error");
    } finally {
      this.deleting.delete(row.id);
      this.grid?.refreshCells({ force: true });
      this.cdr.markForCheck();
    }
  }
  ready(grid: GridApi<SubjectRecord>) {
    this.grid = grid;
    const query = this.route.snapshot.queryParamMap;
    grid.setGridOption(
      "paginationPageSize",
      [10, 25, 50, 100].includes(Number(query.get("size")))
        ? Number(query.get("size"))
        : 10,
    );
    try {
      grid.setFilterModel(JSON.parse(query.get("filters") || "{}"));
      grid.applyColumnState({
        state: JSON.parse(query.get("sort") || "[]"),
        defaultState: { sort: null },
      });
    } catch {
      /* malformed URL state uses grid defaults */
    }
    this.restoring = false;
    this.load();
  }
  load() {
    if (!this.grid) return;
    const page = Number(this.route.snapshot.queryParamMap.get("page"));
    this.pendingPage = Number.isSafeInteger(page) && page > 0 ? page - 1 : 0;
    const version = ++this.requestVersion;
    this.grid.setGridOption("datasource", {
      getRows: (params) => void this.rows(params, version),
    });
  }
  async rows(params: IGetRowsParams<SubjectRecord>, version: number) {
    this.loading = true;
    this.error = "";
    this.cdr.markForCheck();
    try {
      const data = await this.api.get<{
        items: SubjectRecord[];
        total: number;
      }>(
        "/subject-catalog?" +
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
        const page = this.pendingPage;
        this.pendingPage = null;
        this.grid?.paginationGoToPage(
          Math.min(
            page,
            Math.max(
              0,
              Math.ceil(
                data.total / (this.grid?.paginationGetPageSize() || 10),
              ) - 1,
            ),
          ),
        );
      }
      data.total ? this.grid?.hideOverlay() : this.grid?.showNoRowsOverlay();
      this.syncUrl();
    } catch (error) {
      if (version === this.requestVersion) {
        this.error = errorMessage(error);
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
      .filter((column) => column.sort)
      .sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0))
      .map((column) => ({ colId: column.colId, sort: column.sort }));
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
