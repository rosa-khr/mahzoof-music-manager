import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  OnDestroy,
  createComponent,
  forwardRef,
  inject,
} from "@angular/core";
import {
  AbstractControl,
  NG_VALIDATORS,
  ValidationErrors,
  Validator,
} from "@angular/forms";
import jalaali from "jalaali-js";
import { dateDigits, jalaliToday, toIso, toJalali } from "./jalali-date";

const months = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const fa = (n: number) =>
  new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(n);

@Component({
  standalone: true,
  host: {
    class: "jalali-datepicker",
    role: "dialog",
    "aria-modal": "true",
    dir: "rtl",
    "(keydown)": "keyboard($event)",
  },
  template: `<header>
      <button type="button" aria-label="ماه قبل" (click)="moveMonth(-1)">
        ‹
      </button>
      <button
        type="button"
        class="calendar-title"
        [attr.aria-expanded]="choosingMonth"
        (click)="choosingMonth = !choosingMonth"
      >
        {{ months[month - 1] }} {{ fa(year) }}
      </button>
      <button type="button" aria-label="ماه بعد" (click)="moveMonth(1)">
        ›
      </button>
      <button type="button" aria-label="بستن تقویم" (click)="onClose()">
        ×
      </button>
    </header>
    @if (choosingMonth) {
      <div class="calendar-year">
        <label for="calendar-year">سال شمسی</label
        ><input
          id="calendar-year"
          type="text"
          inputmode="numeric"
          [value]="year"
          (change)="setYear($event)"
          (keydown.enter)="setYear($event); $event.preventDefault()"
        />
      </div>
      <div class="calendar-months">
        @for (name of months; track name; let i = $index) {
          <button
            type="button"
            [class.selected]="month === i + 1"
            (click)="setMonth(i + 1)"
          >
            {{ name }}
          </button>
        }
      </div>
    } @else {
      <div
        role="grid"
        [attr.aria-label]="'روزهای ' + months[month - 1] + ' ' + fa(year)"
      >
        <div role="row" class="calendar-week">
          @for (day of weekdays; track day) {
            <span role="columnheader">{{ day }}</span>
          }
        </div>
        @for (week of weeks; track $index) {
          <div role="row" class="calendar-week">
            @for (day of week; track $index) {
              @if (day) {
                <button
                  type="button"
                  role="gridcell"
                  [attr.data-day]="day"
                  [attr.tabindex]="day === focusedDay ? 0 : -1"
                  [attr.aria-label]="label(day)"
                  [attr.aria-selected]="isSelected(day)"
                  [attr.aria-current]="isToday(day) ? 'date' : null"
                  [class.selected]="isSelected(day)"
                  [class.today]="isToday(day)"
                  (focus)="focusedDay = day"
                  (click)="onChoose(value(day))"
                >
                  {{ fa(day) }}
                </button>
              } @else {
                <span role="gridcell"></span>
              }
            }
          </div>
        }
      </div>
    }
    <footer>
      <button type="button" (click)="onChoose(today)">امروز</button
      ><button type="button" (click)="onChoose('')">پاک‌کردن</button>
    </footer>`,
  styles: [
    `
      :host {
        position: fixed;
        z-index: 1400;
        width: min(310px, calc(100vw - 16px));
        padding: 12px;
        border: 1px solid #dce1eb;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 8px 32px #25324b26;
        font:
          12px Dana,
          sans-serif;
        color: #252f4a;
        max-height: calc(100dvh - 16px);
        overflow-y: auto;
        box-sizing: border-box;
      }
      header,
      footer {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      header {
        margin-bottom: 8px;
      }
      button,
      input {
        font: inherit;
        box-sizing: border-box;
      }
      button {
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: inherit;
        min-width: 32px;
        min-height: 32px;
        cursor: pointer;
      }
      button:hover {
        background: #f1f3f6;
      }
      button:focus-visible,
      input:focus-visible {
        outline: 2px solid #70b1ff;
        outline-offset: -2px;
      }
      .calendar-title {
        flex: 1;
        font-weight: 600;
      }
      .calendar-week {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 2px;
        text-align: center;
      }
      .calendar-week > span {
        min-height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #78829d;
        font-size: 11px;
      }
      .calendar-week button {
        min-width: 0;
        min-height: 34px;
      }
      .today {
        box-shadow: inset 0 0 0 1px #70b1ff;
      }
      button.selected {
        background: #1b84ff;
        color: #fff;
      }
      footer {
        justify-content: space-between;
        border-top: 1px solid #edf0f5;
        margin-top: 8px;
        padding-top: 8px;
      }
      footer button {
        padding: 4px 10px;
        color: #1675e6;
      }
      .calendar-months {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .calendar-year {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 8px 0 14px;
      }
      .calendar-year input {
        width: 90px;
        height: 34px;
        text-align: center;
        border: 1px solid #dce1eb;
        border-radius: 5px;
      }
    `,
  ],
})
export class JalaliCalendar {
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  months = months;
  fa = fa;
  weekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  today = jalaliToday();
  selected = "";
  year = 1405;
  month = 1;
  focusedDay = 1;
  weeks: (number | null)[][] = [];
  choosingMonth = false;
  onChoose: (value: string) => void = () => {};
  onClose: () => void = () => {};
  init(value: string) {
    try {
      this.selected = value ? toJalali(toIso(value)) : "";
    } catch {
      this.selected = "";
    }
    const [y, m, d] = (this.selected || this.today).split("/").map(Number);
    this.year = y;
    this.month = m;
    this.focusedDay = d;
    this.refresh();
  }
  value(day: number) {
    return (
      this.year +
      "/" +
      String(this.month).padStart(2, "0") +
      "/" +
      String(day).padStart(2, "0")
    );
  }
  label(day: number) {
    return fa(day) + " " + months[this.month - 1] + " " + fa(this.year);
  }
  isSelected(day: number) {
    return this.value(day) === this.selected;
  }
  isToday(day: number) {
    return this.value(day) === this.today;
  }
  refresh() {
    const g = jalaali.toGregorian(this.year, this.month, 1),
      offset = (new Date(Date.UTC(g.gy, g.gm - 1, g.gd)).getUTCDay() + 1) % 7;
    const length = jalaali.jalaaliMonthLength(this.year, this.month);
    const cells = Array.from(
      { length: Math.ceil((offset + length) / 7) * 7 },
      (_, i) => (i >= offset && i < offset + length ? i - offset + 1 : null),
    );
    this.weeks = Array.from({ length: cells.length / 7 }, (_, i) =>
      cells.slice(i * 7, i * 7 + 7),
    );
    this.focusedDay = Math.min(this.focusedDay, length);
    this.cdr.markForCheck();
  }
  focusDay() {
    this.element.nativeElement
      .querySelector<HTMLElement>('[data-day="' + this.focusedDay + '"]')
      ?.focus();
  }
  moveMonth(delta: number) {
    const index = this.year * 12 + this.month - 1 + delta,
      y = Math.floor(index / 12);
    if (y < 1000 || y > 3177) return;
    this.year = y;
    this.month = (index % 12) + 1;
    this.choosingMonth = false;
    this.refresh();
  }
  setYear(event: Event) {
    const input = event.target as HTMLInputElement,
      y = Number(dateDigits(input.value));
    if (Number.isInteger(y) && y >= 1000 && y <= 3177) {
      this.year = y;
      this.refresh();
    }
    input.value = String(this.year);
  }
  setMonth(month: number) {
    this.month = month;
    this.choosingMonth = false;
    this.refresh();
    this.cdr.detectChanges();
    this.focusDay();
  }
  keyboard(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.onClose();
      return;
    }
    if (event.key === "Tab") {
      const nodes = Array.from(
        this.element.nativeElement.querySelectorAll<HTMLElement>(
          'button:not([tabindex="-1"]),input',
        ),
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (!(event.target as HTMLElement).hasAttribute("data-day")) return;
    const offsets: Record<string, number> = {
      ArrowLeft: 1,
      ArrowRight: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    if (event.key === "PageUp" || event.key === "PageDown")
      this.moveMonth(
        (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1),
      );
    else if (
      Object.hasOwn(offsets, event.key) ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      const d = new Date(toIso(this.value(this.focusedDay)) + "T12:00:00Z");
      const weekday = (d.getUTCDay() + 1) % 7;
      d.setUTCDate(
        d.getUTCDate() +
          (event.key === "Home"
            ? -weekday
            : event.key === "End"
              ? 6 - weekday
              : offsets[event.key]),
      );
      const [y, m, day] = toJalali(d.toISOString().slice(0, 10))
        .split("/")
        .map(Number);
      if (y < 1000 || y > 3177) return;
      this.year = y;
      this.month = m;
      this.focusedDay = day;
      this.refresh();
    } else return;
    event.preventDefault();
    this.cdr.detectChanges();
    this.focusDay();
  }
}

let pickerId = 0;
let activePicker: Datepicker | undefined;
@Directive({
  selector: "input[appDatepicker]",
  standalone: true,
  providers: [
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => Datepicker),
      multi: true,
    },
  ],
})
export class Datepicker implements AfterViewInit, OnDestroy, Validator {
  private input =
    inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private app = inject(ApplicationRef);
  private environment = inject(EnvironmentInjector);
  private button?: HTMLButtonElement;
  private calendar?: ComponentRef<JalaliCalendar>;
  private observer?: MutationObserver;
  private sizeObserver?: ResizeObserver;
  private id = "jalali-calendar-" + ++pickerId;
  validate(control: AbstractControl): ValidationErrors | null {
    try {
      if (control.value) toIso(String(control.value));
      return null;
    } catch {
      return { jalaliDate: true };
    }
  }
  ngAfterViewInit() {
    const button = document.createElement("button");
    this.button = button;
    button.type = "button";
    button.className = "date-picker-trigger";
    button.setAttribute(
      "aria-label",
      "انتخاب " +
        (this.input.labels?.[0]?.textContent?.trim().replace(/\s*\*$/, "") ||
          "تاریخ شمسی"),
    );
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 14h3M14 14h3M7 18h3"/></svg>';
    this.input.after(button);
    this.input.autocomplete = "off";
    this.input.inputMode = "numeric";
    this.input.setAttribute("aria-haspopup", "dialog");
    button.addEventListener("click", this.toggle);
    this.input.addEventListener("click", this.open);
    this.input.addEventListener("keydown", this.inputKey);
    this.observer = new MutationObserver(() => {
      button.disabled = this.input.matches(":disabled");
      if (button.disabled) this.close(false);
    });
    this.observer.observe(this.input, {
      attributes: true,
      attributeFilter: ["disabled"],
    });
    button.disabled = this.input.matches(":disabled");
  }
  private toggle = () => {
    if (this.calendar) this.close(true);
    else this.open();
  };
  private inputKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" && event.altKey) {
      event.preventDefault();
      this.open();
    }
  };
  private open = () => {
    if (this.input.matches(":disabled") || this.input.readOnly) return;
    if (this.calendar) {
      this.calendar.instance.focusDay();
      return;
    }
    activePicker?.close(false);
    activePicker = this;
    const ref = createComponent(JalaliCalendar, {
      environmentInjector: this.environment,
    });
    this.calendar = ref;
    const host = ref.location.nativeElement as HTMLElement;
    host.id = this.id;
    host.setAttribute("aria-label", "تقویم شمسی");
    ref.instance.init(this.input.value);
    ref.instance.onClose = () => this.close(true);
    ref.instance.onChoose = (value) => {
      if (this.input.matches(":disabled")) {
        this.close(false);
        return;
      }
      this.input.value = value;
      this.input.dispatchEvent(new Event("input", { bubbles: true }));
      this.input.dispatchEvent(new Event("change", { bubbles: true }));
      this.close(true);
    };
    this.app.attachView(ref.hostView);
    document.body.append(host);
    ref.changeDetectorRef.detectChanges();
    this.sizeObserver = new ResizeObserver(this.position);
    this.sizeObserver.observe(host);
    this.button?.setAttribute("aria-expanded", "true");
    this.button?.setAttribute("aria-controls", this.id);
    this.input.setAttribute("aria-controls", this.id);
    this.position();
    ref.instance.focusDay();
    document.addEventListener("pointerdown", this.outside, true);
    window.addEventListener("resize", this.position);
    document.addEventListener("scroll", this.position, true);
  };
  private position = () => {
    if (!this.calendar) return;
    const host = this.calendar.location.nativeElement as HTMLElement,
      rect = this.input.getBoundingClientRect();
    const width = host.offsetWidth,
      height = host.offsetHeight;
    host.style.left =
      Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)) +
      "px";
    const top =
      rect.bottom + 6 + height <= window.innerHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - height - 6);
    host.style.top =
      Math.min(top, Math.max(8, window.innerHeight - height - 8)) + "px";
  };
  private outside = (event: PointerEvent) => {
    const node = event.target as Node;
    if (
      node !== this.input &&
      !this.button?.contains(node) &&
      !this.calendar?.location.nativeElement.contains(node)
    )
      this.close(false);
  };
  private close(focus: boolean) {
    if (!this.calendar) return;
    const ref = this.calendar;
    this.calendar = undefined;
    if (activePicker === this) activePicker = undefined;
    document.removeEventListener("pointerdown", this.outside, true);
    window.removeEventListener("resize", this.position);
    document.removeEventListener("scroll", this.position, true);
    this.app.detachView(ref.hostView);
    this.sizeObserver?.disconnect();
    this.sizeObserver = undefined;
    ref.destroy();
    this.button?.setAttribute("aria-expanded", "false");
    this.button?.removeAttribute("aria-controls");
    this.input.removeAttribute("aria-controls");
    if (focus) this.input.focus();
  }
  ngOnDestroy() {
    this.close(false);
    this.observer?.disconnect();
    this.button?.removeEventListener("click", this.toggle);
    this.input.removeEventListener("click", this.open);
    this.input.removeEventListener("keydown", this.inputKey);
    this.button?.remove();
  }
}
