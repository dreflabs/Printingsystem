# ENTITLEMENT GATING — Paket SaaS dan Akses Fitur

Role menjawab **siapa** yang boleh melakukan sesuatu. Entitlement menjawab
**fitur apa** yang tersedia untuk tenant berdasarkan paket berlangganan.

## Aturan

- Gate harus berjalan di server; hidden menu bukan kontrol.
- `Tenant.plan` dan subscription aktif harus konsisten.
- Downgrade tidak boleh memutus job aktif.
- Data historis dari fitur yang terkunci tetap read-only.
- Semua perubahan paket, kuota, dan entitlement dicatat di audit platform.

## Kuota user

- `max_users` menghitung user aktif, termasuk Owner.
- User nonaktif dan user yang dianonimkan tidak dihitung.
- `createEmployee` dan aktivasi user wajib menolak jika kuota tercapai.
- UI menampilkan pemakaian `aktif / maksimum`.
- Downgrade ditolak jika user aktif melebihi kuota paket tujuan.

## Enforcement feature

Contoh keputusan akses:

```text
can(actor, "qc.submit")
  = permission role actor
  + entitlement modul QC tenant
  + policy status job
```

Starter, Pro, dan Enterprise boleh memiliki role yang sama di database, tetapi
permission tidak dapat dipakai jika entitlement modulnya tidak aktif.

## Upgrade dan downgrade

- Upgrade membuka entitlement setelah pembayaran tervalidasi.
- Downgrade dijadwalkan untuk periode berikutnya.
- Downgrade ditolak jika ada user atau job aktif yang melanggar paket tujuan.
- Modul yang terkunci tetap dapat dibaca untuk histori.
- Owner mendapat daftar blocker yang harus diselesaikan sebelum downgrade.
