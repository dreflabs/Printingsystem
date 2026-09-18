-- Warehouse workflow integrity: receipt metadata and active-job uniqueness.
ALTER TABLE "MaterialMovement"
  ADD COLUMN "reference_no" TEXT,
  ADD COLUMN "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- A job can have only one active finishing session.
CREATE UNIQUE INDEX "FinishingJob_one_started_per_job_key"
  ON "FinishingJob" ("job_id")
  WHERE "status" = 'STARTED';

-- A job can occupy only one active storage position at a time.
CREATE UNIQUE INDEX "StorageItem_one_active_per_job_key"
  ON "StorageItem" ("job_id")
  WHERE "status" IN ('STORED', 'IN_TRANSIT', 'INCIDENT');
