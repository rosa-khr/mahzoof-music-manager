import { assert, choice, integer, money, latinDigits } from "./validation.mjs";

export function calculateTuition(body, defaultRates = {}) {
  const currency = choice(body.currency, ["TOMAN", "USD"], "ارز");
  const supplied =
    body.baseRate == null || body.baseRate === ""
      ? null
      : money(body.baseRate, currency);
  const rate =
    supplied ??
    (currency === "USD"
      ? defaultRates.rate_usd_cents_30
      : defaultRates.rate_toman_30);
  assert(rate != null, "برای این ساز در ارز انتخابی تعرفه ثبت نشده است");
  const duration = integer(
    body.durationMinutes ?? 30,
    "مدت جلسه",
    1,
    1440,
  );
  const quota = integer(body.quota ?? 4, "تعداد جلسات", 1, 1000);
  const numerator = BigInt(rate) * BigInt(duration) * BigInt(quota);
  const round = (n, d) => Number((n + d / 2n) / d);
  const gross = round(numerator, 30n);
  assert(Number.isSafeInteger(gross) && gross <= 1000000000000, "مبلغ شهریه خارج از محدوده است");
  const discountType = choice(
    body.discountType || "none",
    ["none", "percent", "fixed"],
    "نوع تخفیف",
  );
  let discountValue = 0;
  let discount = 0;
  if (discountType === "percent") {
    const input = latinDigits(String(body.discountPercent ?? '0'));
    assert(/^\d+(\.\d{1,2})?$/.test(input), 'درصد تخفیف نامعتبر است');
    discountValue = Number(input);
    assert(discountValue >= 0 && discountValue <= 100, 'درصد تخفیف باید بین صفر و صد باشد');
    const basisPoints = Math.round(discountValue * 100);
    const net = round(numerator * BigInt(10000 - basisPoints), 300000n);
    discount = gross - net;
  } else if (discountType === "fixed") {
    discount = money(body.discountAmount ?? "0", currency);
    assert(discount <= gross, "مبلغ تخفیف از شهریه بیشتر است");
    discountValue = discount;
  }
  return {
    currency,
    rate,
    duration,
    quota,
    gross,
    discountType,
    discountValue,
    discount,
    net: gross - discount,
  };
}
