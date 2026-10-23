import { test, expect, Page } from "@playwright/test";
import { chooseSelect2 } from "./select2-helper";
async function login(page: Page, username = "e2e-admin") {
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill(username);
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
}
async function permission(page: Page, title: string, checked: boolean) {
  const input = page.getByRole("checkbox", {
    name: "دسترسی " + title,
    exact: true,
  });
  if (checked) await input.check();
  else await input.uncheck();
  await expect(input).toBeChecked({ checked });
}
test("user management is independent; policies belong to settings; administrator has all menus", async ({
  page,
}, info) => {
  await login(page);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "باز و بسته کردن منو" }).click();
  const nav = page.getByRole("navigation", { name: "منوی اصلی" });
  await expect(
    nav.getByRole("button", { name: "مدیریت", exact: true }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "گزارش‌ها", exact: true }).click();
  await expect(
    nav.getByRole("link", { name: "مالی", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "گزارش‌های آموزشی", exact: true }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "تنظیمات", exact: true }).click();
  await expect(
    nav.getByRole("link", { name: "قوانین ثبت‌نام", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "کاربران", exact: true }),
  ).toHaveCount(0);
  await expect(nav.locator('a[href="/institutions"]')).toHaveCount(0);
  await nav
    .getByRole("button", { name: "مدیریت امنیت", exact: true })
    .click();
  await expect(
    nav.getByRole("button", { name: "تنظیمات", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "کاربران", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "نقش‌ها", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "نقش‌ها", exact: true }),
  ).toBeVisible();
  const grid = page.locator("app-data-grid");
  await grid.locator(".ag-header [col-id=name] input").fill("مدیر");
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
  await grid
    .getByRole("link", { name: "ویرایش نقش مدیر", exact: true })
    .click();
  await expect(page.locator('.primary-nav a[href="/roles"]')).toHaveClass(
    /selected/,
  );
  await expect(
    page.getByText(
      "نقش مدیر همیشه فعال است و به همه منوها دسترسی دارد؛ دسترسی‌های آن قابل کاهش نیست.",
    ),
  ).toBeVisible();
  const switches = page.getByRole("checkbox");
  await expect(switches.first()).toBeDisabled();
  await expect(switches.first()).toBeChecked();
  const me = await (await page.request.get("/api/auth/me")).json();
  const roles = await (await page.request.get("/api/roles")).json();
  const admin = roles.find((r: any) => r.code === "admin");
  expect(admin.permissions).toEqual(me.user.permissions);
  await page.screenshot({
    path: `test-results/${info.project.name}-admin-role.png`,
    fullPage: true,
  });
});
test("custom role permissions persist, can be assigned, and guard menus, routes and APIs", async ({
  page,
  browser,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/roles");
  await page.getByRole("link", { name: "ثبت نقش", exact: true }).click();
  const name = "نقش ساز " + info.project.name;
  await page.getByLabel("نام نقش *", { exact: true }).fill(name);
  await permission(page, "سازها", true);
  await permission(page, "کارهای امروز", true);
  await page.getByRole("button", { name: "ثبت نقش", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "نقش‌ها", exact: true }),
  ).toBeVisible();
  const roles = await (await page.request.get("/api/roles")).json();
  const role = roles.find((r: any) => r.name === name);
  expect(role.permissions).toEqual(["/", "/base-data/instruments"]);
  await page.locator(".ag-header [col-id=name] input").fill(name);
  await page
    .getByRole("link", { name: "ویرایش نقش " + name, exact: true })
    .click();
  await expect(page.getByLabel("نام نقش *", { exact: true })).toHaveValue(name);
  await permission(page, "سازها", true);
  await page.screenshot({
    path: `test-results/${info.project.name}-custom-role.png`,
    fullPage: true,
  });
  await page.goto("/users/new");
  const username = "custom-member-" + info.project.name;
  await page.getByLabel("نام کاربری *", { exact: true }).fill(username);
  await page
    .getByLabel("رمز اولیه (حداقل ۸ نویسه) *", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await chooseSelect2(page, "نقش *", role.code);
  await page.getByRole("button", { name: "ایجاد کاربر", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "مدیریت کاربران", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
    viewport: page.viewportSize()!,
    serviceWorkers: "block",
  });
  try {
    const limited = await context.newPage();
    await login(limited, username);
    expect(
      (await (await limited.request.get("/api/today")).json()).activeStudents,
    ).toBeUndefined();
    await expect(limited.locator(".primary-nav a")).toHaveCount(2);
    for (const path of [
      "/roles",
      "/users",
      "/students",
      "/base-data/instructors",
    ]) {
      await limited.goto(path);
      await expect(limited).toHaveURL("http://localhost:4310/");
    }
    expect((await limited.request.get("/api/roles")).status()).toBe(403);
    expect((await limited.request.get("/api/students")).status()).toBe(403);
    await limited.goto("/base-data/instruments");
    await expect(
      limited.getByRole("heading", { name: "سازها", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
});

test("grouped permission checkboxes edit and persist; role status is explicit and list omits menu counts", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/roles/new");
  const name = "نقش چک‌باکس " + info.project.name;
  await page.getByLabel("نام نقش *", { exact: true }).fill(name);
  const base = page.getByRole("checkbox", {
    name: "همه منوهای اطلاعات پایه",
    exact: true,
  });
  await base.check();
  await expect(
    page.getByRole("checkbox", { name: "دسترسی سازها", exact: true }),
  ).toBeChecked();
  await permission(page, "سازها", false);
  await expect(base).toHaveJSProperty("indeterminate", true);
  await permission(page, "کارهای امروز", true);
  await page.getByRole("button", { name: "ثبت نقش", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "نقش‌ها", exact: true }),
  ).toBeVisible();
  await expect(page.locator('.ag-header [col-id="permissions"]')).toHaveCount(
    0,
  );
  await page.locator(".ag-header [col-id=name] input").fill(name);
  await page
    .getByRole("link", { name: "ویرایش نقش " + name, exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "دسترسی سازها", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "دسترسی مدرسین", exact: true }),
  ).toBeChecked();
  await permission(page, "سازها", true);
  await expect(base).toBeChecked();
  await base.uncheck();
  await expect(
    page.getByRole("checkbox", { name: "دسترسی سازها", exact: true }),
  ).not.toBeChecked();
  await permission(page, "سازها", true);
  await page.screenshot({
    path: `test-results/${info.project.name}-role-checkboxes.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  await page
    .getByRole("switch", { name: "فعال بودن نقش", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await page
    .locator(".swal2-popup")
    .getByRole("button", { name: "بله، ذخیره شود", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "نقش‌ها", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.locator(".ag-header [col-id=name] input").fill(name);
  await page
    .getByRole("link", { name: "ویرایش نقش " + name, exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "فعال بودن نقش", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "دسترسی سازها", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "دسترسی مدرسین", exact: true }),
  ).not.toBeChecked();
  const roles = await (await page.request.get("/api/roles")).json();
  const role = roles.find((r: any) => r.name === name);
  expect(role.active).toBe(0);
  expect(role.permissions).toEqual(["/", "/base-data/instruments"]);
});
