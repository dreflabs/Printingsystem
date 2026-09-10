"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen, LayoutDashboard, ScanLine, ShoppingCart, Tag, Users, BarChart2,
  Clock, Wallet, Palette, Settings2, Package, HelpCircle, ListChecks, Boxes, Search, ChevronDown
} from "lucide-react";
import { getSessionUser } from "@/actions/session";
import { GUIDE_STEPS, ROLE_LABEL, type GuideRole } from "@/components/dashboard/RoleGuide";
import { cn } from "@/lib/utils";

const ALL_ROLES: GuideRole[] = ["owner", "admin", "designer_sales", "operator", "gudang"];

// ── Menu tiap peran ────────────────────────────────────────────────────────
type MenuItem = { label: string; href: string; icon: typeof LayoutDashboard; desc: string };

const MENUS: Record<GuideRole, MenuItem[]> = {
  owner: [
    { label: "Dashboard", href: "/owner", icon: LayoutDashboard, desc: "Ringkasan: KPI, alert kritis, antrian approval (diskon / rework / audit / pembatalan), pipeline produksi, absensi hari ini." },
    { label: "Produksi & Laporan", href: "/admin/production", icon: BarChart2, desc: "Papan mesin: job yang sedang jalan per mesin, alihkan job (reassign) ke mesin/operator lain, pantau rework." },
    { label: "Pegawai & Akses", href: "/owner/users", icon: Users, desc: "Tambah pegawai, atur peran (bisa lebih dari satu), reset kata sandi, buka akun terkunci, nonaktifkan pegawai keluar." },
    { label: "Laporan Bulanan", href: "/owner/reports", icon: BarChart2, desc: "Rekap per bulan: omzet bruto/neto, piutang, diskon, DP hangus, produk terlaris, mesin tersibuk, waste, kinerja. Bisa diekspor CSV." },
    { label: "Pengaturan Absensi", href: "/owner/attendance-settings", icon: Clock, desc: "Jam kerja & batas telat, hari kerja, geofence lokasi kantor, wajib selfie, jalur absen (HP pribadi / kiosk), dan pengelolaan perangkat kiosk + PIN pegawai." },
    { label: "Absensi Pegawai", href: "/admin/attendance", icon: Clock, desc: "Rekap kehadiran: absen in-app (HP/kiosk) + impor CSV fingerprint sebagai cadangan. Lihat sumber, lokasi, selfie, keterlambatan; beri catatan (tanpa mengubah data)." },
    { label: "Gaji Pegawai", href: "/admin/payroll", icon: Wallet, desc: "Hitung gaji per periode berbasis kehadiran + potongan keterlambatan." },
    { label: "Scan QR", href: "/scan", icon: ScanLine, desc: "Pindai kode job / lokasi rak untuk melihat detail dan menjalankan aksi sesuai tahap." },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard, desc: "KPI order, daftar order dengan filter status, buat order baru, catat pembayaran, submit audit akhir, bekukan/cairkan order." },
    { label: "POS / Kasir", href: "/pos", icon: ShoppingCart, desc: "Penjualan eceran cepat (barang jadi): pilih barang, hitung total + PPN, terima bayar lunas — langsung selesai, stok berkurang otomatis." },
    { label: "Katalog & Harga", href: "/admin/products", icon: Tag, desc: "Kelola barang eceran, jasa cetak (bahan + mesin default + harga), dan daftar mesin cetak. Wajib diisi sebelum buat order." },
    { label: "Database Pelanggan", href: "/admin/customers", icon: Users, desc: "Data pelanggan, tipe (umum / member / reseller), riwayat order. Pelanggan baru juga bisa dibuat langsung saat buat order." },
    { label: "Produksi & Laporan", href: "/admin/production", icon: BarChart2, desc: "Pantau job produksi per mesin, alihkan job (maks. 2x mandiri per 24 jam, lebih dari itu minta Owner)." },
    { label: "Laporan", href: "/admin/reports", icon: BarChart2, desc: "Pendapatan harian, grafik 7 hari, piutang berjalan, kinerja operator. Ekspor CSV." },
    { label: "Absensi & Gaji", href: "/admin/attendance", icon: Clock, desc: "Impor & rekap absensi, hitung gaji per periode." },
    { label: "Scan QR", href: "/scan", icon: ScanLine, desc: "Pindai job untuk lihat status, atau lakukan serah terima barang." },
  ],
  designer_sales: [
    { label: "Dashboard", href: "/designer", icon: Palette, desc: "Kartu Absensi (absen masuk/pulang + istirahat), lalu antrian job desain: PENDING (belum ada versi), sedang dikerjakan, sudah disetujui." },
    { label: "Buat Order Baru", href: "/designer", icon: ShoppingCart, desc: "Designer juga boleh membuat order (sama seperti Admin) — lewat tombol di dashboard." },
    { label: "Scan QR", href: "/scan", icon: ScanLine, desc: "Pindai kode job untuk membuka detailnya." },
  ],
  operator: [
    { label: "Dashboard", href: "/operator", icon: Settings2, desc: "Kartu Absensi (absen masuk/pulang + istirahat), job Anda yang aktif, dan antrian job yang bisa diklaim. Maksimal 1 job aktif per operator." },
    { label: "Scan QR", href: "/scan", icon: ScanLine, desc: "Pindai kode job di lembar kerja: Mulai (SCAN 1), lalu Selesai + catat hasil (SCAN 2)." },
  ],
  gudang: [
    { label: "Dashboard Gudang & Finishing", href: "/finishing", icon: Package, desc: "Kartu Absensi di atas, lalu empat tab: QC (inspeksi), Finishing (penyelesaian + cetak label), Storage (simpan ke rak & serah counter), Material (stok bahan baku)." },
    { label: "Scan QR", href: "/scan", icon: ScanLine, desc: "Pindai job untuk QC / finishing / simpan rak, atau pindai lokasi rak." },
  ],
};

// ── Alur Scan QR (lintas peran) ────────────────────────────────────────────
const SCAN_FLOW: { code: string; who: string; what: string }[] = [
  { code: "SCAN 1", who: "Operator", what: "Mulai produksi. Job berpindah ke PRODUCTION_STARTED. Job antrian tanpa operator otomatis jadi milik yang scan." },
  { code: "SCAN 2", who: "Operator", what: "Selesai produksi: isi jumlah aktual + pemakaian bahan (wajib) + waste bila ada. Job → QC_PENDING." },
  { code: "SCAN 3", who: "Gudang", what: "QC: PASS → lanjut finishing. FAIL → isi kategori + deskripsi (min. 20 karakter), Owner memutuskan rework." },
  { code: "SCAN 4", who: "Gudang", what: "Mulai finishing (laminasi / potong / jahit / mata ayam, dll.)." },
  { code: "SCAN 5", who: "Gudang", what: "Selesai finishing: isi jumlah akhir. Label QR bisa dicetak dari sini." },
  { code: "SCAN 6–7", who: "Gudang", what: "Simpan ke rak: pindai job lalu pindai lokasi rak. Barang tersimpan, order → READY_FOR_PICKUP, notifikasi terkirim ke pelanggan." },
  { code: "SCAN 9", who: "Gudang / Admin", what: "Pelanggan datang: konfirmasi barang di counter. Slot rak otomatis kosong lagi." },
  { code: "SCAN 10", who: "Admin / Owner", what: "Serah terima akhir. Kalau masih ada sisa tagihan, hanya Owner (dengan alasan) yang bisa merilis. Order → audit akhir." },
];

// ── Status order (dikelompokkan) ──────────────────────────────────────────
const STATUS_PHASES: { phase: string; states: string; note: string }[] = [
  { phase: "Order & desain", states: "DRAFT → DESIGNING → WAITING_APPROVAL → APPROVED", note: "Order dibuat, desain dikerjakan & disetujui." },
  { phase: "Pembayaran", states: "WAITING_PAYMENT → CONFIRMED", note: "Menunggu DP; lunas-minimal → CONFIRMED, order siap masuk produksi." },
  { phase: "Produksi", states: "PRODUCTION_QUEUED / PRODUCTION_ASSIGNED → PRODUCTION_STARTED → PRODUCTION_COMPLETE", note: "Antrian job → dikerjakan operator → selesai cetak." },
  { phase: "QC", states: "QC_PENDING → QC_PASSED  •  atau  QC_REWORK_PENDING", note: "Lulus lanjut; gagal menunggu keputusan Owner." },
  { phase: "Finishing & rak", states: "FINISHING_STARTED → FINISHING_COMPLETE → STORAGE_PENDING → STORED → READY_FOR_PICKUP", note: "Penyelesaian lalu disimpan; siap diambil pelanggan." },
  { phase: "Serah terima & tutup", states: "IN_TRANSIT → PICKED_UP → FINAL_AUDIT_PENDING → CLOSED", note: "Barang keluar, audit akhir, order selesai." },
  { phase: "Kondisi khusus", states: "ON_HOLD  •  CANCELLED  •  INCIDENT", note: "Dibekukan Owner • dibatalkan • barang bermasalah di rak." },
];

// ── Istilah ───────────────────────────────────────────────────────────────
const GLOSSARY: { term: string; def: string }[] = [
  { term: "DP (uang muka)", def: "Pembayaran awal sebelum produksi jalan. Persentase minimal diatur sistem; Owner bisa menurunkannya dengan alasan." },
  { term: "Pelunasan", def: "Sisa pembayaran setelah DP. Order dengan sisa tagihan tidak bisa diserahkan tanpa izin Owner." },
  { term: "Makloon", def: "Order dari sesama percetakan / reseller — desain dianggap sudah beres, tidak lewat approval pelanggan." },
  { term: "Walk-in", def: "Pelanggan datang langsung ke toko. Approval desain lebih longgar dari order ONLINE." },
  { term: "Waste", def: "Bahan/hasil yang terbuang saat produksi (salah warna, mampet, dll.). Wajib dicatat operator supaya stok & biaya akurat." },
  { term: "Rework", def: "Cetak/perbaikan ulang setelah QC gagal. Keputusannya di tangan Owner: perbaiki, cetak ulang, atau tahan." },
  { term: "Reassign", def: "Memindahkan job ke mesin/operator lain. Admin maksimal 2x per 24 jam untuk satu job; lebih dari itu minta Owner." },
  { term: "Audit akhir", def: "Pemeriksaan sebelum order ditutup. Hijau → langsung CLOSED, kuning → perlu persetujuan Owner, merah → order ditahan." },
  { term: "Koreksi", def: "Perbaikan data setelah order CLOSED. Tidak mengubah data asli — dibuat sebagai catatan baru, kategori finansial perlu Owner." },
  { term: "Freeze / bekukan", def: "Owner memarkir order di ON_HOLD sementara (mis. menunggu konfirmasi pelanggan), lalu mencairkannya kembali." },
  { term: "Kiosk absensi", def: "Satu tablet/PC bersama di kantor untuk absen tanpa login. Owner membuatnya di Pengaturan Absensi, membuka /kiosk di perangkat itu, lalu menempel token. Pegawai memilih namanya + PIN 4–6 digit." },
  { term: "Geofence", def: "Area kantor (titik + radius) untuk absen. Mode: OFF, Catat & tandai (di luar area ditandai untuk Owner), atau Tolak absen (di luar area ditolak)." },
];

// ── FAQ ───────────────────────────────────────────────────────────────────
const FAQ: { q: string; a: string }[] = [
  { q: "Saya menjalankan percetakan sendiri tanpa pegawai — bisa?", a: "Bisa. Saat mendaftar, akun Owner otomatis diberi semua peran (Admin, Designer, Operator, Gudang), jadi Anda bisa mengerjakan seluruh alur sendiri — dari order sampai barang diserahkan. Di Dashboard Owner ada panel \"Langkah berikutnya\" yang menunjukkan aksi tahap berikut untuk tiap order. Saat mulai merekrut, buka Pegawai & Akses lalu cabut peran yang tidak lagi Anda pegang." },
  { q: "Bedanya buat Order dan POS / Kasir apa?", a: "Order (dashboard Admin) = pekerjaan cetak yang lewat desain → produksi → QC → finishing → ambil, dengan DP & pelunasan. POS / Kasir = jual barang jadi yang sudah ada di rak (ATK, souvenir): pilih barang, sistem hitung total + PPN, pelanggan bayar lunas, transaksi langsung selesai dan stok berkurang. Tidak ada produksi." },
  { q: "Bagaimana pegawai absen di aplikasi?", a: "Di dashboard pegawai (Operator / Gudang / Designer) ada kartu \"Absensi Hari Ini\". Tekan Absen Masuk — aplikasi meminta izin lokasi dan (kalau diwajibkan Owner) foto selfie. Di kartu yang sama ada tombol Mulai / Selesai Istirahat dan Absen Pulang. Waktu diambil dari server dan tidak bisa diubah siapa pun. Owner mengatur jam kerja, batas telat, geofence, dan wajib-selfie di Pengaturan Absensi." },
  { q: "Apa itu absen lewat kiosk?", a: "Alternatif tanpa HP pribadi: satu tablet/PC bersama di kantor. Owner membuat perangkat kiosk di Pengaturan Absensi, membuka /kiosk di perangkat itu, lalu menempel token (sekali). Tiap pegawai diberi PIN 4–6 digit di halaman yang sama. Di kiosk: pilih nama → masukkan PIN → (selfie) → Absen Masuk/Pulang. Owner bisa menonaktifkan absen dari HP pribadi sehingga hanya kiosk yang dipakai." },
  { q: "Masih perlu mesin fingerprint?", a: "Tidak wajib. Absen in-app (HP / kiosk) adalah cara utama. Impor CSV dari mesin fingerprint tetap tersedia sebagai cadangan / rekonsiliasi — kalau ada baris in-app untuk hari yang sama, data in-app yang dipakai dan impor hanya mengisi yang kosong; selisih besar ditandai untuk Owner." },
  { q: "Bagaimana format file absensi untuk diimpor?", a: "File CSV hasil ekspor mesin fingerprint. Dua bentuk didukung: (1) “harian” — satu baris per pegawai per hari dengan kolom jam masuk & jam pulang; (2) “scan log” — satu baris per sadap, sistem menggabungkan per nama+tanggal (paling awal = masuk, paling akhir = pulang). Saat impor, cocokkan kolom Nama, Tanggal, Jam Masuk/Pulang lewat dropdown; nama pegawai dicocokkan ke akun berdasarkan nama atau username. Tanggal menerima DD/MM/YYYY maupun YYYY-MM-DD." },
  { q: "Kenapa order saya tidak muncul di antrian produksi?", a: "Order baru masuk produksi setelah CONFIRMED (DP terpenuhi) dan lengkap: desain ACC, semua item punya produk + bahan + harga, deadline terisi. Kalau produk item belum punya “Mesin Default”, sistem tidak bisa merilis otomatis — Admin pakai tombol Assign manual." },
  { q: "Kenapa saya tidak bisa mulai job padahal ada di daftar?", a: "Operator hanya boleh 1 job aktif dalam satu waktu. Selesaikan atau jeda job yang sekarang dulu. Job antrian (PRODUCTION_QUEUED) bisa diklaim siapa saja; job yang sudah dipin ke operator lain tidak." },
  { q: "Diskon yang saya ajukan belum berlaku.", a: "Diskon menunggu keputusan Owner. Selama itu total order tetap harga penuh dan order tidak lanjut ke produksi. Owner menyetujui/menolak dari Dashboard." },
  { q: "Barang sudah selesai tapi tidak bisa diserahkan.", a: "Order dengan sisa tagihan > 0 hanya bisa dirilis oleh Owner dengan mencantumkan alasan. Selesaikan pelunasan lebih dulu atau minta Owner." },
  { q: "Salah catat jumlah / bahan setelah order tutup.", a: "Jangan edit data lama. Buat Koreksi — Owner untuk semua kategori, Admin hanya non-finansial dan perlu persetujuan Owner." },
  { q: "Lupa kata sandi.", a: "Owner me-reset kata sandi pegawai dari menu Pegawai & Akses. Untuk akun Owner sendiri, gunakan tautan “Lupa kata sandi” di halaman login (butuh email terpasang) atau hubungi admin sistem." },
  { q: "Akun terkunci.", a: "Terlalu banyak salah kata sandi mengunci akun sementara (durasi bertahap). Owner bisa membuka lewat menu Pegawai & Akses." },
];

// ── Page ──────────────────────────────────────────────────────────────────

export default function BantuanPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [active, setActive] = useState<GuideRole>("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    getSessionUser().then((r) => {
      if (!r.ok) return;
      const rs = (r.user.roles?.length ? r.user.roles : [r.user.role]).filter(Boolean) as string[];
      setRoles(rs);
      const first = ALL_ROLES.find((x) => rs.includes(x));
      if (first) setActive(first);
    });
  }, []);

  const myGuideRoles = ALL_ROLES.filter((r) => roles.includes(r));
  const tabs = myGuideRoles.length > 0 ? myGuideRoles : ALL_ROLES;

  const q = searchQuery.toLowerCase();
  
  // `s.body` bisa berupa JSX (ReactNode), bukan selalu string — hanya cocokkan
  // yang string. Judul tetap dicari untuk semua langkah.
  const filteredSteps = GUIDE_STEPS[active].filter(
    (s) => s.title.toLowerCase().includes(q) || (typeof s.body === "string" && s.body.toLowerCase().includes(q))
  );
  const filteredMenus = MENUS[active].filter(m => m.label.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q));
  const filteredScanFlow = SCAN_FLOW.filter(s => s.code.toLowerCase().includes(q) || s.who.toLowerCase().includes(q) || s.what.toLowerCase().includes(q));
  const filteredStatus = STATUS_PHASES.filter(s => s.phase.toLowerCase().includes(q) || s.states.toLowerCase().includes(q) || s.note.toLowerCase().includes(q));
  const filteredGlossary = GLOSSARY.filter(g => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q));
  const filteredFAQ = FAQ.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      <div className="bg-gradient-to-r from-accent-teal/10 to-transparent p-6 sm:p-8 rounded-3xl border border-accent-teal/20">
        <h1 className="text-3xl font-extrabold text-primary flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-accent-teal" /> Pusat Bantuan
        </h1>
        <p className="text-base text-muted mt-2 max-w-2xl">
          Cari panduan penggunaan, arti status order, alur kerja, hingga glosarium istilah di Print Pilot.
        </p>

        <div className="mt-6 relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input
            type="text"
            placeholder="Cari kata kunci (misal: DP, Rework, Absen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-background border border-border rounded-2xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal shadow-sm text-sm text-primary transition-all"
          />
        </div>
      </div>

      {/* Pemilih peran */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((r) => (
          <button
            key={r}
            onClick={() => setActive(r)}
            className={`px-3 h-9 rounded-lg text-xs font-bold border transition-colors ${
              active === r
                ? "bg-accent-teal/15 text-accent-teal border-accent-teal/30"
                : "bg-elevated text-muted border-border hover:text-primary"
            }`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      {/* Alur kerja harian */}
      {filteredSteps.length > 0 && (
        <Section icon={ListChecks} title={`Alur kerja harian — ${ROLE_LABEL[active]}`}>
          <ol className="space-y-4">
            {filteredSteps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="shrink-0 mt-0.5 h-6 w-6 rounded-full bg-accent-teal/10 border border-accent-teal/20 text-[11px] font-bold text-accent-teal flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-primary">{s.title}</p>
                  <p className="text-xs text-muted leading-relaxed mt-1">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Menu & fungsinya */}
      {filteredMenus.length > 0 && (
        <Section icon={LayoutDashboard} title="Menu & fungsinya">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredMenus.map((m) => (
              <li key={m.label + m.href} className="flex gap-3 p-4 rounded-xl border border-border bg-base hover:border-accent-teal/50 hover:shadow-sm transition-all group">
                <span className="inline-flex p-2 rounded-lg bg-elevated shrink-0 h-fit group-hover:bg-accent-teal/10 transition-colors">
                  <m.icon className="h-5 w-5 text-accent-teal" />
                </span>
                <div>
                  <Link href={m.href} className="text-sm font-bold text-primary group-hover:text-accent-teal transition-colors">
                    {m.label}
                  </Link>
                  <p className="text-xs text-muted leading-relaxed mt-1">{m.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Scan QR */}
      {filteredScanFlow.length > 0 && (
        <Section icon={ScanLine} title="Alur Scan QR (SCAN 1–10)">
          <p className="text-xs text-muted mb-6 bg-elevated p-3 rounded-xl border border-border">
            Tiap job punya kode QR di lembar kerja. Pindai di menu <b>Scan QR</b>; aksi yang muncul menyesuaikan tahap job dan peran Anda.
          </p>
          <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {filteredScanFlow.map((s, i) => (
              <div key={s.code} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="absolute left-[-24px] flex items-center justify-center w-5 h-5 rounded-full border-2 border-background bg-accent-teal text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 md:left-1/2">
                  <div className="h-2 w-2 bg-white rounded-full"></div>
                </div>
                <div className="w-full md:w-[calc(50%-2rem)] bg-base p-4 rounded-xl border border-border shadow-sm group-hover:border-accent-teal/50 transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-xs bg-accent-teal/10 text-accent-teal px-2 py-0.5 rounded">{s.code}</span>
                    <span className="text-xs font-bold text-primary">{s.who}</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{s.what}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Status order */}
      {filteredStatus.length > 0 && (
        <Section icon={Boxes} title="Arti status order">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredStatus.map((p) => (
              <div key={p.phase} className="p-4 rounded-xl border border-border bg-base hover:border-accent-teal/30 transition-all">
                <p className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent-teal"></span> {p.phase}
                </p>
                <p className="text-[11px] font-mono text-accent-teal bg-accent-teal/5 p-2 rounded mb-2 break-words leading-relaxed">{p.states}</p>
                <p className="text-xs text-muted leading-relaxed">{p.note}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Istilah */}
      {filteredGlossary.length > 0 && (
        <Section icon={Tag} title="Istilah penting">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredGlossary.map((g) => (
              <div key={g.term} className="p-4 rounded-xl border border-border bg-base hover:border-accent-teal/30 transition-all">
                <dt className="text-sm font-bold text-primary mb-1">{g.term}</dt>
                <dd className="text-xs text-muted leading-relaxed">{g.def}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* FAQ */}
      {filteredFAQ.length > 0 && (
        <Section icon={HelpCircle} title="Tanya jawab (FAQ)">
          <div className="space-y-3">
            {filteredFAQ.map((f, i) => {
              const isOpen = openFaqIndex === i;
              return (
                <div key={i} className={cn("border border-border rounded-xl transition-all duration-300 overflow-hidden", isOpen ? "bg-base shadow-sm border-accent-teal/30" : "bg-card hover:bg-base")}>
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
                  >
                    <span className="text-sm font-bold text-primary pr-4">{f.q}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted transition-transform duration-300 shrink-0", isOpen && "rotate-180 text-accent-teal")} />
                  </button>
                  <div className={cn("px-4 pb-4 text-xs text-muted leading-relaxed transition-all duration-300", isOpen ? "block" : "hidden")}>
                    {f.a}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {q && filteredSteps.length === 0 && filteredMenus.length === 0 && filteredScanFlow.length === 0 && filteredStatus.length === 0 && filteredGlossary.length === 0 && filteredFAQ.length === 0 && (
        <div className="text-center py-12 px-4 bg-card border border-border rounded-2xl">
          <Search className="h-10 w-10 text-muted mx-auto mb-3 opacity-30" />
          <h3 className="text-lg font-bold text-primary mb-1">Tidak ditemukan</h3>
          <p className="text-sm text-muted">Tidak ada hasil yang cocok dengan kata kunci "{searchQuery}".</p>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof LayoutDashboard; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-accent-teal" /> {title}
      </h2>
      {children}
    </section>
  );
}
