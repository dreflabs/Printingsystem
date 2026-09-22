# Audit Satuan Harga, Material, Transaksi, dan Storage Print Pilot

Tanggal audit: 16 September 2026
Ruang lingkup: RIM, ROLL, METER, PCS, LEMBAR, M2, stok gudang, PO, penerimaan, pemakaian produksi, waste, HPP, dan storage.

Catatan pemeriksaan: audit ini mencakup kode, schema, workflow, dan UI lokal. PostgreSQL lokal `localhost:5432` tidak aktif pada sesi ini, sehingga saldo/material tenant dan invariant database live belum diverifikasi ulang.

## Kesimpulan eksekutif

Model dasar Print Pilot sudah mengikuti pola percetakan yang benar karena memisahkan:

- **satuan jual**: dasar tarif kepada konsumen;
- **satuan stok**: unit barang yang dibeli dan disimpan Gudang;
- **satuan pemakaian**: unit yang diinput Operator saat produksi; dan
- **satuan output/storage**: unit barang jadi yang disimpan dan diserahkan.

Konversi stok utama sudah relevan untuk `ROLL → METER`, `RIM → LEMBAR`, `LITER → ML`, dan `KG → GRAM`. Formula harga juga sudah mendukung `M2`, `METER`, `LEMBAR`, `RIM`, dan `PCS`.

Namun, sistem **belum sepenuhnya konsisten untuk operasi produksi campuran unit**. Risiko tertinggi ada pada output/storage yang masih dipaksa sebagai bilangan bulat pcs, HPP yang belum membawa biaya aktual ke movement produksi, serta aturan presisi dan dimensi yang belum cukup eksplisit untuk semua unit.

Penilaian saat ini: **7/10 untuk fondasi**, **5/10 untuk kesiapan HPP dan storage multi-unit**.

## 1. Model satuan yang seharusnya dipakai

### Satuan jual

| Satuan | Contoh bisnis | Formula dasar |
|---|---|---|
| `PCS` | kartu, undangan, merchandise | tarif × jumlah pcs |
| `M2` | banner, backdrop, spanduk | tarif × luas m² × jumlah |
| `METER` | cetak bahan berdasarkan panjang | tarif × meter |
| `LEMBAR` | poster, art paper, lembar digital | tarif × jumlah lembar |
| `RIM` | produk yang dijual per rim | tarif × jumlah rim |

### Satuan material

| Satuan stok | Satuan pemakaian umum | Contoh |
|---|---|---|
| `ROLL` | `METER` | Flexi, vinyl, canvas |
| `RIM` | `LEMBAR` | Art paper, kertas |
| `LITER` | `ML` | Tinta, coating cair |
| `KG` | `GRAM` | Bubuk, bahan sablon tertentu |
| `PCS` | `PCS` | packaging atau komponen satuan |

Basis ini sudah tercermin di `catalog-constants.ts`, `Material`, `MaterialMovement`, dan `ProductMaterial`.

## 2. Audit alur transaksi order

### Yang sudah benar

- `Product.unit` menentukan basis harga.
- Banner berbasis `M2` menghitung lebar dan tinggi dari cm ke m².
- `METER`, `LEMBAR`, `RIM`, dan `PCS` menghitung tarif berdasarkan jumlah pada unit jualnya.
- Tarif dapat berbeda per material melalui `ProductMaterial.unit_price`.
- Server menghitung ulang harga dan memvalidasi material terhadap produk; browser tidak menjadi sumber kebenaran ketika harga mengikuti katalog.
- `pricing_snapshot` menyimpan unit, tarif katalog, unit price, material, dan cost unit sehingga perubahan katalog tidak menulis ulang histori order.
- Diskon tetap dianggap sebagai permintaan sampai approval, sehingga total tidak diam-diam berubah sebelum disetujui.

### Temuan transaksi

#### P1 — Output quantity belum mengikuti satuan jual

`OrderItem.quantity` dan `ProductionJob.planned_qty`/`actual_qty` bertipe integer. Ini benar untuk PCS, tetapi tidak cukup untuk produk yang dijual dengan panjang pecahan, misalnya 2,5 meter atau 0,5 rim.

**Dampak:** order bisa menghitung harga dengan unit METER/RIM, tetapi hasil produksi, QC, finishing, dan storage tetap menganggap jumlah sebagai pcs bulat.

**Rekomendasi:** simpan `quantity` sebagai Decimal atau tambahkan `quantity_decimal`, lalu simpan `quantity_unit` pada snapshot. Untuk produk yang memang wajib integer, server harus menolak pecahan secara eksplisit.

#### P1 — Form ukuran masih ambigu untuk METER dan RIM

Form selalu menampilkan Lebar dan Tinggi, lalu hanya mengganti label Qty. Produk METER biasanya membutuhkan panjang, sedangkan produk LEMBAR/RIM membutuhkan jumlah lembar/rim dan mungkin ukuran lembar sebagai spesifikasi, bukan sebagai pengali harga.

**Rekomendasi:** bentuk form berdasarkan `pricing_unit`:

- `M2`: lebar, tinggi, qty;
- `METER`: panjang meter, qty atau langsung total meter — pilih satu perilaku;
- `LEMBAR`: jumlah lembar dan ukuran lembar opsional;
- `RIM`: jumlah rim;
- `PCS`: jumlah pcs.

#### P2 — Tarif material belum mempunyai policy pembulatan yang terlihat

Server membulatkan harga ke rupiah dengan `Math.round`. Itu sesuai rupiah, tetapi pembulatan luas m² dan kuantitas perlu ditampilkan agar Admin dapat menjelaskan perbedaan antara ukuran nyata, tarif, dan total.

## 3. Audit material dan konversi stok

### Yang sudah benar

- `ROLL → METER` memakai `usage / conversion_factor`, sehingga pemakaian 5 meter dari roll 50 meter mengurangi 0,1 roll.
- `RIM → LEMBAR` dengan faktor 500 bekerja secara konsep.
- `LITER → ML` dan `KG → GRAM` memakai pola yang sama.
- OUT dan WASTE dicatat sebagai movement terpisah dengan before/after stock.
- Material dikunci sebelum pengurangan dan saldo negatif ditolak saat produksi.
- Receipt langsung dan penerimaan PO memakai lock material serta mencatat supplier, referensi, biaya, dan actor.
- Perubahan satuan/konversi material yang sudah memiliki movement atau order ditolak agar histori tidak berubah.

### Temuan material

#### P1 — Faktor konversi belum memiliki dimensi dan profil fisik

`conversion_factor` hanya angka. Untuk roll, angka 50 belum menjelaskan apakah itu 50 meter panjang, lebar roll berapa, dan panjang efektif setelah waste.

**Dampak:** stok meter dapat benar, tetapi HPP m² tidak dapat dihitung dari data ini saja.

**Rekomendasi:** tambahkan profil material untuk bahan roll:

- panjang efektif per roll;
- lebar efektif dalam mm/cm;
- panjang nominal dan toleransi;
- allowance waste;
- unit cost basis.

#### P1 — HPP produksi belum membawa biaya material ke movement OUT/WASTE

`MaterialMovement` memiliki `unit_cost`, tetapi saat produksi selesai kode mencatat `unit_cost` kosong. `standard_cost` material juga tidak otomatis menjadi nilai biaya pemakaian.

**Dampak:** laporan HPP, margin, dan biaya waste belum dapat dipercaya walaupun saldo stok benar.

**Rekomendasi:** pada saat movement OUT/WASTE, simpan `cost_unit`, `unit_cost`, dan `cost_amount`. Gunakan weighted average per unit stok sebagai metode awal; simpan biaya aktual penerimaan untuk rekonsiliasi.

#### P1 — Validasi unit yang sama belum memaksa faktor 1

Pasangan seperti `METER → METER`, `LITER → LITER`, atau `KG → KG` diterima dengan faktor selain 1. Secara bisnis ini membingungkan karena unit sama seharusnya tidak mengubah skala.

**Rekomendasi:** jika stock unit = usage unit, faktor harus tepat 1. Jika memang ada rasio khusus, gunakan unit custom atau profil konversi yang menjelaskan dimensinya.

#### P2 — Presisi universal 0,01 belum sesuai semua unit

Receipt dan PO memakai maksimal dua desimal untuk semua bahan. Ini mungkin cukup untuk roll/rim, tetapi bisa terlalu kasar untuk 0,005 liter atau 0,001 kg.

**Rekomendasi:** tetapkan `quantity_scale` per material/unit:

- PCS/RIM/LEMBAR: biasanya integer atau 2 desimal sesuai kebijakan toko;
- METER: 2–3 desimal;
- LITER/KG: 3–6 desimal di ledger;
- rupiah: integer.

#### P2 — Basis biaya belum disimpan sebagai field eksplisit

`standard_cost` dan `MaterialMovement.unit_cost` secara implisit dianggap per unit stok. UI sudah mulai menampilkan unit stok, tetapi schema belum memiliki `cost_unit` yang immutable.

**Rekomendasi:** simpan `cost_unit` pada material dan snapshot movement. Jangan mengandalkan label UI atau asumsi dari `unit_stock`.

## 4. Audit pembelian dan penerimaan

### Yang sudah benar

- PO menyimpan `ordered_qty`, `received_qty`, dan `unit_cost` dalam unit stok material.
- Penerimaan parsial didukung.
- Penerimaan melebihi sisa PO ditolak.
- Penerimaan mengubah stok dan membuat movement dalam satu transaksi.
- Status PO berubah dari `SUBMITTED` ke `PARTIAL` lalu `RECEIVED`.

### Temuan

- Label harga PO masih dapat dibaca sebagai “harga per satuan” tanpa selalu menampilkan `Rp/ROLL`, `Rp/RIM`, atau `Rp/LITER` di input.
- Tidak ada snapshot nama/unit material pada PurchaseOrderItem; histori masih bergantung pada master material yang tetap aktif.
- Tidak ada penerimaan berbasis lot/batch atau tanggal kedaluwarsa untuk tinta/cairan.
- Harga penerimaan berbeda belum memperbarui weighted average cost.
- Opening stock dan penerimaan pembelian memakai jalur yang sama secara konsep, padahal opening stock sebaiknya memiliki movement type dan audit yang berbeda.

## 5. Audit produksi dan waste

### Yang sudah benar

- Operator memasukkan usage unit, bukan langsung mengurangi unit stok.
- Sistem mengkonversi pemakaian dan waste ke unit stok.
- OUT dan WASTE terpisah.
- Job dikunci sebelum pemotongan untuk mencegah double-submit.
- Material utama job dan consumable mesin divalidasi.

### Temuan

- `actual_qty`, `waste_qty`, dan data finishing/QC masih integer pcs. Produk METER/M2 perlu quantity output Decimal atau field area/panjang yang konsisten.
- Waste produksi umum dicatat sebagai pcs, sedangkan waste material dicatat sebagai unit pemakaian; keduanya perlu dibedakan jelas di laporan.
- Dokumen masih menyebut stok kurang hanya sebagai peringatan, tetapi implementasi terbaru memblokir stok tidak mencukupi. Dokumentasi harus diselaraskan ke hard block, dengan override Owner yang terkontrol bila operasional memang membutuhkannya.
- Tidak ada batas anomali waste berdasarkan persentase usage, quantity, atau produk.
- Substitusi material belum menjadi transaksi resmi dengan alasan, approval, dampak harga, dan audit yang lengkap.

## 6. Audit storage dan barang jadi

### Temuan utama

#### P1 — StorageItem tidak memiliki satuan output

`StorageItem.quantity` bertipe `Int` dan UI storage menampilkan `pcs`. Ini sesuai untuk order potongan/merchandise, tetapi salah atau ambigu untuk banner berdasarkan m², cetak meteran, rim kertas, atau paket campuran.

**Dampak:** jumlah barang yang disimpan, diverifikasi QC, diberi label, dikonfirmasi di counter, dan diserahkan tidak selalu dapat dibandingkan dengan `OrderItem.quantity`.

**Rekomendasi:** tambahkan `output_quantity Decimal`, `output_unit`, dan bila perlu `package_count`. Contoh: `12 m²`, `8 lembar`, `0,5 rim`, `10 pcs`. Storage boleh menghitung kapasitas berdasarkan `package_count`, tetapi label dan audit harus menampilkan output unit.

#### P1 — Kapasitas lokasi berarti jumlah paket/job, bukan kapasitas fisik

`capacity_current` bertambah 1 setiap StorageItem, terlepas dari quantity. Ini boleh jika satu slot hanya mengatur jumlah paket/job, tetapi dokumentasi menyebut kapasitas tanpa mendefinisikan unitnya.

**Rekomendasi:** beri nama dan aturan eksplisit: `package_slots` atau tambahkan mode kapasitas `PACKAGE`, `PCS`, `M2`, atau `VOLUME`. Untuk tahap awal, gunakan `PACKAGE_SLOT` dan tampilkan “1 paket dari 3 slot”, bukan “kapasitas barang” yang ambigu.

#### P2 — Satu job hanya dapat memiliki satu storage item aktif

`assignStorageLocation()` menolak item aktif yang sudah ada. Ini menyederhanakan pencarian, tetapi tidak mendukung satu job yang dikemas menjadi dua lokasi atau penerimaan sebagian.

**Rekomendasi:** dukung beberapa `StorageItem` per job dengan `output_quantity`, `package_no`, dan status per paket jika bisnis membutuhkan split storage.

#### P2 — Storage belum menyimpan snapshot item/output

Storage mengambil data produk/order melalui relasi job. Untuk audit historis, label sebaiknya menyimpan snapshot deskripsi, unit, quantity, material, dan finishing ketika barang masuk rak.

## 7. Audit konsistensi dokumen vs implementasi

Dokumen dan kode sudah sepakat mengenai pemisahan unit stok dan pemakaian, tetapi masih ada perbedaan yang harus diperbaiki:

- Dokumen menyebut stok kurang sebagai peringatan; kode memblokir transaksi.
- Dokumen storage dan WhatsApp masih menggunakan “quantity pcs” secara umum; implementasi bisnis mendukung produk non-PCS.
- Dokumen belum menjelaskan apakah kapasitas rak dihitung per job, per paket, atau per unit barang.
- Dokumen belum mendefinisikan HPP weighted average dan perlakuan biaya kosong.
- Dokumen belum menetapkan presisi berbeda per unit.

## 8. Rekomendasi arsitektur target

Gunakan empat field snapshot pada transaksi:

```text
pricing_unit  = unit tarif konsumen
stock_unit    = unit saldo gudang
usage_unit    = unit pemakaian operator
output_unit   = unit barang jadi/storage
```

Untuk material, tambahkan:

```text
conversion_factor
cost_unit
quantity_scale
usable_width_mm       // roll/media bila dibutuhkan HPP area
effective_length      // roll/media bila dibutuhkan HPP area
```

Untuk output/storage, tambahkan:

```text
output_quantity Decimal
output_unit
package_count
package_label
```

## 9. Prioritas implementasi

### Tahap 1 — wajib sebelum transaksi multi-unit

1. Tambahkan output unit dan Decimal quantity pada job/storage.
2. Tegaskan form order berdasarkan pricing unit.
3. Wajibkan faktor 1 untuk unit yang sama.
4. Tampilkan basis harga dan biaya di semua form.
5. Selaraskan dokumen hard block stok kurang.

### Tahap 2 — wajib sebelum HPP/margin dipakai

1. Tambahkan cost unit dan cost amount pada movement OUT/WASTE.
2. Implementasikan weighted average per unit stok.
3. Tambahkan profil lebar/panjang efektif roll.
4. Tandai biaya kosong sebagai `COST_PENDING`.
5. Tambahkan laporan biaya per order, produk, bahan, mesin, dan waste.

### Tahap 3 — penguatan gudang

1. Tambahkan snapshot material/output pada storage.
2. Tentukan kapasitas lokasi sebagai slot paket atau unit fisik.
3. Dukung split storage bila diperlukan.
4. Tambahkan batch/lot untuk material cair atau yang memiliki masa simpan.
5. Tambahkan substitusi material dengan approval dan audit.

## 10. Skenario uji wajib

1. Banner 200×300 cm, tarif Rp15.000/m², qty 1 → Rp90.000.
2. Banner material roll 50 meter, pemakaian 6 meter dan waste 0,5 meter → saldo berkurang 0,13 roll setelah pembulatan ledger.
3. Art Paper, harga Rp650.000/rim, pemakaian 12 lembar → stok berkurang 0,024 rim.
4. Produk METER 2,5 meter → harga, actual output, QC, label, dan storage menyebut 2,5 meter.
5. Produk RIM 0,5 rim → diterima hanya bila kebijakan supplier mengizinkan pecahan; jika tidak, ditolak.
6. Material `ROLL → GRAM` → ditolak.
7. Material `METER → METER` dengan faktor 2 → ditolak.
8. Dua operator menyelesaikan job yang memakai material sama → saldo tidak negatif dan movement tidak dobel.
9. Dua penerimaan PO bersamaan → `received_qty` tidak melebihi `ordered_qty`.
10. Produk non-PCS masuk storage → label dan counter tidak menampilkan “pcs” secara otomatis.
11. Harga beli dua batch berbeda → weighted average berubah dan HPP periode berikutnya memakai rata-rata baru.
12. Material tanpa unit cost → transaksi boleh sesuai kebijakan, tetapi margin diberi status `COST_PENDING`.

## Keputusan audit

Print Pilot sudah memiliki **fondasi unit yang relevan untuk bisnis percetakan**, khususnya ROLL/METER dan RIM/LEMBAR. Namun statusnya belum dapat disebut sepenuhnya konsisten sampai output/storage dan HPP menggunakan satuan yang sama-sama eksplisit.

Rekomendasi bisnis saya: izinkan operasi produksi Banner berbasis M2 dengan stok Flexi ROLL→METER setelah data roll dan lebar efektif divalidasi. Tahan penggunaan produk METER/RIM non-integer pada storage dan laporan margin sampai Tahap 1 dan Tahap 2 selesai. Jangan memperlakukan `PCS` sebagai satuan universal untuk semua produk.

Audit awal ini bersifat read-only. Setelah rekomendasi disetujui, implementasi Tahap 1 dilakukan secara lokal sebagai perubahan kompatibilitas data:

- `ProductionJob` menyimpan `planned_output_quantity`, `output_quantity`, dan `output_unit` tanpa menghapus field legacy integer.
- `StorageItem` menyimpan jumlah/unit barang jadi dan `package_count`, sehingga tampilan storage tidak lagi selalu menyebut `pcs`.
- Auto-release menurunkan unit output dari product yang masuk ke job; job dengan unit berbeda diberi unit `MIXED`.
- Saat produksi selesai, unit output disimpan bersama hasil aktual; saat barang ditempatkan di storage, nilai tersebut dibawa ke `StorageItem`.
- Peta, pencarian, dan incident storage menampilkan label unit dinamis. Nilai Decimal dipetakan menjadi angka plain sebelum dikirim ke Client Component.
- Faktor konversi server-side menolak nilai tidak positif dan menolak faktor selain `1` jika satuan stok dan pemakaian sama.
- Migrasi `20260916080000_output_unit_storage` melakukan backfill data lama sebagai `PCS` agar deployment tidak memutus transaksi existing.
- Test kebijakan material menambahkan verifikasi faktor konversi satu-ke-satu.

Implementasi Tahap 2 untuk dasar HPP juga sudah ditambahkan:

- `MaterialMovement.cost_amount` menyimpan nilai biaya total per movement; migration `20260916090000_material_movement_cost_amount` melakukan backfill dari `quantity_stock_change × unit_cost`.
- Movement OUT/WASTE produksi menyimpan snapshot `unit_cost` dari `Material.standard_cost` dan `cost_amount`.
- Penerimaan material langsung dan penerimaan PO memperbarui `standard_cost` dengan weighted average ketika harga beli tersedia.
- Riwayat movement mengembalikan `costAmount` sebagai angka plain untuk laporan.
- Helper costing memiliki test untuk weighted average, penerimaan tanpa harga, dan biaya movement.

Implementasi Tahap 3 awal untuk profil media:

- `Material` memiliki `usable_width_mm` dan `effective_length` nullable untuk menyimpan profil fisik roll tanpa memaksa data lama diisi ulang sekaligus.
- Form material menampilkan profil tersebut saat satuan stok `ROLL`.
- Nilai profil divalidasi positif di server; field kosong tetap menghasilkan status biaya yang perlu dilengkapi sebelum HPP berbasis luas dipakai.
- Storage menerima override `outputQuantity` pecahan secara server-side, sedangkan `quantity` lama tetap dipertahankan sebagai jumlah paket/lokasi.

Input produksi legacy masih memakai bilangan bulat pada tahap ini. Dukungan input pecahan langsung di form operator, perhitungan HPP berdasarkan lebar efektif roll, dan laporan margin per unit menjadi tahap berikutnya setelah tiga migration ini diuji di database staging.
