import {
  AfterViewInit,
  Directive,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ElementRef,
  inject,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import Tagify from "@yaireo/tagify";

export interface TagifyChoice {
  id: number;
  value: string;
}

type TagifyTag = TagifyChoice & { __isValid?: boolean };
type TagifyInstance = {
  value: TagifyTag[];
  settings: { whitelist: TagifyChoice[] };
  addTags(tags: TagifyChoice[]): void;
  removeAllTags(): void;
  destroy(): void;
  on(event: string, callback: () => void): void;
  setDisabled?(disabled: boolean): void;
};
type TagifyConstructor = new (
  input: HTMLInputElement,
  settings: Record<string, unknown>,
) => TagifyInstance;

@Directive({
  selector: "input[appTagify]",
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TagifyControl),
      multi: true,
    },
  ],
  host: { "aria-label": "سازهای تخصصی مدرس" },
})
export class TagifyControl
  implements ControlValueAccessor, AfterViewInit, OnChanges, OnDestroy
{
  @Input() appTagifyWhitelist: TagifyChoice[] = [];
  private input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private tagify?: TagifyInstance;
  private value: number[] = [];
  private disabled = false;
  private changed: (value: number[]) => void = () => {};
  private touched: () => void = () => {};

  ngAfterViewInit() {
    const Ctor = Tagify as unknown as TagifyConstructor;
    this.tagify = new Ctor(this.input, {
      whitelist: this.appTagifyWhitelist,
      enforceWhitelist: true,
      duplicates: false,
      userInput: true,
      tagTextProp: "value",
      dropdown: { enabled: 0, maxItems: 30, closeOnSelect: false, searchKeys: ["value"] },
      direction: "rtl",
      placeholder: "ساز را جست‌وجو و انتخاب کنید",
      a11y: { inputAriaLabel: "جست‌وجو و انتخاب سازهای تدریسی" },
    });
    this.tagify.on("change", () => {
      const next = this.tagify!.value.map((tag) => tag.id);
      if (next.length === this.value.length && next.every((id, index) => id === this.value[index])) return;
      this.value = next;
      this.changed([...next]);
    });
    this.input.addEventListener("blur", this.handleBlur);
    this.syncTags();
    this.tagify.setDisabled?.(this.disabled);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes["appTagifyWhitelist"] || !this.tagify) return;
    this.tagify.settings.whitelist = this.appTagifyWhitelist;
    this.syncTags();
  }

  writeValue(value: number[] | null) {
    this.value = Array.isArray(value) ? value : [];
    this.syncTags();
  }
  registerOnChange(fn: (value: number[]) => void) {
    this.changed = fn;
  }
  registerOnTouched(fn: () => void) {
    this.touched = fn;
  }
  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
    this.tagify?.setDisabled?.(disabled);
  }
  private handleBlur = () => this.touched();
  private syncTags() {
    if (!this.tagify) return;
    const selected = this.appTagifyWhitelist.filter((item) =>
      this.value.includes(item.id),
    );
    this.tagify.removeAllTags();
    if (selected.length) this.tagify.addTags(selected);
  }
  ngOnDestroy() {
    this.input.removeEventListener("blur", this.handleBlur);
    this.tagify?.destroy();
  }
}
