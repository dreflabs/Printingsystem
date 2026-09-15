# Audit Visual Dashboard Print Pilot

**Tanggal audit:** 14 September 2026  
**Ruang lingkup:** design system, warna, tipografi, layout, komponen bersama, dashboard per role, POS, scanner, laporan, responsivitas, aksesibilitas, dan kesesuaian dengan dokumen 08-UI-UX/.  
**Metode:** inspeksi source TSX/CSS, pencocokan dengan dokumen desain, serta pemeriksaan browser pada dashboard Admin desktop (viewport sekitar 1166×846) dengan data seed yang tersedia.

## Penilaian ringkas

Skor keseluruhan saat ini: **6,3/10**.

- **Identitas dan palet: 6/10.** Teal dan warna status mudah dikenali, tetapi implementasi mencampur gaya light, dark, glassmorphism, gradient, dan token yang tidak tersedia.
- **Struktur desktop: 7/10.** Sidebar, header, PageHeader, kartu KPI, panel prioritas, dan tabel Admin membentuk hierarki yang cukup jelas.
- **Konsistensi lintas role: 6/10.** Owner, Admin, Designer, Operator, Gudang, POS, dan Scanner memakai pola spacing, radius, shadow, dan ukuran judul yang berbeda.
- **Responsif: 5,5/10.** Beberapa halaman sudah menyediakan kartu mobile, tetapi ada grid tetap tiga kolom, panel POS dengan tinggi viewport ganda, dan kontrol kecil di layar kerja Operator.
- **Aksesibilitas: 5/10.** Focus ring tersedia pada komponen Button dan banyak input, tetapi banyak kontrol ikon tidak berlabel dan beberapa interaksi berbasis div/tr tidak dapat dijalankan dari keyboard.
- **State loading/error/empty: 7/10.** Operator, Owner, dan beberapa modul sudah memiliki empty/error state; layout utama masih blank saat sesi belum siap.

Tidak ditemukan cacat visual yang membuat seluruh aplikasi tidak dapat dipakai di desktop, tetapi ada beberapa isu P1 yang sebaiknya diperbaiki sebelum aplikasi diposisikan sebagai SaaS percetakan yang profesional.

## Temuan prioritas tinggi

### P1 — Kontrak tema light dan dark bertentangan

Dokumen menetapkan Paper Studio Light, dan token di globals.css memang memakai #F8FAFC, putih, slate, dan teks gelap. Namun root layout memaksa class dark, colorScheme: "dark", dan viewport colorScheme: "dark" (frontend/src/app/layout.tsx:60-70). Blok token dark di globals.css masih dikomentari (frontend/src/app/globals.css:38-51).

Pada browser Admin yang diperiksa, hasil akhirnya terlihat light karena token light masih aktif. Konfigurasi ini tetap berisiko menghasilkan warna native control, scrollbar, date input, select, dan komponen pihak ketiga yang gelap atau berbeda antar browser. Ini juga membuat keputusan desain sulit diprediksi ketika dark mode benar-benar diaktifkan.

**Rekomendasi:** pilih light sebagai tema resmi sekarang: hapus class dark, set colorScheme: "light", dan tambahkan color-scheme: light pada root. Jika dark mode direncanakan, jadikan toggle eksplisit dengan token lengkap dan visual regression terpisah.

### P1 — Token bg-background dipakai tetapi tidak didefinisikan

Design system hanya mendefinisikan bg-base, bg-card, dan bg-elevated (frontend/src/app/globals.css:5-8). Namun bg-background dipakai di POS, bantuan, scanner, PosCartItem, dan NewOrderModal, misalnya frontend/src/app/(dashboard)/pos/page.tsx:581-624, frontend/src/app/(dashboard)/scan/page.tsx:370-460, dan frontend/src/app/(dashboard)/bantuan/page.tsx:154-162.

Class tersebut tidak memiliki pasangan token proyek. Akibatnya surface input/panel dapat jatuh ke background default atau tidak menghasilkan aturan CSS, sehingga kontras antar area berbeda dari yang terlihat pada mockup.

**Rekomendasi:** ganti semua pemakaian menjadi bg-base atau bg-elevated sesuai fungsi. Alternatif aman adalah membuat alias token color-background, tetapi satu nama kanonik tetap lebih mudah dirawat.

### P1 — Komponen Card masih memakai glassmorphism dan shadow gelap

Dokumen meminta kartu flat white dengan shadow-sm, tetapi Card selalu memberi backdrop-blur-xl dan shadow hitam rgba(0,0,0,0.4) (frontend/src/components/ui/Card.tsx:14-20). Pola yang sama diulang pada Scanner dan tab Gudang, sementara halaman lain memakai shadow-sm, shadow-card, shadow-lg, shadow-xl, atau shadow literal.

Pada tema light, shadow 0.4 terlihat terlalu berat, blur membuat panel kurang tajam, dan hierarchy elevation tidak konsisten. Ini paling terasa saat Owner/Scanner/Gudang dibuka berdampingan dengan Admin.

**Rekomendasi:** tetapkan tiga level elevation saja: shadow-card, shadow-popover, dan shadow-modal dari token CSS. Gunakan bg-card opak untuk kartu utama; gunakan transparansi/blur hanya untuk overlay dan header sticky.

### P1 — Grid KPI Designer tidak aman untuk mobile

KPI Designer memakai grid grid-cols-3 tanpa breakpoint (frontend/src/app/(dashboard)/designer/page.tsx:513-526). Pada lebar 360–430px, tiga kartu harus berbagi ruang sempit sehingga angka 36px dan label mudah terpotong.

**Rekomendasi:** gunakan grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 atau grid-cols-2 pada mobile dengan angka lebih kecil. Uji dengan order code dan label terpanjang.

### P1 — POS memiliki nested scroll dan tinggi panel yang berpotensi memotong konten

POS menggunakan h-[calc(100vh-2rem)], overflow-y-auto, panel produk h-[60vh] pada mobile, serta panel keranjang min-h-[50vh] (frontend/src/app/(dashboard)/pos/page.tsx:429-430, 581-644). Pada layar pendek, total tinggi produk dan keranjang melebihi viewport sehingga pengguna harus menggulir dua container; pada desktop panel kanan tetap w-[380px].

**Rekomendasi:** biarkan halaman utama mengikuti tinggi konten pada mobile, gunakan satu scroll container, dan ubah POS menjadi layout bertumpuk dengan keranjang sticky hanya ketika viewport cukup tinggi. Pertahankan lebar kanan berbasis clamp() atau minmax().

### P1 — Data finansial tampil pada alur Scanner yang dapat dipakai Operator

Context hasil scan menampilkan Dibayar dan Sisa Tagihan (frontend/src/app/(dashboard)/scan/page.tsx:283-294). Dokumen Operator menyatakan nominal pembayaran tidak boleh tampil. Walaupun Scanner adalah route bersama, Operator dapat melihat informasi tersebut setelah scan.

**Rekomendasi:** server kirimkan field finansial hanya untuk role Owner/Admin/Designer sesuai kebutuhan; UI Scanner tampilkan status DP terpenuhi/Belum untuk role produksi.

### P1 — Loading dashboard utama menghasilkan layar kosong

DashboardLayout mengembalikan null sebelum getSessionUser selesai (frontend/src/app/(dashboard)/layout.tsx:16-24). Pada jaringan lambat, pengguna melihat halaman kosong tanpa indikator proses.

**Rekomendasi:** tampilkan shell loading yang mempertahankan sidebar/header dan skeleton konten. Jika sesi gagal, tampilkan state error yang punya tombol masuk ulang.

## Temuan konsistensi visual dan produk

### P2 — Ukuran tipografi tidak mengikuti spesifikasi tunggal

Design system menetapkan judul halaman 28px, judul card 18px, KPI 36px, dan body 14px. Implementasi memakai text-2xl (24px) untuk banyak judul, text-3xl pada Bantuan, text-4xl pada KPI Designer, serta KPI Owner/Admin 24–30px. Contohnya admin/page.tsx:897-924, owner/page.tsx:280-327, dan designer/page.tsx:513-525.

**Rekomendasi:** buat komponen PageTitle, SectionTitle, KpiValue, dan MetaText dengan skala tetap. Biarkan tiap role berbeda pada kepadatan informasi, bukan pada ukuran dasar yang tidak terkontrol.

### P2 — Radius dan gaya tombol terlalu beragam

Ada rounded-lg, rounded-xl, rounded-2xl, dan rounded-3xl untuk fungsi yang sama. Komponen Button menggunakan rounded-full (frontend/src/components/ui/Button.tsx:33-43), sementara mayoritas tombol dashboard menggunakan rounded-xl. Designer, Scanner, QC, dan POS juga mengulang gradient teal berbeda-beda.

**Rekomendasi:** gunakan rounded-control untuk input/tombol dan rounded-card untuk panel. Sediakan satu Button bersama untuk primary/secondary/danger; exception hanya untuk kontrol POS yang membutuhkan target besar.

### P2 — Gradient bertentangan dengan keputusan flat-light

Design system mendeskripsikan kartu flat white dan menghapus warna neon, tetapi dokumen juga masih mendeskripsikan tombol primary gradient. Implementasi menggunakan gradient pada Designer, Scanner, QC, Finishing, dan Header/avatar (designer/page.tsx:498-503, scan/page.tsx:243, finishing/QCTab.tsx:213-268, shared/Header.tsx:84).

**Rekomendasi:** putuskan satu aturan merek. Untuk SaaS operasional, solid teal lebih mudah dibaca dan stabil saat dicetak/screenshot. Jika gradient dipertahankan, batasi pada satu tier dan dokumentasikan.

### P2 — Owner memakai surface halaman yang berbeda dari role lain

Root Owner membungkus seluruh isi dengan bg-elevated p-6 rounded-2xl min-h-screen (frontend/src/app/(dashboard)/owner/page.tsx:186), sedangkan Admin, Designer, Operator, Gudang, dan Scanner memakai background layout biasa. Owner terlihat seperti panel besar di dalam panel.

**Rekomendasi:** hapus surface wrapper tersebut, atau jadikan pola layout global yang digunakan semua role.

### P2 — Admin dashboard lebih ringkas daripada dokumen UI

Dokumen Admin mendeskripsikan sebelas KPI serta panel produksi, reassignment, dan QC. Implementasi menampilkan lima KPI (admin/page.tsx:877-884), dua panel ringkas, dan daftar order. Ini gap ekspektasi antara dokumentasi dan tampilan yang perlu diputuskan.

**Rekomendasi:** perbarui dokumen menjadi scope aktual, atau tambahkan widget secara bertahap dengan prioritas operasional.

### P2 — Laporan memakai warna literal sehingga sulit mengikuti tema

Recharts memakai konstanta hex langsung (admin/reports/page.tsx:8-9). Ini valid untuk chart saat ini, tetapi tidak berubah jika token CSS diganti dan tidak memiliki jalur dark/light eksplisit.

**Rekomendasi:** sentralisasi palette chart di satu file token dan sediakan fallback yang selaras dengan tema aktif.

### P2 — Font Inter bergantung pada fetch build

next/font/google dipakai di layout.tsx:3,10-13. Build sebelumnya gagal saat lingkungan tidak dapat mengambil Google Fonts. Fallback font dapat mengubah metrik teks, line wrap, tinggi tombol, dan posisi tabel.

**Rekomendasi:** self-host font Inter (WOFF2) atau sediakan stack fallback Inter, ui-sans-serif, system-ui, sans-serif. Jalankan screenshot regression dengan font fallback juga.

## Audit per dashboard

### Owner

Struktur informasi paling lengkap dan sesuai kebutuhan peran: PageHeader, KPI empat kartu, alert kritis, approval review, pipeline produksi, absensi, dan audit log. Pada desktop, urutan prioritas mudah dipindai dan link KPI memberi affordance yang jelas.

Risiko visualnya adalah kepadatan tinggi saat banyak alert; semua alert ditumpuk dalam satu card panjang. KPI memakai angka 24px meskipun spesifikasi meminta 36px. Root surface Owner berbeda dari layout global. Pada mobile, pipeline enam tahap menggunakan tiga kolom sehingga label panjang berpotensi terpotong.

### Admin

Baseline browser menunjukkan sidebar 240px, header 64px, judul, CTA Scan/POS/Order Baru, KPI lima kartu, panel Siap Diambil/Menunggu Audit, dan tabel order. Hierarki, status pill, deadline merah, dan empty state sudah jelas.

Search dan dua filter hanya mengandalkan placeholder/selected value (admin/page.tsx:982-1001); tambahkan label visual atau aria-label. Tabel delapan kolom padat pada lebar tablet, dan klik baris dilakukan pada tr (admin/page.tsx:1049-1050) sehingga tidak keyboard-accessible. Dokumen menyebut filter tambahan yang belum tampak.

### Designer Sales

Kelebihan: tersedia mode tabel desktop dan kartu mobile (designer/page.tsx:548-610), status desain dan versi dekat dengan aksi, serta data finansial tidak ditampilkan pada list.

Masalah utama: KPI tiga kolom tetap pada mobile, gradient CTA, dan modal dengan shadow literal berat. Aksi Detail pada beberapa baris hanya button teks kecil; target sentuh perlu minimal sekitar 44px.

### Operator

Layout queue/active job, skeleton, empty state, dan tombol Scan QR sesuai konteks produksi. Struktur ini paling dekat dengan dokumen mobile-first.

Dokumen meminta tombol utama minimal 56px, tetapi CTA Scan memakai h-11/44px (operator/page.tsx:613-618) dan beberapa aksi kartu juga 40–44px. Naikkan hanya aksi utama agar cepat disentuh. Pastikan data finansial dari route Scanner disembunyikan.

### Gudang, QC, Finishing, Storage, Material

Penggabungan menjadi empat tab masuk akal untuk satu orang yang mengerjakan banyak tahap. Tab overflow horizontal membantu layar sempit, dan tabel memiliki overflow-x-auto.

Masih ada dua sistem visual: tab utama memakai token flat, sedangkan QCTab, StorageTab, dan MaterialTab memakai bg-card/70, blur, serta shadow hitam literal berulang. Form Material memakai grid dua kolom tanpa selalu memiliki versi satu kolom pada layar sangat sempit. Tombol close di modal hanya ikon.

### POS

Alur kasir cukup jelas: tab Kasir/Riwayat/Stok, katalog, kategori, keranjang, ringkasan, modal pembayaran, dan receipt. CTA Bayar memiliki target besar dan empty cart mudah dipahami.

bg-background yang tidak didefinisikan, nested scroll, dan panel fixed 380px adalah risiko terbesar. Emoji 💵 dan 📱 pada pilihan pembayaran tidak mengikuti bahasa visual ikon Lucide di area lain; pilih ikon konsisten atau label teks saja. Riwayat memakai grid min-w-[700px], sehingga perlu alternatif kartu pada mobile.

### Scanner

Layar Scanner berorientasi tindakan: mode hardware/kamera, input manual, state scanning/error/found, status job, dan aksi lanjutan. Empty/error/success state cukup jelas.

Kartu hasil scan memakai gradient dan shadow gelap, form action memakai bg-background, dan detail finansial muncul untuk route bersama. Banyak input action hanya memiliki placeholder. Tambahkan label, aria-live untuk hasil scan/toast, dan instruksi singkat terkait izin kamera.

### Beranda Solo

Beranda fokus pada WorkQueue dan satu link ke Dashboard lengkap. Lebar max-w-3xl menjaga scanability. Pastikan WorkQueue mempunyai loading, error, dan empty state yang sama dengan dashboard lain agar perpindahan Solo terasa mulus.

### Laporan, Audit Log, Master Data, Bantuan, dan Pengaturan

Halaman laporan memiliki chart responsif, tabel dengan horizontal scroll, export CSV, dan state belum ada data. Audit Log memiliki pencarian, filter entitas, refresh, dan empty state.

Master Data Pelanggan, Produk, Absensi, Payroll, User Management, Toko, dan Attendance Settings memakai pola panel berbeda-beda. Beberapa halaman memakai shadow-card, lainnya shadow-sm, lainnya blur. Search field Pelanggan dan Bantuan belum memiliki label aksesibel. Bantuan memakai hero gradient dan bg-background, sehingga berbeda dari shell operasional.

## Aksesibilitas dan kualitas interaksi

- **Label form:** banyak input pencarian, filter, dan form Scanner hanya mempunyai placeholder. Placeholder bukan pengganti label karena hilang saat pengguna mengetik.
- **Kontrol ikon:** tombol close modal, edit pelanggan, simpan catatan absensi, dan beberapa aksi tabel tidak memiliki aria-label (admin/customers/page.tsx:130-132 adalah contoh).
- **Keyboard:** baris order Admin dan item pickup menggunakan div/tr dengan onClick; ubah menjadi link/button atau tambahkan semantics keyboard.
- **Focus:** komponen Button punya focus ring yang baik (Button.tsx:57-60), tetapi banyak tombol raw hanya mengandalkan perubahan warna hover.
- **Live region:** hasil scan, toast, dan perubahan loading sebaiknya memakai role=status atau aria-live.
- **Warna:** status pill sudah menyertakan label, tetapi KPI yang hanya memakai titik warna perlu label/teks bermakna saat warna tidak terlihat.
- **Target sentuh:** aksi utama Operator, Scanner, dan POS sudah besar; aksi sekunder pada Designer, tabel, dan modal sering 32–40px.

## Roadmap perbaikan

### Gelombang 1 — stabilisasi visual (P1)

1. Tegaskan light theme di root layout dan hilangkan class/color scheme dark yang dipaksa.
2. Ganti atau alias seluruh bg-background; pilih token kanonik.
3. Normalisasi Card, modal, header, tab, dan panel Gudang ke token elevation light; hilangkan shadow literal hitam 0.4–0.6.
4. Perbaiki grid KPI Designer dan layout POS pada 360/390/430px.
5. Saring field finansial Scanner berdasarkan role produksi.
6. Ganti blank loading layout dengan shell/skeleton dan error state.

### Gelombang 2 — sistem komponen dan aksesibilitas (P2)

1. Buat utility PageTitle, SectionTitle, KPI, field berlabel, dan table mobile.
2. Tambahkan label/aria-label, focus ring, aria-live, dan keyboard semantics pada seluruh dashboard.
3. Satukan radius, ukuran kontrol, dan tombol primary/secondary/danger.
4. Self-host Inter dan uji layout dengan fallback font.
5. Pindahkan palette chart ke token terpusat.

### Gelombang 3 — verifikasi profesional (P2/P3)

1. Buat screenshot regression untuk Admin, Owner, Designer, Operator, Gudang, POS, dan Scanner pada 360, 768, 1024, dan 1440px.
2. Uji kontras WCAG AA untuk teks muted, amber, teal, tabel, dan tooltip.
3. Cocokkan kembali setiap dokumen 08-UI-UX/ dengan UI aktual; tandai fitur yang belum diimplementasikan.
4. Tambahkan checklist review visual ke Definition of Done: loading, empty, error, focus, keyboard, overflow, long text, dan data padat.

## Status implementasi Gelombang 1

Perubahan berikut sudah diterapkan setelah audit disetujui:

- Root layout dikunci ke `colorScheme: light` dan class `dark` yang dipaksa dihapus.
- Semua pemakaian `bg-background` pada dashboard, POS, Scanner, Bantuan, keranjang, dan modal order diganti dengan token surface yang tersedia.
- Komponen `Card` memakai surface opak dan `shadow-card` yang ringan, tanpa shadow hitam glassmorphism.
- KPI Designer memakai breakpoint mobile dan ukuran angka yang menyesuaikan layar.
- Layout POS tidak lagi memaksa tinggi viewport tetap pada mobile; panel produk memakai tinggi minimum yang dapat mengalir bersama halaman.
- Nominal pembayaran Scanner hanya dikirim dan ditampilkan ketika actor memiliki permission `payment.view_detail`.
- Dashboard shell menampilkan indikator loading yang dapat dibaca screen reader, bukan layar kosong.
- Search/filter utama Admin, Designer, POS, Pelanggan, Audit Log, dan Scanner diberi `aria-label`.

## Status implementasi Gelombang 2

Perbaikan aksesibilitas dan interaksi dasar sudah diterapkan:

- Baris order Admin pada kartu pickup, tampilan mobile, dan tabel desktop sekarang dapat difokuskan dengan Tab serta dibuka dengan Enter atau Space.
- Tombol ikon pada modal dan aksi penting (tutup, edit pelanggan, refresh, simpan/batal catatan, kontrol kuantitas POS, pemindai QR, dan kamera absensi) diberi `aria-label` yang spesifik.
- Label aksesibel juga ditambahkan pada pengaturan akun, tombol keluar sidebar, pengelolaan gaji Owner, aksi produk, kapasitas Storage, order baru, PIN, serta panel platform.
- Error Scanner menjadi `role="alert"` dengan `aria-live="assertive"`, sedangkan hasil berhasil dan loading dashboard memakai live region yang sesuai.
- Fokus keyboard global memakai outline teal dengan offset agar tetap terlihat pada surface terang.

Validasi pasca perubahan:

- `npx tsc --noEmit --pretty false` — **lulus**.
- ESLint pada file inti yang disentuh — **lulus tanpa error**; pemeriksaan lint pada modul lama yang ikut tersentuh masih melaporkan error `any` dan hook yang sudah ada sebelum audit ini.
- `git diff --check` — **lulus**.
- Tidak ada perubahan pada data, migrasi database, atau alur transaksi.

## Status implementasi Gelombang 3 (visual consistency)

Normalisasi surface dan elevation diterapkan pada komponen yang paling sering dipakai:

- Panel Designer, Scanner, POS, Finishing/QC/Material/Storage, dan absensi memakai `bg-card` opak serta `shadow-card`.
- Modal produk, PIN, POS, Designer, dan QC memakai token `shadow-modal`.
- Toast memakai `shadow-popover`; sidebar dan header memakai surface solid dengan `shadow-card`.
- CTA material menggunakan warna primary teal tanpa gradient khusus, sehingga hierarki tombol antar-role lebih konsisten.
- Halaman login ikut memakai surface dan elevation light yang sama.

Validasi runtime:

- Browser berhasil memuat ulang `/admin` setelah perubahan dan menerima respons `GET /admin 200` dari server lokal.
- AX tree tetap menampilkan navigasi, filter berlabel, dan baris order sebagai row yang dapat difokuskan.

## Regression check lintas role

Smoke check browser pada server lokal berhasil untuk route utama berikut:

- `/admin` — KPI, filter order, tabel, dan row detail termuat.
- `/pos` — tab kasir/riwayat/stok, pencarian produk, pelanggan, keranjang, dan tombol bayar termuat.
- `/designer` — KPI, pencarian antrian, dan tabel desain termuat.
- `/operator` — queue produksi, riwayat pekerjaan, dan link Scan QR termuat.
- `/finishing` — tab QC/Finishing/Storage/Material, queue QC, dan aksi inspeksi termuat.
- `/scan` — mode hardware/kamera, input manual berlabel, dan state siap scan termuat.

Tidak ditemukan error render pada smoke check tersebut. Data dan alur transaksi tidak disentuh selama regression check.

## Kesimpulan audit

Print Pilot sudah memiliki fondasi visual yang layak: palet teal/status cocok untuk operasi percetakan, navigasi role jelas, status order mudah dipindai, dan beberapa layar sudah memperhatikan mobile. Kualitas profesional belum konsisten karena tema root bertentangan, token warna tidak lengkap, elevation terlalu berat, serta beberapa dashboard belum mengikuti breakpoint dan aturan aksesibilitas yang sama.

Enam item Gelombang 1 dan fondasi aksesibilitas Gelombang 2 sudah selesai. Tahap berikutnya adalah menyatukan komponen visual yang berulang, self-host font, memusatkan palette chart, lalu menjalankan screenshot regression pada seluruh role dengan data ekstrem.
