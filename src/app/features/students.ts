import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Api, errorMessage } from "../core/api";
import { StudentRow } from "../core/models";
import { Icon } from "../shared/icon";
import { DataGrid, actionColumn, statusColumn } from "../shared/data-grid";
import {
  ColDef,
  GridApi,
  GridOptions,
  IGetRowsParams,
} from "ag-grid-community";
import { PageHeader } from "../shared/ui";
import { confirmDelete } from "../shared/confirm";
import { Toasts } from "../shared/toast";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, PageHeader, Icon, DataGrid],
  template: `<app-header
      title="پرونده هنرجویان"
      subtitle="مدیریت پرونده، ترم‌ها و امور مالی هنرجویان"
    >
      @if (api.user()?.education) {
        <a class="btn btn-primary" routerLink="/students/new">
          <app-icon name="plus" /> ثبت هنرجو
        </a>
      }
    </app-header>
    @if (error) {
      <p class="alert alert-danger" role="alert">
        {{ error }}
        <button class="btn btn-sm btn-light" (click)="load()">تلاش مجدد</button>
      </p>
    }
    <app-data-grid
      title="فهرست هنرجویان"
      description="پرونده‌های آموزشگاه و دسترسی سریع به عملیات هر هنرجو"
      emptyMessage="هنرجویی با این مشخصات پیدا نشد"
      [columns]="columns"
      [options]="gridOptions"
      [total]="total"
      [loading]="loading"
      stateKey="students"
      (ready)="onGridReady($event)"
    />`,
})
export class Students implements OnInit {
  cdr = inject(ChangeDetectorRef);
  api = inject(Api);
  route = inject(ActivatedRoute);
  router = inject(Router);
  toasts = inject(Toasts);
  deleting = new Set<number>();
  columns: ColDef<StudentRow>[] = [
    {
      colId: "search",
      headerName: "هنرجو (نام، کد یا تماس)",
      valueGetter: (p) =>
        p.data ? p.data.first_name + " " + p.data.last_name : "",
      minWidth: 240,
      cellRenderer: (
        p: import("ag-grid-community").ICellRendererParams<StudentRow>,
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
          avatar.className = "grid-student-avatar student-avatar-placeholder";
          avatar.setAttribute("aria-hidden", "true");
          row.append(avatar);
        }
        const name = document.createElement("span");
        name.className = "grid-student-name";
        name.textContent = p.data.first_name + " " + p.data.last_name;
        row.append(name);
        return row;
      },
    },
    {
      field: "code",
      headerName: "کد هنرجو",
      colId: "code",
      cellClass: "grid-ltr",
      minWidth: 150,
    },
    {
      field: "phone",
      headerName: "تماس",
      cellClass: "grid-ltr",
      minWidth: 180,
    },
    statusColumn<StudentRow>("status"),
    actionColumn<StudentRow>(
      (s) => [
        {
          label: "باز کردن پرونده",
          icon: "eye",
          href: "/students/" + s.id,
          run: () => void this.router.navigate(["/students", s.id]),
        },
        {
          label: "چاپ پرونده",
          icon: "book",
          href: "/students/" + s.id + "/print",
          run: () => void this.router.navigate(["/students", s.id, "print"]),
        },
        ...(this.api.user()?.education
          ? [
              {
                label: "ویرایش هنرجو",
                icon: "edit" as const,
                href: "/students/" + s.id + "/edit",
                run: () =>
                  void this.router.navigate(["/students", s.id, "edit"]),
              },
            ]
          : []),
        ...(this.api.user()?.admin
          ? [
              {
                label: "حذف هنرجو",
                icon: "trash" as const,
                disabled: this.deleting.has(s.id),
                run: () => void this.remove(s),
              },
            ]
          : []),
      ],
      this.api.user()?.admin ? 165 : 135,
    ),
  ];
  async remove(student: StudentRow) {
    const name = `${student.first_name} ${student.last_name}`.trim();
    if (
      !(await confirmDelete(
        "حذف هنرجو",
        `آیا از حذف «${name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`,
      ))
    )
      return;
    this.deleting.add(student.id);
    this.grid?.refreshCells({ force: true });
    try {
      await this.api.delete(
        `/students/${student.id}?version=${student.version}`,
      );
      this.toasts.show("هنرجو با موفقیت حذف شد", "success");
      this.load();
    } catch (error) {
      this.toasts.show(errorMessage(error), "error");
    } finally {
      this.deleting.delete(student.id);
      this.grid?.refreshCells({ force: true });
      this.cdr.markForCheck();
    }
  }
  grid?: GridApi<StudentRow>;
  initialized = false;
  requestVersion = 0;
  restoring = true;
  pendingPage: number | null = null;
  gridOptions: GridOptions<StudentRow> = {
    // Five pinned actions must not consume most of a phone's reading viewport.
    suppressColumnVirtualisation: true,
    onGridSizeChanged: () => {
      if (this.grid) this.resizeActions(this.grid);
    },
    rowModelType: "infinite",
    cacheBlockSize: 100,
    maxBlocksInCache: 3,
    maxConcurrentDatasourceRequests: 1,
    onPaginationChanged: (e) => {
      if (e.newPage && this.initialized && !this.restoring) {
        this.page = e.api.paginationGetCurrentPage() + 1;
        this.syncUrl();
      }
    },
    onSortChanged: () => this.syncUrl(),
    onFilterChanged: () => this.syncUrl(),
  };
  onGridReady(grid: GridApi<StudentRow>) {
    this.grid = grid;
    this.resizeActions(grid);
    const p = this.route.snapshot.queryParamMap;
    grid.setGridOption("paginationPageSize", Number(p.get("size")) || 10);
    try {
      const filters = JSON.parse(p.get("filters") || "{}");
      if (filters.name && !filters.search) filters.search = filters.name;
      delete filters.name;
      // Move old shared links into visible grid filters; no hidden legacy filter.
      if (p.get("q") && !filters.search)
        filters.search = {
          filterType: "text",
          type: "contains",
          filter: p.get("q"),
        };
      if (p.get("status") && !filters.status)
        filters.status = {
          filterType: "text",
          type: "equals",
          filter:
            (
              {
                active: "فعال",
                inactive: "غیرفعال",
                archived: "بایگانی",
              } as Record<string, string>
            )[p.get("status")!] || p.get("status"),
        };
      grid.setFilterModel(filters);
      const sort = JSON.parse(p.get("sort") || "[]") as {
        colId: string;
        sort: "asc" | "desc";
      }[];
      grid.applyColumnState({
        state: sort.map((c) => ({
          ...c,
          colId: c.colId === "name" ? "search" : c.colId,
        })),
        defaultState: { sort: null },
      });
    } catch {
      /* malformed URL uses defaults */
    }
    this.restoring = false;
    if (this.initialized) this.load();
  }
  total = 0;
  resizeActions(grid: GridApi<StudentRow>) {
    const pinned = window.matchMedia("(max-width: 650px)").matches
      ? null
      : "left";
    if (
      (grid.getColumnState().find((c) => c.colId === "actions")?.pinned ||
        null) !== pinned
    )
      grid.applyColumnState({ state: [{ colId: "actions", pinned }] });
  }
  page = 1;
  loading = false;
  error = "";
  async ngOnInit() {
    const p = this.route.snapshot.queryParamMap;
    this.page = Math.max(1, Number(p.get("page")) || 1);
    this.initialized = true;
    this.load();

    this.cdr.markForCheck();
  }
  load() {
    if (!this.grid || !this.initialized) return;
    const version = ++this.requestVersion;
    this.pendingPage = this.page - 1;
    this.grid.setGridOption("datasource", {
      getRows: (params: IGetRowsParams<StudentRow>) =>
        void this.fetchRows(params, version),
    });
  }
  async fetchRows(params: IGetRowsParams<StudentRow>, version: number) {
    this.loading = true;
    this.error = "";
    this.cdr.markForCheck();
    try {
      const v = await this.api.get<{ items: StudentRow[]; total: number }>(
        "/students?" +
          new URLSearchParams({
            startRow: String(params.startRow),
            endRow: String(params.endRow),
            sortModel: JSON.stringify(params.sortModel),
            filterModel: JSON.stringify(params.filterModel),
          }),
      );
      if (version !== this.requestVersion) return;
      this.total = v.total;
      params.successCallback(v.items, v.total);
      if (this.pendingPage !== null) {
        const target = this.pendingPage;
        this.pendingPage = null;
        this.grid?.paginationGoToPage(
          Math.min(
            target,
            Math.max(
              0,
              Math.ceil(v.total / (this.grid?.paginationGetPageSize() || 10)) -
                1,
            ),
          ),
        );
      }
      if (v.total === 0) this.grid?.showNoRowsOverlay();
      else this.grid?.hideOverlay();
      this.syncUrl();
    } catch (e) {
      if (version !== this.requestVersion) return;
      this.error = errorMessage(e);
      params.failCallback();
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }
  syncUrl() {
    if (!this.grid || !this.initialized || this.restoring) return;
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
        sort: sort.length ? JSON.stringify(sort) : null,
        filters: Object.keys(this.grid.getFilterModel()).length
          ? JSON.stringify(this.grid.getFilterModel())
          : null,
      },
      replaceUrl: true,
    });
  }
}
