-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER,
    "summary" TEXT,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_job_started_at_idx" ON "JobRun"("job", "started_at");
