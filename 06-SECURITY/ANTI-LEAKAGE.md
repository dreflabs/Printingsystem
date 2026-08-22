# Anti-Leakage Controls

## Customer Data Leakage

### Aturan Kontak Konsumen
- Designer/Sales boleh berkomunikasi langsung dengan konsumen untuk keperluan desain
- Namun setelah data masuk sistem, designer TIDAK DAPAT mengakses nomor HP atau email konsumen
- Nomor HP konsumen hanya tersedia untuk Admin dan Owner
- Sistem WhatsApp dikirim otomatis — tidak ada manual copy-paste nomor ke luar sistem
- Pelanggaran: designer yang mencoba akses data kontak lewat cara apapun harus tercatat dan dilaporkan

### Setiap order resmi harus memiliki:
- Customer ID
- Order ID
- payment record
- design record
- production Job ID

---

## Financial Leakage

Designer/Designer-Sales TIDAK DAPAT:
- menghapus payment
- menandai payment sebagai diterima
- menutup order
- melepas (release) barang jadi
- mengubah harga order setelah disetujui

---

## Production Leakage

- Produksi membutuhkan Job ID valid dan desain yang sudah disetujui
- Tanpa Job ID resmi = tidak ada produksi resmi
- Material keluar harus selalu terkait Job ID

---

## Material Leakage

- Material OUT membutuhkan Job ID
- Waste dan adjustment harus disertai alasan yang tercatat
- Perbedaan antara planned_qty dan actual_qty wajib dicatat beserta alasannya

---

## Finished Goods Leakage

Release barang membutuhkan:
- order valid dengan status READY_FOR_PICKUP
- payment verified (cek apakah sudah lunas atau override disetujui)
- user yang berwenang (hanya Admin)
- pickup record yang lengkap

Override aturan release hanya bisa dilakukan oleh Admin atau Owner dengan approval eksplisit dan tercatat di audit.

---

## QR/Barcode adalah Identitas, Bukan Otorisasi

Scan QR tidak pernah otomatis memberikan izin apapun.
Setelah QR di-scan, sistem masih melakukan pengecekan:
1. Apakah user yang scan punya izin untuk aksi ini?
2. Apakah status order cocok dengan aksi yang diminta?
3. Semua aksi setelah scan tetap divalidasi server-side

---

## WhatsApp Control

- Notifikasi konsumen hanya dipicu setelah STORAGE_CONFIRMED
- Mengirim pesan tidak mengubah status order
- Nomor HP konsumen tidak pernah ditampilkan kepada operator, designer, atau Gudang
- Jika pengiriman gagal: alert ke Admin, notifikasi tidak otomatis diulang tanpa perintah manual dari Admin
