import { Component, Injectable, inject, signal } from "@angular/core";

export type ToastKind = "success" | "error" | "info";
export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

@Injectable({ providedIn: "root" })
export class Toasts {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 0;
  show(text: string, kind: ToastKind = "info") {
    const message = { id: ++this.nextId, text, kind };
    this.messages.update((items) => [...items.slice(-3), message]);
    setTimeout(() => this.dismiss(message.id), kind === "error" ? 6500 : 4200);
  }
  dismiss(id: number) {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
}

@Component({
  selector: "app-toast-host",
  standalone: true,
  template: `<div
    class="toast-stack"
    aria-live="polite"
    aria-relevant="additions"
  >
    @for (message of toasts.messages(); track message.id) {
      <div
        class="toast-message"
        [class.toast-success]="message.kind === 'success'"
        [class.toast-error]="message.kind === 'error'"
        [class.toast-info]="message.kind === 'info'"
        [attr.role]="message.kind === 'error' ? 'alert' : 'status'"
      >
        <span>{{ message.text }}</span>
        <button
          type="button"
          aria-label="بستن پیام"
          (click)="toasts.dismiss(message.id)"
        >
          ×
        </button>
      </div>
    }
  </div>`,
})
export class ToastHost {
  readonly toasts = inject(Toasts);
}
