# Database Architecture

Sistem menggunakan database relasional (PostgreSQL) dengan pendekatan **Multi-Tenant SaaS (Shared Database, Shared Schema)**.

## Core Entities:

1. **SaaS & Multi-Tenancy:**
   `tenants`, `subscription_plans`, `tenant_subscriptions`, `invoices`.
   *(Semua tabel operasional di bawah ini wajib memiliki kolom `tenant_id` untuk Row Level Security)*

2. **Platform (di luar tenant):**
   `super_admins`, `tenant_audit_logs`, `onboarding_steps` — tabel terpisah untuk pengelola SaaS, tidak terhubung ke `tenant_id` mana pun. Lihat `13-SAAS/SUPER-ADMIN.md`.

3. **Master Data:**
   `users`, `roles`, `customers`, `products`, `materials` (stok tersimpan sebagai kolom `current_stock` di tabel ini, bukan tabel terpisah), `retail_products`.

4. **Transaksi & POS:**
   `orders`, `order_items`, `payments`.

5. **Produksi & QC:**
   `design_jobs`, `design_versions`, `machines`, `production_jobs`, `production_job_pauses` (fitur Jeda Produksi), `qc_records`, `finishing_jobs`.

6. **Inventory & Gudang:**
   `material_movements`, `retail_stock_movements`, `storage_locations`, `storage_items`, `pickup_records`.

7. **Sistem & Audit:**
   `audits`, `audit_items`, `audit_logs`, `notification_events`, `attendance_imports`, `attendance_records`, `corrections`, `deadline_alerts`.

Gunakan *Foreign Keys* dan *Indexes* yang ketat pada kolom ID, `tenant_id`, status, customer, job, dan timestamps.
