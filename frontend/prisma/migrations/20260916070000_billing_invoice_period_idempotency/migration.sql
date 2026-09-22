-- Make the beta invoice generator safe to retry and prepare gateway reconciliation.
ALTER TABLE "Invoice"
  ADD COLUMN "billing_period" TEXT,
  ADD COLUMN "period_start" TIMESTAMP(3),
  ADD COLUMN "period_end" TIMESTAMP(3),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN "external_order_id" TEXT,
  ADD COLUMN "gateway_transaction_id" TEXT,
  ADD COLUMN "idempotency_key" TEXT;

-- Existing invoice numbers are INV-YYYYMM-XXXXX. Preserve that period for
-- historical rows; fall back to due_date for any legacy/custom number.
UPDATE "Invoice"
SET "billing_period" = COALESCE(
  substring("invoice_number" from 'INV-([0-9]{6})-'),
  to_char("due_date", 'YYYYMM')
)
WHERE "billing_period" IS NULL;

-- If old data contains duplicate rows for one tenant/period, keep the oldest
-- canonical period and suffix the historical duplicate so the unique index can
-- be installed without deleting financial history.
WITH ranked AS (
  SELECT "id", "tenant_id", "billing_period",
         ROW_NUMBER() OVER (PARTITION BY "tenant_id", "billing_period" ORDER BY "created_at", "id") AS rn
  FROM "Invoice"
)
UPDATE "Invoice" i
SET "billing_period" = i."billing_period" || '-LEGACY-' || LEFT(i."id", 8)
FROM ranked r
WHERE i."id" = r."id" AND r.rn > 1;

ALTER TABLE "Invoice"
  ALTER COLUMN "billing_period" SET NOT NULL;

CREATE UNIQUE INDEX "Invoice_tenant_id_billing_period_key"
  ON "Invoice" ("tenant_id", "billing_period");
CREATE UNIQUE INDEX "Invoice_idempotency_key_key"
  ON "Invoice" ("idempotency_key");
