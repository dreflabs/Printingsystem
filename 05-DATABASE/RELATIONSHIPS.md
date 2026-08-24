# Relationships

## Multi-Tenant SaaS
- Tenant 1:N Users (Pegawai/Admin)
- Tenant 1:1 Tenant Subscription
- Tenant 1:N Invoices
- Tenant 1:N Customers
- Tenant 1:N Products (termasuk retail)
- Tenant 1:N Orders
*(Semua data operasional terisolasi per `tenant_id`)*

## Platform (Terpisah dari Tenant)
- Super Admin 1:N Tenant Audit Logs (aksi impersonate/override yang dilakukan Super Admin ke tenant manapun)
- Tenant 1:N Onboarding Steps
*(Tabel-tabel ini TIDAK punya `tenant_id` sebagai pemilik data — `super_admins` sengaja terpisah total dari tabel `users` manapun, lihat `06-SECURITY/MULTI-TENANT-ISOLATION.md`)*

## Operasional
- Customer 1:N Orders
- Order 1:N Order Items
- Order 1:1 Design Job
- Design Job 1:N Design Versions
- Order 1:N Production Jobs
- Production Job N:1 Machine
- Production Job N:1 Operator/User
- Production Job 1:N Production Job Pauses (fitur Jeda Produksi — riwayat setiap kali job dijeda/dilanjutkan)
- Production Job 1:N Material Movements
- Production Job 1:N QC Records
- Production Job 1:1 Finishing Job
- Production Job 1:N Storage Items
- Production Job self-referencing 1:N (parent_job_id — Child Job hasil rework mengarah ke Job asli)
- Storage Location 1:N Storage Items
- Order 1:N Payments
- Order 1:1 Pickup record
- Order 1:N Notification Events
- Order 1:N Audits
- Order 1:N Corrections (koreksi pasca-CLOSED)
- Order 1:N Deadline Alerts
- Audit 1:N Audit Items

## Retail & Absensi
- Order Item N:1 Retail Product
- Retail Product 1:N Retail Stock Movements
- Attendance Import 1:N Attendance Records (satu file CSV import dari mesin fingerprint menghasilkan banyak record)
- User 1:N Attendance Records

## Global Audit
- All critical entities 1:N Audit Logs
