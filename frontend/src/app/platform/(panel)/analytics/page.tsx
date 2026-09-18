"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { TrendingUp, AlertTriangle, Users, TrendingDown, DollarSign } from "lucide-react";
import { getGrowthAnalytics } from "@/actions/platform-billing";

type Data = Extract<Awaited<ReturnType<typeof getGrowthAnalytics>>, { success: true }>["data"];

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const jt = (n: number) => `${(n / 1_000_000).toFixed(1)}jt`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// Palet chart light-mode, sejajar dengan halaman laporan tenant.
const C = { accent: "#0492B2", green: "#16A34A", red: "#DC2626", grid: "#E2E8F0", axis: "#64748B", card: "#FFFFFF", text: "#0F172A" };

export default function PlatformAnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [months, setMonths] = useState(12);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getGrowthAnalytics({ months });
    if (r.success) { setData(r.data); setError(null); }
    else setError(r.error);
  }, [months]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const cards = [
    { label: "MRR sekarang", value: s ? rupiah(s.mrrNow) : "—", icon: DollarSign, hint: "langganan aktif" },
    { label: "Tenant aktif", value: s?.activeNow ?? "—", icon: Users, hint: s ? `${s.trialNow} masih trial` : "" },
    { label: "Tenant baru (30h)", value: s?.newLast30 ?? "—", icon: TrendingUp, hint: "" },
    { label: "Churn (30h)", value: s ? `${s.churnedLast30} · ${pct(s.churnRate30)}` : "—", icon: TrendingDown, hint: "dari tenant aktif" },
    { label: "ARPA", value: s ? rupiah(Math.round(s.arpa)) : "—", icon: DollarSign, hint: "rata-rata / tenant aktif" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Analitik Pertumbuhan</h1>
          <p className="text-sm text-muted mt-0.5">MRR, tenant baru, churn, dan pendapatan tertagih per bulan.</p>
        </div>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="h-9 rounded-lg bg-elevated border border-border text-primary text-xs px-2 outline-none focus:border-accent-teal shrink-0"
        >
          <option value={6}>6 bulan</option>
          <option value={12}>12 bulan</option>
          <option value={24}>24 bulan</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="inline-flex p-2 rounded-xl bg-accent-teal/10 mb-2">
              <c.icon className="h-4 w-4 text-accent-teal" />
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{c.label}</p>
            <p className="text-lg font-bold text-primary mt-1 font-mono">{c.value}</p>
            {c.hint && <p className="text-[10px] text-muted mt-0.5">{c.hint}</p>}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-primary mb-1">MRR &amp; Tenant Aktif</h2>
        <p className="text-[11px] text-muted mb-4">
          MRR historis direkonstruksi dari jendela aktif langganan — perkiraan, bukan snapshot harian.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data?.series ?? []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="mrr" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={jt} />
              <YAxis yAxisId="count" orientation="right" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: C.card, borderColor: C.grid, borderRadius: 12, color: C.text, fontSize: 12 }}
                formatter={(v, n) => (n === "MRR" ? rupiah(Number(v)) : String(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="mrr" dataKey="mrrEnd" name="MRR" fill={C.accent} radius={[4, 4, 0, 0]} barSize={18} />
              <Line yAxisId="count" type="monotone" dataKey="activeEnd" name="Tenant aktif" stroke={C.green} strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-4">Tenant Baru vs Churn</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data?.series ?? []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="label" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: C.card, borderColor: C.grid, borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="newTenants" name="Baru" fill={C.green} radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="churned" name="Churn" fill={C.red} radius={[4, 4, 0, 0]} barSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-1">Pendapatan Tertagih / Bulan</h2>
          <p className="text-[11px] text-muted mb-4">Dari invoice berstatus PAID (tanggal bayar).</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data?.series ?? []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="label" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={jt} />
                <Tooltip
                  contentStyle={{ backgroundColor: C.card, borderColor: C.grid, borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => rupiah(Number(v))}
                />
                <Bar dataKey="revenue" name="Tertagih" fill={C.accent} radius={[4, 4, 0, 0]} barSize={18} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
