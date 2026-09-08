"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen, LayoutDashboard, ScanLine, ShoppingCart, Tag, Users, BarChart2,
  Clock, Wallet, Palette, Settings2, Package, HelpCircle, ListChecks, Boxes,
} from "lucide-react";
import { getSessionUser } from "@/actions/session";
import { GUIDE_STEPS, ROLE_LABEL, type GuideRole } from "@/components/dashboard/RoleGuide";

const ALL_ROLES: GuideRole[] = ["owner", "admin", "designer_sales", "operator", "gudang"];

// ── Menu tiap peran ────────────────────────────────────────────────────────
type MenuItem = { label: string; href: string; icon: typeof LayoutDashboard; desc: string };

const MENUS: Record<GuideRole, MenuItem[]> = {
  owner: [
    { label: "Dashboard", href: "/owner", icon: LayoutDashboard, desc: "Ringkasan: KPI, alert kritis, antrian approval (diskon / rework / audit / pembatalan), pipeline produksi, absensi hari ini." },
    { label: "Produksi & Laporan", href: "/admin/production", icon: BarChart2, desc: "Papan mesin: job yang sedang jalan per mesin, alihkan job (reassign) ke mesin/operator lain, pantau rework." },
    { label: "Pegawai & Akses", href: "/owner/users", icon: Users, desc: "Tambah pegawai, atur peran (bisa lebih dari satu), reset kata sandi, buka akun terkunci, nonaktifkan pegawai keluar." },
    { label: "Laporan Bulanan", href: "/owner/reports", icon: BarChart2, desc: "Rekap per bulan: omzet bruto/neto, piutang, diskon, DP hangus, produk terlaris, mesin tersibuk, waste, kinerja. Bisa diekspor CSV." },
    { label: "Absensi Pegawai", href: "/admin/attendance", icon: Clock, desc: "Impor absensi dari file CSV mesin fingerprint, lihat rekap kehadiran & keterlambatan, beri catatan (tanpa mengubah data)." },
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
    { label: "Dashboard", href: "/designer", icon: Palette, desc: "Antrian job desain: PENDING (belum ada versi), sedang dikerjakan, sudah disetujui. Buka job untuk mulai." },
    { label: "Buat Order Baru", href: "/designer", icon: ShoppingCart, desc: "Designer juga boleh membuat order (sama seperti Admin) — lewat tombol di dashboard." },
    { label: "Scan QR", href: "/scan", icon: ScanLine, desc: "Pindai kode job untuk membuka detailnya." },
  ],
  operator: [
    { label: "Dashboard", href: "/operator", icon: Settings2, desc: "Job Anda yang aktif + antrian job yang bisa diklaim. Maksimal 1 job aktif per operator." },
    { label: "Scan QR", href: "/scan", icon: ScanLine, desc: "Pindai kode job di lembar kerja: Mulai (SCAN 1), lalu Selesai + catat hasil (SCAN 2)." },
  ],
  gudang: [
    { label: "Dashboard Gudang & Finishing", href: "/finishing", icon: Package, desc: "Empat tab: QC (inspeksi), Finishing (penyelesaian + cetak label), Storage (simpan ke rak & serah counter), Material (stok bahan baku)." },
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
];

// ── FAQ ───────────────────────────────────────────────────────────────────
const FAQ: { q: string; a: string }[] = [
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

  const steps = GUIDE_STEPS[active];
  const menus = MENUS[active];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-accent-teal" /> Panduan Penggunaan
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Cara pakai aplikasi per peran, alur scan QR, arti status order, dan istilah. Baca kalau ada yang belum jelas.
        </p>
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
      <Section icon={ListChecks} title={`Alur kerja harian — ${ROLE_LABEL[active]}`}>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-elevated border border-border text-[11px] font-bold text-muted flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">{s.title}</p>
                <p className="text-xs text-muted leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Menu & fungsinya */}
      <Section icon={LayoutDashboard} title="Menu & fungsinya">
        <ul className="space-y-2.5">
          {menus.map((m) => (
            <li key={m.label + m.href} className="flex gap-3">
              <span className="inline-flex p-1.5 rounded-lg bg-elevated shrink-0 h-fit">
                <m.icon className="h-4 w-4 text-accent-teal" />
              </span>
              <div>
                <Link href={m.href} className="text-sm font-semibold text-primary hover:text-accent-teal">
                  {m.label}
                </Link>
                <p className="text-xs text-muted leading-relaxed">{m.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Scan QR */}
      <Section icon={ScanLine} title="Alur Scan QR (SCAN 1–10)">
        <p className="text-xs text-muted mb-3">
          Tiap job punya kode QR di lembar kerja. Pindai di menu <b>Scan QR</b>; aksi yang muncul menyesuaikan tahap job dan peran Anda.
        </p>
        <ul className="space-y-2">
          {SCAN_FLOW.map((s) => (
            <li key={s.code} className="grid grid-cols-[auto_1fr] gap-3 text-xs">
              <span className="font-mono font-bold text-accent-teal whitespace-nowrap">{s.code}</span>
              <span className="text-muted">
                <b className="text-primary">{s.who}.</b> {s.what}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Status order */}
      <Section icon={Boxes} title="Arti status order">
        <div className="space-y-2.5">
          {STATUS_PHASES.map((p) => (
            <div key={p.phase} className="border-l-2 border-border pl-3">
              <p className="text-sm font-semibold text-primary">{p.phase}</p>
              <p className="text-[11px] font-mono text-accent-teal break-words">{p.states}</p>
              <p className="text-xs text-muted">{p.note}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Istilah */}
      <Section icon={Tag} title="Istilah penting">
        <dl className="space-y-2">
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <dt className="text-sm font-semibold text-primary">{g.term}</dt>
              <dd className="text-xs text-muted leading-relaxed">{g.def}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* FAQ */}
      <Section icon={HelpCircle} title="Tanya jawab">
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-primary">{f.q}</p>
              <p className="text-xs text-muted leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>
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
