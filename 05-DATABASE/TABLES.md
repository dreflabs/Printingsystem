# Tables

Konvensi tipe data: `id`/`*_id` (FK) = `uuid`; harga/nominal = `decimal`; waktu = `timestamptz`; teks pendek (kode, nama, status/enum) = `varchar`; teks panjang (notes, deskripsi, alasan) = `text`; boolean = `boolean`; angka bulat non-uang (qty, count) = `integer`.

## users
id (uuid, PK), name (varchar), username (varchar, unique), email (varchar, unique), password_hash (varchar), role_id (uuid, FK → roles.id), phone (varchar) [SENSITIVE], active (boolean), last_login_at (timestamptz),
failed_login_count (integer), locked_until (timestamptz),
must_change_password (boolean),
deactivated_at (timestamptz), deactivated_by (uuid, FK → users.id), created_at (timestamptz), updated_at (timestamptz)

## roles
id (uuid, PK), name (varchar)
*(Values: owner, supervisor, admin_sales, designer_sales, operator, qc, finishing, warehouse, auditor)*

## customers
id (uuid, PK), customer_code (varchar, unique, CST-XXXXX), name (varchar), phone (varchar) [SENSITIVE], email (varchar) [SENSITIVE], address (text), company (varchar), notes (text), created_by (uuid, FK → users.id), created_at (timestamptz), updated_at (timestamptz)
*Akses phone/email: hanya admin_sales, supervisor, owner*

## products
id (uuid, PK), name (varchar), category (varchar), default_material_id (uuid, FK → materials.id), active (boolean)

---

## MACHINES & MATERIALS

## machines
id (uuid, PK), machine_code (varchar, unique, M-OUT-01, M-IND-01, ...), name (varchar), category (varchar)
(OUTDOOR/INDOOR/SUBLIMASI/A3/UV/DTF/BENDERA),
status (varchar, enum: ACTIVE/MAINTENANCE/INACTIVE),
notes (text), created_at (timestamptz), updated_at (timestamptz)

## materials
id (uuid, PK), material_code (varchar, unique, MAT-OUT-001, MAT-INK-OUT-001, MAT-SHARED-001 ...),
name (varchar), type (varchar, enum: MEDIA/INK),
unit_stock (varchar, enum: ROLL/METER/LEMBAR/LITER/KG/RIM/BOTOL/PCS/CUSTOM — satuan pencatatan stok),
unit_usage (varchar, enum: METER/LEMBAR/ML/GRAM/PCS/CUSTOM — satuan pemakaian operator),
unit_custom (varchar, diisi jika salah satu = CUSTOM),
conversion_factor (decimal, contoh: 1 Roll = 50 Meter → factor = 50),
is_shared (boolean — true jika bisa dipakai di lebih dari 1 mesin),
min_stock (decimal), current_stock (decimal), standard_cost (decimal),
added_by (uuid, FK → users.id), active (boolean), created_at (timestamptz), updated_at (timestamptz)
*(Admin/Owner dapat menambahkan bahan baru kapan saja)*

## machine_materials
id (uuid, PK), machine_id (uuid, FK → machines.id), material_id (uuid, FK → materials.id)
*(Relasi many-to-many: satu bahan bisa dipakai di beberapa mesin)*
*(Bahan shared (is_shared=true) memiliki lebih dari 1 baris di tabel ini)*

## material_movements
id (uuid, PK), material_id (uuid, FK → materials.id), machine_id (uuid, FK → machines.id — mesin mana yang pakai, penting untuk shared material),
job_id (uuid, FK → production_jobs.id, nullable — null jika IN/ADJUSTMENT),
movement_type (varchar, enum: IN/OUT/WASTE/ADJUSTMENT),
quantity_usage (decimal, dalam unit_usage — input dari operator),
quantity_stock_change (decimal, setelah konversi ke unit_stock),
before_stock (decimal), after_stock (decimal),
supplier (varchar, nullable, untuk tipe IN),
unit_cost (decimal, nullable, untuk tipe IN),
performed_by (uuid, FK → users.id), reason (text), created_at (timestamptz)

---

## ORDERS

## orders
id (uuid, PK), order_code (varchar, unique, ORD-YYYYMMDD-XXXX), customer_id (uuid, FK → customers.id), created_by (uuid, FK → users.id), designer_id (uuid, FK → users.id),
status (varchar, enum — lihat `09-TECHNICAL/STATUS-MACHINE.md`), subtotal (decimal), discount (decimal), discount_approved_by (uuid, FK → users.id), discount_approved_at (timestamptz), discount_reason (text),
total (decimal), dp_required (decimal, total × 0.5), dp_override_pct (decimal), dp_override_by (uuid, FK → users.id), dp_override_reason (text),
paid_amount (decimal), balance (decimal), deadline (timestamptz), notes (text),
cancelled_at (timestamptz), cancelled_by (uuid, FK → users.id), cancellation_reason (text), cancellation_approved_by (uuid, FK → users.id),
dp_refund_amount (decimal), dp_refund_method (varchar),
closed_at (timestamptz), created_at (timestamptz), updated_at (timestamptz)

## order_items
id (uuid, PK), order_id (uuid, FK → orders.id), product_id (uuid, FK → products.id), description (text), quantity (integer), size (varchar), material_id (uuid, FK → materials.id), finishing (varchar), unit_price (decimal), total_price (decimal)

---

## DESIGN

## design_jobs
id (uuid, PK), order_id (uuid, FK → orders.id), designer_id (uuid, FK → users.id), status (varchar, enum), current_version (integer), approval_method (varchar, enum:
WALK_IN/MAKLOON/WHATSAPP), created_at (timestamptz), updated_at (timestamptz)

## design_versions
id (uuid, PK), design_job_id (uuid, FK → design_jobs.id), version_no (integer), file_path (varchar), preview_path (varchar), uploaded_by (uuid, FK → users.id), uploaded_at (timestamptz),
approval_status (varchar, enum: PENDING/APPROVED/REJECTED), approved_at (timestamptz), approved_by (uuid, FK → users.id),
approval_method (varchar, enum: WALK_IN/MAKLOON/WHATSAPP), approval_notes (text), rejection_reason (text)

---

## PRODUCTION

## production_jobs
id (uuid, PK), order_id (uuid, FK → orders.id), job_code (varchar, unique, JOB-YYYYMMDD-XXXX), machine_id (uuid, FK → machines.id), operator_id (uuid, FK → users.id), status (varchar, enum), priority (integer),
planned_start (timestamptz), planned_end (timestamptz), actual_start (timestamptz), actual_end (timestamptz),
planned_qty (integer), actual_qty (integer), reprint_qty (integer), waste_qty (integer), waste_reason (text),
parent_job_id (uuid, FK → production_jobs.id, untuk rework), rework_count (integer), rework_reason (text),
notes (text), created_at (timestamptz), updated_at (timestamptz)

## qc_records
id (uuid, PK), job_id (uuid, FK → production_jobs.id), inspector_id (uuid, FK → users.id), result (varchar, enum: PASS/FAIL/PENDING), checklist_json (jsonb),
notes (text), photo_path (varchar), rework_recommendation (varchar),
rework_decision (varchar, enum: APPROVED/REJECTED/HOLD), rework_decided_by (uuid, FK → users.id), rework_decided_at (timestamptz), rework_reason (text),
created_at (timestamptz)

## finishing_jobs
id (uuid, PK), job_id (uuid, FK → production_jobs.id), operator_id (uuid, FK → users.id), status (varchar, enum), started_at (timestamptz), completed_at (timestamptz), actual_qty (integer), notes (text),
job_qr_scanned_at (timestamptz), label_printed_at (timestamptz), created_at (timestamptz)

---

## STORAGE

## storage_locations
id (uuid, PK), location_code (varchar, unique, LT3-A-01-01 / LT1-COUNTER-01), name (varchar), floor (integer, 1/3), zone (varchar), rack (varchar), slot (varchar),
capacity_max (integer, default 1), capacity_current (integer),
qr_code_value (varchar), active (boolean), created_at (timestamptz)

## storage_items
id (uuid, PK), job_id (uuid, FK → production_jobs.id), location_id (uuid, FK → storage_locations.id), quantity (integer), status (varchar, enum: STORED/IN_TRANSIT/RELEASED/INCIDENT),
stored_by (uuid, FK → users.id), stored_at (timestamptz),
transit_at (timestamptz), transit_by (uuid, FK → users.id), transit_location_id (uuid, FK → storage_locations.id),
released_by (uuid, FK → users.id), released_at (timestamptz),
incident_reported_at (timestamptz), incident_reported_by (uuid, FK → users.id), incident_notes (text)

---

## PAYMENT & PICKUP

## payments
id (uuid, PK), order_id (uuid, FK → orders.id), amount (decimal), method (varchar, enum: CASH/TRANSFER/QRIS), reference (varchar), status (varchar, enum: PENDING/CONFIRMED/REJECTED),
received_by (uuid, FK → users.id), paid_at (timestamptz), notes (text)

## pickup_records
id (uuid, PK), order_id (uuid, FK → orders.id), released_by (uuid, FK → users.id), receiver_name (varchar), receiver_id_type (varchar), receiver_id_number (varchar), photo_path (varchar), notes (text), released_at (timestamptz)

---

## NOTIFICATION

## notification_events
id (uuid, PK), order_id (uuid, FK → orders.id), customer_id (uuid, FK → customers.id), event_type (varchar), channel (varchar, enum: WHATSAPP/EMAIL),
recipient (varchar) [SENSITIVE], template_code (varchar), status (varchar, enum: PENDING/SENT/FAILED/RETRY),
provider_message_id (varchar), error_message (text), sent_at (timestamptz),
is_resend (boolean), resent_by (uuid, FK → users.id), retry_count (integer), created_at (timestamptz)

---

## AUDIT & REPORTING

## audits
id (uuid, PK), order_id (uuid, FK → orders.id), auditor_id (uuid, FK → users.id), result (varchar, enum: GREEN/YELLOW/RED),
financial_status (varchar), material_status (varchar), quantity_status (varchar), production_status (varchar), storage_status (varchar),
exception_count (integer), notes (text), audited_at (timestamptz), approved_at (timestamptz), approved_by (uuid, FK → users.id)

## audit_items
id (uuid, PK), audit_id (uuid, FK → audits.id), category (varchar), severity (varchar, enum: INFO/WARNING/CRITICAL), expected_value (varchar), actual_value (varchar), difference (varchar), status (varchar), note (text)

## audit_logs
id (uuid, PK), actor_id (uuid, FK → users.id), action (varchar), entity_type (varchar), entity_id (uuid),
old_value_json (jsonb), new_value_json (jsonb),
ip_address (varchar), user_agent (varchar), notes (text), created_at (timestamptz)
*(Tidak ada UPDATE/DELETE endpoint. Hanya INSERT. Owner bisa hapus via panel khusus dengan logging terpisah.)*

## corrections
id (uuid, PK), order_id (uuid, FK → orders.id), corrected_entity (varchar), corrected_id (uuid),
category (varchar, enum: FINANCIAL/MATERIAL/QUANTITY/OTHER),
field_name (varchar), old_value (text), new_value (text), reason (text),
created_by (uuid, FK → users.id), created_at (timestamptz),
approved_by (uuid, FK → users.id), approved_at (timestamptz)

## deadline_alerts
id (uuid, PK), order_id (uuid, FK → orders.id),
alert_type (varchar, enum: H1_WARNING/OVERDUE),
triggered_at (timestamptz), resolved_at (timestamptz)

---

## ABSENSI

## attendance_imports
id (uuid, PK), imported_by (uuid, FK → users.id), import_date (timestamptz), file_path (varchar),
period_start (timestamptz), period_end (timestamptz), row_count (integer), late_count (integer), created_at (timestamptz)

## attendance_records
id (uuid, PK), import_id (uuid, FK → attendance_imports.id), user_id (uuid, FK → users.id, nullable),
employee_name (varchar), date (timestamptz),
check_in (timestamptz), check_out (timestamptz),
check_in_status (varchar, enum: ON_TIME/LATE), late_minutes (integer),
break_start (timestamptz), break_end (timestamptz), break_duration_min (integer),
break_status (varchar, enum: NORMAL/EXCEEDED),
warning_sent_at (timestamptz),
owner_note (text), created_at (timestamptz)
*(Data tidak bisa diedit. Owner hanya bisa isi owner_note.)*

---

## Catatan Umum Database

- Semua tabel menggunakan UUID untuk primary key
- Semua tabel memiliki `created_at` dan `updated_at` (kecuali audit_logs dan attendance_records yang immutable)
- Field [SENSITIVE] distrip dari API response untuk role yang tidak berhak
- Tidak ada soft-delete untuk tabel inti — nonaktifkan dengan field `active = false`
- `audit_logs` dan `attendance_records` menggunakan role PostgreSQL khusus yang hanya punya INSERT permission

---

## Index yang Direkomendasikan

Index dipilih untuk mendukung pola akses paling sering: filter status per tahap workflow, lookup via kode unik (scan QR, pencarian), sorting/filter berdasarkan tanggal, dan join lewat foreign key.

### Kolom status (filter cepat per tahap workflow)
- `orders.status`
- `production_jobs.status`
- `qc_records.result`
- `finishing_jobs.status`
- `storage_items.status`
- `payments.status`
- `notification_events.status`
- `design_versions.approval_status`
- `machines.status`
- `materials.active`, `customers.active`, `users.active`
- `attendance_records.check_in_status`, `attendance_records.break_status`

### Kolom kode unik (lookup exact — scan QR, pencarian manual)
- `orders.order_code` (unique index)
- `production_jobs.job_code` (unique index)
- `customers.customer_code` (unique index)
- `storage_locations.location_code` (unique index)
- `materials.material_code` (unique index)
- `machines.machine_code` (unique index)
- `users.username` (unique index)

### Kolom timestamp (sorting/filter tanggal)
- `orders.created_at`, `orders.deadline`
- `production_jobs.created_at`, `production_jobs.planned_start`, `production_jobs.planned_end`
- `payments.paid_at`
- `audit_logs.created_at`
- `material_movements.created_at`
- `notification_events.sent_at`
- `deadline_alerts.triggered_at`
- `attendance_records.date`

### Foreign key (semua kolom `*_id` yang merujuk tabel lain)
Semua kolom bertipe `FK →` pada daftar tabel di atas direkomendasikan memiliki index, termasuk namun tidak terbatas pada:
`users.role_id`, `customers.created_by`, `products.default_material_id`, `machine_materials.machine_id` + `machine_materials.material_id` (composite unique index untuk mencegah duplikasi pasangan mesin-material), `material_movements.material_id` + `material_movements.machine_id` + `material_movements.job_id`, `orders.customer_id` + `orders.designer_id` + `orders.created_by`, `order_items.order_id` + `order_items.product_id` + `order_items.material_id`, `design_jobs.order_id` + `design_jobs.designer_id`, `design_versions.design_job_id`, `production_jobs.order_id` + `production_jobs.machine_id` + `production_jobs.operator_id` + `production_jobs.parent_job_id`, `qc_records.job_id` + `qc_records.inspector_id`, `finishing_jobs.job_id` + `finishing_jobs.operator_id`, `storage_items.job_id` + `storage_items.location_id` + `storage_items.transit_location_id`, `payments.order_id`, `pickup_records.order_id`, `notification_events.order_id` + `notification_events.customer_id`, `audits.order_id` + `audits.auditor_id`, `audit_items.audit_id`, `audit_logs.actor_id` + composite (`entity_type`, `entity_id`) untuk lookup riwayat per entitas, `corrections.order_id`, `deadline_alerts.order_id`, `attendance_records.import_id` + `attendance_records.user_id`.

### Index komposit tambahan yang berguna
- `production_jobs (machine_id, status)` — antrian per mesin
- `production_jobs (operator_id, status)` — job aktif per operator
- `orders (status, deadline)` — deteksi overdue per status
- `storage_items (location_id, status)` — cek kapasitas lokasi real-time
