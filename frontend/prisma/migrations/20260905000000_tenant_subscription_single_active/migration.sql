-- Pastikan hanya ada satu TenantSubscription berstatus ACTIVE per tenant.
-- Tanpa ini, dua request updateTenantPlan yang nyaris bersamaan (double-submit,
-- dua tab Super Admin) bisa menghasilkan dua baris ACTIVE untuk tenant yang
-- sama, yang menggandakan MRR di getPlatformMetrics().

-- 1. Bersihkan duplikat yang mungkin sudah ada: untuk tenant dengan lebih dari
--    satu baris ACTIVE, pertahankan yang paling baru dibuat, sisanya di-cancel.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at DESC, id DESC) AS rn
  FROM "TenantSubscription"
  WHERE status = 'ACTIVE'
)
UPDATE "TenantSubscription" t
SET status = 'CANCELLED', ends_at = COALESCE(t.ends_at, now())
FROM ranked
WHERE t.id = ranked.id AND ranked.rn > 1;

-- 2. Partial unique index: hanya satu baris ACTIVE per tenant_id.
CREATE UNIQUE INDEX "TenantSubscription_tenant_id_active_unique"
ON "TenantSubscription" ("tenant_id")
WHERE status = 'ACTIVE';
