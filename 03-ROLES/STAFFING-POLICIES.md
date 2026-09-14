# STAFFING POLICIES — Solo, Tim Kecil, dan Tim Penuh

Policy staffing menyesuaikan kontrol kerja dengan kapasitas tenant tanpa
mengubah arti role.

## SOLO

Dipakai ketika Owner menjalankan toko sendiri.

- Owner boleh memiliki seluruh role operasional.
- Satu actor boleh melewati beberapa tahap workflow.
- Payment, release, override, dan koreksi tetap dicatat sebagai self-operation.
- Sistem menampilkan peringatan rekonsiliasi, bukan memblokir pekerjaan normal.
- Owner dapat mengambil alih pekerjaan apa pun saat tidak ada pegawai aktif.

## TEAM_SMALL

Dipakai ketika beberapa orang merangkap tugas.

- Multi-role pada pegawai diperbolehkan.
- Sistem memperingatkan jika actor yang sama membuat dan memeriksa tahap yang sama.
- Approval Owner tetap wajib untuk diskon, refund, rework, cancel setelah produksi,
  release belum lunas, dan audit YELLOW.
- Owner boleh melepas role operasional setelah ada pegawai pengganti.

## TEAM_FULL

Dipakai ketika pekerjaan dibagi per fungsi atau departemen.

- Admin, Designer, Operator, dan Gudang dapat dipisah sepenuhnya.
- Separation of duties dapat diwajibkan per tenant.
- Operator tidak boleh QC job yang dikerjakannya sendiri.
- Pembuat payment tidak boleh menyetujui refund yang sama.
- Admin yang submit Final Audit tidak boleh menyetujui audit tersebut.
- Job dapat dibatasi ke mesin, departemen, atau lokasi tertentu.

## Emergency takeover

Owner tetap dapat menjalankan fungsi operasional yang sudah didelegasikan ketika
pegawai tidak tersedia. Sistem meminta alasan, mencatat mode takeover, dan
menampilkan event tersebut di dashboard Owner.

## Perubahan policy

Hanya Owner yang dapat mengubah staffing policy. Perubahan berlaku untuk transaksi
baru; transaksi yang sudah berjalan tidak boleh diam-diam melewati kontrol yang
sudah aktif. Setiap perubahan menyimpan nilai sebelum, nilai sesudah, actor, waktu,
dan alasan.
