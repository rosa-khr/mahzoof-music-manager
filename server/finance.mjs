import { dateInZone } from "./dates.mjs";
import { one, all, run, transaction, audit } from "./db.mjs";
import { assert, text, integer, choice, date, money } from "./validation.mjs";
import { hashToken, requireRole } from "./auth.mjs";
import { financial } from "./education.mjs";
export function installFinance(app, db) {
  app.get("/api/bank-accounts", (req, res) => {
    requireRole(req, ["admin", "accountant"]);
    res.json(all(db, "SELECT * FROM bank_accounts WHERE active=1"));
  });
  app.post("/api/payments", (req, res) => {
    requireRole(req, ["admin", "accountant"]);
    const b = req.body,
      key = text(req.headers["idempotency-key"], "شناسه درخواست", 100, true);
    assert(key.length >= 16, "شناسه درخواست کوتاه است");
    const hash = hashToken(JSON.stringify(b));
    let result;
    transaction(db, () => {
      const previous = one(
        db,
        "SELECT * FROM payments WHERE idempotency_key=?",
        key,
      );
      if (previous) {
        assert(
          previous.request_hash === hash,
          "شناسه درخواست با محتوای متفاوت استفاده شده است",
          409,
        );
        result = { id: previous.id, replayed: true };
        return;
      }
      const studentId = integer(b.studentId, "هنرجو"),
        invoice = one(
          db,
          "SELECT * FROM invoices WHERE id=?",
          integer(b.invoiceId, "صورتحساب"),
        );
      assert(
        invoice && invoice.student_id === studentId,
        "صورتحساب متعلق به این هنرجو نیست",
      );
      assert(invoice.settlement_flow !== 'full', 'برای این ترم از دریافت کامل شهریه استفاده کنید');
      const currency = choice(b.currency, ["TOMAN", "USD"], "ارز");
      assert(invoice.currency === currency, "ارز صورتحساب و دریافت یکسان نیست");
      const amount = money(b.amount, currency);
      assert(amount > 0, "مبلغ دریافت باید بیشتر از صفر باشد");
      const received = date(b.receivedOn, true);
      assert(received <= dateInZone(), "تاریخ دریافت در آینده نیست");
      const method = choice(b.method, ["cash", "bank", "other"], "روش دریافت");
      const bank = b.bankAccountId
        ? integer(b.bankAccountId, "حساب بانکی")
        : null;
      if (method === "bank")
        assert(
          bank &&
            one(
              db,
              "SELECT 1 FROM bank_accounts WHERE id=? AND currency=? AND active=1",
              bank,
              currency,
            ),
          "حساب فعال هم‌ارز لازم است",
        );
      else assert(bank === null, "حساب فقط برای انتقال بانکی مجاز است");
      const id = Number(
        run(
          db,
          "INSERT INTO payments(student_id,currency,amount_minor,received_on,method,bank_account_id,reference,notes,actor_id,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          studentId,
          currency,
          amount,
          received,
          method,
          bank,
          text(b.reference, "پیگیری", 100),
          text(b.notes, "توضیحات", 1000),
          req.user.id,
          key,
          hash,
        ).lastInsertRowid,
      );
      const allocated = Math.min(financial(db, invoice).balance_minor, amount);
      if (allocated > 0)
        run(
          db,
          "INSERT INTO payment_allocations(payment_id,invoice_id,student_id,currency,amount_minor) VALUES(?,?,?,?,?)",
          id,
          invoice.id,
          studentId,
          currency,
          allocated,
        );
      audit(db, req.user, "payment-created", id, {
        amount,
        currency,
        invoiceId: invoice.id,
        allocated,
      });
      result = {
        id,
        allocated_minor: allocated,
        credit_minor: amount - allocated,
        replayed: false,
      };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
}
