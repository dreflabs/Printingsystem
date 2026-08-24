# Cancel & Refund Workflow

## Kebijakan Dasar

Kebijakan pembatalan order berbeda tergantung pada seberapa jauh produksi sudah berjalan.

---

## Skenario 1 — Cancel Sebelum Produksi Dimulai

**Kondisi:** Status order masih di: DRAFT / DESIGNING / WAITING_APPROVAL / APPROVED / WAITING_PAYMENT / CONFIRMED

**Kebijakan DP:**
- Jika DP sudah dibayar:
  - **DP dikembalikan PENUH** (setelah dikurangi biaya desain jika sudah ada proses desain)
  - Biaya desain yang dipotong harus disepakati dan dicatat
- Jika belum ada DP: tidak ada pengembalian apapun

**Siapa yang bisa approve:** Admin atau Owner

**Alur:**
```
Konsumen / Admin request cancel
  → Admin klik "Ajukan Pembatalan"
  → Pilih alasan: Konsumen berubah pikiran / Desain tidak cocok / Lainnya
  → Sistem cek status order → Sebelum produksi? → Bisa dicancel
  → Admin atau Owner klik "Konfirmasi Cancel"
  → Jika ada DP:
      Input jumlah yang dikembalikan (bisa penuh atau dikurangi biaya desain)
      Catat metode pengembalian (cash / transfer)
  → Status order → CANCELLED
  → Dicatat di audit log
```

---

## Skenario 2 — Cancel Saat Produksi Sedang Berjalan atau Sudah Selesai

**Kondisi:** Status order sudah di: PRODUCTION_ASSIGNED / PRODUCTION_STARTED / PRODUCTION_COMPLETE / QC / FINISHING / atau lebih jauh

**Kebijakan DP: DP HANGUS (tidak dikembalikan)**

Alasannya:
- Material sudah dipakai
- Waktu operator sudah terpakai
- Mesin sudah digunakan
- Biaya produksi sudah keluar

**Siapa yang bisa approve:** **Owner SAJA** (tidak bisa dicancel oleh Admin sendiri)

**Alur:**
```
Konsumen / Admin request cancel
  → Admin klik "Ajukan Pembatalan"
  → Sistem detect: order sudah dalam produksi
  → Sistem tampilkan peringatan: "DP HANGUS jika cancel dilanjutkan"
  → Request dikirim ke Owner untuk disetujui
  → Owner review → klik "Setujui Cancel" atau "Tolak"
  → Jika disetujui:
      DP dicatat sebagai hangus (tidak ada pengembalian)
      Produksi dihentikan (status job produksi → CANCELLED)
      Material yang sudah keluar tetap tercatat sebagai pemakaian
  → Status order → CANCELLED
  → Dicatat lengkap di audit log: siapa yang minta, kapan, kenapa, siapa yang approve
```

---

## Skenario 3 — Cancel Setelah Barang Selesai (READY_FOR_PICKUP)

**Kondisi:** Barang sudah selesai dan tersimpan di gudang, tapi konsumen tidak mau ambil

**Kebijakan:**
- **DP HANGUS**
- Jika ada pelunasan: dikembalikan SEBAGIAN setelah dikurangi biaya produksi penuh
- Barang fisik menjadi milik percetakan untuk dibuang atau digunakan kembali (jika memungkinkan)
- **Harus ada keputusan Owner**

**Alur:** Sama seperti Skenario 2 — harus lewat Owner.

---

## Pencatatan Cancel

Saat cancel:
- Status order → CANCELLED
- Field `cancelled_at` diisi
- Field `cancelled_by` diisi (user_id)
- Field `cancellation_reason` diisi
- Field `dp_refund_amount` diisi (0 jika hangus, jumlah jika dikembalikan)
- Field `dp_refund_method` diisi jika ada pengembalian
- Field `cancellation_approved_by` diisi (Owner jika produksi sudah berjalan)

Semua dicatat di `audit_logs`.

---

## Aturan Tambahan

- Order yang CANCELLED tidak bisa di-reopen — harus buat order baru
- Data konsumen tetap tersimpan untuk referensi repeat order di masa mendatang
- Laporan keuangan Owner menampilkan jumlah DP yang hangus sebagai pemasukan
