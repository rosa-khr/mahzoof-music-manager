import { test, expect } from "@playwright/test";
import { chooseSelect2 } from "./select2-helper";

test("payment methods persist installments, currencies and required free-tuition notes", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill("e2e-admin");
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
  await page.goto("/base-data/payment-methods");
  await page
    .getByRole("link", { name: "ثبت شیوه پرداخت", exact: true })
    .click();
  const name = "پرداخت سه قسط " + info.project.name;
  await page.getByLabel("عنوان شیوه پرداخت *", { exact: true }).fill(name);
  await chooseSelect2(page, "شیوه تسویه *", "installment");
  await page.getByLabel("تعداد اقساط *", { exact: true }).fill("۱");
  await page.getByRole("button", { name: "ثبت و بازگشت", exact: true }).click();
  await expect(page.getByRole("alert").last()).toContainText("حداقل ۲");
  await page.getByLabel("تعداد اقساط *", { exact: true }).fill("۳");
  await chooseSelect2(page, "نوع پرداخت *", "foreign");
  await page.getByRole("button", { name: "ثبت و بازگشت", exact: true }).click();
  await expect(page).toHaveURL(/\/base-data\/payment-methods(?:\?|$)/);
  const grid = page.locator("app-data-grid");
  await grid.locator(".ag-header [col-id=name] input").fill(name);
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
  if (info.project.name === "desktop") {
    await expect(
      grid.locator(".ag-row [col-id=installment_count]"),
    ).toContainText("۳");
    await expect(
      grid.locator(".ag-row [col-id=payment_currency]"),
    ).toContainText("ارزی");
  }
  await grid
    .getByRole("link", { name: "ویرایش شیوه پرداخت", exact: true })
    .click();
  await expect(page.getByLabel("تعداد اقساط *", { exact: true })).toHaveValue(
    "3",
  );
  await chooseSelect2(page, "شیوه تسویه *", "free");
  await expect(page.locator("#installment-count")).toHaveCount(0);
  await expect(page.locator("#payment-currency")).toHaveCount(0);
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await expect(page.getByRole("alert").last()).toContainText(
    "توضیح بدون شهریه الزامی",
  );
  await page.getByLabel("توضیحات *", { exact: true }).fill("بورسیه آموزشی");
  await page.screenshot({
    path: `test-results/${info.project.name}-payment-method.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await expect(page).toHaveURL(/\/base-data\/payment-methods(?:\?|$)/);
  await expect(grid.locator(".ag-row [col-id=settlement_type]")).toContainText(
    "بدون شهریه",
  );
  await grid
    .getByRole("link", { name: "ویرایش شیوه پرداخت", exact: true })
    .click();
  await expect(page.getByLabel("توضیحات *", { exact: true })).toHaveValue(
    "بورسیه آموزشی",
  );
});
