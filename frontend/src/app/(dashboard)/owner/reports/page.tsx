"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, TrendingUp, Wallet, PackageX, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMonthlyReport } from "@/actions/reports";
import { toCsv, downloadCsv } from "@/lib/csv";

type Report = Extract<Awaited<ReturnType<typeof getMonthlyReport>>, { success: true }>["data"];

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function OwnerReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getMonthlyReport(month);
    if (res.success) setReport(res.data);
    else {
      setError(res.error);
      setReport(null);
    }
    setLoading(false);
  }, [month]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!report) return;
    const f = report.financial;
    const o = report.operational;
    const rows: (string | number)[][] = [
      ["Laporan Bulanan Owner", report.period],
      ["Periode", `${report.periodStart} s/d ${report.periodEnd}`],
      ["Dibuat", new Date().toLocaleString("id-ID")],
      [],
      ["FINANSIAL", "Nilai"],
      ["Omset bruto (gabungan)", f.omsetBruto],
      ["Omset bruto printing", f.omsetBrutoPrinting],
      ["Total diskon", f.totalDiskon],
      ["Omset neto", f.omsetNeto],
      ["Pendapatan masuk (kas)", f.pendapatanMasuk],
      ["Pendapatan retail", f.retailRevenue],
      ["Kontribusi retail", pct(f.retailPctOfBruto)],
      ["Piutang akhir periode", f.piutangAkhirPeriode],
      ["DP hangus (cancel)", f.dpHangus],
      ["Jumlah order printing", f.jumlahOrderPrinting],
      ["Jumlah transaksi retail", f.jumlahTransaksiRetail],
      ["Order selesai", f.orderSelesai],
      ["Order dibatalkan", f.orderDibatalkan],
      ["Rata-rata nilai order printing", Math.round(f.avgOrderValue)],
      ["Rata-rata nilai transaksi retail", Math.round(f.avgRetailValue)],
      [],
      ["OPERASIONAL", "Nilai"],
      ["Total order (semua tipe)", o.totalOrder],
      ["Order diambil dalam periode", o.pickedUpInPeriod],
      ["Tingkat penyelesaian", pct(o.completionRate)],
      ["Tingkat pembatalan", pct(o.cancelRate)],
      ["Order overdue", o.orderOverdue],
      ["Rata-rata waktu penyelesaian (hari)", o.avgCompletionDays.toFixed(1)],
      ["Total output (pcs)", o.totalOutput],
      ["Total waste (pcs)", o.totalWaste],
      ["Persentase waste", pct(o.wastePct)],
      ["QC FAIL", o.qcFail],
      ["Rework", o.reworkCount],
      ["Eskalasi ke Owner", o.ownerEscalations],
      ["Exception audit (YELLOW/RED)", o.auditExceptionCount],
      [],
      ["PRODUK PRINTING TERLARIS", "Qty"],
      ...f.topPrinting.map((p) => [p.name, p.qty]),
      [],
      ["PRODUK RETAIL TERLARIS", "Qty"],
      ...f.topRetail.map((p) => [p.name, p.qty]),
      [],
      ["MESIN TERSIBUK", "Jam"],
      ...f.mesinTersibuk.map((m) => [m.name, m.hours]),
      [],
      ["PENYELESAIAN PER KATEGORI", "Total", "Tepat Waktu", "Terlambat", "Dibatalkan", "Tingkat Penyelesaian"],
      ...report.completionByCategory.map((c) => [c.category, c.total, c.onTime, c.late, c.cancelled, pct(c.completionRate)]),
      [],
      ["EXCEPTION AUDIT", "Kode Order", "Hasil", "Kategori", "Tindak Lanjut", "Catatan"],
      ...report.auditExceptions.map((a) => ["", a.orderCode, a.result, a.categories, a.followUp, a.note]),
    ];
    downloadCsv(`laporan-bulanan-${report.period}.csv`, toCsv(rows));
  };

  const f = report?.financial;
  const o = report?.operational;

  const kpi = report && f && o
    ? [
        { label: "Omset Neto", value: rupiah(f.omsetNeto), sub: `Bruto ${rupiah(f.omsetBruto)}`, icon: TrendingUp, color: "text-status-green", bg: "bg-status-green/10" },
        { label: "Pendapatan Masuk", value: rupiah(f.pendapatanMasuk), sub: `Retail ${pct(f.retailPctOfBruto)}`, icon: Wallet, color: "text-accent-teal", bg: "bg-accent-teal/10" },
        { label: "Tingkat Penyelesaian", value: pct(o.completionRate), sub: `${f.orderSelesai}/${f.jumlahOrderPrinting} order`, icon: CheckCircle2, color: "text-accent-teal", bg: "bg-accent-teal/10" },
        { label: "Persentase Waste", value: pct(o.wastePct), sub: `${o.totalWaste} pcs`, icon: PackageX, color: o.wastePct > 0.1 ? "text-status-red" : "text-status-green", bg: "bg-status-red/10" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Laporan Bulanan Owner</h1>
          <p className="text-sm text-muted mt-0.5">Ringkasan finansial &amp; operasional per bulan kalender</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal"
          />
          <button
            onClick={load}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-elevated border border-border text-muted hover:text-primary hover:border-accent-teal transition-all"
            title="Muat ulang"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={exportCsv}
            disabled={!report}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40 transition-all shadow-sm"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}
      {loading && !report && <p className="text-sm text-muted">Memuat laporan…</p>}

      {report && f && o && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpi.map((k) => (
              <div key={k.label} className="bg-card border border-border rounded-2xl p-5 shadow-card">
                <div className={cn("p-2 rounded-xl w-fit mb-3", k.bg)}><k.icon className={cn("h-5 w-5", k.color)} /></div>
                <p className="text-2xl font-bold text-primary">{k.value}</p>
                <p className="text-xs text-muted font-medium mt-1">{k.label}</p>
                <p className="text-[11px] text-muted/70 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Finansial + Operasional detail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Ringkasan Finansial" note="Sumber: FINANCIAL-REPORT §3">
              <Row label="Omset bruto (gabungan)" value={rupiah(f.omsetBruto)} />
              <Row label="— Omset bruto printing" value={rupiah(f.omsetBrutoPrinting)} muted />
              <Row label="— Pendapatan retail" value={rupiah(f.retailRevenue)} muted />
              <Row label="Total diskon" value={`- ${rupiah(f.totalDiskon)}`} />
              <Row label="Omset neto" value={rupiah(f.omsetNeto)} strong />
              <Row label="Pendapatan masuk (kas)" value={rupiah(f.pendapatanMasuk)} />
              <Row label="Piutang akhir periode" value={rupiah(f.piutangAkhirPeriode)} />
              <Row label="DP hangus (cancel)" value={rupiah(f.dpHangus)} />
              <Row label="Jumlah order printing" value={String(f.jumlahOrderPrinting)} />
              <Row label="Jumlah transaksi retail" value={String(f.jumlahTransaksiRetail)} />
              <Row label="Rata-rata nilai order printing" value={rupiah(f.avgOrderValue)} />
              <Row label="Rata-rata nilai transaksi retail" value={rupiah(f.avgRetailValue)} />
            </Section>

            <Section title="Ringkasan Operasional" note="Sumber: MONTHLY-OWNER-REPORT">
              <Row label="Total order (semua tipe)" value={String(o.totalOrder)} />
              <Row label="Order selesai (dibuat & tuntas)" value={`${f.orderSelesai} (${pct(o.completionRate)})`} />
              <Row label="Order diambil dalam periode" value={String(o.pickedUpInPeriod)} muted />
              <Row label="Order dibatalkan" value={`${o.orderDibatalkan} (${pct(o.cancelRate)})`} />
              <Row label="Order overdue" value={String(o.orderOverdue)} />
              <Row label="Rata-rata waktu penyelesaian" value={`${o.avgCompletionDays.toFixed(1)} hari`} />
              <Row label="Total output" value={`${o.totalOutput} pcs`} />
              <Row label="Total waste" value={`${o.totalWaste} pcs (${pct(o.wastePct)})`} strong={o.wastePct > 0.1} />
              <Row label="QC FAIL" value={String(o.qcFail)} />
              <Row label="Rework" value={String(o.reworkCount)} />
              <Row label="Eskalasi ke Owner (rework 2×)" value={String(o.ownerEscalations)} />
              <Row label="Exception audit (YELLOW/RED)" value={String(o.auditExceptionCount)} />
            </Section>
          </div>

          {/* Top lists */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TopList title="Produk Printing Terlaris" items={f.topPrinting.map((p) => ({ name: p.name, val: `${p.qty} pcs` }))} />
            <TopList title="Produk Retail Terlaris" items={f.topRetail.map((p) => ({ name: p.name, val: `${p.qty} pcs` }))} />
            <TopList title="Mesin Tersibuk" items={f.mesinTersibuk.map((m) => ({ name: m.name, val: `${m.hours} jam` }))} />
          </div>

          {/* Completion per kategori */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-accent-teal" />
              <h3 className="text-base font-bold text-primary">Tingkat Penyelesaian per Kategori Produk</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Tepat Waktu</th><th className="px-4 py-3">Terlambat</th>
                    <th className="px-4 py-3">Dibatalkan</th><th className="px-4 py-3">Penyelesaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {report.completionByCategory.map((c) => (
                    <tr key={c.category} className="hover:bg-elevated/30">
                      <td className="px-4 py-3 font-medium text-primary">{c.category}</td>
                      <td className="px-4 py-3 text-muted">{c.total}</td>
                      <td className="px-4 py-3 text-status-green">{c.onTime}</td>
                      <td className="px-4 py-3 text-status-yellow-text">{c.late}</td>
                      <td className="px-4 py-3 text-status-red">{c.cancelled}</td>
                      <td className={cn("px-4 py-3 font-bold", c.completionRate >= 0.8 ? "text-status-green" : "text-status-yellow-text")}>
                        {pct(c.completionRate)}
                      </td>
                    </tr>
                  ))}
                  {report.completionByCategory.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Belum ada order dalam periode ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exception audit */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-yellow-text" />
              <h3 className="text-base font-bold text-primary">Audit Exception Bulanan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Kode Order</th><th className="px-4 py-3">Hasil</th>
                    <th className="px-4 py-3">Kategori</th><th className="px-4 py-3">Tindak Lanjut</th>
                    <th className="px-4 py-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {report.auditExceptions.map((a, i) => (
                    <tr key={`${a.orderCode}-${i}`} className="hover:bg-elevated/30">
                      <td className="px-4 py-3 font-mono text-accent-teal font-bold">{a.orderCode}</td>
                      <td className={cn("px-4 py-3 font-bold", a.result === "RED" ? "text-status-red" : "text-status-yellow-text")}>{a.result}</td>
                      <td className="px-4 py-3 text-muted">{a.categories}</td>
                      <td className={cn("px-4 py-3 text-xs font-semibold", a.followUp === "Selesai" ? "text-status-green" : "text-status-yellow-text")}>{a.followUp}</td>
                      <td className="px-4 py-3 text-xs text-muted max-w-xs truncate">{a.note || "—"}</td>
                    </tr>
                  ))}
                  {report.auditExceptions.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Tidak ada temuan YELLOW/RED dalam periode ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-base font-bold text-primary">{title}</h3>
        {note && <span className="text-[10px] text-muted/70">{note}</span>}
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className={cn(muted ? "text-muted/70 pl-2" : "text-muted")}>{label}</span>
      <span className={cn("font-mono tabular-nums", strong ? "font-bold text-primary" : muted ? "text-muted" : "text-primary")}>{value}</span>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: { name: string; val: string }[] }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <h3 className="text-sm font-bold text-primary mb-3">{title}</h3>
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={`${it.name}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-elevated text-[11px] font-bold text-muted shrink-0">{i + 1}</span>
            <span className="flex-1 truncate text-primary">{it.name}</span>
            <span className="font-mono text-xs text-muted">{it.val}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-muted">Belum ada data.</li>}
      </ol>
    </div>
  );
}
