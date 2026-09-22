# Laporan Audit Input Jumlah Stok Masuk

Tanggal audit: 16 September 2026  
Scope: form Catat Stok Masuk, penerimaan Purchase Order, validasi server, presisi satuan material, dan risiko perubahan saldo stok.

## Kesimpulan utama

Pesan browser pada screenshot bukan karena angka `20` salah. Form memakai kombinasi:

- `min="0.000001"`
- `step="0.01"`

HTML menghitung nilai yang valid dari nilai minimum. Karena itu, nilai valid menjadi:

`0.000001 + n × 0.01`

Angka `20` tidak berada tepat pada grid tersebut. Browser lalu menawarkan `19.990001` dan `20.000001`. Ini adalah bug konfigurasi input.

Temuan ini menghambat alur kerja Gudang karena jumlah stok yang normal, seperti 20 roll, tidak dapat langsung disimpan.

## Temuan prioritas

### P1 — Form penerimaan stok menolak angka bulat yang valid

Bukti ada pada [MaterialTab.tsx](/Users/drefan/Projects/PRINT PILOT/frontend/src/app/(dashboard)/finishing/MaterialTab.tsx:229):

`type="number" min="0.000001" step="0.01"`

Dengan konfigurasi tersebut, angka 20 ditolak browser. Pengguna dapat mencoba memasukkan 20.000001 agar lolos, tetapi itu akan mencatat stok yang secara bisnis tidak wajar.

Dampak:

- penerimaan 20 roll, 100 lembar, atau 5 liter terhambat;
- pengguna berpotensi memasukkan angka “hampir sama” untuk melewati validasi;
- saldo stok dapat memiliki pecahan artifisial;
- masalah muncul sebelum server action dijalankan, sehingga pesan server tidak pernah tampil.

### P1 — Bug yang sama ada pada jalur Purchase Order

[PurchaseOrderTab.tsx](/Users/drefan/Projects/PRINT PILOT/frontend/src/app/(dashboard)/finishing/PurchaseOrderTab.tsx:89) memakai kombinasi `min="0.000001" step="0.01"` pada:

- jumlah material saat membuat PO;
- jumlah penerimaan PO.

Jadi perbaikan hanya pada modal Catat Stok Masuk tidak cukup. Tiga field harus diselaraskan agar jalur langsung dan jalur PO menghasilkan aturan yang sama.

### P2 — Server menerima presisi tanpa kebijakan satuan yang eksplisit

[master-data.ts](/Users/drefan/Projects/PRINT PILOT/frontend/src/actions/master-data.ts:697) hanya memeriksa:

- angka finite;
- jumlah lebih besar dari 0.

Tidak ada pemeriksaan jumlah desimal, quantum per satuan, atau batas maksimum. Database menyimpan stok dan movement pada `Decimal(18,6)`, sehingga nilai seperti `20.000001` dapat dianggap sah oleh backend.

Ini membuat UI dan backend memiliki kebijakan yang berbeda: UI bermaksud dua desimal, sedangkan server menerima sampai enam desimal.

### P2 — Presisi `conversion_factor` dan presisi stok belum didokumentasikan sebagai satu kebijakan

Schema Material memakai `conversion_factor Decimal(10,2)`, sedangkan `current_stock` dan `MaterialMovement.quantity_stock_change` memakai enam desimal. Fungsi konsumsi produksi membulatkan hasil konversi ke enam desimal.

Perbedaan ini tidak langsung menyebabkan pesan screenshot, tetapi perlu aturan yang jelas agar:

- penerimaan stok;
- pemakaian produksi;
- waste;
- stock opname;
- dan laporan biaya

menggunakan presisi yang sama.

## Kontrol yang sudah benar

- [receiveMaterialStock()](/Users/drefan/Projects/PRINT PILOT/frontend/src/actions/master-data.ts:697) memakai row lock pada Material sebelum menghitung stok lama dan stok baru.
- Penerimaan dicatat sebagai movement `IN` dengan `before_stock`, `after_stock`, supplier, referensi, harga beli, tanggal, dan petugas.
- [receivePurchaseOrder()](/Users/drefan/Projects/PRINT PILOT/frontend/src/actions/purchase-orders.ts:108) memakai lock pada PO item dan Material serta menolak jumlah melebihi sisa PO.
- Field database memiliki presisi desimal yang cukup untuk saldo stok hasil konversi.
- Permission `material.receive` dan `purchase.receive` sudah dipisahkan dari adjustment stok.

## Rekomendasi desain input

### Pilihan yang saya rekomendasikan

Terapkan helper presisi per material dan gunakan aturan yang sama di semua form:

- nilai minimum UI: `0`;
- jumlah harus lebih besar dari 0 divalidasi di server;
- `step` mengikuti presisi satuan material;
- label menampilkan unit, misalnya `Jumlah masuk (ROLL)`.

Contoh bila kebijakan toko memakai maksimal dua desimal:

- `min="0"`
- `step="0.01"`

Dengan ini angka 20 valid, dan angka 20.01 juga valid.

Jika sistem ingin mendukung hingga enam desimal:

- `min="0"`
- `step="0.000001"`

Jangan memakai `min="0.000001"` bersama step yang lebih besar dari nilai minimum.

### Kebijakan unit yang disarankan

| Jenis satuan | Step awal | Catatan |
|---|---:|---|
| PCS, LEMBAR, RIM | 1 | Gunakan bilangan bulat bila tidak ada penerimaan pecahan |
| ROLL | 0.01 | Mendukung sebagian roll; ubah ke 1 bila toko hanya menerima roll utuh |
| METER, LITER, KG | 0.01 | Naikkan ke 0.001 bila pembelian supplier memerlukannya |
| Custom | mengikuti master material | Wajib disimpan bersama kebijakan presisi |

Aturan ini harus menjadi kebijakan tenant, bukan hanya atribut HTML.

## Validasi server yang wajib ditambahkan

Buat satu helper validasi jumlah stok dan gunakan pada:

- `receiveMaterialStock()`;
- `createPurchaseOrder()`;
- `receivePurchaseOrder()`;
- `adjustMaterialStock()`;
- stock opname;
- pemakaian dan waste produksi.

Helper harus memeriksa:

1. angka finite dan safe;
2. jumlah > 0 untuk penerimaan;
3. tidak lebih dari skala database;
4. sesuai quantum satuan material;
5. tidak menghasilkan nilai negatif;
6. pembulatan dilakukan eksplisit sebelum transaksi.

Server tetap menjadi sumber kebenaran. Validasi browser hanya membantu pengguna.

## Rekomendasi UX

1. Ubah label dari “Jumlah masuk” menjadi “Jumlah masuk (ROLL)” atau unit terpilih.
2. Tampilkan helper text, misalnya “Maksimal 2 angka desimal”.
3. Hindari pesan browser berbahasa Inggris; tampilkan error inline Bahasa Indonesia sebelum submit.
4. Gunakan input yang sama untuk penerimaan langsung dan penerimaan PO.
5. Setelah disimpan, tampilkan ringkasan “Stok 100 → 120 ROLL” agar petugas dapat memverifikasi hasil.
6. Untuk material yang hanya menerima bilangan bulat, gunakan step 1 dan tampilkan “jumlah utuh”.

## Rencana perbaikan bertahap

### Tahap 1 — Perbaikan bug form

1. Ganti konfigurasi `min/step` pada modal stok masuk.
2. Perbaiki dua field pada Purchase Order.
3. Uji angka 1, 20, 20.01, 0.01, dan nilai negatif.
4. Pastikan tombol simpan dapat dijalankan pada browser Chrome, Safari, dan Firefox.

### Tahap 2 — Konsistensi server dan satuan

1. Buat helper presisi material.
2. Terapkan validasi yang sama pada semua action stok.
3. Tambahkan konfigurasi presisi/quantum pada master Material atau kebijakan tenant.
4. Selaraskan `conversion_factor`, stok, movement, opname, dan waste.

### Tahap 3 — Audit dan laporan

1. Tambahkan laporan jumlah masuk per supplier, PO, unit, harga beli, dan tanggal.
2. Tampilkan alert bila penerimaan langsung tidak memiliki referensi invoice/surat jalan.
3. Tandai movement dengan presisi yang tidak sesuai kebijakan lama untuk ditinjau.
4. Tambahkan acceptance test untuk seluruh unit dan kedua jalur penerimaan.

## Acceptance criteria

- Angka 20 pada material ROLL dapat disimpan tanpa pesan browser.
- Nilai yang disimpan menjadi tepat 20, bukan 20.000001.
- Penerimaan 20 melalui modal langsung dan PO menghasilkan aturan yang sama.
- Jumlah melebihi sisa PO ditolak dalam server transaction.
- Jumlah dengan presisi di luar kebijakan unit ditolak dengan pesan Bahasa Indonesia.
- Saldo dan movement menyimpan before/after yang konsisten.
- Dua penerimaan bersamaan tidak menyebabkan lost update.

## Rekomendasi akhir

Perbaikan paling mendesak adalah menyelaraskan `min` dan `step` pada tiga field jumlah. Untuk kebijakan dua desimal, gunakan `min=0` dan `step=0.01`, lalu pertahankan validasi `quantity > 0` di server. Setelah bug form diperbaiki, lanjutkan dengan helper presisi per satuan agar data stok tidak bergantung pada aturan HTML browser.

## Status implementasi

Tahap perbaikan pertama sudah diterapkan:

- tiga field jumlah pada penerimaan langsung dan Purchase Order sekarang memakai `min=0` dan `step=0.01`;
- label penerimaan langsung menampilkan unit material yang dipilih;
- validasi server menormalkan jumlah ke dua angka desimal dan menolak nilai nol, negatif, atau presisi berlebih;
- aturan tersebut digunakan pada penerimaan stok langsung, pembuatan PO, dan penerimaan PO;
- saldo, movement, dan jumlah diterima PO menggunakan nilai yang sudah dinormalisasi.

Validasi yang dijalankan:

- TypeScript (`npx tsc --noEmit`) lulus;
- ESLint pada file terkait lulus;
- uji helper menerima `20`, `20.01`, dan `0.01`, serta menolak `0`, `20.000001`, dan `20.001`;
- production build dengan Webpack lulus. Build Turbopack masih gagal karena keterbatasan worker internal pada lingkungan lokal, bukan karena error kode.

Konfigurasi presisi per satuan material, validasi stock opname/waste, dan acceptance test lintas unit tetap menjadi tahap lanjutan sesuai rekomendasi audit.
