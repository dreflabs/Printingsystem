# Audit Registrasi, Level Layanan SaaS, Trial, dan Payment Gateway

Tanggal audit: 16 September 2026
Status: audit dokumentasi, implementasi, dan rancangan rollout beta → live.
Keputusan produk: fitur verifikasi email disimpan, tetapi belum diwajibkan selama beta/trial.

## 1. Kesimpulan eksekutif

Print Pilot sudah memiliki fondasi SaaS yang cukup untuk uji coba terkontrol:

- self-serve signup untuk Starter dan Pro;
- Enterprise melalui jalur Sales;
- `SubscriptionPlan`, `TenantSubscription`, dan `Invoice`;
- pembatasan user dan order per bulan;
- panel Super Admin untuk katalog paket dan invoice;
- cron penerbitan invoice internal;
- lifecycle tenant dan pengarsipan.

Billing gateway belum boleh dianggap siap live. Belum ada checkout tenant, route webhook gateway, tabel event webhook yang idempotent, rekonsiliasi settlement, atau state pembayaran subscription yang terpisah dari status tenant.

Rekomendasi rollout: **beta tanpa gateway dan tanpa verifikasi email wajib**, memakai invoice simulasi/internal. Setelah paket dan trial diseragamkan, baru aktifkan checkout sandbox, webhook, dan kemudian production.

## 2. Audit registrasi dan verifikasi email

### Yang sudah ada

- `registerTenant()` membuat Tenant, owner, subscription trial, onboarding, dan starter material dalam satu transaksi.
- Paket dari query string hanya menerima `starter` atau `pro`; nilai lain kembali ke Starter. Enterprise tidak dibuat melalui self-serve.
- Password memakai kebijakan terpusat.
- `User.email_verified_at`, `EmailVerificationToken`, route `/verify-email`, token hash, TTL, single-use, dan resend sudah tersedia sebagai fitur tersimpan.
- Login menolak user dengan `email_verified_at` null ketika gate digunakan.

### Kebijakan beta yang disetujui

Gate verifikasi sekarang hanya aktif jika:

```env
REQUIRE_EMAIL_VERIFICATION=true
```

Jika variabel kosong atau `false`, registrasi langsung dapat dipakai. Ini sesuai fase uji coba dan mencegah provider email yang belum dikonfigurasi menghambat testing.

### Risiko yang tetap perlu dicatat

- Provider email belum menjadi dependency wajib pada beta; pengujian email delivery belum menjadi acceptance criterion.
- Onboarding lama masih menyebut trial 7 hari, sedangkan kode `TRIAL_DAYS` dan model SaaS memakai 14 hari.
- Saat gate diaktifkan, perlu menguji domain pengirim, bounce, token kadaluarsa, resend, dan login paralel.
- Verifikasi email belum menjadi status lifecycle Tenant tersendiri; `Tenant.status` tetap `TRIAL`. Ini masih dapat diterima untuk beta, tetapi release sebaiknya memakai state `PENDING_VERIFICATION` atau flag onboarding yang eksplisit.

## 3. Level layanan SaaS dan sinkronisasi

### Katalog bisnis saat ini

| Paket | Harga | Batas | Posisi bisnis |
|---|---:|---|---|
| Starter | Rp299.000/bulan | 5 user, 200 order/bulan | Percetakan kecil/copy center |
| Pro | Rp599.000/bulan | 15 user, order tidak dibatasi | Percetakan berkembang dengan QC, gudang, dan audit |
| Enterprise | Custom, dokumen menyebut mulai Rp1.500.000+ | Unlimited, multi-cabang | Franchise/pabrik, kontrak Sales |

Katalog ini konsisten antara `SAAS-MODEL.md`, landing page, dan `PLAN_CATALOG` untuk Starter/Pro. Enterprise memang tidak self-serve.

### Sinkronisasi yang sudah benar

- Harga Starter/Pro sama di register, landing page, dan seed.
- `max_users` dan `max_orders_per_month` dipakai oleh entitlement server.
- Subscription aktif dipakai untuk membaca fitur paket.
- Admin platform dapat membuat/mengubah katalog `SubscriptionPlan`.
- Perubahan paket tenant memperbarui `Tenant.plan` dan `TenantSubscription` dalam satu transaksi.

### Gap sinkronisasi yang ditemukan

**P1 — Trial tidak konsisten di dokumen.** `register.ts` memakai 14 hari, `SAAS-MODEL.md` memakai 14 hari, tetapi `BILLING.md` dan `TENANT-ONBOARDING.md` masih menyebut 7 hari. Ini dapat menyebabkan salah komunikasi tanggal invoice dan kebijakan churn.

**P1 — Entitlement belum menutup seluruh fitur yang dijanjikan.** Server hanya menegakkan beberapa feature key, terutama storage dan audit. Dokumen Starter menyebut QR produksi, QC, dan gudang terkunci, tetapi tidak semua route/modul memiliki `requireEntitlement()` yang sesuai. Landing page juga menyebut “1 lokasi finishing” dan “multi-lokasi”, sedangkan model paket belum memiliki limit lokasi.

**P1 — Ada dua sumber kebenaran paket.** `Tenant.plan` dipakai untuk label/gate legacy, sedangkan `TenantSubscription` dipakai untuk feature entitlement. Keduanya bisa berbeda jika ada import/manual update atau kegagalan integrasi gateway.

**Status diperbaiki — satu subscription ACTIVE.** Audit awal menemukan risiko ini, tetapi migrasi `20260905000000_tenant_subscription_single_active` sudah membuat partial unique index `TenantSubscription_tenant_id_active_unique` dan membersihkan duplikat lama. Tetap perlu dipertahankan pada deployment dan diuji saat pergantian paket bersamaan.

**P2 — Plan inactive masih dapat menjadi entitlement.** Query entitlement hanya memfilter `TenantSubscription.status = ACTIVE`, tidak memeriksa `SubscriptionPlan.active`.

**P2 — Fitur, kuota, dan harga disimpan sebagai JSON/string bebas.** Ini cukup untuk beta, tetapi rawan typo feature key, perbedaan nama plan, dan perubahan harga tanpa versioning saat live.

**P2 — Tahunan dan prorata belum terwakili schema.** Dokumen menjanjikan paket tahunan diskon 10+2 dan prorata upgrade, tetapi model hanya memiliki `price_monthly`, `started_at`, `ends_at`; belum ada billing interval, effective date, credit, atau invoice line.

## 4. Audit proses subscription dan billing saat ini

### Yang sudah ada

- `SubscriptionPlan`: katalog nama, slug, harga, limit, feature JSON.
- `TenantSubscription`: relasi tenant → plan dan status.
- `Invoice`: nomor, nominal, status, jatuh tempo, metode, reference.
- `/api/jobs/billing`: generate invoice bulanan secara terjadwal.
- Panel platform: list, generate, mark paid, waive, dan metrik invoice.
- Tenant lifecycle: trial/churn/purge dan pelepasan slug.

### Gap proses bisnis

**P1 — Tidak ada checkout tenant.** Belum ada halaman `/billing` untuk Owner memilih paket, melihat invoice, dan memulai pembayaran.

**P1 — Tidak ada endpoint gateway webhook.** Tidak ditemukan `/api/billing/webhook`, verifikasi signature, penyimpanan raw payload, atau rekonsiliasi status dari gateway.

**P1 — Belum ada idempotensi invoice.** `generateInvoicesForPeriod()` memeriksa invoice yang ada lalu membuat baris baru, tetapi tidak ada unique key `(tenant_id, billing_period)` atau event idempotency. Dua cron bersamaan berpotensi membuat dua invoice.

**P1 — Invoice belum memiliki periode billing formal.** `Invoice` hanya memiliki `due_date`; belum ada `period_start`, `period_end`, `currency`, `external_order_id`, `gateway_transaction_id`, atau `idempotency_key`.

**P1 — Trial tidak masuk alur invoice seperti dokumen.** Generator invoice hanya mencari tenant `ACTIVE` dengan subscription `ACTIVE`, sedangkan tenant baru berstatus `TRIAL`. Dokumen menyatakan hari terakhir trial menghasilkan invoice dan grace period.

**P1 — Lifecycle trial tidak sesuai grace period dokumen.** Cron saat ini langsung menunggu trial melewati `TRIAL_GRACE_DAYS = 14` untuk churn. Tidak ada state invoice overdue → grace period 3 hari → suspended yang terhubung dengan pembayaran.

**P2 — Status pembayaran subscription bercampur dengan status tenant.** `TRIAL`, `ACTIVE`, `SUSPENDED`, dan `CHURNED` adalah lifecycle akses; status invoice `PENDING/PAID/FAILED/WAIVED` adalah uang. Model membutuhkan `payment_state` atau subscription billing state yang terpisah.

**P2 — Mark paid manual masih menjadi jalur utama.** Ini cocok untuk beta/internal, tetapi harus diberi label “simulasi/manual” agar tidak disalahartikan sebagai rekonsiliasi gateway.

**P2 — Belum ada retry dan dunning otomatis.** Dokumen menyebut H-7, H-0, H+3, tetapi belum ada job yang mengirim reminder, menandai past due, atau melakukan retry berdasarkan provider.

## 5. Rekomendasi model paket profesional

Gunakan tiga tier tetap:

1. **Starter** — entry level untuk toko kecil; batasi user/order, tetapi tetap berikan alur order dan POS inti.
2. **Pro** — monetisasi workflow yang memberi dampak operasional: QC, gudang, production tracking, audit trail, dan kuota lebih besar.
3. **Enterprise** — jangan dipaksakan menjadi self-serve; gunakan kontrak, multi-outlet, SLA, API, dan billing manual/term invoice.

Tetapkan satu katalog sumber kebenaran:

- `SubscriptionPlan` menyimpan harga, interval, limit, feature key, active, dan version.
- `TenantSubscription` menyimpan satu subscription aktif saja, effective period, billing interval, gateway customer/subscription ID.
- `Invoice` menyimpan periode, status uang, gateway IDs, amount, tax, credit, dan reconciliation state.
- UI landing, register, dan platform membaca katalog yang sama atau generated config; jangan menyalin angka manual di banyak file.

## 6. Rekomendasi proses bisnis beta/trial

Selama uji coba:

1. Owner mendaftar Starter/Pro.
2. Tenant dibuat `TRIAL` 14 hari.
3. Tidak ada kartu dan tidak ada gateway.
4. Super Admin dapat melihat usage dan invoice simulasi.
5. Reminder cukup berupa banner internal, bukan penagihan uang.
6. Tenant tidak boleh otomatis disuspend hanya karena gateway belum aktif.
7. Data trial harus dapat dipertahankan untuk migrasi ke paket berbayar.

Sebelum live:

1. Selaraskan seluruh dokumen menjadi trial 14 hari.
2. Tambahkan `/billing` untuk Owner.
3. Tambahkan `BillingWebhookEvent` dengan unique provider event/order ID.
4. Tambahkan unique partial index satu subscription ACTIVE per tenant.
5. Pisahkan `Tenant.status` dan `SubscriptionBillingState`.
6. Implementasikan checkout sandbox dan test webhook duplicate/out-of-order.
7. Baru aktifkan gateway production.

## 7. Rekomendasi payment gateway

### Pilihan awal: Midtrans Snap

Midtrans cocok sebagai gateway pertama untuk checkout SaaS Indonesia karena alur Snap dan metode pembayaran lokal sudah sesuai kebutuhan. Signature notification diverifikasi dengan SHA-512 dari `order_id + status_code + gross_amount + ServerKey`, sehingga implementasi webhook harus memverifikasi signature sebelum mengubah invoice. Midtrans juga memiliki Subscription API dan menyatakan dukungan idempotency key saat membuat subscription. Lihat [Midtrans webhook notification](https://docs.midtrans.com/docs/https-notification-webhooks) dan [Midtrans Create Subscription](https://docs.midtrans.com/reference/create-subscription).

### Alternatif jika recurring auto-debit menjadi prioritas: Xendit

Xendit Subscriptions menyediakan event plan/cycle seperti activated, retrying, succeeded, failed, dan force attempt failed. Ini lebih dekat dengan kebutuhan recurring dan dunning, tetapi harus dipastikan channel merchant-initiated transaction yang tersedia untuk akun bisnis. Lihat [Xendit How subscriptions work](https://docs.xendit.co/docs/how-subscriptions-work) dan [Subscription webhook](https://docs.xendit.co/apidocs/subscription-webhook).

### Alternatif kontrak/kartu: Duitku

Duitku memiliki alur subscription berbasis callback dan status change, tetapi dokumentasinya menekankan recurring kartu kredit. Ini lebih cocok sebagai opsi tambahan setelah kebutuhan channel dan kontrak komersial dipastikan, bukan gateway pertama.

## 8. Flow gateway yang direkomendasikan

```text
Owner pilih paket
  → buat Invoice PENDING + idempotency key
  → server membuat checkout gateway
  → redirect/payment page
  → gateway webhook masuk
  → verifikasi signature + timestamp + nominal + tenant
  → simpan BillingWebhookEvent unik
  → transaksi atomic: invoice PAID + subscription period + tenant access
  → kirim receipt
  → webhook duplikat/out-of-order hanya menghasilkan 200 tanpa efek ganda
```

Aturan wajib:

- Browser tidak boleh menentukan nominal final.
- Webhook tidak boleh dipercaya hanya karena status `settlement`; nominal, currency, invoice, dan tenant harus cocok.
- Event webhook disimpan sebelum efek bisnis dan diproses idempotent.
- Payment success harus memperpanjang periode tepat satu kali.
- Refund gateway tidak otomatis menghapus data tenant; ia mengubah invoice/subscription state sesuai kebijakan.
- Semua perubahan akses dan uang masuk audit platform.

## 9. Urutan pekerjaan bertahap

### Tahap A — sekarang, beta

- Pertahankan verifikasi email sebagai opt-in.
- Bekukan katalog Starter/Pro/Enterprise dan tetapkan trial 14 hari.
- Tandai invoice manual sebagai simulasi.
- Perbaiki dokumen 7 hari menjadi 14 hari.
- Tambahkan acceptance test entitlement Starter vs Pro.

### Tahap B — sebelum sandbox gateway

- Tambahkan billing period dan unique invoice key.
- Tambahkan `BillingWebhookEvent`.
- Pisahkan payment state dari tenant lifecycle.
- Buat halaman Owner billing dan checkout abstraction.
- Implementasikan upgrade/downgrade effective date.

### Tahap C — sandbox

- Integrasi Midtrans Snap sandbox.
- Uji paid, pending, expire, deny, duplicate, out-of-order, nominal mismatch, dan signature invalid.
- Uji concurrent webhook dan retry job.
- Uji suspend/grace period serta pemulihan setelah bayar.

### Tahap D — production

- Isi credential gateway di Coolify secret.
- Set webhook HTTPS publik.
- Aktifkan `REQUIRE_EMAIL_VERIFICATION=true` jika provider email sudah siap.
- Jalankan pilot dengan beberapa tenant terlebih dahulu.
- Pantau reconciliation harian dan alert invoice overdue/webhook gagal.

## 10. Keputusan yang perlu dikunci sebelum live

1. Trial resmi: rekomendasi **14 hari**.
2. Gateway pertama: rekomendasi **Midtrans Snap**.
3. Recurring otomatis: aktifkan hanya jika channel dan perjanjian merchant-initiated sudah disetujui; jika belum, gunakan invoice bulanan + payment link.
4. Grace period: rekomendasi 3 hari setelah jatuh tempo.
5. Downgrade: efektif periode berikutnya, tidak memutus job aktif.
6. Enterprise: kontrak manual dan invoice term, bukan self-serve.
7. Verifikasi email: aktif saat product release, bukan selama beta.

## 11. Implementasi Tahap A setelah audit

Perubahan tahap beta yang sudah diterapkan secara lokal:

- Katalog self-serve Starter dan Pro dipindahkan ke satu sumber bersama di `src/lib/saas-catalog.ts`; landing page, register, dan pembuatan subscription memakai harga yang sama.
- `TRIAL_DAYS` ditetapkan satu kali sebagai 14 hari.
- Entitlement tidak lagi memakai fitur dari `SubscriptionPlan` yang sudah nonaktif; paket legacy menjadi fallback aman.
- `BILLING_GATEWAY_ENABLED=false` ditambahkan sebagai penanda eksplisit bahwa billing beta masih manual/simulasi.
- Dokumen billing dan onboarding diselaraskan dari 7 hari menjadi 14 hari.
- Dokumen onboarding menjelaskan bahwa verifikasi email bersifat opt-in pada beta dan wajib hanya setelah release.

Validasi tahap ini:

- `npx tsc --noEmit` berhasil.
- ESLint untuk file yang berubah tidak menemukan error; hanya peringatan lama terkait penggunaan `<img>` di halaman register.
- Belum ada gateway, checkout, atau webhook yang diaktifkan oleh perubahan ini.

## 12. Implementasi Tahap B — fondasi billing tanpa gateway

Perubahan berikut sudah disiapkan di schema dan generator invoice:

- `Invoice.billing_period` dengan unique key `(tenant_id, billing_period)` agar satu tenant hanya memiliki satu invoice pada satu periode.
- `period_start`, `period_end`, dan `currency` untuk rekonsiliasi periode yang eksplisit.
- `external_order_id`, `gateway_transaction_id`, dan `idempotency_key` sebagai tempat aman untuk integrasi gateway berikutnya.
- Generator invoice menyimpan idempotency key deterministik dan menangani race `P2002` sebagai skip idempoten.
- Migrasi juga membersihkan kemungkinan invoice periode lama yang duplikat tanpa menghapus histori keuangan.

`npx prisma validate`, `npx prisma generate`, dan TypeScript berhasil. `prisma migrate deploy` belum dapat dijalankan pada sesi ini karena PostgreSQL lokal di `localhost:5432` tidak sedang aktif; migrasi wajib dijalankan setelah database lokal/server tersedia sebelum deploy aplikasi.
