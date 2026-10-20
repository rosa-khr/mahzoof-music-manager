import { test, expect } from "@playwright/test";
import { chooseSelect2, nativeSelect } from "./select2-helper";

test("Select2 RTL search, Persian normalization, keyboard, validation and cleanup", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill("e2e-admin");
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
  await page.goto("/students/new");
  const label = "واحد آموزشی موردنظر *";
  const combo = page.getByRole("combobox", { name: label, exact: true });
  await expect(page.locator("select.select2-hidden-accessible")).toHaveCount(2);
  await page
    .getByRole("tab", { name: "اطلاعات ساز و جلسه", exact: true })
    .click();
  await combo.click();
  const search = page.getByRole("searchbox", {
    name: "جست‌وجو در " + label,
    exact: true,
  });
  await search.fill("چنین گزینه‌ای نداریم");
  await expect(page.locator(".select2-results__message")).toHaveText(
    "موردی پیدا نشد",
  );
  await search.fill("پيانو");
  await expect(
    page.getByRole("option", { name: "پیانو", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-select2-search.png`,
    fullPage: true,
  });
  const box = await page.locator(".select2-dropdown").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
  await search.press("Enter");
  await expect(combo).toContainText("پیانو");
  await expect(nativeSelect(page, label)).toHaveValue("1");
  await page.getByRole("tab", { name: "اطلاعات فردی", exact: true }).click();
  const history = page.getByRole("combobox", {
    name: "سابقه ثبت‌نام",
    exact: true,
  });
  await history.focus();
  await history.press("Alt+ArrowDown");
  const historySearch = page.getByRole("searchbox", {
    name: "جست‌وجو در سابقه ثبت‌نام",
    exact: true,
  });
  await historySearch.fill("سابقه قبلی");
  await historySearch.press("Enter");
  await expect(nativeSelect(page, "سابقه ثبت‌نام")).toHaveValue("old");
  await page
    .getByRole("switch", { name: "فعال بودن هنرجو", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "ثبت و باز کردن پرونده" }).click();
  await expect(page.locator(".student-editor")).toContainText(
    "فیلدهای الزامی را تکمیل کنید.",
  );
  await page
    .getByRole("tab", { name: "اطلاعات ساز و جلسه", exact: true })
    .click();
  await expect(combo).toContainText("پیانو");
  await combo.click();
  await search.press("Escape");
  await expect(combo).toHaveAttribute("aria-expanded", "false");
  await combo.click();
  await page.goto("/students");
  await expect(page.locator(".select2-dropdown")).toHaveCount(0);
  expect(errors).toEqual([]);
});
