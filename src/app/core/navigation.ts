import { User } from "./models";
import { BASE_RESOURCES } from "./base-data";

export type MenuAccess = "all" | "education" | "finance" | "admin";
export interface MenuItem {
  path: string;
  title: string;
  icon: string;
  access: MenuAccess;
  planned?: boolean;
  section?: string;
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
    items: [{ path: "/", title: "کارهای امروز", icon: "grid", access: "all" }],
  },
  {
    id: "people",
    icon: "users",
    title: "افراد",
    items: [
      {
        path: "/students",
        title: "پرونده هنرجویان",
        icon: "users",
        access: "all",
      },
      {
        path: "/base-data/instructors",
        title: "مدرسین",
        icon: "users",
        access: "education",
      },
    ],
  },
  {
    id: "base",
    icon: "music",
    title: "اطلاعات پایه",
    items: [
      {
        path: "/subjects",
        title: "آموزشگاه‌ها",
        icon: "building",
        access: "education",
      },
      ...BASE_RESOURCES.filter(
        (resource) => resource.key !== "instructors",
      ).map((resource) => ({
        path: "/base-data/" + resource.key,
        title: resource.title,
        icon: resource.icon,
        access:
          resource.key === "payment-methods"
            ? ("finance" as const)
            : ("education" as const),
      })),
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
    id: "documents",
    icon: "document",
    title: "مدارک",
    items: [
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
        path: "/reports/finance",
        title: "مالی",
        icon: "chart",
        access: "finance",
        planned: true,
      },
    ],
  },
  {
    id: "user-management",
    icon: "lock",
    title: "مدیریت امنیت",
    items: [
      {
        path: "/users",
        title: "کاربران",
        icon: "users",
        access: "admin",
      },
      {
        path: "/roles",
        title: "نقش‌ها",
        icon: "lock",
        access: "admin",
      },
    ],
  },
  {
    id: "management",
    icon: "settings",
    title: "تنظیمات",
    items: [
      {
        path: "/registration-policies",
        title: "قوانین ثبت‌نام",
        icon: "document",
        access: "education",
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
      },
      {
        path: "/audit-log",
        title: "سابقه عملیات",
        icon: "clock",
        access: "admin",
        planned: true,
      },
    ],
  },
];

export function canOpenMenu(
  user: User | null,
  access: MenuAccess,
  path?: string,
) {
  if (!user) return false;
  if (user.permissions && path !== undefined)
    return (
      user.admin ||
      (user.permissions.includes(path) &&
        !(path === "/students" && access === "education" && !user.education))
    );
  return access === "all" || user[access];
}

export const PLANNED_PAGES = MENU_GROUPS.flatMap((group) =>
  group.items
    .filter((item) => item.planned)
    .map((item) => ({ ...item, group: group.title })),
);
