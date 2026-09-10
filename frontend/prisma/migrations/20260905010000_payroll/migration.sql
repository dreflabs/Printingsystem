-- Fitur Gaji (Payroll): gaji pokok per pegawai + potongan otomatis dari absensi.

ALTER TABLE "Tenant" ADD COLUMN "payroll_late_deduction_per_minute" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "base_salary" DECIMAL(15,2);

CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generated_by" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollPeriod_tenant_id_year_month_key" ON "PayrollPeriod"("tenant_id", "year", "month");

CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_salary" DECIMAL(15,2) NOT NULL,
    "working_days" INTEGER NOT NULL,
    "present_days" INTEGER NOT NULL,
    "absent_days" INTEGER NOT NULL,
    "late_minutes" INTEGER NOT NULL,
    "deduction_absent" DECIMAL(15,2) NOT NULL,
    "deduction_late" DECIMAL(15,2) NOT NULL,
    "total_deduction" DECIMAL(15,2) NOT NULL,
    "net_salary" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRecord_period_id_user_id_key" ON "PayrollRecord"("period_id", "user_id");

ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
