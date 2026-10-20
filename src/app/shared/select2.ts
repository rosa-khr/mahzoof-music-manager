import {
  AfterViewInit,
  ChangeDetectorRef,
  Directive,
  ElementRef,
  inject,
  OnDestroy,
} from "@angular/core";
import { NgControl } from "@angular/forms";
import { Subscription } from "rxjs";
import $ from "jquery";
import register from "select2/dist/js/select2.js";
import type { OptionData, OptGroupData } from "select2";

register(window, $);
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u200c\u200d]/g, "")
    .replace(/ي|ى/g, "ی")
    .replace(/ك/g, "ک")
    .trim()
    .toLocaleLowerCase("fa");

/** Enhance the native Angular value accessor; native change remains the only writer. */
@Directive({ selector: "select[appSelect2]", standalone: true })
export class Select2 implements AfterViewInit, OnDestroy {
  private element =
    inject<ElementRef<HTMLSelectElement>>(ElementRef).nativeElement;
  private control = inject(NgControl, { optional: true, self: true });
  private cdr = inject(ChangeDetectorRef);
  private widget?: JQuery<HTMLSelectElement>;
  private observer?: MutationObserver;
  private fieldsetObserver?: MutationObserver;
  private subscriptions = new Subscription();
  private destroyed = false;
  private queued = false;

  ngAfterViewInit() {
    const el = this.element;
    const label = el.labels?.[0];
    if (label) label.id ||= `${el.id}-label`;
    const match = (
      params: { term?: string },
      data: OptionData | OptGroupData,
    ): OptionData | OptGroupData | null => {
      const term = normalize(params.term || "");
      if (!term) return data;
      if ("children" in data && data.children) {
        const children = data.children.filter(
          (child) => !!match(params, child),
        );
        return children.length ? { ...data, children } : null;
      }
      return normalize(data.text).includes(term) ? data : null;
    };
    this.widget = $(el);
    this.widget.select2({
      dir: "rtl",
      width: "100%",
      theme: "mahzoof",
      minimumResultsForSearch: 0,
      matcher: match,
      language: {
        noResults: () => "موردی پیدا نشد",
        searching: () => "در حال جست‌وجو…",
        errorLoading: () => "دریافت گزینه‌ها ممکن نشد",
      },
    });
    this.widget.on("change.mahzoof", (event) => {
      // Select2 emits a jQuery event; Angular listens to the browser event.
      if (!event.originalEvent)
        el.dispatchEvent(new Event("change", { bubbles: true }));
      this.cdr.markForCheck();
    });
    this.widget.on("select2:opening.mahzoof", (event) => {
      if (el.matches(":disabled")) event.preventDefault();
    });
    this.widget.on("select2:open.mahzoof", () => {
      const search = document.querySelector<HTMLInputElement>(
        ".select2-container--open .select2-search__field",
      );
      if (search) {
        search.placeholder = "جست‌وجو…";
        search.setAttribute(
          "aria-label",
          `جست‌وجو در ${label?.textContent?.trim() || "گزینه‌ها"}`,
        );
        search.focus();
      }
    });
    this.widget.on("select2:close.mahzoof", () => {
      this.control?.control?.markAsTouched();
      this.cdr.markForCheck();
    });
    const combo =
      el.nextElementSibling?.querySelector<HTMLElement>("[role=combobox]");
    if (combo && label) combo.setAttribute("aria-labelledby", label.id);
    if (combo && el.required) combo.setAttribute("aria-required", "true");
    this.observer = new MutationObserver(() => this.scheduleSync());
    this.observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled", "selected"],
    });
    const fieldset = el.closest("fieldset");
    if (fieldset) {
      this.fieldsetObserver = new MutationObserver(() => this.scheduleSync());
      this.fieldsetObserver.observe(fieldset, {
        attributes: true,
        attributeFilter: ["disabled"],
      });
    }
    this.subscriptions.add(
      this.control?.valueChanges?.subscribe(() => this.scheduleSync()),
    );
    this.subscriptions.add(
      this.control?.statusChanges?.subscribe(() => this.scheduleSync()),
    );
    this.scheduleSync();
  }
  private scheduleSync() {
    if (this.queued || this.destroyed) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (this.destroyed || !this.widget) return;
      // Options and writeValue may arrive asynchronously in the same render.
      const value = this.control?.control?.value;
      if (value !== undefined)
        this.widget.val(value == null ? "" : String(value));
      this.widget.trigger("change.select2");
      const disabled = this.element.matches(":disabled");
      const container = this.element.nextElementSibling;
      container?.classList.toggle("select2-container--disabled", disabled);
      const combo = container?.querySelector<HTMLElement>("[role=combobox]");
      combo?.setAttribute("aria-disabled", String(disabled));
      combo?.setAttribute("tabindex", disabled ? "-1" : "0");
      if (disabled) this.widget.select2("close");
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.observer?.disconnect();
    this.fieldsetObserver?.disconnect();
    this.subscriptions.unsubscribe();
    this.widget?.off(".mahzoof");
    this.widget?.select2("destroy");
  }
}
