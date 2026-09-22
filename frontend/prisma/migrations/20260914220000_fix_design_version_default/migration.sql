-- DesignJob.current_version is a summary counter. The first actual version is V1.
ALTER TABLE "DesignJob" ALTER COLUMN "current_version" SET DEFAULT 0;
