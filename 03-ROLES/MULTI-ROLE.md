# MULTI-ROLE & SOLO MODE

## Apa Itu Multi-Role?

Fitur **Multi-Role** memungkinkan satu akun user memiliki lebih dari satu peran (role) sekaligus. Ini dirancang untuk percetakan kecil-menengah yang stafnya mengerjakan lebih dari satu tugas.

---

## Apa Itu Solo Mode?

**Solo Mode** adalah kondisi ketika satu user memiliki lebih dari satu role aktif. Di sidebar, user tersebut akan melihat:
- **Role Switcher** — dropdown untuk berpindah antar dashboard (Admin → Operator → Finishing, dll.)
- Label **"Solo Mode ✓"** di bagian bawah sidebar sebagai indikator
- Semua menu dari seluruh role yang dimiliki ditampilkan sekaligus

---

## Struktur Database

Role disimpan dalam dua tempat:

| Field / Table | Keterangan |
|---------------|------------|
| `User.role_id` | **Primary role** — role utama, digunakan untuk backward compat |
| `UserRole` (join table) | **Extra roles** — role tambahan, relasi many-to-many |

### Model UserRole (Baru)
```prisma
model UserRole {
  id      String @id @default(uuid())
  user_id String
  user    User   @relation(...)
  role_id String
  role    Role   @relation(...)
  @@unique([user_id, role_id])
}
```

---

## Aturan Primary Role

Ketika user memiliki banyak role, sistem otomatis menentukan **primary role** berdasarkan urutan prioritas:

```
owner → admin → designer_sales → operator → gudang
```

Primary role digunakan untuk:
1. Menentukan redirect default setelah login
2. Menentukan home dashboard (`HOME_BY_ROLE`)
3. Backward compatibility dengan JWT token lama

---

## Cara Membuat User Multi-Role

Pada halaman **Owner → Pegawai & Akses → Tambah Pegawai**:
1. Isi Nama, Username, Email
2. Di bagian **Role / Peran**, centang satu atau lebih role sekaligus
3. Role dengan prioritas tertinggi yang dipilih otomatis menjadi primary role (ditandai badge **PRIMARY**)
4. Klik **Simpan Pegawai**

---

## Skenario Rekomendasi Berdasarkan Skala Bisnis

### Percetakan Kecil (1-3 orang)
| User | Role yang Dicentang |
|------|---------------------|
| Owner | Owner (bawaan, semua akses) |
| Karyawan 1 | Admin + Operator + Finishing & Gudang |

> Dengan kombinasi ini, karyawan bisa mengakses semua bagian operasional tanpa perlu banyak akun.

### Percetakan Menengah (4-10 orang)
| User | Role |
|------|------|
| Owner | Owner |
| Admin | Admin |
| Desainer | Designer/Setting |
| Operator mesin | Operator Cetak |
| Staff finishing | Finishing & Gudang |

### Percetakan Besar (>10 orang)
Setiap orang punya **1 role spesifik** sesuai jobdesc masing-masing.

---

## Catatan Teknis

- **Tidak ada breaking change**: User lama dengan 1 role tetap berjalan normal.
- **JWT Token**: Menyimpan `role` (string, primary) dan `roles` (array semua role).
- **Middleware RBAC**: Menggunakan `roles.some(r => allowedRoles.includes(r))` — user diizinkan jika SALAH SATU rolenya cocok.
- **Sidebar**: Menampilkan semua menu yang relevan dengan semua role yang dimiliki user.
