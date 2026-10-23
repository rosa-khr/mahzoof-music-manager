import { chooseSelect2, nativeSelect } from "./select2-helper";
import { test, expect } from "@playwright/test";
import sharp from "sharp";

test("separate student editor, photo persistence, edit and removal", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("Content Security Policy"))
      errors.push(m.text());
  });
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill("e2e-admin");
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
  await page.goto("/students");
  await expect(page.locator(".student-editor")).toHaveCount(0);
  await page.getByRole("link", { name: "ثبت هنرجو", exact: true }).click();
  await expect(page).toHaveURL(/\/students\/new$/);
  await page.getByLabel("نام فارسی *", { exact: true }).fill("نگار");
  await page
    .getByLabel("نام خانوادگی فارسی *", { exact: true })
    .fill("تصویر " + info.project.name);
  await page.getByLabel("تماس هنرجو", { exact: true }).fill("+989121234567");
  await chooseSelect2(page, "واحد آموزشی موردنظر *", "1");
  await page.locator("#student-photo").setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.getByRole("alert")).toContainText("JPG");
  const buffer = await sharp({
    create: { width: 320, height: 360, channels: 3, background: "#d9dde3" },
  })
    .png()
    .toBuffer();
  await page
    .locator("#student-photo")
    .setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer });
  await expect(page.getByAltText("عکس هنرجو")).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-student-create-photo.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "ثبت و باز کردن پرونده" }).click();
  await expect(
    page.getByRole("heading", {
      name: "نگار تصویر " + info.project.name,
      exact: true,
    }),
  ).toBeVisible();
  const profile = page.url();
  await expect(page.locator(".profile-photo")).toBeVisible();
  await page.getByRole("link", { name: "ویرایش هنرجو", exact: true }).click();
  await expect(page).toHaveURL(/\/students\/\d+\/edit$/);
  await expect(page.getByLabel("نام فارسی *", { exact: true })).toHaveValue(
    "نگار",
  );
  await expect(page.getByAltText("عکس هنرجو")).toBeVisible();
  await page.getByLabel("نام فارسی *", { exact: true }).fill("نگار ویرایش");
  await page.screenshot({
    path: `test-results/${info.project.name}-student-edit.png`,
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
  await expect(page).toHaveURL(profile);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "نگار ویرایش تصویر " + info.project.name,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".profile-photo")).toBeVisible();
  await page.getByRole("link", { name: "ویرایش هنرجو", exact: true }).click();
  await page.getByRole("button", { name: "حذف عکس", exact: true }).click();
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await expect(page).toHaveURL(profile);
  await page.reload();
  await expect(page.locator(".profile-photo")).toHaveCount(0);
  await expect(
    page.locator(".dossier-avatar.student-avatar-placeholder"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
