import { test } from "node:test";
import assert from "node:assert/strict";
import jalaali from "jalaali-js";
import { dateInZone } from "../dates.mjs";
test("Tehran calendar day boundary and Persian year/leap transition", () => {
  assert.equal(dateInZone("2026-03-20T20:29:59Z"), "2026-03-20");
  assert.equal(dateInZone("2026-03-20T20:30:00Z"), "2026-03-21");
  assert.deepEqual(jalaali.toJalaali(2026, 3, 21), { jy: 1405, jm: 1, jd: 1 });
  assert.equal(jalaali.isValidJalaaliDate(1403, 12, 30), true);
  assert.equal(jalaali.isValidJalaaliDate(1404, 12, 30), false);
});
test("IANA conversion follows daylight saving instead of fixed offset", () => {
  assert.equal(
    dateInZone("2026-03-29T22:30:00Z", "Europe/Berlin"),
    "2026-03-30",
  );
  assert.equal(
    dateInZone("2026-03-28T22:30:00Z", "Europe/Berlin"),
    "2026-03-28",
  );
});
