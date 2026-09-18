-- Formal incident resolution metadata for stored goods.
ALTER TABLE "StorageItem"
  ADD COLUMN "incident_resolution" TEXT,
  ADD COLUMN "incident_resolution_notes" TEXT,
  ADD COLUMN "incident_resolved_at" TIMESTAMP(3),
  ADD COLUMN "incident_resolved_by" TEXT;

ALTER TABLE "StorageItem"
  ADD CONSTRAINT "StorageItem_incident_resolved_by_fkey"
    FOREIGN KEY ("incident_resolved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StorageItem_tenant_id_status_incident_resolved_at_idx"
  ON "StorageItem" ("tenant_id", "status", "incident_resolved_at");
