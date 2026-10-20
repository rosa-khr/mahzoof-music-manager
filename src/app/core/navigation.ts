import { User } from "./models";
import { BASE_RESOURCES } from "./base-data";

export type MenuAccess = "all" | "education" | "finance" | "admin";
export interface MenuItem {
  path: string;
  title: string;
  icon: string;
  access: MenuAccess;
  planned?: boolean;
}
export interface MenuGroup {
  id: string;
  icon: string;
  direct?: boolean;
  title: string;
  items: MenuItem[];
}

/** Scope: brief sections 13, 17, 19 and 20. Pages are delivered individually. */
export const MENU_GROUPS: MenuGroup[] = [
  {
    id: "workspace",
    icon: "grid",
    direct: true,
    title: "میز کار",
    items: [
      { path: "/", title: "کارهای امروز", icon: "grid", access: "all" },
      {
        path: "/students",
        title: "پرونده هنرجویان",
        icon: "users",
        access: "all",
      },
    ],
  },
  {
    id: "finance",
    icon: "wallet",
    title: "امور مالی",
    items: [
      {
        path: "/invoices",
        title: "صورتحساب‌ها",
        icon: "receipt",
        access: "finance",
        planned: true,
      },
      {
        path: "/payments",
        title: "دریافت‌ها",
        icon: "wallet",
        access: "finance",
        planned: true,
      },
      {
        path: "/bank-accounts",
        title: "حساب‌های بانکی",
        icon: "bank",
        access: "finance",
        planned: true,
      },
    ],
  },
  {
    id: "base",
    icon: "music",
    title: "اطلاعات پایه",
    items: [
      ...BASE_RESOURCES.map((resource) => ({
        path: "/base-data/" + resource.key,
        title: resource.title,
        icon: resource.icon,
        access: "education" as const,
      })),
      {
        path: "/subjects",
        title: "واحدهای آموزشی",
        icon: "music",
        access: "education",
        planned: true,
      },
      {
        path: "/institutions",
        title: "آموزشگاه‌های دیگر",
        icon: "building",
        access: "education",
        planned: true,
      },
    ],
  },
  {
    id: "documents",
    icon: "document",
    title: "قوانین و مدارک",
    items: [
      {
        path: "/registration-policies",
        title: "قوانین ثبت‌نام",
        icon: "document",
        access: "education",
        planned: true,
      },
      {
        path: "/certificate-requests",
        title: "درخواست‌های مدرک",
        icon: "certificate",
        access: "education",
        planned: true,
      },
      {
        path: "/certificate-types",
        title: "انواع مدارک",
        icon: "book",
        access: "admin",
        planned: true,
      },
    ],
  },
  {
    id: "reports",
    icon: "chart",
    title: "گزارش‌ها",
    items: [
      {
        path: "/reports/education",
        title: "گزارش‌های آموزشی",
        icon: "chart",
        access: "education",
        planned: true,
      },
      {
        path: "/reports/finance",
        title: "گزارش‌های مالی",
        icon: "chart",
        access: "finance",
        planned: true,
      },
    ],
  },
  {
    id: "management",
    icon: "settings",
    title: "مدیریت",
    items: [
      {
        path: "/users",
        title: "کاربران و نقش‌ها",
        icon: "users",
        access: "admin",
        planned: true,
      },
      {
        path: "/settings",
        title: "تنظیمات آموزشگاه",
        icon: "settings",
        access: "admin",
        planned: true,
      },
      {
        path: "/settings/letterhead",
        title: "مشخصات و سربرگ",
        icon: "document",
        access: "admin",
        planned: true,
      },
      {
        path: "/audit-log",
        title: "سابقه عملیات",
        icon: "clock",
        access: "admin",
        planned: true,
      },
      {
        path: "/account",
        title: "حساب و دسترسی‌ها",
        icon: "settings",
        access: "all",
      },
    ],
  },
];

export function canOpenMenu(user: User | null, access: MenuAccess) {
  return !!user && (access === "all" || user[access]);
}

export const PLANNED_PAGES = MENU_GROUPS.flatMap((group) =>
  group.items
    .filter((item) => item.planned)
    .map((item) => ({ ...item, group: group.title })),
);
