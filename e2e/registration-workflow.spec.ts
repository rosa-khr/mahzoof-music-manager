import { test, expect } from "@playwright/test";
import { chooseSelect2 } from "./select2-helper";
import { weeklyTermEnd, toIso } from "../src/app/shared/jalali-date";

test("weekly term end handles Jalali month/year/leap boundaries", () => {
  expect(weeklyTermEnd("۱۴۰۵/۰۷/۳۰", "۴")).toBe("1405/08/21");
  expect(weeklyTermEnd("1403/12/25", 2)).toBe("1404/01/02");
  expect(weeklyTermEnd("1404/12/25", 2)).toBe("1405/01/03");
  expect(weeklyTermEnd("1405/07/30", 1)).toBe("1405/07/30");
  expect(weeklyTermEnd("1405/07/30", 0)).toBe("");
  expect(() => toIso("1404/12/30")).toThrow();
});

test("registration, guided term, reasoned attendance, partial receipt and renewal", async ({
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
  const session = await (await page.request.get("/api/auth/me")).json();
  const headers = {
    Origin: "http://localhost:4310",
    "X-CSRF-Token": session.csrf,
  };
  const add = async (path: string, data: unknown) => {
    const response = await page.request.post("/api" + path, { headers, data });
    expect(response.status()).toBe(201);
    return response.json();
  };
  const suffix = info.project.name;
  const instrument = await add("/base-data/instruments", {
    name: "ساز گردش " + suffix,
  });
  const instructor = await add("/base-data/instructors", {
    firstName: "مدرس",
    lastName: "گردش " + suffix,
    instrumentIds: [instrument.id],
  });
  const teaching = await add("/base-data/teaching-types", {
    name: "نوع گردش " + suffix,
  });
  const onlineDelivery = await add("/base-data/teaching-types", {
    name: "آنلاین گردش " + suffix,
    requiresAcademy: false,
  });
  const academy = await add("/subject-catalog", {
    name: "آموزشگاه گردش " + suffix,
  });
  const method = await add("/base-data/payment-methods", {
    name: "دو قسط گردش " + suffix,
    settlementType: "installment",
    installmentCount: 2,
    paymentCurrency: "rial",
  });
  await page.goto("/students/new");
  await page.getByLabel("نام فارسی *", { exact: true }).fill("هنرجو");
  await page
    .getByLabel("نام خانوادگی فارسی *", { exact: true })
    .fill("گردش " + suffix);
  await page.getByLabel("تماس هنرجو", { exact: true }).fill("۰۹۱۲۸۴۵۲۹۲۰");
  await page
    .getByRole("tab", { name: "اطلاعات ساز و جلسه", exact: true })
    .click();
  await chooseSelect2(page, "ساز *", String(instrument.id));
  await expect(
    page.locator('#education-instructor option[value="' + instructor.id + '"]'),
  ).toHaveCount(1);
  await chooseSelect2(page, "مدرس *", String(instructor.id));
  await chooseSelect2(page, "شیوه برگزاری *", String(teaching.id));
  await expect(page.locator("#education-mode")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "شیوه برگزاری *", exact: true }),
  ).toHaveCount(1);
  await chooseSelect2(page, "شیوه برگزاری *", String(onlineDelivery.id));
  await expect(page.locator("#education-academy")).toHaveCount(0);
  await chooseSelect2(page, "شیوه برگزاری *", String(teaching.id));
  await expect(page.locator("#education-academy")).toHaveCount(1);
  await chooseSelect2(page, "آموزشگاه *", String(academy.id));
  await chooseSelect2(page, "شیوه پرداخت *", String(method.id));
  await page.getByRole("tab", { name: "اطلاعات فردی", exact: true }).click();
  await expect(
    page.getByLabel("نام خانوادگی فارسی *", { exact: true }),
  ).toHaveValue("گردش " + suffix);
  await page
    .getByRole("button", { name: "ثبت و باز کردن پرونده", exact: true })
    .click();
  await expect(page).toHaveURL(/\/students\/\d+$/);
  const studentId = Number(new URL(page.url()).pathname.split("/").pop());
  const read = async () =>
    (await page.request.get("/api/students/" + studentId)).json();
  await page
    .getByRole("button", { name: "ترم جدید", exact: true })
    .first()
    .click();
  const termForm = page.locator("app-term-form");
  await expect(
    page.getByRole("combobox", { name: "مدرس *", exact: true }),
  ).toContainText(instructor.name);
  await termForm.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.getByLabel("تعداد جلسات *", { exact: true }).fill("۲");
  await page
    .getByRole("button", { name: "انتخاب شروع شمسی", exact: true })
    .click();
  const calendar = page.getByRole("dialog", {
    name: "تقویم شمسی",
    exact: true,
  });
  await expect(calendar).toBeVisible();
  await calendar.locator(".calendar-title").click();
  await calendar.getByLabel("سال شمسی", { exact: true }).fill("۱۴۰۵");
  await calendar.getByRole("button", { name: "مهر", exact: true }).click();
  await calendar
    .getByRole("gridcell", { name: "۱ مهر ۱۴۰۵", exact: true })
    .click();
  await expect(page.locator("#start")).toHaveValue("1405/07/01");
  await expect(page.locator("#end")).toHaveValue("1405/07/08");
  await page.locator("#start").press("Alt+ArrowDown");
  await calendar
    .getByRole("gridcell", { name: "۱ مهر ۱۴۰۵", exact: true })
    .press("ArrowLeft");
  await expect(
    calendar.getByRole("gridcell", { name: "۲ مهر ۱۴۰۵", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#start")).toHaveValue("1405/07/02");
  await expect(page.locator("#end")).toHaveValue("1405/07/09");
  await page.locator("#end").fill("۱۴۰۵/۰۷/۲۵");
  await page.getByLabel("تعداد جلسات *", { exact: true }).fill("۳");
  await expect(page.locator("#end")).toHaveValue("۱۴۰۵/۰۷/۲۵");
  await page.getByRole("button", { name: /استفاده از پایان پیشنهادی/ }).click();
  await expect(page.locator("#end")).toHaveValue("1405/07/16");
  await page.getByLabel("تعداد جلسات *", { exact: true }).fill("۱");
  await expect(page.locator("#end")).toHaveValue("1405/07/02");
  await page.getByLabel("تعداد جلسات *", { exact: true }).fill("۲");
  await page
    .getByRole("button", { name: "انتخاب پایان شمسی", exact: true })
    .click();
  const bounds = await calendar.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.screenshot({
    path: "test-results/" + suffix + "-jalali-calendar.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(calendar).toHaveCount(0);
  await termForm.getByRole("button", { name: "ادامه", exact: true }).click();
  await page.getByLabel("شهریه پایه *", { exact: true }).fill("۱۰۰");
  await page
    .getByRole("button", { name: "تقسیم مساوی مبلغ", exact: true })
    .click();
  await page
    .getByLabel("سررسید شمسی قسط 1 *", { exact: true })
    .fill("۱۴۰۵/۰۷/۰۱");
  await page
    .getByLabel("سررسید شمسی قسط 2 *", { exact: true })
    .fill("۱۴۰۵/۰۹/۰۱");
  await termForm.getByRole("button", { name: "ادامه", exact: true }).click();
  await expect(termForm).toContainText("دریافت پول جداگانه");
  await page
    .getByRole("button", { name: "تأیید و ثبت ترم", exact: true })
    .click();
  await expect(termForm).toHaveCount(0);
  let data = await read();
  expect(data.terms[0].invoice.installments).toHaveLength(2);
  expect(data.terms[0].start_date).toBe("2026-09-24");
  expect(data.terms[0].end_date).toBe("2026-10-01");
  expect(data.payments).toHaveLength(0);
  const original = data.terms[0].id;
  await page
    .getByRole("button", { name: "رزرو جلسه", exact: true })
    .first()
    .click();
  await page
    .getByLabel("تاریخ شمسی جلسه *", { exact: true })
    .fill("۱۴۰۵/۰۷/۰۱");
  await page.getByLabel("ساعت تهران *", { exact: true }).fill("10:00");
  await chooseSelect2(page, "از طرف چه کسی؟ *", "student");
  await chooseSelect2(page, "وضعیت دلیل *", "yes");
  await page
    .getByLabel("توضیح علت *", { exact: true })
    .fill("هماهنگی زمان هنرجو");
  await page.getByRole("button", { name: "ثبت رزرو", exact: true }).click();
  await expect(page.locator("app-session-form")).toHaveCount(0);
  data = await read();
  expect(data.terms[0].counters.reserved).toBe(1);
  expect(data.terms[0].counters.consumed).toBe(0);
  const attendance = data.terms[0].sessions[0];
  await page
    .getByRole("radio", {
      name: "کنسل جلسه " + attendance.session_id,
      exact: true,
    })
    .click();
  await chooseSelect2(page, "از طرف چه کسی؟ *", "teacher");
  await chooseSelect2(page, "وضعیت دلیل *", "yes");
  await page
    .getByLabel("توضیح علت *", { exact: true })
    .fill("عدم امکان برگزاری از طرف مدرس");
  await page.getByRole("button", { name: "تأیید وضعیت", exact: true }).click();
  await expect(page.locator("app-attendance-form")).toHaveCount(0);
  data = await read();
  expect(data.terms[0].sessions[0].requested_by).toBe("teacher");
  expect(data.terms[0].counters.consumed).toBe(0);
  await page
    .getByRole("button", { name: "ثبت پرداخت", exact: true })
    .first()
    .click();
  await chooseSelect2(page, "ترم و صورتحساب مقصد *", { index: 1 });
  await expect(
    page.getByLabel("مبلغ دریافت در ارز ترم *", { exact: true }),
  ).toHaveValue("50");
  await page.getByLabel("مبلغ دریافت در ارز ترم *", { exact: true }).fill("۲۰");
  await page
    .getByRole("button", { name: "تأیید و ثبت دریافت", exact: true })
    .click();
  await expect(page.locator("app-payment-form")).toHaveCount(0);
  data = await read();
  expect(data.terms[0].invoice.balance_minor).toBe(80);
  expect(data.terms[0].invoice.installments[0].balance_minor).toBe(30);
  await page
    .getByRole("button", { name: "تمدید با مشخصات همین ترم", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "ساز *", exact: true }),
  ).toContainText(instrument.name);
  await termForm.getByRole("button", { name: "ادامه", exact: true }).click();
  await termForm.getByRole("button", { name: "ادامه", exact: true }).click();
  await page
    .getByRole("button", { name: "تقسیم مساوی مبلغ", exact: true })
    .click();
  await page
    .getByLabel("سررسید شمسی قسط 1 *", { exact: true })
    .fill("۱۴۰۵/۰۹/۰۱");
  await page
    .getByLabel("سررسید شمسی قسط 2 *", { exact: true })
    .fill("۱۴۰۵/۱۰/۰۱");
  await termForm.getByRole("button", { name: "ادامه", exact: true }).click();
  await page
    .getByRole("button", { name: "تأیید و ثبت ترم", exact: true })
    .click();
  await expect(termForm).toHaveCount(0);
  data = await read();
  expect(data.terms[0].number).toBe(2);
  expect(data.terms[0].sessions).toHaveLength(0);
  expect(
    data.terms.find((t: any) => t.id === original).invoice.balance_minor,
  ).toBe(80);
  expect(data.payments).toHaveLength(1);
  await page.getByRole("button", { name: "مالی", exact: true }).click();
  await expect(
    page.locator("app-data-grid").filter({ hasText: "اقساط و تعهدات" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/" + suffix + "-registration-finance.png",
    fullPage: true,
  });
});
