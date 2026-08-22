# Keamanan & Isolasi Multi-Tenant

Pendekatan multi-tenancy Print Pilot adalah **Single Database, Shared Schema** (semua tenant berada di satu tabel yang sama). Untuk mencegah kebocoran data antar-percetakan, sistem menerapkan dua lapis pertahanan yang ketat.

## 1. Lapisan Database: PostgreSQL Row-Level Security (RLS)

Ini adalah lapisan pertahanan terkuat. RLS menjamin bahwa sekiranya ada bug di kode backend (Prisma/Node.js), query tidak akan pernah bisa membaca/mengubah baris data milik tenant lain.

### Implementasi:
Semua tabel akan memiliki aturan (policy) seperti berikut:
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON orders
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```
Saat backend membuat koneksi/transaksi ke database, sebelum mengeksekusi query, sistem **WAJIB** mengeksekusi:
```sql
SET LOCAL app.current_tenant_id = 'uuid-milik-tenant-aktif';
```

## 2. Lapisan Aplikasi: Middleware Resolusi Tenant (Next.js)

Aplikasi harus tahu URL mana milik percetakan yang mana.

### Alur Resolusi (Middleware.ts):
1. User mengakses `https://majujayaprint.printpilot.id/login`.
2. Middleware membaca *host* URL (`majujayaprint.printpilot.id`).
3. Middleware memisahkan subdomain (`majujayaprint`).
4. Sistem melakukan lookup ke memori / tabel `tenants` untuk mencari `slug = majujayaprint`.
5. Jika tidak ketemu: Return 404 Not Found.
6. Jika ketemu (dan status tidak SUSPENDED):
   - Ambil `tenant_id`.
   - Set request header kustom `x-tenant-id = <uuid>`.
7. Auth Session (NextAuth) juga mengunci payload jwt dengan klaim `tenant_id`.
8. API Endpoints hanya boleh memproses request jika `session.tenant_id == request.header.x-tenant-id`.

## 3. Isolasi API Pihak Ketiga (WhatsApp)

WhatsApp API token tidak boleh hardcoded global karena setiap percetakan mungkin ingin menggunakan nomor WA mereka masing-masing.
- Tabel `tenants` menyimpan `wa_api_key`.
- Key ini **wajib dienkripsi** (misalnya menggunakan fungsi enkripsi Node.js Crypto + MASTER_KEY sistem) saat disimpan di DB, dan didekripsi di memori saat *background job* berjalan.

## 4. Isolasi Sesi di Custom Domain (Enterprise)

Paket Enterprise (lihat `13-SAAS/SAAS-MODEL.md`) mengizinkan tenant memakai domain sendiri (contoh: `sistem.namatoko.com`) alih-alih subdomain `*.printpilot.id`. Ini menambah risiko baru karena cookie sesi tidak otomatis mengikuti domain custom.

- **Setup domain:** Tenant mengarahkan CNAME domain mereka ke endpoint Print Pilot. Sistem memverifikasi kepemilikan domain (TXT record) sebelum mengaktifkannya, lalu menerbitkan sertifikat SSL otomatis (mis. Let's Encrypt via edge/reverse proxy) — domain tidak aktif melayani trafik sebelum SSL terbit.
- **Cookie scoping:** Cookie sesi NextAuth **tidak** boleh di-set dengan `Domain=.printpilot.id` untuk tenant custom domain — harus di-scope ke domain custom itu sendiri (`Domain=sistem.namatoko.com`), supaya sesi tenant A dengan custom domain tidak pernah bisa terbaca di konteks `*.printpilot.id` atau domain custom tenant lain.
- **Resolusi tenant tetap sama:** Middleware (Section 2) tetap melakukan lookup tenant berdasarkan *host* header, hanya saja untuk custom domain, lookup dilakukan ke kolom `custom_domain` di tabel `tenants`, bukan `slug`.
- **Larangan cross-domain session sharing:** Owner yang login di `sistem.namatoko.com` tidak boleh otomatis punya sesi valid di `majujayaprint.printpilot.id` (subdomain default mereka), dan sebaliknya — treat sebagai dua origin terpisah.
