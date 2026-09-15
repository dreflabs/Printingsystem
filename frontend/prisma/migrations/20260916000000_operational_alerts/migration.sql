-- Actionable tenant-scoped operational alerts.
CREATE TABLE "OperationalAlert" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "alert_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMP(3),
  "acknowledged_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OperationalAlert"
  ADD CONSTRAINT "OperationalAlert_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OperationalAlert_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OperationalAlert_tenant_id_dedupe_key_key" ON "OperationalAlert"("tenant_id", "dedupe_key");
CREATE INDEX "OperationalAlert_tenant_id_status_severity_last_seen_at_idx" ON "OperationalAlert"("tenant_id", "status", "severity", "last_seen_at");
