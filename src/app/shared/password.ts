import { Directive, ElementRef, inject } from "@angular/core";
const eye =
  "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0";
const eyeOff =
  "M3 3l18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.9 5.2A11 11 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3 3.8 M6.2 6.2C3.5 8.2 2 12 2 12s3 7 10 7c2.1 0 4-.6 5.6-1.6";
/** Keeps native labels, validation and Angular forms attached to the original input. */
@Directive({ selector: "input[appPassword]", standalone: true })
export class Password {
  element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  button?: HTMLButtonElement;
  dispose?: () => void;
  visible = false;
  ngAfterViewInit() {
    const input = this.element.nativeElement,
      parent = input.parentElement!;
    parent.classList.add("password-field");
    input.dir = "ltr";
    const label =
      input.labels?.[0]?.textContent?.replace(/\s*\(.*?\)|\*/g, "").trim() ||
      "رمز عبور";
    const button = document.createElement("button");
    this.button = button;
    button.type = "button";
    button.className = "password-toggle";
    button.setAttribute("aria-controls", input.id);
    const render = () => {
      button.setAttribute(
        "aria-label",
        (this.visible ? "پنهان‌کردن " : "نمایش ") + label,
      );
      button.setAttribute("aria-pressed", String(this.visible));
      button.title = button.getAttribute("aria-label")!;
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${this.visible ? eyeOff : eye}"/></svg>`;
    };
    const toggle = () => {
      if (input.disabled) return;
      const start = input.selectionStart,
        end = input.selectionEnd;
      this.visible = !this.visible;
      input.type = this.visible ? "text" : "password";
      render();
      if (document.activeElement === input && start !== null && end !== null)
        input.setSelectionRange(start, end);
    };
    const keepFocus = (event: MouseEvent) => {
      if (event.button === 0) event.preventDefault();
    };
    render();
    parent.append(button);
    button.addEventListener("click", toggle);
    button.addEventListener("mousedown", keepFocus);
    this.dispose = () => {
      button.removeEventListener("click", toggle);
      button.removeEventListener("mousedown", keepFocus);
      button.remove();
      parent.classList.remove("password-field");
      input.type = "password";
    };
  }
  ngOnDestroy() {
    this.dispose?.();
  }
}
