# IMPLEMENTASI FRONTEND (RERE)

Dokumen ini merinci tugas dan arsitektur untuk pengembangan sisi **Frontend (UI/UX)** dari aplikasi PrintFlow. Seluruh antarmuka aplikasi akan menggunakan Next.js 14 App Router dengan Tailwind CSS, dibangun berdasarkan pedoman desain yang ada di `08-UI-UX/DESIGN-SYSTEM.md`.

---

## 🎨 Teritori Kerja (Folder)
Sebagai spesialis Frontend, fokus kerja Anda berada secara eksklusif pada folder berikut:
- `src/app/` (Khusus untuk Layout dan Halaman Client)
- `src/components/` (Semua komponen UI yang dapat digunakan ulang)
- `public/` (Untuk aset statis seperti logo atau gambar)

---

## 📍 Tahap 1: Persiapan UI Library (Sprint 1)
Sebelum menyusun halaman yang rumit, bangunlah fondasi komponen (*design system*) Anda.
1. **Tema Tailwind:** Konfigurasi warna, tipografi, dan *spacing* di `tailwind.config.ts`.
2. **Komponen Inti (`src/components/ui/`):**
   - `<Button>` (berbagai ukuran dan varian: primary, secondary, danger)
   - `<Input>` dan `<Select>` (untuk form dasar)
   - `<Card>` (sebagai wadah untuk widget dashboard)
   - `<StatusPill>` (dengan warna dinamis berdasarkan prop status: GREEN, YELLOW, RED, dll)
3. **Layout Dinamis (`src/components/shared/`):**
   - `<Sidebar>` (Menu navigasi yang bisa dikondisikan sesuai role user)
   - `<Header>` (Bagian atas yang menampilkan informasi nama/role dan tombol Logout)

---

## 📍 Tahap 2: Perakitan Halaman (Sprint 2-3)
Setelah komponen siap, rangkailah menjadi halaman fungsional.
1. **Modul Login (`src/app/(auth)/login/page.tsx`):**
   - Halaman statis awal untuk *username* dan *password*.
2. **Dashboard Admin Sales (`src/app/(dashboard)/admin/page.tsx`):**
   - Ubah `08-UI-UX/ADMIN-DASHBOARD.md` menjadi kode React.
   - Siapkan UI untuk modal "Tambah Order" dan "Panel Final Audit".
3. **Modul POS/Kasir:**
   - Rancang halaman kasir cepat (Direct Sales) dengan keranjang belanja.
4. **Halaman Operator & QC (`src/app/(dashboard)/scan/[id]/page.tsx`):**
   - Desain antar-muka *mobile-first* yang besar agar mudah diklik oleh staf di pabrik.
   - Integrasikan *library* scanner QR HTML5 ke dalam antarmuka.

---

## 🔗 Cara Menghubungkan UI dengan Backend Drefan
Anda tidak perlu menulis *query* database. Cukup fokus ke penyajian data.
1. **Mengambil Data (GET):** Anda akan menerima data (seperti `orders` atau `products`) melalui tipe *Props* yang sudah didefinisikan oleh Drefan. Anda tinggal melakukan iterasi (`map`) untuk menampilkannya ke tabel.
2. **Mengirim Data (POST/PUT):** Gunakan fungsi *Server Action* yang dibuat Drefan. Contoh: `<form action={processOrderAction}>`.

*Git Workflow:* Selalu gunakan penamaan *branch* dengan awalan `ui/` (contoh: `ui/admin-dashboard`) agar kode Anda tidak bertabrakan dengan Drefan.
