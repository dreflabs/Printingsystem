-- Attendance policy and one-record-per-user-per-day guard.
ALTER TABLE "User" ADD COLUMN "attendance_eligible" BOOLEAN NOT NULL DEFAULT false;

-- Existing operational roles and owners keep the current in-app behavior.
UPDATE "User" u
SET "attendance_eligible" = true
WHERE EXISTS (
  SELECT 1 FROM "Role" r
  WHERE r.id = u.role_id AND r.name IN ('owner', 'designer_sales', 'operator', 'gudang')
)
OR EXISTS (
  SELECT 1
  FROM "UserRole" ur
  JOIN "Role" r ON r.id = ur.role_id
  WHERE ur.user_id = u.id AND r.name IN ('designer_sales', 'operator', 'gudang')
);

ALTER TABLE "AttendanceRecord" ADD COLUMN "attendance_day" DATE;
UPDATE "AttendanceRecord" SET "attendance_day" = ("date"::date);
ALTER TABLE "AttendanceRecord" ALTER COLUMN "attendance_day" SET NOT NULL;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "attendance_day" SET DEFAULT CURRENT_DATE;

-- Do not silently destroy historical duplicates. Deployment fails with a
-- clear message so an operator can reconcile them before enabling the guard.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AttendanceRecord"
    WHERE "user_id" IS NOT NULL
    GROUP BY "tenant_id", "user_id", "attendance_day"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'AttendanceRecord duplicate user/day rows found; reconcile before applying attendance policy migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "AttendanceRecord_tenant_id_user_id_attendance_day_key"
  ON "AttendanceRecord"("tenant_id", "user_id", "attendance_day");
