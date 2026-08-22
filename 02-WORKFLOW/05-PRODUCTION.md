# Production Workflow

## Alur Normal

```
Desain APPROVED + syarat pembayaran terpenuhi
  → Admin assign job ke mesin & operator (PRODUCTION_ASSIGNED)
  → Operator scan mulai produksi (PRODUCTION_STARTED)
  → Operator scan selesai produksi, input actual qty & waste (PRODUCTION_COMPLETE)
```

Dicatat per job:
- Job ID, mesin, operator
- Planned quantity, actual quantity
- Waktu mulai/selesai
- Reprint (jika ada)
- Waste
- Catatan

**Tidak ada Job ID = tidak ada produksi resmi.** Semua pemakaian mesin/material/waktu operator harus terhubung ke Job ID yang valid.

**Ambang batas waste anomali:** waste di atas **20% dari total pemakaian material** pada satu job otomatis ditandai sebagai anomali oleh sistem dan muncul di panel "Anomali & Kecurangan" dashboard Owner berlabel merah — bukan cuma tercatat sebagai angka biasa (aturan ini sudah ada di `07-REPORTS/MATERIAL-REPORT.md` §4, dicatat ulang di sini karena langsung relevan ke pekerjaan Operator sehari-hari).

**Batas 1 job aktif per Operator:** sistem sengaja membatasi Operator hanya bisa punya **1 job berstatus `PRODUCTION_STARTED` pada satu waktu** — scan mulai job baru diblokir selama masih ada job aktif yang belum di-scan selesai. Ini keputusan desain yang disengaja demi akuntabilitas (jelas siapa bertanggung jawab atas mesin/waktu/material yang sedang terpakai), bukan keterbatasan teknis. Kalau operasional butuh 1 orang memantau beberapa mesin otomatis sekaligus, itu didaftarkan sebagai job-job terpisah yang dikerjakan **berurutan** (selesaikan satu, baru mulai berikutnya), bukan paralel dalam sistem.

---

## Reassignment Sebelum Job Dimulai

Selama job masih berstatus `PRODUCTION_ASSIGNED` (belum di-scan mulai oleh Operator), Admin bisa langsung reassign ke mesin/operator lain tanpa proses tambahan — belum ada aktivitas fisik yang terjadi, jadi tidak butuh justifikasi khusus selain dicatat di audit log seperti biasa.

---

## Reassignment Setelah Job Sudah Dimulai (Salah Assign / Insiden)

**Kondisi:** Job sudah berstatus `PRODUCTION_STARTED` (Operator sudah scan mulai) ketika ternyata assignment-nya salah — misalnya salah pilih mesin (tidak sesuai kapasitas/jenis produk), atau mesin tiba-tiba rusak/maintenance mendadak di tengah proses.

**Siapa yang memutuskan:** **Admin sendiri** (tidak perlu approval Owner) — ini keputusan operasional harian, bukan keputusan finansial/kebijakan. Konsisten dengan prinsip: Admin pegang kendali operasional penuh, Owner baru dilibatkan untuk keputusan yang berdampak finansial signifikan (lihat `14-CANCEL-REFUND.md`).

**Wajib:** Setiap tindakan reassignment di tengah produksi **wajib disertai alasan** dan otomatis tercatat di `audit_logs` — **Owner bisa melihat log ini kapan saja** (read access penuh ke seluruh audit log, lihat `06-SECURITY/AUDIT-TRAIL.md`), tapi tidak perlu approve dulu sebelum Admin bertindak. Ini bukan pre-approval, tapi post-hoc visibility — Owner mengawasi lewat log, bukan menyetujui di muka.

**Alur:**
```
Admin sadar/menerima laporan job salah assign atau mesin bermasalah
  → Admin buka detail job (status PRODUCTION_STARTED)
  → Klik "Reassign Job"
  → Pilih mesin/operator baru
  → Isi alasan wajib (mis. "Mesin M-UV-01 rusak mendadak, dipindah ke M-UV-02")
  → Sistem catat:
      - machine_id / operator_id lama → baru
      - actual_start job lama tetap tersimpan (bukan dihapus, untuk jejak produksi)
      - material yang sudah terpakai di assignment lama tetap tercatat sebagai pemakaian (tidak di-void)
  → Audit log: actor_id (Admin), action=PRODUCTION_JOB_REASSIGNED, old_value_json (mesin/operator lama), new_value_json (mesin/operator baru), reason, timestamp
  → Job lanjut di mesin/operator baru, status tetap PRODUCTION_STARTED
```

**Catatan:**
- Material yang sudah dipakai di mesin/assignment lama **tidak hilang dari pencatatan** — supaya laporan material tetap akurat meski job dipindah.

### Aturan Tegas — Reassignment Berulang

Reassignment di tengah produksi tetap hak Admin secara mandiri, **tapi dibatasi otomatis oleh sistem** supaya tidak disalahgunakan atau jadi tanda ada masalah yang tidak tertangani:

- **Maksimal 2x reassignment** untuk Job ID yang sama dalam periode **24 jam**.
- Begitu percobaan reassignment **ke-3** terjadi dalam 24 jam untuk Job ID yang sama, sistem **otomatis blokir** aksi reassign oleh Admin dan **wajib eskalasi ke Owner** — Admin tidak bisa lagi memindahkan job itu sendiri, harus Owner yang memutuskan (bisa approve reassignment lanjutan, atau ambil tindakan lain seperti investigasi mesin/operator).
- Sistem otomatis kirim notifikasi ke Owner begitu batas ini tercapai (`action=PRODUCTION_JOB_REASSIGN_LIMIT_REACHED` di `audit_logs`), bukan menunggu Owner cek log sendiri.
- Batas ini per Job ID (termasuk Child Job hasil rework — dihitung terpisah dari job induknya, bukan digabung).

---

## Jeda Produksi (Pause)

**Masalah yang diselesaikan:** Timer job berjalan terus sejak `actual_start` sampai Operator scan selesai. Kalau di tengah proses ada gangguan di luar kendali Operator (mesin macet, nunggu material, listrik padam), durasi produksi di laporan jadi menggelembung tanpa penjelasan — padahal itu bukan waktu kerja aktual, dan Operator tidak punya cara membuktikan keterlambatan bukan salahnya.

**Alur:**
```
Job berstatus PRODUCTION_STARTED
  → Operator klik "Jeda Produksi"
  → Pilih alasan wajib: Mesin Macet / Menunggu Material / Lainnya (isi catatan)
  → Sistem catat: paused_at, pause_reason
  → Job berstatus PRODUCTION_PAUSED (timer berhenti terlihat, tapi actual_start tidak berubah)
  → Operator klik "Lanjutkan Produksi" saat siap kerja lagi
  → Sistem catat: resumed_at
  → Job kembali PRODUCTION_STARTED
```

**Perhitungan durasi:** Total waktu jeda (jumlah semua `resumed_at - paused_at` untuk job tersebut) **dikurangi** dari total durasi produksi yang tampil di laporan produksi — supaya laporan mencerminkan waktu kerja aktual, bukan waktu job "menggantung".

**Batas wajar:** Kalau job di-jeda lebih dari 2x atau total durasi jeda melebihi waktu produksi aktual itu sendiri, ini juga masuk kategori yang perlu ditinjau Admin — indikasi ada masalah berulang di mesin tertentu (bisa jadi kandidat maintenance) atau pola pemakaian jeda yang tidak wajar.

---

## Job Macet di Tahap QC / Finishing (Bukan Produksi) — Tidak Ada Reassignment

Aturan reassignment di atas **hanya berlaku untuk tahap produksi** (`PRODUCTION_ASSIGNED`/`PRODUCTION_STARTED`, ditangani Operator). Untuk job yang sedang di tahap **QC atau Finishing** (ditangani role Gudang) dan staf yang mengerjakannya tiba-tiba tidak bisa lanjut (sakit mendadak, dsb) — **job tersebut menunggu**, bukan direassign ke staf Gudang lain di tengah jalan.

Alasan: berbeda dari job produksi yang statusnya jelas per mesin, satu record QC/Finishing yang sudah setengah jalan (misalnya checklist QC baru terisi sebagian) tidak punya mekanisme "pindah tangan" yang aman — memaksakan orang lain melanjutkan checklist yang sudah diisi orang lain berisiko salah tanggung jawab kalau hasil akhirnya keliru. Job baru bisa dilanjutkan staf Gudang lain kalau checklist/proses yang sudah berjalan dianggap batal dan diulang dari awal oleh orang yang sama atau berbeda, bukan "melanjutkan" pekerjaan orang lain.
