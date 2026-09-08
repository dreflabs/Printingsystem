"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type GuideRole = "owner" | "admin" | "designer_sales" | "operator" | "gudang";

type Step = { title: string; body: React.ReactNode };

export const ROLE_LABEL: Record<GuideRole, string> = {
  owner: "Owner",
  admin: "Admin / Kasir",
  designer_sales: "Designer / Setting",
  operator: "Operator Cetak",
  gudang: "Gudang & Finishing",
};

export const GUIDE_STEPS: Record<GuideRole, Step[]> = {
  owner: [
    { title: "Pantau Alert Kritis", body: "Kartu di atas mengumpulkan semua yang butuh keputusan Anda: diskon, rework, audit akhir, permintaan pembatalan, stok menipis." },
    { title: "Putuskan diskon", body: "Admin mengajukan diskon saat membuat order. Order tidak lanjut ke produksi sampai Anda menyetujui atau menolaknya." },
    { title: "Putuskan rework QC", body: "Kalau QC menemukan cacat, Anda memilih: perbaiki (rework), cetak ulang dari awal, atau tahan order." },
    { title: "Audit akhir sebelum tutup", body: "Setiap order lewat Audit Akhir sebelum berstatus CLOSED — hijau langsung tutup, kuning perlu persetujuan Anda." },
    { title: "Baca Laporan Bulanan", body: <>Tiap awal bulan buka <GuideLink href="/owner/reports">Laporan Bulanan</GuideLink> untuk omzet, piutang, waste, dan kinerja pegawai.</> },
  ],
  admin: [
    { title: "Buat order", body: <>Klik <b>+ Order Baru</b>. Pilih pelanggan (atau buat baru), tambah item jasa cetak dari katalog, isi ukuran & jumlah, tentukan deadline.</> },
    { title: "Terima DP", body: "Catat pembayaran DP di detail order. Order pindah ke CONFIRMED begitu DP minimal terpenuhi." },
    { title: "Pantau produksi", body: "Order yang lengkap otomatis rilis jadi antrian job produksi. Pakai halaman Produksi & Laporan untuk memantau." },
    { title: "Tangani pembayaran & piutang", body: "Tambah pelunasan kapan pun dari detail order. Order dengan sisa tagihan tidak bisa diserahkan tanpa izin Owner." },
    { title: "Rilis ke pelanggan", body: <>Setelah barang siap di rak, lakukan serah terima dari <GuideLink href="/pos">POS / Kasir</GuideLink> atau detail order (scan / rilis).</> },
  ],
  designer_sales: [
    { title: "Ambil job desain", body: "Antrian menampilkan job desain PENDING. Buka satu untuk mulai." },
    { title: "Upload versi desain", body: "Unggah file (PDF/AI/CDR/gambar). Tiap unggahan menambah nomor versi." },
    { title: "Tangani revisi", body: "Kalau pelanggan minta ubah, ajukan revisi — status kembali ke DESIGNING dan Anda unggah versi baru." },
    { title: "ACC desain", body: "Setelah final, ACC desain. Order lanjut ke pembayaran / produksi. Untuk order ONLINE, ACC butuh Admin/Owner." },
  ],
  operator: [
    { title: "Scan QR job", body: <>Di <GuideLink href="/scan">Scan QR</GuideLink>, pindai kode job pada lembar kerja. Kartu menampilkan status, jumlah rencana, dan pembayaran.</> },
    { title: "Mulai produksi (SCAN 1)", body: "Job antrian (PRODUCTION_QUEUED) bisa Anda klaim — begitu dimulai, job jadi tanggung jawab Anda. Hanya boleh 1 job aktif per operator." },
    { title: "Catat hasil (SCAN 2)", body: "Setelah selesai, isi jumlah aktual dan pemakaian bahan (wajib) + waste bila ada. Stok bahan otomatis berkurang." },
    { title: "Serahkan ke QC", body: "Job selesai otomatis masuk antrian QC di Gudang. Ambil job berikutnya." },
  ],
  gudang: [
    { title: "QC hasil produksi", body: "Tab QC: periksa hasil cetak. Lulus → lanjut finishing. Gagal → isi kategori + deskripsi (min. 20 karakter), Owner yang memutuskan rework." },
    { title: "Finishing", body: "Tab Finishing: kerjakan laminasi/potong/jahit, lalu tandai selesai dengan jumlah akhir. Cetak label QR di sini." },
    { title: "Simpan ke rak (SCAN 6–7)", body: "Tab Storage: scan job + scan lokasi rak. Barang tersimpan, order jadi READY_FOR_PICKUP, notifikasi ke pelanggan." },
    { title: "Serahkan di counter (SCAN 9)", body: "Saat pelanggan datang, konfirmasi barang di counter — slot rak otomatis kosong lagi." },
    { title: "Kelola stok bahan", body: "Tab Material: tambah bahan baku, sesuaikan stok, pantau bahan yang menipis." },
  ],
};

function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-accent-teal hover:underline">
      {children}
    </Link>
  );
}

// ── Setup checklist (Owner) ─────────────────────────────────────────────────

export type ChecklistItem = { key: string; done: boolean; count: number };
type Checklist = { items: ChecklistItem[]; doneCount: number; total: number; allDone: boolean };

const CHECKLIST_META: Record<string, { label: string; href: string; hint: string }> = {
  machine: { label: "Tambah mesin cetak", href: "/admin/products", hint: "Katalog & Harga → tab Mesin" },
  material: { label: "Tambah bahan baku", href: "/finishing", hint: "Gudang & Finishing → tab Material" },
  product: { label: "Buat katalog produk + harga", href: "/admin/products", hint: "jasa cetak & barang eceran" },
  staff: { label: "Tambah pegawai & atur peran", href: "/owner/users", hint: "Pegawai & Akses" },
  order: { label: "Buat order pertama", href: "/admin", hint: "tombol + Order Baru" },
};

// ── Component ───────────────────────────────────────────────────────────────

export function RoleGuide({ role, checklist }: { role: GuideRole; checklist?: Checklist | null }) {
  const storageKey = `pp_guide_${role}`;
  // Preferensi lipat per-peran. Server & render hidrasi pertama selalu `null`
  // (netral) supaya tidak ada mismatch; nilai asli dari localStorage dipasang
  // setelahnya via ref + state di bawah.
  const [open, setOpen] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      /* private mode / blocked */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(stored !== "0");
  }, [storageKey]);

  // `null` (belum terhidrasi) diperlakukan sebagai terbuka — default untuk
  // pengunjung baru, dan menghindari kedip collapse→expand saat mount.
  const isOpen = open ?? true;

  function toggle() {
    const next = !isOpen;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const steps = GUIDE_STEPS[role];
  const showChecklist = role === "owner" && checklist && !checklist.allDone;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-elevated/40 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="inline-flex p-1.5 rounded-lg bg-accent-teal/10">
          <BookOpen className="h-4 w-4 text-accent-teal" />
        </span>
        <span className="flex-1">
          <span className="text-sm font-bold text-primary">Panduan — {ROLE_LABEL[role]}</span>
          {showChecklist && (
            <span className="ml-2 text-[11px] font-bold text-accent-teal">
              Penyiapan {checklist!.doneCount}/{checklist!.total}
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/60">
          {showChecklist && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted mt-3 mb-2">
                Langkah menyiapkan toko
              </p>
              <ul className="space-y-1.5">
                {checklist!.items.map((it) => {
                  const meta = CHECKLIST_META[it.key];
                  if (!meta) return null;
                  return (
                    <li key={it.key}>
                      <Link
                        href={meta.href}
                        className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 hover:bg-elevated/60"
                      >
                        {it.done ? (
                          <CheckCircle2 className="h-4 w-4 text-status-green shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted shrink-0" />
                        )}
                        <span className={cn("text-sm", it.done ? "text-muted line-through" : "text-primary")}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-muted hidden sm:inline">· {meta.hint}</span>
                        {it.done && it.count > 0 && (
                          <span className="text-[11px] text-status-green">({it.count})</span>
                        )}
                        {!it.done && (
                          <ArrowRight className="h-3.5 w-3.5 text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            {showChecklist && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted mt-3 mb-2">Alur harian</p>
            )}
            <ol className="space-y-2.5 mt-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-elevated border border-border text-[11px] font-bold text-muted flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">{s.title}</p>
                    <p className="text-xs text-muted leading-relaxed">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/bantuan"
              className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-accent-teal hover:underline"
            >
              Panduan lengkap — menu, scan QR, arti status, istilah <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
