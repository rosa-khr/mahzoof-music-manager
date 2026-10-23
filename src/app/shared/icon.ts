import { Component, Input } from "@angular/core";

/** Original line icons; no template assets or external icon font. */
@Component({
  selector: "app-icon",
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="paths[name] || paths['grid']" />
  </svg>`,
})
export class Icon {
  @Input() name = "grid";
  paths: Record<string, string> = {
    lock: "M6 10V7a6 6 0 0 1 12 0v3 M5 10h14a1 1 0 0 1 1 1v10H4V11a1 1 0 0 1 1-1 M12 14v3",
    resetKey:
      "M11.27 8H22v8h-3v-3h-3v-2h-4.73a5 5 0 1 1 0-3Z M8 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0",
    key: "m21 2-2 2m-7.39 7.39a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5M15.5 7.5l3 3L22 7l-3-3",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    calendar:
      "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2 M7 14h3 M14 14h3 M7 18h3",
    clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    wallet: "M20 8V5H5a3 3 0 0 0 0 6h16v10H5a3 3 0 0 1-3-3V8 M21 14h-5v4h5",
    settings:
      "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    class: "M3 4h18v12H3z M7 20h10 M12 16v4 M7 8h6 M7 12h10",
    book: "M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15",
    receipt: "M5 3h14v18l-3-2-4 2-4-2-3 2V3 M8 7h8 M8 11h8 M8 15h4",
    bank: "m2 9 10-6 10 6H2 M4 21h16 M6 12v6 M12 12v6 M18 12v6",
    building:
      "M4 21V3h12v18 M16 10h4v11 M2 21h20 M8 7h4 M8 11h4 M8 15h4 M9 21v-3h2v3",
    document: "M14 2H4v20h16V8l-6-6v6h6 M8 12h8 M8 16h8",
    certificate:
      "M14 3H4v18h7 M14 3v5h6V8l-6-5 M8 12h3 M8 16h2 M21 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M14 18v5l3-2 3 2v-5",
    chart: "M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8",
    upload: "M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6",
    save: "M4 3h13l4 4v14H3V3h1 M7 3v6h10V3 M7 21v-8h10v8",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    chevron: "m14 7-5 5 5 5",
    plus: "M12 5v14 M5 12h14",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    logout: "M9 4H4v16h5 M13 12h9 m-4-4 4 4-4 4",
    music:
      "M9 18V5l12-2v13 M9 9l12-2 M9 18a3 3 0 1 1-3-3c1.66 0 3 1.34 3 3 M21 16a3 3 0 1 1-3-3c1.66 0 3 1.34 3 3",
    check: "m5 12 4 4L19 6",
    renew: "M20 7v5h-5 M4 17v-5h5 M19 12a7 7 0 0 0-12-5 M5 12a7 7 0 0 0 12 5",
    close: "m6 6 12 12 M6 18 18 6",
  };
}
