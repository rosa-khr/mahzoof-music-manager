import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from "@angular/core";
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  MENU_GROUPS,
  canOpenMenu,
  MenuGroup,
  MenuItem,
} from "./core/navigation";
import { Icon } from "./shared/icon";
import { ToastHost } from "./shared/toast";
import { Api, errorMessage } from "./core/api";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-root",
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ToastHost],
  host: {
    "(document:keydown.escape)": "closeMenu()",
    "(window:resize)": "cdr.markForCheck()",
  },
  template: `<app-toast-host />
    @if (api.user(); as user) {
      <a class="skip-link" href="#main-content">رفتن به محتوای صفحه</a>
      <div class="app-layout" [class.sidebar-collapsed]="collapsed">
        @if (menu) {
          <button
            class="sidebar-backdrop"
            aria-label="بستن منو"
            (click)="closeMenu()"
          ></button>
        }
        <aside
          class="sidebar"
          [class.open]="menu"
          id="main-sidebar"
          (keydown)="trapMenu($event)"
          [attr.inert]="!menu && mobile ? '' : null"
        >
          <div class="brand-row">
            <a class="brand" routerLink="/" aria-label="محذوف، پیشخوان"
              ><span class="brand-symbol"><app-icon name="music" /></span
              ><span class="sidebar-label"
                >محذوف<small>مدیریت آموزشگاه موسیقی</small></span
              ></a
            >
            <button
              class="icon-button sidebar-collapse"
              (click)="collapsed = !collapsed"
              [attr.aria-expanded]="!collapsed"
              aria-controls="main-sidebar"
              aria-label="جمع کردن سایدبار"
            >
              <app-icon name="chevron" />
            </button>
            <button
              class="icon-button mobile-close"
              (click)="closeMenu()"
              aria-label="بستن منو"
            >
              <app-icon name="close" />
            </button>
          </div>
          <nav class="primary-nav navigation-scroll" aria-label="منوی اصلی">
            @for (group of navigation; track group.id) {
              <div
                class="nav-group"
                [class.nav-group--direct]="group.direct"
                [class.nav-group--expanded]="groupOpen(group.id)"
                role="group"
                [attr.aria-label]="group.title"
              >
                @if (!group.direct) {
                  <button
                    class="nav-group-toggle"
                    type="button"
                    [attr.aria-expanded]="groupOpen(group.id)"
                    [attr.aria-controls]="'nav-' + group.id"
                    [attr.aria-label]="group.title"
                    [title]="group.title"
                    (click)="toggleGroup(group.id)"
                  >
                    <app-icon [name]="group.icon" />
                    <span class="sidebar-label">{{ group.title }}</span>
                    <app-icon
                      class="nav-group-chevron sidebar-label"
                      name="chevron"
                    />
                  </button>
                }
                <div
                  [id]="'nav-' + group.id"
                  class="nav-group-items"
                  [class.nav-submenu]="!group.direct"
                  [hidden]="!group.direct && !groupOpen(group.id)"
                >
                  @for (item of group.items; track item.path) {
                    @if (item.section && firstInSection(group, item)) {
                      <button
                        type="button"
                        class="nav-group-toggle nav-nested-toggle"
                        [attr.aria-label]="item.section"
                        [attr.aria-expanded]="usersSectionOpen"
                        (click)="usersSectionOpen = !usersSectionOpen"
                      >
                        <app-icon name="users" /><span class="sidebar-label">{{
                          item.section
                        }}</span
                        ><app-icon
                          class="nav-group-chevron sidebar-label"
                          name="chevron"
                        />
                      </button>
                    }
                    <a
                      [hidden]="!!item.section && !usersSectionOpen"
                      [class.nav-nested-link]="!!item.section"
                      [routerLink]="item.path"
                      [routerLinkActiveOptions]="{
                        paths:
                          item.path === '/students' ||
                          item.path === '/users' ||
                          item.path === '/roles' ||
                          item.path === '/subjects' ||
                          item.path.startsWith('/base-data/')
                            ? 'subset'
                            : 'exact',
                        queryParams: 'ignored',
                        matrixParams: 'ignored',
                        fragment: 'ignored',
                      }"
                      routerLinkActive="selected"
                      ariaCurrentWhenActive="page"
                      (click)="closeMenu()"
                      [title]="item.title"
                      [attr.aria-label]="item.title"
                    >
                      <app-icon [name]="item.icon" />
                      <span class="sidebar-label">{{ item.title }}</span>
                    </a>
                  }
                </div>
              </div>
            }
          </nav>
          <div class="sidebar-footer">
            <span class="sidebar-avatar">م</span>
            <div class="sidebar-label">
              <b>آموزشگاه محذوف</b><small>پنل مدیریت کارکنان</small>
            </div>
          </div>
        </aside>
        <div class="workspace">
          <header class="topbar">
            <div class="topbar-context">
              <button
                class="icon-button menu-toggle"
                (click)="toggleMenu()"
                aria-label="باز و بسته کردن منو"
                [attr.aria-expanded]="menu"
                aria-controls="main-sidebar"
              >
                <app-icon name="menu" /></button
              ><span class="topbar-title"
                >آموزشگاه موسیقی <b>شهرام محذوف</b></span
              ><span class="topbar-section">پنل کارکنان</span>
            </div>
            <div class="user-menu">
              <a
                class="user-account"
                routerLink="/account"
                aria-label="حساب شخصی"
              >
                <span class="user-avatar">{{
                  user.username.slice(0, 1).toUpperCase()
                }}</span>
                <div class="user-details">
                  <b dir="auto">{{ user.username }}</b
                  ><small>{{
                    roles[user.role] || user.roleName || "کاربر آموزشگاه"
                  }}</small>
                </div></a
              >
              <button
                class="icon-button"
                (click)="logout()"
                aria-label="خروج"
                title="خروج"
              >
                <app-icon name="logout" />
              </button>
            </div>
          </header>
          @if (error) {
            <p class="alert alert-danger" role="alert">{{ error }}</p>
          }
          <main id="main-content"><router-outlet /></main>
          <footer class="workspace-footer">
            <span>آموزشگاه موسیقی شهرام محذوف</span
            ><span>مدیریت آموزش و امور هنرجویان</span>
          </footer>
        </div>
      </div>
    } @else {
      <router-outlet />
    }`,
})
export class App implements OnInit {
  cdr = inject(ChangeDetectorRef);
  api = inject(Api);
  router = inject(Router);
  destroy = inject(DestroyRef);
  expandedGroup: string | null = null;
  private activePath = "";
  get navigation() {
    return MENU_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canOpenMenu(this.api.user(), item.access, item.path),
      ),
    })).filter((group) => group.items.length);
  }
  usersSectionOpen = false;
  firstInSection(group: MenuGroup, item: MenuItem) {
    return group.items.find((i) => i.section === item.section) === item;
  }
  menu = false;
  collapsed = false;
  get mobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }
  roles: Record<string, string> = {
    admin: "مدیر آموزشگاه",
    secretary: "مسئول آموزش",
    accountant: "حسابدار",
  };
  error = "";
  ngOnInit() {
    this.syncActiveGroup();
    this.router.events
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.syncActiveGroup();
          this.cdr.markForCheck();
        }
      });
    void this.api.restore();
  }
  groupOpen(id: string) {
    return this.expandedGroup === id && (!this.collapsed || this.mobile);
  }
  toggleGroup(id: string) {
    if (this.collapsed && !this.mobile) {
      this.collapsed = false;
      this.expandedGroup = id;
    } else this.expandedGroup = this.expandedGroup === id ? null : id;
  }
  private syncActiveGroup() {
    const path = this.router.url.split(/[?#]/)[0];
    if (path === this.activePath) return;
    this.activePath = path;
    this.usersSectionOpen = /^\/(users|roles)(\/|$)/.test(path);
    this.expandedGroup =
      MENU_GROUPS.find(
        (group) =>
          !group.direct &&
          group.items.some(
            (item) =>
              item.path === path ||
              (item.path !== "/" && path.startsWith(item.path + "/")),
          ),
      )?.id || null;
  }
  toggleMenu() {
    this.menu = !this.menu;
    if (this.menu)
      setTimeout(() =>
        document.querySelector<HTMLButtonElement>(".mobile-close")?.focus(),
      );
  }
  closeMenu() {
    if (this.menu) {
      this.menu = false;
      document.querySelector<HTMLButtonElement>(".menu-toggle")?.focus();
    }
  }
  trapMenu(event: KeyboardEvent) {
    if (event.key !== "Tab" || !this.mobile || !this.menu) return;
    const items = [
      ...document.querySelectorAll<HTMLElement>(
        "#main-sidebar a, #main-sidebar button",
      ),
    ].filter((el) => el.offsetParent !== null);
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  async logout() {
    try {
      await this.api.logout();
    } catch (e) {
      this.error = errorMessage(e);
    }

    this.cdr.markForCheck();
  }
}
