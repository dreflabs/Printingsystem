"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2, DollarSign, Users, PauseCircle, AlertTriangle,
  ScrollText, ArrowRight, Receipt, TrendingUp,
} from "lucide-react";
import { getPlatformMetrics, listPlatformAuditLog } from "@/actions/platform";

type Metrics = { mrr: number; trialMrr: number; totalTenants: number; trial: number; active: number; suspended: number; churned: number };
type Entry = {
  id: string; actorName: string; actorSubLevel: string | null; action: string;
  targetLabel: string | null; createdAt: Date | string;
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const dt = (d: Date | string) => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const DANGER = new Set(["LOGIN_FAILED", "LOGIN_LOCKED", "TENANT_PURGED", "SUPER_ADMIN_DEACTIVATED"]);

export default function PlatformDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, a] = await Promise.all([getPlatformMetrics(), listPlatformAuditLog({ limit: 8 })]);
    if (m.success) setMetrics(m.data);
    else setError(m.error);
    if (a.success) setRecent(a.data.entries);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const cards: { label: string; value: string | number; icon: typeof DollarSign; hint?: string }[] = [
    {
      label: "MRR (tenant aktif)",
      value: metrics ? rupiah(metrics.mrr) : "—",
      icon: DollarSign,
      hint: metrics && metrics.trialMrr > 0 ? `+ ${rupiah(metrics.trialMrr)} potensi dari trial` : undefined,
    },
    { label: "Total Tenant", value: metrics?.totalTenants ?? "—", icon: Building2 },
    { label: "Aktif / Trial", value: metrics ? `${metrics.active} / ${metrics.trial}` : "—", icon: Users },
    { label: "Suspended / Churned", value: metrics ? `${metrics.suspended} / ${metrics.churned}` : "—", icon: PauseCircle },
  ];

  const shortcuts = [
    { href: "/platform/tenants", label: "Kelola Tenant", desc: "Cari, suspend, impersonate, hapus", icon: Building2 },
    { href: "/platform/billing", label: "Billing & Invoice", desc: "Terbitkan tagihan, catat pembayaran", icon: Receipt },
    { href: "/platform/analytics", label: "Analitik", desc: "MRR, churn, pertumbuhan tenant", icon: TrendingUp },
    { href: "/platform/activity", label: "Aktivitas", desc: "Jejak audit lengkap", icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard Platform</h1>
        <p className="text-sm text-muted mt-0.5">Ringkasan metrik & aktivitas Print Pilot SaaS.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="inline-flex p-2 rounded-xl bg-accent-teal/10 mb-3">
              <c.icon className="h-5 w-5 text-accent-teal" />
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{c.label}</p>
            <p className="text-2xl font-bold text-primary mt-1 font-mono">{c.value}</p>
            {c.hint && <p className="text-[10px] text-muted mt-1">{c.hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group bg-card border border-border rounded-2xl p-4 hover:border-accent-teal/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex p-2 rounded-xl bg-elevated">
                <s.icon className="h-4 w-4 text-accent-teal" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent-teal transition-colors" />
            </div>
            <p className="text-sm font-bold text-primary">{s.label}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-accent-teal" />
            <h2 className="text-sm font-semibold text-primary">Aktivitas terbaru</h2>
          </div>
          <Link href="/platform/activity" className="text-xs font-bold text-accent-teal hover:underline">
            Lihat semua
          </Link>
        </div>
        <ul className="divide-y divide-border/60">
          {recent.map((e) => (
            <li key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                  DANGER.has(e.action)
                    ? "bg-status-red/10 text-status-red border-status-red/30"
                    : "bg-elevated text-muted border-border"
                }`}
              >
                {e.action}
              </span>
              <span className="text-xs text-primary truncate">{e.actorName}</span>
              {e.targetLabel && <span className="text-xs text-muted font-mono truncate">→ {e.targetLabel}</span>}
              <span className="ml-auto text-[11px] text-muted whitespace-nowrap shrink-0">{dt(e.createdAt)}</span>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="px-4 py-8 text-center text-muted text-sm">Belum ada aktivitas.</li>
          )}
        </ul>
      </div>

      <p className="text-xs text-muted">
        Belum ada di versi ini: broadcast notification, System Health. Login Super Admin = email + password; percobaan
        gagal berturut-turut mengunci akun sementara. Suspend tenant benar-benar memblokir login &amp; akses;
        impersonate SUPPORT lihat-saja untuk aksi uang/pembatalan/koreksi. Siklus hidup tenant:
        <b>Tenant → Detail → Zona Berbahaya</b> untuk <i>Churned</i> lalu <i>Hapus permanen</i>; job
        <code>tenant-lifecycle</code> &amp; <code>billing</code> berjalan otomatis (invoice bulanan idempoten).
      </p>
    </div>
  );
}
