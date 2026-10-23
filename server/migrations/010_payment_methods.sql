CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  settlement_type TEXT NOT NULL CHECK(settlement_type IN ('single','installment','free')),
  payment_currency TEXT CHECK(payment_currency IN ('rial','foreign')),
  installment_count INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK((settlement_type='installment' AND installment_count IS NOT NULL AND installment_count>=2)
    OR (settlement_type!='installment' AND installment_count IS NULL)),
  CHECK((settlement_type='free' AND payment_currency IS NULL AND length(trim(notes))>0)
    OR (settlement_type!='free' AND payment_currency IS NOT NULL))
);
