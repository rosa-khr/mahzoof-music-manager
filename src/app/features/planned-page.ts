import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { PageHeader } from "../shared/ui";
import { Icon } from "../shared/icon";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Icon],
  template: `<app-header [title]="page.title" [subtitle]="page.group" />
    <section class="card planned-page">
      <span class="planned-icon"><app-icon [name]="page.icon" /></span>
      <h2>{{ page.title }}</h2>
      <span class="count-label">در انتظار پیاده‌سازی</span>
      <p>این بخش در گام بعد، با جزئیات مشخص‌شده برای همین صفحه ساخته می‌شود.</p>
    </section>`,
})
export class PlannedPage {
  page = inject(ActivatedRoute).snapshot.data as {
    title: string;
    group: string;
    icon: string;
  };
}
