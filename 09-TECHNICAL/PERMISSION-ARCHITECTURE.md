# PERMISSION ARCHITECTURE

## Lapisan keputusan akses

Setiap server action yang mengubah atau membuka data sensitif mengevaluasi:

1. session dan user aktif;
2. tenant context yang tervalidasi;
3. role dan permission efektif;
4. entitlement paket SaaS;
5. staffing policy dan separation of duties;
6. status objek dan prasyarat workflow;
7. mode impersonation/read-only;
8. audit event dan idempotency.

Urutan ini berlaku sama untuk Server Actions, Route Handlers, cron yang memiliki
actor system, dan endpoint perangkat kiosk.

## Model data yang disarankan

- `Permission`: katalog global permission yang stabil.
- `RolePermission`: default permission untuk role bawaan.
- `UserRole`: role tambahan per user, tetap tenant-scoped melalui User.
- `UserPermissionOverride`: allow/deny terbatas per user dan tenant.
- `TenantPolicy`: staffing policy dan aturan separation of duties.
- `TenantEntitlement`: fitur aktif, kuota, dan sumber paket.

Pada fase pertama, role custom penuh belum diperlukan. Gunakan role bawaan,
multi-role, dan override terbatas. Role custom dapat ditambahkan setelah pola
penggunaan tenant tervalidasi.

## Helper terpusat

Gunakan satu pemeriksa server-side, misalnya:

```ts
can(actor, "payment.receive")
can(actor, "pickup.release")
can(actor, "rework.approve")
```

Action tidak boleh membuat daftar pengecekan role sendiri-sendiri. Helper juga
harus mengembalikan alasan penolakan yang aman dan tidak membocorkan data tenant.

## Migrasi

- Role lama dipetakan ke default permission yang setara.
- Owner lama tetap memperoleh seluruh akses yang sebelumnya tersedia.
- Tidak ada akses penting yang dicabut tanpa audit dan migration note.
- Permission baru diterapkan melalui feature flag sampai acceptance test lulus.
