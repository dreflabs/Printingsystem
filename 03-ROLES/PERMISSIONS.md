# PERMISSIONS — Katalog Akses Print Pilot

Dokumen ini adalah sumber kebenaran untuk izin tindakan. Role adalah template
izin; jumlah pegawai, `workspace_mode`, dan paket SaaS tidak mengubah arti role.

## Prinsip

- Server memeriksa permission, bukan hanya tombol UI atau URL.
- User dapat memiliki satu atau beberapa role.
- Permission efektif = role defaults + override user yang diizinkan − policy tenant.
- Permission berisiko tinggi tidak boleh diberikan lewat override biasa.
- Setiap perubahan role, permission, dan policy dicatat di audit log.

## Role bawaan

| Role | Fokus |
|---|---|
| `owner` | Kepemilikan, approval exception, user, laporan, dan override darurat |
| `admin` | Order, customer, payment operasional, produksi harian, pickup |
| `designer_sales` | Intake customer, desain, revisi, dan approval walk-in |
| `operator` | Eksekusi produksi, scan job, qty, material, dan waste |
| `gudang` | QC, finishing, label, storage, dan perpindahan counter |

## Katalog permission

### Order dan customer

- `order.view_scoped`
- `order.view_all`
- `order.create`
- `order.edit_draft`
- `order.edit_pre_production`
- `customer.create`
- `customer.view_contact`
- `customer.update`

### Harga dan keuangan

- `quote.edit_price`
- `discount.request`
- `discount.approve`
- `payment.view_detail`
- `payment.receive`
- `payment.confirm`
- `payment.refund_request`
- `payment.refund_approve`
- `pickup.release`
- `pickup.release_override`

### Desain dan produksi

- `design.upload`
- `design.approve_walkin`
- `design.approve_online`
- `design.request_revision`
- `production.assign`
- `production.reassign`
- `production.execute`
- `production.input_material`
- `production.submit_waste`
- `production.rework_decide`

### QC, gudang, dan audit

- `qc.submit`
- `finishing.execute`
- `storage.store`
- `storage.move_to_counter`
- `storage.report_incident`
- `audit.submit`
- `audit.approve`
- `correction.create_operational`
- `correction.create_financial`
- `correction.approve`

### Administrasi tenant

- `user.view`
- `user.create`
- `user.update_role`
- `user.deactivate`
- `user.reset_password`
- `attendance.view`
- `attendance.self` — absen masuk/pulang/istirahat; tetap membutuhkan `User.attendance_eligible=true`
- `attendance.configure`
- `payroll.view`
- `payroll.manage`
- `report.view_operational`
- `report.view_financial`
- `report.export`
- `shop.configure`

## Permission berisiko tinggi

`discount.approve`, `payment.refund_approve`, `pickup.release_override`,
`production.rework_decide`, `audit.approve`, `correction.approve`,
`user.update_role`, dan `user.deactivate` default-nya hanya Owner.

Jika bisnis mengizinkan delegasi di masa depan, delegasi harus memakai batas
nominal, masa berlaku, alasan, dan approval Owner.

## Role bukan pembatas jumlah orang

Role yang sama dapat dimiliki banyak user. Satu user juga dapat memiliki banyak
role. Jangan membuat role baru berdasarkan jumlah pegawai; gunakan kombinasi role
dan policy staffing.
