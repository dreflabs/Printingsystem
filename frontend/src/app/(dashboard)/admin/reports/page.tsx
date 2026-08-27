"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { DollarSign, PackageX, Activity, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDailyRevenue, getOperatorPerformance, getOutstandingReceivables, getRevenueSeries } from "@/actions/reports";

// Recharts butuh hex literal — pakai nilai token desain (globals.css).
const C = { accent: "#0492B2", blue: "#2563EB", red: "#DC2626", grid: "#E2E8F0", axis: "#64748B", text: "#0F172A", card: "#FFFFFF" };

type Daily = Extract<Awaited<ReturnType<typeof getDailyRevenue>>, { success: true }>["data"];
type Perf = Extract<Awaited<ReturnType<typeof getOperatorPerformance>>, { success: true }>["data"];
type Recv = Extract<Awaited<ReturnType<typeof getOutstandingReceivables>>, { success: true }>["data"];
type Series = Extract<Awaited<ReturnType<typeof getRevenueSeries>>, { success: true }>["data"];

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—");

export default function ReportsPage() {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [perf, setPerf] = useState<Perf>([]);
  const [recv, setRecv] = useState<Recv>([]);
  const [series, setSeries] = useState<Series>([]);
  const [recvFilter, setRecvFilter] = useState<"all" | "overdue" | "ready_unpaid">("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, p, s] = await Promise.all([getDailyRevenue(), getOperatorPerformance(), getRevenueSeries(7)]);
    if (d.success) setDaily(d.data); else setError(d.error);
    if (p.success) setPerf(p.data);
    if (s.success) setSeries(s.data);
  }, []);

  const loadRecv = useCallback(async () => {
    const r = await getOutstandingReceivables(recvFilter);
    if (r.success) setRecv(r.data);
  }, [recvFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRecv(); }, [loadRecv]);

  const totalWaste = perf.reduce((a, b) => a + b.totalWaste, 0);
  const totalReceivable = recv.reduce((a, b) => a + b.balance, 0);

  const kpi = [
    { label: "Pendapatan Hari Ini", value: daily ? rupiah(daily.combinedRevenue) : "—", icon: DollarSign, color: "text-status-green", bg: "bg-status-green/10" },
    { label: "Order Printing Hari Ini", value: daily?.newPrintingOrders ?? "—", icon: Activity, color: "text-accent-teal", bg: "bg-accent-teal/10" },
    { label: "Total Waste (30 hari)", value: totalWaste, icon: PackageX, color: "text-status-red", bg: "bg-status-red/10" },
    { label: "Piutang Outstanding", value: rupiah(totalReceivable), icon: Receipt, color: "text-status-yellow-text", bg: "bg-status-yellow/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Analytics & Laporan</h1>
        <p className="text-sm text-muted mt-0.5">Pendapatan, kinerja operator, dan piutang</p>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpi.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-5 shadow-card">
            <div className={cn("p-2 rounded-xl w-fit mb-3", k.bg)}><k.icon className={cn("h-5 w-5", k.color)} /></div>
            <p className="text-2xl font-bold text-primary">{k.value}</p>
            <p className="text-xs text-muted font-medium mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="text-base font-bold text-primary mb-6">Tren Pendapatan (7 Hari)</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" stroke={C.axis} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={C.axis} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ backgroundColor: C.card, borderColor: C.grid, borderRadius: 12, color: C.text }} formatter={(v) => rupiah(Number(v))} />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="cetak" name="Cetak (Printing)" stroke={C.accent} strokeWidth={3} dot={{ r: 3, fill: C.accent, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="retail" name="Eceran (Retail)" stroke={C.blue} strokeWidth={3} dot={{ r: 3, fill: C.blue, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h3 className="text-base font-bold text-primary mb-6">Waste per Operator (30 hari)</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perf.map((p) => ({ name: p.operatorName, waste: p.totalWaste }))} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                <XAxis type="number" stroke={C.axis} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} width={90} />
                <Tooltip cursor={{ fill: C.grid, opacity: 0.5 }} contentStyle={{ backgroundColor: C.card, borderColor: C.grid, borderRadius: 12 }} />
                <Bar dataKey="waste" name="Waste" fill={C.red} radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
            {perf.length === 0 && <p className="text-center text-xs text-muted -mt-40">Belum ada data produksi.</p>}
          </div>
        </div>
      </div>

      {/* Kinerja operator — tabel */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent-teal" />
          <h3 className="text-base font-bold text-primary">Kinerja Operator (30 hari)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
              <tr><th className="px-4 py-3">Operator</th><th className="px-4 py-3">Job</th><th className="px-4 py-3">Output</th><th className="px-4 py-3">Waste</th><th className="px-4 py-3">Rasio Waste</th></tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {perf.map((p) => (
                <tr key={p.operatorId} className="hover:bg-elevated/30">
                  <td className="px-4 py-3 font-medium text-primary">{p.operatorName}</td>
                  <td className="px-4 py-3 text-muted">{p.jobCount}</td>
                  <td className="px-4 py-3 text-muted">{p.totalOutput} pcs</td>
                  <td className="px-4 py-3 text-muted">{p.totalWaste} pcs</td>
                  <td className={cn("px-4 py-3 font-bold", p.wasteRatio > 0.2 ? "text-status-red" : "text-status-green")}>
                    {(p.wasteRatio * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
              {perf.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Belum ada data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Piutang */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-accent-teal" />
            <h3 className="text-base font-bold text-primary">Piutang Outstanding</h3>
          </div>
          <select value={recvFilter} onChange={(e) => setRecvFilter(e.target.value as typeof recvFilter)}
            className="h-9 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal">
            <option value="all">Semua</option>
            <option value="overdue">Overdue</option>
            <option value="ready_unpaid">Siap Ambil Belum Lunas</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
              <tr><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Konsumen</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Dibayar</th><th className="px-4 py-3">Sisa</th><th className="px-4 py-3">Deadline</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recv.map((o) => (
                <tr key={o.orderCode} className="hover:bg-elevated/30">
                  <td className="px-4 py-3 font-mono text-accent-teal font-bold">{o.orderCode}</td>
                  <td className="px-4 py-3">{o.customerName}</td>
                  <td className="px-4 py-3 font-mono text-muted">{rupiah(o.total)}</td>
                  <td className="px-4 py-3 font-mono text-muted">{rupiah(o.paidAmount)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-status-yellow-text">{rupiah(o.balance)}</td>
                  <td className={cn("px-4 py-3 text-xs", o.overdue ? "text-status-red font-bold" : "text-muted")}>{fmtDate(o.deadline)}</td>
                  <td className="px-4 py-3 text-xs text-muted">{o.status}</td>
                </tr>
              ))}
              {recv.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Tidak ada piutang.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
