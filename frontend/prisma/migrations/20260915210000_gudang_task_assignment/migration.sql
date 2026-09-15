-- Phase 2 warehouse task assignment: explicit QC and finishing ownership.
ALTER TABLE "ProductionJob"
  ADD COLUMN "qc_assignee_id" TEXT,
  ADD COLUMN "qc_claimed_at" TIMESTAMP(3),
  ADD COLUMN "finishing_assignee_id" TEXT,
  ADD COLUMN "finishing_claimed_at" TIMESTAMP(3);

ALTER TABLE "ProductionJob"
  ADD CONSTRAINT "ProductionJob_qc_assignee_id_fkey"
    FOREIGN KEY ("qc_assignee_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductionJob_finishing_assignee_id_fkey"
    FOREIGN KEY ("finishing_assignee_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductionJob_tenant_id_qc_assignee_id_status_idx"
  ON "ProductionJob" ("tenant_id", "qc_assignee_id", "status");

CREATE INDEX "ProductionJob_tenant_id_finishing_assignee_id_status_idx"
  ON "ProductionJob" ("tenant_id", "finishing_assignee_id", "status");
