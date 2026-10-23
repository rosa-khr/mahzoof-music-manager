import { test, expect, Page } from "@playwright/test";

async function login(page: Page, role = "admin") {
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill("e2e-" + role);
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
}

test("educational units use AG Grid and persist optional contact fields", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/subjects");
  await expect(
    page.getByRole("heading", { name: "آموزشگاه‌ها", exact: true }),
  ).toBeVisible();
  await expect(page.locator("app-data-grid")).toBeVisible();
  await page
    .getByRole("link", { name: "ثبت واحد آموزشی", exact: true })
    .click();
  await page.getByRole("button", { name: "ثبت و بازگشت", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("نام واحد الزامی");
  const name = "واحد آزمون " + info.project.name;
  await page.getByLabel("نام واحد آموزشی *", { exact: true }).fill(name);
  await page.getByRole("button", { name: "ثبت و بازگشت", exact: true }).click();
  await expect(page).toHaveURL(/\/subjects(?:\?|$)/);

  const grid = page.locator("app-data-grid");
  await grid.locator(".ag-header [col-id=name] input").fill(name);
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
  await expect(
    grid.getByRole("button", { name: "حذف آموزشگاه", exact: true }),
  ).toBeVisible();
  await grid
    .getByRole("link", { name: "ویرایش واحد آموزشی", exact: true })
    .click();
  await expect(page.getByLabel("آدرس", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("شماره تلفن", { exact: true })).toHaveValue("");
  await page.getByLabel("آدرس", { exact: true }).fill("تهران، خیابان موسیقی");
  await page.getByLabel("شماره تلفن", { exact: true }).fill("+982112345678");
  await page.getByLabel("وب‌سایت", { exact: true }).fill("https://example.com");
  await page
    .getByLabel("آدرس شبکه اجتماعی", { exact: true })
    .fill("https://instagram.com/example");
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await expect(page).toHaveURL(/\/subjects(?:\?|$)/);
  await grid
    .getByRole("link", { name: "ویرایش واحد آموزشی", exact: true })
    .click();
  await expect(page.getByLabel("آدرس", { exact: true })).toHaveValue(
    "تهران، خیابان موسیقی",
  );
  await expect(page.getByLabel("وب‌سایت", { exact: true })).toHaveValue(
    "https://example.com",
  );
  await expect(page.getByLabel("شماره تلفن", { exact: true })).toHaveValue(
    "+982112345678",
  );
  await expect(
    page.getByLabel("آدرس شبکه اجتماعی", { exact: true }),
  ).toHaveValue("https://instagram.com/example");
  await page.screenshot({
    path: `test-results/${info.project.name}-subject-form.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);

  await page.goto("/subjects");
  await grid.locator(".ag-header [col-id=name] input").fill(name);
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
  await grid.getByRole("button", { name: "حذف آموزشگاه", exact: true }).click();
  await page.getByRole("button", { name: "انصراف", exact: true }).click();
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
  await grid.getByRole("button", { name: "حذف آموزشگاه", exact: true }).click();
  await page.getByRole("button", { name: "بله، حذف شود", exact: true }).click();
  await expect(page.getByText("آموزشگاه با موفقیت حذف شد")).toBeVisible();
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(0);
});

test("accountant cannot access educational unit management", async ({
  page,
}) => {
  await login(page, "accountant");
  await page.goto("/subjects");
  await expect(page).toHaveURL("http://localhost:4310/");
  await page.goto("/subjects/new");
  await expect(page).toHaveURL("http://localhost:4310/");
});
