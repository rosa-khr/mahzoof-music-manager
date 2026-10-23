import { test, expect, Page } from "@playwright/test";
import sharp from "sharp";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("نام کاربری", { exact: true }).fill("e2e-admin");
  await page
    .getByLabel("رمز عبور", { exact: true })
    .fill(process.env["E2E_PASSWORD"]!);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "کارهای امروز", exact: true }),
  ).toBeVisible();
}

test("instructor create, dossier layout, list entry and edit stay connected", async ({
  page,
}, info) => {
  await login(page);
  const session = await (await page.request.get("/api/auth/me")).json();
  const instrumentName = "ساز مدرس " + info.project.name;
  const instrumentResponse = await page.request.post(
    "/api/base-data/instruments",
    {
      headers: {
        Origin: "http://localhost:4310",
        "X-CSRF-Token": session.csrf,
      },
      data: { name: instrumentName },
    },
  );
  expect(instrumentResponse.status()).toBe(201);

  await page.goto("/base-data/instructors/new");
  await expect(
    page.getByRole("heading", { name: "ثبت مدرس", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ثبت و باز کردن پرونده" }).click();
  await expect(page.getByRole("alert")).toContainText("نام، نام خانوادگی");

  const firstName = "مدرس";
  const lastName = "پرونده " + info.project.name;
  await page.getByLabel("نام *", { exact: true }).fill(firstName);
  await page.getByLabel("نام خانوادگی *", { exact: true }).fill(lastName);
  await page.getByLabel("شماره تماس", { exact: true }).fill("+989121234567");
  await page.getByLabel("توضیحات", { exact: true }).fill("توضیحات تخصصی مدرس");
  const instruments = page.locator(
    "#instructor-instruments + .select2-container",
  );
  await instruments.locator(".select2-selection").click();
  await instruments.locator(".select2-search__field").fill(instrumentName);
  await page.getByRole("option", { name: instrumentName, exact: true }).click();
  await expect(instruments.locator(".select2-selection--multiple")).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await expect(instruments.locator(".select2-selection__choice")).toHaveCSS(
    "display",
    "flex",
  );
  await expect(
    instruments.locator(".select2-selection__choice__remove"),
  ).toHaveCSS("border-top-width", "0px");
  await instruments.locator(".select2-selection__choice__remove").click();
  await expect(instruments.locator(".select2-selection__choice")).toHaveCount(
    0,
  );
  await instruments.locator(".select2-search__field").fill(instrumentName);
  await page.getByRole("option", { name: instrumentName, exact: true }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-instructor-multiselect.png`,
    fullPage: true,
    animations: "disabled",
  });
  const photo = await sharp({
    create: {
      width: 320,
      height: 360,
      channels: 3,
      background: "#d9dde3",
    },
  })
    .png()
    .toBuffer();
  await page.locator("#instructor-photo").setInputFiles({
    name: "instructor.png",
    mimeType: "image/png",
    buffer: photo,
  });
  await page.getByRole("button", { name: "ثبت و باز کردن پرونده" }).click();

  await expect(page).toHaveURL(/\/base-data\/instructors\/\d+$/);
  await expect(
    page.getByRole("heading", {
      name: firstName + " " + lastName,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(".instructor-dossier .profile-photo"),
  ).toBeVisible();
  await expect(page.locator(".instructor-dossier")).toContainText(
    instrumentName,
  );
  await page
    .getByRole("button", { name: "اطلاعات تدریس", exact: true })
    .click();
  await expect(page).toHaveURL(/tab=teaching/);
  await expect(
    page.getByText("توضیحات تخصصی مدرس", { exact: true }),
  ).toBeVisible();
  await page.locator(".toast-message button").evaluateAll((buttons) => {
    for (const button of buttons) (button as HTMLButtonElement).click();
  });
  await page.screenshot({
    path: `test-results/${info.project.name}-instructor-profile.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);

  await page
    .getByRole("link", { name: "ویرایش مدرس", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("نام *", { exact: true })).toHaveValue(
    firstName,
  );
  await expect(
    page.locator("#instructor-instruments option:checked"),
  ).toHaveText(instrumentName);
  await page
    .getByLabel("نام خانوادگی *", { exact: true })
    .fill(lastName + " ویرایش");
  await page
    .getByRole("button", { name: "ذخیره تغییرات", exact: true })
    .click();
  await expect(page).toHaveURL(/\/base-data\/instructors\/\d+$/);
  await expect(
    page.getByRole("heading", {
      name: firstName + " " + lastName + " ویرایش",
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "بازگشت به پرونده مدرسین", exact: true })
    .click();
  const grid = page.locator("app-data-grid");
  await grid
    .locator(".ag-header [col-id=name] input")
    .fill(lastName + " ویرایش");
  await expect(grid.locator(".ag-row[row-id]")).toHaveCount(1);
  await expect(
    grid.getByRole("link", { name: "باز کردن پرونده", exact: true }),
  ).toBeVisible();
});
