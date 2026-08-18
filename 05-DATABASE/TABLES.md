# Tables

## users
id, name, username, email, password_hash, role_id, phone [SENSITIVE], active, last_login_at,
failed_login_count, locked_until, must_change_password,
deactivated_at, deactivated_by, created_at, updated_at

## roles
id, name  
*(Values: owner, supervisor, admin_sales, designer_sales, operator, qc, finishing, warehouse, auditor)*

## customers
id, customer_code (CST-XXXXX), name, phone [SENSITIVE], email [SENSITIVE], address, company, notes, created_by, created_at, updated_at  
*Akses phone/email: hanya admin_sales, supervisor, owner*

## products
id, name, category, default_material_id, active

---

## MACHINES & MATERIALS

## machines
id, machine_code (M-OUT-01, M-IND-01, ...), name, category
(OUTDOOR/INDOOR/SUBLIMASI/A3/UV/DTF/BENDERA),
status (ACTIVE/MAINTENANCE/INACTIVE),
notes, created_at, updated_at

## materials
id, material_code (MAT-OUT-001, MAT-INK-OUT-001, MAT-SHARED-001 ...),
name, type (MEDIA/INK),
unit_stock (ROLL/METER/LEMBAR/LITER/KG/RIM/BOTOL/PCS/CUSTOM — satuan pencatatan stok),
unit_usage (METER/LEMBAR/ML/GRAM/PCS/CUSTOM — satuan pemakaian operator),
unit_custom (diisi jika salah satu = CUSTOM),
conversion_factor (contoh: 1 Roll = 50 Meter → factor = 50),
is_shared (boolean — true jika bisa dipakai di lebih dari 1 mesin),
min_stock, current_stock, standard_cost,
added_by, active, created_at, updated_at
*(Admin/Owner dapat menambahkan bahan baru kapan saja)*

## machine_materials
id, machine_id (FK → machines), material_id (FK → materials)
*(Relasi many-to-many: satu bahan bisa dipakai di beberapa mesin)*
*(Bahan shared (is_shared=true) memiliki lebih dari 1 baris di tabel ini)*

## material_movements
id, material_id, machine_id (mesin mana yang pakai — penting untuk shared material),
job_id (nullable — null jika IN/ADJUSTMENT),
movement_type (IN/OUT/WASTE/ADJUSTMENT),
quantity_usage (dalam unit_usage — input dari operator),
quantity_stock_change (setelah konversi ke unit_stock),
before_stock, after_stock,
supplier (nullable, untuk tipe IN),
unit_cost (nullable, untuk tipe IN),
performed_by, reason, created_at

---

## ORDERS

## orders
id, order_code (ORD-YYYYMMDD-XXXX), customer_id, created_by, designer_id,
status, subtotal, discount, discount_approved_by, discount_approved_at, discount_reason,
total, dp_required (total × 0.5), dp_override_pct, dp_override_by, dp_override_reason,
paid_amount, balance, deadline, notes,
cancelled_at, cancelled_by, cancellation_reason, cancellation_approved_by,
dp_refund_amount, dp_refund_method,
closed_at, created_at, updated_at

## order_items
id, order_id, product_id, description, quantity, size, material_id, finishing, unit_price, total_price

---

## DESIGN

## design_jobs
id, order_id, designer_id, status, current_version, approval_method
(WALK_IN/MAKLOON/WHATSAPP), created_at, updated_at

## design_versions
id, design_job_id, version_no, file_path, preview_path, uploaded_by, uploaded_at,
approval_status (PENDING/APPROVED/REJECTED), approved_at, approved_by,
approval_method (WALK_IN/MAKLOON/WHATSAPP), approval_notes, rejection_reason

---

## PRODUCTION

## production_jobs
id, order_id, job_code (JOB-YYYYMMDD-XXXX), machine_id, operator_id, status, priority,
planned_start, planned_end, actual_start, actual_end,
planned_qty, actual_qty, reprint_qty, waste_qty, waste_reason,
parent_job_id (untuk rework, FK ke production_jobs), rework_count, rework_reason,
notes, created_at, updated_at

## qc_records
id, job_id, inspector_id, result (PASS/FAIL/PENDING), checklist_json,
notes, photo_path, rework_recommendation,
rework_decision (APPROVED/REJECTED/HOLD), rework_decided_by, rework_decided_at, rework_reason,
created_at

## finishing_jobs
id, job_id, operator_id, status, started_at, completed_at, actual_qty, notes,
job_qr_scanned_at, label_printed_at, created_at

---

## STORAGE

## storage_locations
id, location_code (LT3-A-01-01 / LT1-COUNTER-01), name, floor (1/3), zone, rack, slot,
capacity_max (default 1), capacity_current,
qr_code_value, active, created_at

## storage_items
id, job_id, location_id, quantity, status (STORED/IN_TRANSIT/RELEASED/INCIDENT),
stored_by, stored_at,
transit_at, transit_by, transit_location_id,
released_by, released_at,
incident_reported_at, incident_reported_by, incident_notes

---

## PAYMENT & PICKUP

## payments
id, order_id, amount, method (CASH/TRANSFER/QRIS), reference, status (PENDING/CONFIRMED/REJECTED),
received_by, paid_at, notes

## pickup_records
id, order_id, released_by, receiver_name, receiver_id_type, receiver_id_number, photo_path, notes, released_at

---

## NOTIFICATION

## notification_events
id, order_id, customer_id, event_type, channel (WHATSAPP/EMAIL),
recipient [SENSITIVE], template_code, status (PENDING/SENT/FAILED/RETRY),
provider_message_id, error_message, sent_at,
is_resend, resent_by, retry_count, created_at

---

## AUDIT & REPORTING

## audits
id, order_id, auditor_id, result (GREEN/YELLOW/RED),
financial_status, material_status, quantity_status, production_status, storage_status,
exception_count, notes, audited_at, approved_at, approved_by

## audit_items
id, audit_id, category, severity (INFO/WARNING/CRITICAL), expected_value, actual_value, difference, status, note

## audit_logs
id, actor_id, action, entity_type, entity_id,
old_value_json, new_value_json,
ip_address, user_agent, notes, created_at
*(Tidak ada UPDATE/DELETE endpoint. Hanya INSERT. Owner bisa hapus via panel khusus dengan logging terpisah.)*

## corrections
id, order_id, corrected_entity, corrected_id,
category (FINANCIAL/MATERIAL/QUANTITY/OTHER),
field_name, old_value, new_value, reason,
created_by, created_at,
approved_by, approved_at

## deadline_alerts
id, order_id,
alert_type (H1_WARNING/OVERDUE),
triggered_at, resolved_at

---

## ABSENSI

## attendance_imports
id, imported_by, import_date, file_path,
period_start, period_end, row_count, late_count, created_at

## attendance_records
id, import_id, user_id (nullable, FK ke users),
employee_name, date,
check_in, check_out,
check_in_status (ON_TIME/LATE), late_minutes,
break_start, break_end, break_duration_min,
break_status (NORMAL/EXCEEDED),
warning_sent_at,
owner_note, created_at
*(Data tidak bisa diedit. Owner hanya bisa isi owner_note.)*

---

## Catatan Umum Database

- Semua tabel menggunakan UUID untuk primary key
- Semua tabel memiliki `created_at` dan `updated_at` (kecuali audit_logs dan attendance_records yang immutable)
- Field [SENSITIVE] distrip dari API response untuk role yang tidak berhak
- Tidak ada soft-delete untuk tabel inti — nonaktifkan dengan field `active = false`
- `audit_logs` dan `attendance_records` menggunakan role PostgreSQL khusus yang hanya punya INSERT permission
