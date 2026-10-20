import { test, expect } from "@playwright/test";
import { chooseSelect2 } from "./select2-helper";

test("student tabs preserve personal drafts and support per-session attendance and tuition", async ({
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
  const me = await (await page.request.get("/api/auth/me")).json();
  const headers = { Origin: "http://localhost:4310", "X-CSRF-Token": me.csrf };
  const post = async (path: string, data: unknown) => {
    const r = await page.request.post("/api" + path, {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data,
    });
    expect(r.status(), await r.text()).toBe(201);
    return r.json();
  };
  const s = await post("/students", {
    firstName: "آوا",
    lastName: "تب " + info.project.name,
    phone: "+989121234567",
    subjectId: 1,
    age: 22,
    address: "تهران، خیابان هنر، پلاک ۱۲",
  });
  const t = await post(`/students/${s.id}/terms`, {
    subjectId: 1,
    quota: 4,
    amount: "8000000",
    currency: "TOMAN",
    registeredOn: "2026-10-19",
    location: "آموزشگاه",
  });
  const reserved = await post(`/terms/${t.id}/sessions`, {
    startsAt: "2026-01-01T10:00:00Z",
    timezone: "Asia/Tehran",
  });
  const sid = reserved.sessions[0].session_id;
  await page.goto(`/students/${s.id}/edit`);
  await expect(page.getByLabel("سن (سال)", { exact: true })).toHaveValue("22");
  await expect(page.getByLabel("آدرس", { exact: true })).toHaveValue(
    "تهران، خیابان هنر، پلاک ۱۲",
  );
  await page.getByLabel("نام فارسی *", { exact: true }).fill("آوا ویرایش");
  await page
    .getByRole("tab", { name: "اطلاعات ساز و جلسه", exact: true })
    .click();
  await expect(page.locator(".term-card")).toHaveCount(1);
  await page.getByRole("tab", { name: "حضور و غیاب", exact: true }).click();
  await expect(
    page.locator('app-data-grid[title="جلسات و حضور و غیاب"]'),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "حاضر جلسه " + sid, exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "حاضر جلسه " + sid, exact: true }),
  ).toBeChecked();
  await page
    .getByRole("radio", { name: "غایب جلسه " + sid, exact: true })
    .click();
  await expect(page.locator(".action-panel")).toBeVisible();
  await chooseSelect2(page, "وضعیت جلسه", "absent");
  await page
    .getByRole("button", { name: "تأیید بدون کسر سهم", exact: true })
    .click();
  await page
    .getByLabel("دلیل (برای غیبت و کنسلی الزامی)", { exact: true })
    .fill("غیبت با هماهنگی");
  await page.getByRole("button", { name: "تأیید وضعیت", exact: true }).click();
  await expect(page.locator(".action-panel")).toHaveCount(0);
  await expect(
    page.getByRole("radio", { name: "غایب جلسه " + sid, exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: `test-results/${info.project.name}-student-tab-attendance.png`,
    fullPage: true,
  });
  await page.getByRole("tab", { name: "مالی", exact: true }).click();
  await expect(
    page.locator('app-data-grid[title="صورتحساب‌ها"] .ag-row[row-id]'),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "اطلاعات فردی", exact: true }).click();
  await expect(page.getByLabel("نام فارسی *", { exact: true })).toHaveValue(
    "آوا ویرایش",
  );
  await page.getByLabel("سن (سال)", { exact: true }).fill("23");
  await page.screenshot({
    path: `test-results/${info.project.name}-student-tab-personal.png`,
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
  await expect(page).toHaveURL(new RegExp(`/students/${s.id}$`));
  const saved = await (await page.request.get(`/api/students/${s.id}`)).json();
  expect(saved.age).toBe(23);
  expect(saved.first_name).toBe("آوا ویرایش");
  expect(saved.address).toBe("تهران، خیابان هنر، پلاک ۱۲");
  expect(saved.terms[0].counters.consumed).toBe(0);
});
