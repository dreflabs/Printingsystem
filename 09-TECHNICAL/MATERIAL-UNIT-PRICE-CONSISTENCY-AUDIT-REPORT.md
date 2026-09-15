# Audit Satuan Material, Satuan Harga, dan Satuan Produksi

**Tanggal audit:** 16 September 2026  
**Tenant yang diperiksa:** `duniapercetakan`  
**Ruang lingkup:** master material, harga katalog, material per produk, stok masuk, purchase order, pemakaian produksi, konversi, dan dokumentasi.

## Kesimpulan eksekutif

Print Pilot sudah memiliki pemisahan konsep yang benar antara:

- **satuan stok/gudang**: satuan barang dibeli dan disimpan;
- **satuan pemakaian**: satuan yang diinput operator saat produksi;
- **satuan harga jual**: dasar tarif produk kepada konsumen; dan
- **faktor konversi**: hubungan pemakaian dengan stok.

Namun implementasinya belum konsisten untuk semua jenis produk. Konversi stok material sudah berjalan dengan pola `pemakaian ÷ faktor konversi`, tetapi perhitungan harga order hanya memperlakukan `M2` secara khusus. Produk dengan satuan harga `METER`, `LEMBAR`, atau `RIM` saat ini jatuh ke perilaku seperti `PCS`. Label form juga belum selalu menyebut unit yang menjadi dasar nominal.

**Penilaian keseluruhan: 6/10 — fondasi baik, belum siap untuk operasi campuran unit tanpa perbaikan.**

- **Stok dan konversi:** relevan untuk contoh Roll→Meter, Rim→Lembar, Liter→mL, dan Kg→Gram.
- **Harga jual:** benar untuk produk berbasis m² seperti Banner, belum lengkap untuk Meter/Lembar/Rim.
- **Harga beli dan standard cost:** secara konsep per unit stok, tetapi basisnya belum terlihat jelas di UI dan kebijakan costing belum ditetapkan.
- **Data saat ini:** terdapat material duplikat/konfigurasi mencurigakan serta fixture QA yang masih aktif.

## Data yang diperiksa

Tenant lokal memiliki dua produk: `Banner` aktif dengan harga dasar **Rp20.000/m²** dan `Cetak Banner Outdoor` nonaktif. `Banner` memiliki tiga material utama yang sudah terhubung:

| Material | Unit stok | Unit pemakaian | Faktor | Standard cost | Tarif jual per material | Penilaian |
|---|---:|---:|---:|---:|---:|---|
| Flexi China 280 gr | ROLL | METER | 50 | Rp12.000/roll | Rp15.000/m² | Konsep benar bila satu roll berisi 50 meter; lebar roll belum menjadi field terstruktur |
| Flexi China 350 gr | ROLL | METER | 50 | Rp14.500/roll | Rp18.000/m² | Sama; perlu verifikasi panjang fisik per roll |
| Flexi China 400 gr | ROLL | METER | 50 | Rp17.000/roll | Rp22.000/m² | Sama; stok saat ini 0 dan berada di bawah minimum |
| Sticker Vinyl | ROLL | METER | 50 | Rp22.000/roll | Belum terhubung ke Banner | Konversi masuk akal; harus dipetakan ke produk Sticker |
| Art Paper | RIM | LEMBAR | 500 | Rp650.000/rim | Belum terhubung | Konversi standar; perlu penguncian ukuran rim sesuai supplier |
| Tinta Eco Solvent | LITER | ML | 1.000 | Rp350.000/liter | Tidak dijual sebagai material utama | Konversi benar untuk consumable mesin |
| Flexi China (MAT-0010) | ROLL | METER | **1** | Rp50.000/roll | Tidak terhubung | Konfigurasi tidak konsisten dengan tiga Flexi lain; review/deaktivasi diperlukan |

Masih ada tiga material `QA-UNIT-*` dengan status aktif (`PAKET`, `KG`, `PCS`). Material tersebut berguna untuk pengujian, tetapi tidak boleh aktif di tenant produksi.

## Model unit yang berlaku di kode

1. `Material.unit_stock` menyimpan unit saldo gudang (`ROLL`, `RIM`, `LITER`, dan sebagainya).
2. `Material.unit_usage` menyimpan unit pemakaian operator (`METER`, `LEMBAR`, `ML`, `GRAM`, `PCS`).
3. `Material.conversion_factor` dipakai di `stockUsage()` untuk mengubah pemakaian menjadi pengurangan stok. Contoh 6 meter dengan faktor 50 menjadi 0,12 roll.
4. `Product.unit` dan `ProductMaterial.unit_price` menjadi dasar tarif penjualan. Produk Banner memakai `M2`, sehingga luas dihitung dari lebar dan tinggi dalam cm lalu dikalikan tarif per m².
5. `Material.standard_cost` serta `MaterialMovement.unit_cost` tidak mempunyai kolom unit biaya terpisah. Dalam workflow, keduanya secara implisit berarti **per unit stok**.

## Temuan audit

### P1 — Satuan harga produk selain M2 belum dihitung sesuai unit

`PRINTING_UNITS` mengizinkan `PCS`, `M2`, `METER`, `LEMBAR`, dan `RIM`. Akan tetapi `createPrintingOrder()` dan `autoItemPrice()` hanya memiliki cabang khusus untuk `M2`; semua unit lain memakai tarif dasar dikali `quantity` seolah-olah quantity selalu pcs. Form juga menampilkan label umum `Qty (pcs)`.

**Dampak:** produk berbasis meter, lembar, atau rim dapat ditagih salah. Misalnya produk `METER` dengan tarif Rp8.000/m dan quantity 10 harus menjadi Rp80.000, sedangkan alur sekarang berisiko memperlakukan quantity sebagai pcs tanpa basis pengukuran yang jelas. Harga yang terlihat benar pada Banner tidak membuktikan unit lain aman.

**Bukti:** [orders.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/actions/orders.ts:228), [NewOrderModal.tsx](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/components/orders/NewOrderModal.tsx:87), [catalog-constants.ts](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/lib/catalog-constants.ts:1).

### P1 — Biaya material dan harga jual memakai basis yang berbeda tetapi tidak dinyatakan eksplisit

Harga jual Banner adalah per m², sedangkan standard cost Flexi adalah per roll. Itu dapat menjadi desain yang benar, tetapi sistem belum menyimpan atau menampilkan `price_basis`/`cost_basis` secara eksplisit. Akibatnya pengguna dapat memasukkan Rp12.000 sebagai per meter padahal maksudnya per roll, atau menafsirkan `Harga beli per satuan` tanpa mengetahui satuannya.

**Dampak:** margin, HPP, dan laporan waste sulit diaudit. Pengguna harus menebak basis nominal dari `unit_stock`.

### P1 — HPP per m² belum dapat dihitung akurat hanya dari data yang ada

Untuk material Roll→Meter, faktor 50 memberi panjang roll, tetapi harga Banner adalah per m². Biaya per m² juga membutuhkan lebar efektif roll dan waste. Lebar saat ini hanya dapat berada di teks `specifications`, bukan field numerik yang dapat dipakai formula.

**Dampak:** stok meter dapat berkurang dengan benar, tetapi HPP per m² dan margin per order belum dapat dihitung konsisten. `Rp12.000/roll ÷ 50 meter` menghasilkan biaya per meter, bukan biaya per m².

### P1 — Validasi pasangan unit masih terlalu longgar di server

UI menyediakan daftar unit, tetapi `validateMaterialSetup()` belum memvalidasi `unit_stock`, `unit_usage`, kebutuhan `unit_custom`, maupun pasangan yang diperbolehkan. Server dapat menerima kombinasi yang secara bisnis tidak masuk akal, misalnya `ROLL → GRAM`, `LITER → METER`, atau `unit_custom` kosong.

**Dampak:** kesalahan konfigurasi baru terlihat ketika produksi atau laporan, bukan saat material dibuat.

**Pasangan minimum yang direkomendasikan:**

| Unit stok | Unit pemakaian yang valid |
|---|---|
| ROLL | METER; atau unit custom yang disetujui |
| RIM | LEMBAR |
| LITER | ML |
| KG | GRAM |
| PCS | PCS |
| METER/LEMBAR/ML/GRAM | unit yang sama bila stok memang disimpan langsung |
| CUSTOM | CUSTOM yang sama dan faktor dijelaskan |

### P2 — Presisi input belum mengikuti karakter satuan

Penerimaan dan purchase order memakai maksimal dua angka desimal. Ledger produksi dapat menyimpan enam angka desimal setelah konversi. Kebijakan ini dapat diterima untuk roll/rim, tetapi belum menjelaskan quantum untuk liter, kg, tinta, atau material custom.

**Risiko:** penerimaan 0,005 liter atau koreksi 0,001 kg dapat ditolak, sementara hasil konversi produksi mungkin membutuhkan presisi tersebut. Sebaliknya, terlalu banyak presisi untuk barang yang hanya dapat diterima dalam bilangan bulat dapat membuat saldo tidak realistis.

### P2 — Label UI tidak cukup untuk mencegah salah input

- `Standard Cost (Rp)` tidak menampilkan `per ROLL`, `per RIM`, atau unit stok terpilih.
- `Harga beli per satuan` pada stok masuk dan PO tidak menyebut unit material.
- Quantity PO tidak menampilkan unit stok di samping input.
- Tabel material tidak menampilkan unit pemakaian, faktor konversi, dan basis standard cost.

Bukti ada di [MaterialTab.tsx](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/app/(dashboard)/finishing/MaterialTab.tsx:119) dan [PurchaseOrderTab.tsx](/Users/drefan/Projects/PRINT%20PILOT/frontend/src/app/(dashboard)/finishing/PurchaseOrderTab.tsx:89).

### P2 — Kebijakan costing belum ditetapkan

Movement menyimpan `unit_cost` saat penerimaan, sementara material memiliki `standard_cost`. Belum ada kebijakan yang menjawab apakah laporan memakai standard cost, weighted average, FIFO, atau biaya pada movement aktual. Penerimaan MAT-0001, MAT-0005, MAT-0010 juga memiliki movement tanpa `unit_cost`, sehingga histori biaya tidak lengkap.

### P2 — Dokumentasi dan implementasi waste belum sepenuhnya sejajar

Dokumen material menyebut estimasi waste dapat dihitung sebagai `qty × standard_cost`. Untuk material Roll→Meter, formula itu salah bila `qty` adalah meter dan standard cost adalah per roll. Kode laporan saat ini lebih banyak mengagregasi kuantitas dan rasio waste, belum menghasilkan valuasi biaya yang terkonversi.

### P2 — Kualitas data tenant perlu dibersihkan

- `MAT-0010 Flexi China` memiliki faktor 1, tidak mempunyai mapping produk, dan stok 2 di bawah minimum 10. Ini berisiko menjadi material duplikat atau salah konversi.
- `QA-UNIT-CUSTOM`, `QA-UNIT-KG`, dan `QA-UNIT-PCS` masih aktif.
- `MAT-0003 Flexi China 400 gr` stok 0 dan minimum 10. Ini valid sebagai alert stok, tetapi harus dipastikan memang material operasional, bukan hanya fixture.
- Penerimaan tanpa harga beli dapat diterima untuk opening stock, tetapi harus ditandai sebagai biaya belum diketahui agar tidak masuk laporan margin seolah-olah lengkap.

### P3 — Unit produk belum memiliki profil pengukuran yang cukup

Semua item order memakai lebar, tinggi, dan quantity pcs pada satu form. Untuk produk `METER`, `LEMBAR`, atau `RIM`, form seharusnya berubah mengikuti basis harga. Satuan produk perlu menjadi aturan perilaku form, bukan hanya label dropdown.

## Rekomendasi desain target

### 1. Pisahkan empat basis secara eksplisit

Gunakan definisi berikut pada setiap snapshot transaksi:

- `stock_unit`: unit saldo gudang;
- `usage_unit`: unit input pemakaian;
- `pricing_unit`: unit tarif ke konsumen;
- `cost_unit`: unit biaya pembelian/valuasi, minimal sama dengan `stock_unit` untuk material.

Simpan `pricing_unit`, `catalog_rate`, `material_rate`, `cost_unit`, dan `conversion_factor` di `pricing_snapshot`/movement snapshot agar histori tidak berubah ketika master diedit.

### 2. Terapkan formula harga berdasarkan unit produk

- `PCS`: `tarif × quantity`.
- `M2`: `tarif × (lebar_cm/100 × tinggi_cm/100) × quantity`.
- `METER`: `tarif × panjang_meter × quantity` atau quantity langsung menjadi panjang, pilih satu perilaku dan tampilkan dengan jelas.
- `LEMBAR`: `tarif × jumlah_lembar`.
- `RIM`: `tarif × jumlah_rim`.

Server dan client harus menggunakan fungsi yang sama; browser tidak boleh menjadi sumber kebenaran harga.

### 3. Tambahkan profil material untuk HPP area

Untuk material roll yang dipakai pada produk m², simpan minimal `usable_width_mm` dan panjang efektif per roll. HPP m² dapat dihitung dari:

`cost_per_roll ÷ (usable_width_m × usable_length_m)`

Jika data lebar belum tersedia, laporan harus menandai HPP m² sebagai **belum dapat dihitung**, bukan mengarang nilai.

### 4. Validasi unit di server

Buat konstanta unit bersama client/server dan validasi:

- unit harus berada di allowlist;
- `CUSTOM` wajib mempunyai nama custom;
- pasangan stock/usage harus ada di compatibility matrix;
- faktor harus positif dan sesuai skala unit;
- tipe `INK` otomatis `CONSUMABLE`;
- material `PRIMARY` harus bertipe MEDIA/OTHER yang diizinkan;
- faktor 1 untuk Roll→Meter harus meminta konfirmasi khusus atau ditolak bila spesifikasi tidak mendukung.

### 5. Perjelas UI dan operasi gudang

Tampilkan label dinamis:

- `Standard cost (Rp per ROLL)`;
- `Harga beli (Rp per RIM)`;
- `Jumlah PO (RIM)`;
- `Pemakaian operator (METER)`;
- `Konversi: 50 METER = 1 ROLL`.

Tabel material sebaiknya menampilkan unit stok, unit pemakaian, faktor, standard cost per unit stok, saldo, dan minimum. Form order harus mengganti label quantity serta field dimensi sesuai `pricing_unit`.

### 6. Tetapkan kebijakan biaya

Rekomendasi untuk tahap awal: gunakan **weighted average cost per unit stok** untuk HPP operasional, simpan biaya aktual di setiap movement, dan pertahankan `standard_cost` sebagai fallback/anggaran. Jika unit cost pada penerimaan kosong, tandai batch sebagai `COST_PENDING` dan jangan tampilkan margin final sebagai angka pasti.

### 7. Tetapkan skala angka per unit

Simpan `quantity_scale` atau aturan unit:

- ROLL/RIM/PCS: 0–2 desimal sesuai kebijakan pembelian;
- METER/LEMBAR: 0–3 desimal bila supplier mengizinkan;
- LITER/KG dan hasil konversi: sampai 6 desimal di ledger;
- Rupiah: bilangan bulat rupiah, tanpa pecahan.

Validasi harus sama pada receipt, PO, adjustment, stock opname, dan pemakaian produksi.

## Tindakan sebelum data produksi diisi penuh

1. Review dan nonaktifkan `MAT-0010` sampai panjang roll, harga, spesifikasi, dan mapping produk dikonfirmasi.
2. Nonaktifkan seluruh `QA-UNIT-*` setelah skenario pengujian selesai.
3. Pastikan tiga Flexi Banner memakai panjang efektif yang sama; catat lebar efektif untuk HPP m².
4. Hubungkan Sticker Vinyl ke produk Sticker dan Art Paper ke produk kertas sebelum dipakai di order.
5. Isi unit cost pada penerimaan baru; untuk opening stock yang tidak memiliki harga, beri catatan `COST_PENDING`.
6. Jangan membuat produk baru dengan unit `METER`, `LEMBAR`, atau `RIM` sebelum formula harga dan tampilan form unit-aware diterapkan.
7. Jalankan acceptance test di bawah sebelum push/deploy berikutnya.

## Acceptance test yang wajib lulus

| Skenario | Hasil yang diharapkan |
|---|---|
| Banner 200×300 cm, Flexi 280, qty 1 | Harga Rp15.000/m² × 6 = Rp90.000; pemakaian 6 meter mengurangi 0,12 roll pada faktor 50 |
| Produk METER, tarif Rp8.000/m, panjang 10 m | Total Rp80.000, bukan tarif per pcs |
| Produk LEMBAR, tarif Rp2.000, 12 lembar | Total Rp24.000 dan stok rim berkurang 12/500 |
| Tinta 250 ml | Stok liter berkurang 0,25 liter |
| Roll→Gram atau Liter→Meter | Ditolak saat membuat/mengubah material |
| Cost per roll di UI | Semua label dan snapshot menyebut `Rp/ROLL` |
| Dua penerimaan bersamaan | Saldo dan movement konsisten; tidak ada double count |
| Material tanpa unit cost | Diterima hanya dengan status biaya belum diketahui; laporan margin memberi tanda |
| Material duplikat MAT-0010 | Tidak muncul sebagai pilihan produk sampai direview |

## Keputusan audit

**Satuan stok dan konversi dasar sudah relevan untuk bisnis percetakan. Satuan harga dan pengukuran belum konsisten untuk seluruh katalog.** Print Pilot dapat melanjutkan pengujian terbatas pada Banner berbasis m² dan material yang sudah tervalidasi, tetapi sebaiknya menahan penggunaan produk berbasis Meter/Lembar/Rim serta laporan HPP/margin sampai temuan P1 diperbaiki.

Audit database awal bersifat read-only. Perubahan tindak lanjut dicatat terpisah pada addendum di bawah.

## Addendum tindak lanjut implementasi

Setelah laporan disetujui, tiga kontrol P1 awal sudah diterapkan di branch kerja:

- formula harga produk dipusatkan dan dipakai oleh server serta form order untuk `M2`, `METER`, `LEMBAR`, `RIM`, dan `PCS`;
- validasi pasangan `unit_stock`–`unit_usage` serta satuan custom ditambahkan ke server;
- label standard cost dan harga beli sekarang menyebut basis unit stok;
- `pricing_unit` dan `cost_unit` ditambahkan ke snapshot harga order;
- test unit untuk formula harga, pasangan unit, konversi roll, waste, dan validasi pemakaian lulus **5/5**.

Temuan yang masih terbuka: profil lebar efektif untuk HPP m², kebijakan weighted average yang benar-benar dipakai laporan, quantum per unit, pembersihan data MAT-0010/fixture QA, dan formula harga untuk produk yang membutuhkan panjang pecahan.
