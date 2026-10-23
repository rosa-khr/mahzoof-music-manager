import { Injectable, inject } from "@angular/core";
import { Api } from "./api";
export const DEFAULT_SESSION_STATUSES = [
  { code: "present", name: "حاضر" },
  { code: "absent", name: "غایب" },
  { code: "reserved", name: "رزرو" },
  { code: "cancelled", name: "کنسل" },
];
@Injectable({ providedIn: "root" })
export class SessionStatuses {
  api = inject(Api);
  options = DEFAULT_SESSION_STATUSES;
  async load() {
    const data = await this.api.get<{
      items: { code: string; name: string }[];
    }>("/session-status-options");
    this.options = DEFAULT_SESSION_STATUSES.map(
      (defaultValue) =>
        data.items.find((item) => item.code === defaultValue.code) ||
        defaultValue,
    );
    return this.options;
  }
}
