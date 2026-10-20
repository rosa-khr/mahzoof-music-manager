import { test, expect, Page } from "@playwright/test";
import {
  PLANNED_PAGES,
  MENU_GROUPS,
  canOpenMenu,
} from "../src/app/core/navigation";
import { User } from "../src/app/core/models";

async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill(`e2e-${role}`);
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
}

test("all brief menu destinations, active state, mobile scrolling and reload", async ({
  page,
}, info) => {
  await login(page, "admin");
  const mobile = info.project.name === "mobile";
  for (const item of PLANNED_PAGES) {
    if (mobile)
      await page.getByRole("button", { name: "باز و بسته کردن منو" }).click();
    const section = page.getByRole("button", { name: item.group, exact: true });
    if ((await section.getAttribute("aria-expanded")) !== "true")
      await section.click();
    const link = page
      .getByRole("navigation", { name: "منوی اصلی" })
      .getByRole("link", { name: item.title, exact: true });
    await link.click();
    await expect(
      page.getByRole("heading", { name: item.title, exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator(".planned-page")).toContainText(
      "در انتظار پیاده‌سازی",
    );
    await expect(page.locator(".primary-nav a.selected")).toHaveCount(1);
    await expect(page.locator(".primary-nav a.selected")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "سابقه عملیات", exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  if (mobile)
    await page.getByRole("button", { name: "باز و بسته کردن منو" }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-menus.png`,
    fullPage: false,
    animations: "disabled",
  });
});

test("compact accordion menus toggle with keyboard, follow routes and expand from icon rail", async ({
  page,
}, info) => {
  await login(page, "admin");
  const mobile = info.project.name === "mobile";
  if (mobile)
    await page.getByRole("button", { name: "باز و بسته کردن منو" }).click();
  const nav = page.getByRole("navigation", { name: "منوی اصلی" });
  await expect(
    nav.locator('.nav-group-toggle[aria-expanded="true"]'),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "پرونده هنرجویان", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("button", { name: "آموزش", exact: true }),
  ).toHaveCount(0);
  for (const title of [
    "کلاس‌ها و گروه‌ها",
    "ترم‌ها و تمدید",
    "جلسات و حضور و غیاب",
  ])
    await expect(
      nav.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
  const base = nav.getByRole("button", { name: "اطلاعات پایه", exact: true });
  const finance = nav.getByRole("button", { name: "امور مالی", exact: true });
  await base.focus();
  await base.press("Enter");
  await expect(base).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "سازها", exact: true }),
  ).toBeVisible();
  await finance.click();
  await expect(base).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.locator('.nav-group-toggle[aria-expanded="true"]'),
  ).toHaveCount(1);
  await finance.press("Space");
  await expect(finance).toHaveAttribute("aria-expanded", "false");
  await base.click();
  await nav.getByRole("link", { name: "سازها", exact: true }).click();
  await expect(page).toHaveURL(/\/base-data\/instruments(?:\?|$)/);
  await expect(
    page.getByRole("heading", { name: "سازها", exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  if (mobile)
    await page.getByRole("button", { name: "باز و بسته کردن منو" }).click();
  await expect(base).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "سازها", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  if (!mobile) {
    await page.getByRole("button", { name: "جمع کردن سایدبار" }).click();
    await expect(base).toHaveAttribute("aria-expanded", "false");
    await finance.click();
    await expect(page.locator(".app-layout")).not.toHaveClass(
      /sidebar-collapsed/,
    );
    await expect(finance).toHaveAttribute("aria-expanded", "true");
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-accordion-menu.png`,
    fullPage: false,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
});

for (const role of ["secretary", "accountant"]) {
  test(`${role} sees permitted menus and cannot open restricted destinations`, async ({
    page,
  }) => {
    await login(page, role);
    const user = {
      education: role === "secretary",
      finance: role === "accountant",
      admin: false,
    } as User;
    const visible = MENU_GROUPS.flatMap((g) => g.items).filter((item) =>
      canOpenMenu(user, item.access),
    );
    await expect(page.locator(".primary-nav a")).toHaveCount(visible.length);
    for (const item of PLANNED_PAGES.filter(
      (item) => !canOpenMenu(user, item.access),
    )) {
      await page.goto(item.path);
      await expect(page).toHaveURL("http://localhost:4310/");
      await expect(page.locator(".planned-page")).toHaveCount(0);
    }
    if (role === "accountant") {
      for (const path of ["/students/new", "/students/1/edit"]) {
        await page.goto(path);
        await expect(page).toHaveURL("http://localhost:4310/");
        await expect(page.locator(".student-editor")).toHaveCount(0);
      }
    }
  });
}

test("new pages require sign-in on direct navigation", async ({ page }) => {
  for (const path of [
    "/settings/letterhead",
    "/students/new",
    "/students/1/edit",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator(".planned-page,.student-editor")).toHaveCount(0);
  }
});

test("legacy education URLs lead to student management", async ({ page }) => {
  await login(page, "admin");
  for (const path of ["/classes", "/terms", "/sessions"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/students(?:\?|$)/);
    await expect(
      page.getByRole("heading", { name: "پرونده هنرجویان", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".planned-page")).toHaveCount(0);
  }
});
