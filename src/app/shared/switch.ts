import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  inject,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

let switchId = 0;
@Component({
  selector: "app-switch",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Switch),
      multi: true,
    },
  ],
  template: `<div class="switch-field">
    <label class="switch-title" [for]="id">{{ label }}</label>
    <label class="switch-control" [for]="id">
      <input
        [id]="id"
        type="checkbox"
        role="switch"
        [checked]="checked"
        [disabled]="disabled"
        [attr.aria-label]="label"
        (change)="change($event)"
        (blur)="touched()"
      />
      <span class="switch-track" aria-hidden="true"></span>
      <span class="switch-value">{{ checked ? onText : offText }}</span>
    </label>
  </div>`,
})
export class Switch implements ControlValueAccessor {
  @Input() label = "";
  @Input() onText = "فعال";
  @Input() offText = "غیرفعال";
  @Input() onValue: unknown = true;
  @Input() offValue: unknown = false;
  @Input() checked = false;
  @Input() disabled = false;
  @Output() checkedChange = new EventEmitter<boolean>();
  id = "switch-" + ++switchId;
  cdr = inject(ChangeDetectorRef);
  private changed: (value: unknown) => void = () => {};
  touched: () => void = () => {};
  writeValue(value: unknown) {
    this.checked = value === this.onValue;
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (value: unknown) => void) {
    this.changed = fn;
  }
  registerOnTouched(fn: () => void) {
    this.touched = fn;
  }
  setDisabledState(disabled: boolean) {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }
  change(event: Event) {
    this.checked = (event.target as HTMLInputElement).checked;
    this.changed(this.checked ? this.onValue : this.offValue);
    this.checkedChange.emit(this.checked);
    this.touched();
  }
}

/** Native grid cell: same appearance, real keyboard switch and explicit save callback. */
export function switchCell(
  label: string,
  checked: boolean,
  change: (input: HTMLInputElement) => void,
  offText = "غیرفعال",
) {
  const wrapper = document.createElement("label");
  wrapper.className = "switch-control grid-switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.role = "switch";
  input.checked = checked;
  input.setAttribute("aria-label", label);
  input.title = label;
  const track = document.createElement("span");
  track.className = "switch-track";
  track.setAttribute("aria-hidden", "true");
  const value = document.createElement("span");
  value.className = "switch-value";
  value.textContent = checked ? "فعال" : offText;
  input.addEventListener("change", () => change(input));
  wrapper.append(input, track, value);
  return wrapper;
}
