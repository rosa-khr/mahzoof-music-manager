import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from "@angular/core";
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  type ColDef,
  type GridApi,
  type GridOptions,
  type ICellRendererParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);
export const GRID_LOCALE: Record<string, string> = {
  page: "صفحه",
  firstPage: "صفحه اول",
  previousPage: "صفحه قبل",
  nextPage: "صفحه بعد",
  lastPage: "صفحه آخر",
  pageNumber: "شماره صفحه",
  more: "بیشتر",
  to: "تا",
  of: "از",
  next: "بعدی",
  last: "آخرین",
  first: "اولین",
  previous: "قبلی",
  loadingOoo: "در حال بارگذاری…",
  selectAll: "انتخاب همه",
  searchOoo: "جستجو…",
  blanks: "خالی",
  blank: "خالی",
  notBlank: "خالی نباشد",
  filterOoo: "فیلتر…",
  equals: "برابر",
  notEqual: "نامساوی",
  contains: "شامل",
  notContains: "شامل نباشد",
  startsWith: "شروع با",
  endsWith: "پایان با",
  lessThan: "کمتر از",
  greaterThan: "بیشتر از",
  lessThanOrEqual: "کمتر یا مساوی",
  greaterThanOrEqual: "بیشتر یا مساوی",
  inRange: "در بازه",
  andCondition: "و",
  orCondition: "یا",
  applyFilter: "اعمال",
  resetFilter: "بازنشانی",
  clearFilter: "پاک‌کردن",
  cancelFilter: "لغو",
  noRowsToShow: "رکوردی برای نمایش وجود ندارد",
  pinColumn: "سنجاق‌کردن ستون",
  autosizeThiscolumn: "اندازه خودکار ستون",
  autosizeAllColumns: "اندازه خودکار همه ستون‌ها",
  resetColumns: "بازنشانی ستون‌ها",
  sortAscending: "مرتب‌سازی صعودی",
  sortDescending: "مرتب‌سازی نزولی",
  sortUnSort: "حذف مرتب‌سازی",
  pageSizeSelectorLabel: "تعداد در صفحه:",
  ariaPageSizeSelectorLabel: "تعداد ردیف در صفحه",
  ariaFirstPage: "صفحه اول",
  ariaPreviousPage: "صفحه قبل",
  ariaNextPage: "صفحه بعد",
  ariaLastPage: "صفحه آخر",
  ariaColumnFilter: "فیلتر ستون",
  ariaFilterInput: "مقدار فیلتر",
  ariaFilterMenuOpen: "باز کردن فیلتر ستون",
  ariaColumn: "ستون",
  ariaRow: "ردیف",
};

@Component({
  selector: "app-data-grid",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="resource-grid" [attr.aria-label]="title">
    <div class="resource-grid-heading">
      <div>
        <strong>{{ title }}</strong
        ><span>{{ description }}</span>
      </div>
      <span>{{ countText }}</span>
    </div>
    <div class="resource-grid-wrap ag-theme-material" [style.height]="height">
      <div
        #grid
        class="resource-data-grid"
        [attr.aria-label]="'جدول ' + title"
      ></div>
    </div>
  </section>`,
})
export class DataGrid<T extends { id: number }>
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() title = "";
  @Input() description = "جست‌وجو و مرتب‌سازی از فیلتر ستون‌ها";
  @Input() emptyMessage = "رکوردی برای نمایش وجود ندارد";
  @Input() rowNumbers = true;
  @Input() rows: T[] = [];
  @Input() columns: ColDef<T>[] = [];
  @Input() options: GridOptions<T> = {};
  @Input() loading = false;
  @Input() total: number | undefined;
  @Input() stateKey = "";
  @Input() height = "clamp(520px, 68vh, 640px)";
  @Output() ready = new EventEmitter<GridApi<T>>();
  @ViewChild("grid", { static: true }) element!: ElementRef<HTMLDivElement>;
  cdr = inject(ChangeDetectorRef);
  grid?: GridApi<T>;
  countText = "";
  ngAfterViewInit() {
    const numberColumn: ColDef<T> = {
      colId: "rowNumber",
      headerName: "ردیف",
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      valueFormatter: (p) => new Intl.NumberFormat("fa-IR").format(p.value),
      width: 78,
      minWidth: 78,
      maxWidth: 78,
      pinned: "right",
      lockPinned: true,
      filter: false,
      sortable: false,
    };
    this.grid = createGrid<T>(this.element.nativeElement, {
      theme: "legacy",
      rowData: this.options.rowModelType === "infinite" ? undefined : this.rows,
      columnDefs: this.rowNumbers
        ? [numberColumn, ...this.columns]
        : this.columns,
      enableRtl: true,
      localeText: { ...GRID_LOCALE, noRowsToShow: this.emptyMessage },
      rowHeight: 60,
      headerHeight: 52,
      floatingFiltersHeight: 36,
      pagination: true,
      paginationPageSize: 10,
      paginationPageSizeSelector: [10, 25, 50, 100],
      animateRows: false,
      loading: this.loading,
      getRowId: (p) => String(p.data.id),
      defaultColDef: {
        resizable: true,
        sortable: true,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        minWidth: 150,
        flex: 1,
        cellDataType: false,
        filterParams: {
          buttons: ["reset"],
          debounceMs: 250,
          maxNumConditions: 2,
          textFormatter: normalizeGridText,
        },
      },
      ...this.options,
      onGridReady: (e) => {
        if (this.stateKey)
          try {
            const state = JSON.parse(
              sessionStorage.getItem("grid-layout:" + this.stateKey) || "null",
            );
            if (Array.isArray(state))
              e.api.applyColumnState({ state, applyOrder: true });
          } catch {
            /* unavailable storage does not prevent rendering */
          }
        this.options.onGridReady?.(e);
        this.ready.emit(e.api);
      },
      onCellClicked: (e) => {
        this.options.onCellClicked?.(e);
        this.cdr.markForCheck();
      },
      onModelUpdated: (e) => {
        this.updateCount(e.api);
        this.options.onModelUpdated?.(e);
      },
      onColumnMoved: () => this.saveLayout(),
      onColumnPinned: () => this.saveLayout(),
      onColumnVisible: () => this.saveLayout(),
      onColumnResized: (e) => {
        if (e.finished) this.saveLayout();
      },
    });
    this.updateCount(this.grid);
  }
  ngOnChanges() {
    if (!this.grid) return;
    this.grid.setGridOption("loading", this.loading);
    if (this.options.rowModelType !== "infinite")
      this.grid.setGridOption("rowData", this.rows);
    this.updateCount(this.grid);
  }
  updateCount(api: GridApi<T>) {
    const count = this.total ?? api.getDisplayedRowCount();
    this.countText = this.loading
      ? "در حال دریافت اطلاعات…"
      : new Intl.NumberFormat("fa-IR").format(count) + " رکورد";
    this.cdr.markForCheck();
  }
  saveLayout() {
    if (!this.stateKey || !this.grid) return;
    try {
      sessionStorage.setItem(
        "grid-layout:" + this.stateKey,
        JSON.stringify(
          this.grid
            .getColumnState()
            .map(({ colId, width, hide, pinned, flex }) => ({
              colId,
              width,
              hide,
              pinned,
              flex,
            })),
        ),
      );
    } catch {
      /* layout persistence is optional */
    }
  }
  ngOnDestroy() {
    this.grid?.destroy();
  }
}
export const normalizeGridText = (value: string | null) =>
  value
    ?.normalize("NFKC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase() ?? "";
export const statusLabels: Record<string, string> = {
  active: "فعال",
  inactive: "غیرفعال",
  archived: "بایگانی",
  reserved: "رزرو",
  present: "حاضر",
  absent: "غایب",
  cancelled: "کنسل‌شده",
  current: "جاری",
  completed: "تکمیل‌شده",
  planned: "برنامه‌ریزی‌شده",
  paused: "متوقف",
  unpaid: "پرداخت‌نشده",
  partial: "پرداخت جزئی",
  settled: "تسویه‌شده",
  no_due: "بدون مبلغ قابل دریافت",
};
export function statusCell(value: string, note = "", label?: string) {
  const container = document.createElement("div");
  const badge = document.createElement("span");
  badge.className = "status";
  badge.dataset["status"] = value;
  badge.textContent = label || statusLabels[value] || value;
  container.append(badge);
  if (note) {
    const small = document.createElement("small");
    small.className = "text-danger";
    small.textContent = note;
    container.append(small);
  }
  return container;
}
export function statusColumn<T>(
  field: ColDef<T>["field"],
  title = "وضعیت",
): ColDef<T> {
  return {
    field,
    headerName: title,
    width: 130,
    minWidth: 130,
    maxWidth: 150,
    flex: 0,
    cellClass: "grid-status-cell",
    headerClass: "grid-status-header",
    filterValueGetter: (p) =>
      statusLabels[String(p.getValue(field as string))] ||
      String(p.getValue(field as string) ?? ""),
    cellRenderer: (p: ICellRendererParams<T>) =>
      p.data && p.value != null ? statusCell(String(p.value)) : "",
  };
}
export interface GridAction {
  label: string;
  icon?:
    | "eye"
    | "edit"
    | "check"
    | "renew"
    | "key"
    | "resetKey"
    | "wallet"
    | "power"
    | "book"
    | "calendar"
    | "trash";
  href?: string;
  run?: () => void;
  disabled?: boolean;
}
const icons: Record<string, string> = {
  resetKey:
    "M11.27 8H22v8h-3v-3h-3v-2h-4.73a5 5 0 1 1 0-3Z M8 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0",
  key: "m21 2-2 2m-7.39 7.39a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5M15.5 7.5l3 3L22 7l-3-3",
  book: "M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15",
  calendar:
    "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2 M12 13v6 M9 16h6",
  eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  edit: "m15 4 5 5 M4 20l5-1L21 7l-5-5L4 14v6",
  check: "m5 12 4 4L19 6",
  renew: "M20 7v5h-5 M4 17v-5h5 M19 12a7 7 0 0 0-12-5 M5 12a7 7 0 0 0 12 5",
  wallet: "M20 8V5H5a3 3 0 0 0 0 6h16v10H5a3 3 0 0 1-3-3V8 M21 14h-5v4h5",
  power: "M12 2v10 M5 5a9 9 0 1 0 14 0",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6",
};
export function actionColumn<T>(
  actions: (row: T) => GridAction[],
  width = 165,
): ColDef<T> {
  return {
    colId: "actions",
    headerName: "عملیات",
    pinned: "left",
    lockPinned: true,
    width,
    minWidth: width,
    maxWidth: width,
    flex: 0,
    sortable: false,
    filter: false,
    cellRenderer: (p: ICellRendererParams<T>) => {
      const group = document.createElement("div");
      group.className = "grid-row-actions";
      if (!p.data) return group;
      for (const action of actions(p.data)) {
        const element = action.href
          ? document.createElement("a")
          : document.createElement("button");
        element.title = action.label;
        element.setAttribute("aria-label", action.label);
        element.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[action.icon || "eye"]}"/></svg>`;
        if (element instanceof HTMLAnchorElement) element.href = action.href!;
        else {
          element.type = "button";
          element.disabled = !!action.disabled;
        }
        if (action.run)
          element.addEventListener("click", (e) => {
            e.preventDefault();
            action.run!();
          });
        group.append(element);
      }
      return group;
    },
  };
}

export function linesCell(main: string, details: string[] = []) {
  const el = document.createElement("div");
  el.className = "grid-lines";
  const text = document.createElement("span");
  text.textContent = main;
  el.append(text);
  for (const detail of details) {
    const small = document.createElement("small");
    small.textContent = detail;
    el.append(small);
  }
  return el;
}
