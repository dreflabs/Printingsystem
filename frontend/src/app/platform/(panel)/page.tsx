"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, DollarSign, Users, PauseCircle, PlayCircle, LogIn, AlertTriangle, X, Eye } from "lucide-react";
import { getPlatformMetrics, listTenants, setTenantStatus, impersonateTenant } from "@/actions/platform";
import { TenantDetailDrawer } from "@/components/platform/TenantDetailDrawer";

type Metrics = { mrr: number; totalTenants: number; trial: number; active: number; suspended: number; churned: number };
type Tenant = {
  id: string; slug: string; name: string; status: string; plan: string;
  ownerName: string | null; userCount: number; orderCount: number;
  activePlanName: string | null; mrr: number;
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-status-green/10 text-status-green border-status-green/30",
  TRIAL: "bg-status-blue/10 text-status-blue border-status-blue/30",
  SUSPENDED: "bg-status-red/10 text-status-red border-status-red/30",
  CHURNED: "bg-muted/10 text-muted border-muted/30",
};

export default function PlatformDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<
    | { kind: "suspend" | "activate" | "impersonate"; tenant: Tenant; reason: string }
    | null
  >(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, t] = await Promise.all([getPlatformMetrics(), listTenants()]);
    if (m.success) setMetrics(m.data);
    if (t.success) setTenants(t.data);
    if (!m.success) setError(m.error);
    else if (!t.success) setError(t.error);
    else setError(null);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function openPrompt(kind: "suspend" | "activate" | "impersonate", tenant: Tenant) {
    setError(null);
    setPrompt({ kind, tenant, reason: "" });
  }

  async function confirmPrompt() {
    if (!prompt) return;
    const { kind, tenant, reason } = prompt;
    setBusy(tenant.id);
    let res: { success: boolean; error?: string };
    if (kind === "impersonate") res = await impersonateTenant(tenant.id, reason);
    else res = await setTenantStatus(tenant.id, kind === "suspend" ? "SUSPEND" : "ACTIVATE", reason || undefined);
    setBusy(null);
    if (!res.success) { setError(res.error ?? "Aksi gagal."); return; }
    setPrompt(null);
    if (kind === "impersonate") { window.location.href = "/owner"; return; }
    await load();
  }

  const cards = [
    { label: "MRR", value: metrics ? rupiah(metrics.mrr) : "—", icon: DollarSign },
    { label: "Total Tenant", value: metrics?.totalTenants ?? "—", icon: Building2 },
    { label: "Aktif / Trial", value: metrics ? `${metrics.active} / ${metrics.trial}` : "—", icon: Users },
    { label: "Suspended / Churned", value: metrics ? `${metrics.suspended} / ${metrics.churned}` : "—", icon: PauseCircle },
  ];

  const promptCopy = {
    suspend: { title: "Suspend Tenant", desc: "Semua user tenant ini tidak akan bisa akses sampai diaktifkan lagi.", cta: "Suspend", danger: true, reasonRequired: false },
    activate: { title: "Aktifkan Tenant", desc: "Tenant kembali bisa diakses.", cta: "Aktifkan", danger: false, reasonRequired: false },
    impersonate: { title: "Login sebagai Tenant", desc: "Anda masuk sebagai Owner tenant. Alasan dikirim ke Owner untuk transparansi & dicatat di audit log.", cta: "Masuk", danger: false, reasonRequired: true },
  } as const;

  return (
    <div className="space-y-6">
      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setPrompt(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-modal space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-primary">{promptCopy[prompt.kind].title}</h3>
                <p className="text-xs text-muted mt-1">{prompt.tenant.name} · <span className="font-mono">{prompt.tenant.slug}</span></p>
              </div>
              <button onClick={() => setPrompt(null)} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-muted">{promptCopy[prompt.kind].desc}</p>
            <textarea
              autoFocus
              value={prompt.reason}
              onChange={(e) => setPrompt({ ...prompt, reason: e.target.value })}
              rows={2}
              placeholder={promptCopy[prompt.kind].reasonRequired ? "Alasan (wajib)…" : "Alasan (opsional, untuk audit)…"}
              className="w-full rounded-xl bg-elevated border border-border text-sm text-primary p-3 outline-none focus:border-accent-teal resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setPrompt(null)} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs font-bold text-muted hover:text-primary">Batal</button>
              <button
                disabled={busy === prompt.tenant.id || (promptCopy[prompt.kind].reasonRequired && !prompt.reason.trim())}
                onClick={confirmPrompt}
                className={`flex-1 h-10 rounded-xl text-xs font-bold text-white disabled:opacity-40 ${promptCopy[prompt.kind].danger ? "bg-status-red" : "bg-accent-teal"} hover:brightness-110`}
              >
                {promptCopy[prompt.kind].cta}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard Platform</h1>
        <p className="text-sm text-muted mt-0.5">Metrics & manajemen tenant Print Pilot SaaS</p>
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
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Building2 className="h-5 w-5 text-accent-teal" />
          <h2 className="text-base font-semibold text-primary">Tenant</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">{tenants.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Toko</th>
                <th className="px-4 py-3">Subdomain</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">MRR</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-elevated/30">
                  <td className="px-4 py-3 font-medium text-primary">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-accent-teal">{t.slug}</td>
                  <td className="px-4 py-3 text-muted text-xs">{t.ownerName ?? "-"}</td>
                  <td className="px-4 py-3 text-xs">{t.activePlanName ?? t.plan}</td>
                  <td className="px-4 py-3 text-muted text-xs">{t.userCount}</td>
                  <td className="px-4 py-3 font-mono text-xs">{rupiah(t.mrr)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[t.status] ?? STATUS_STYLE.CHURNED}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDetailId(t.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detail
                      </button>
                      <span className="text-border">·</span>
                      <button
                        disabled={busy === t.id}
                        onClick={() => openPrompt("impersonate", t)}
                        className="inline-flex items-center gap-1 text-xs text-accent-teal hover:underline disabled:opacity-40"
                      >
                        <LogIn className="h-3.5 w-3.5" /> Login sebagai
                      </button>
                      <span className="text-border">·</span>
                      <button
                        disabled={busy === t.id}
                        onClick={() => openPrompt(t.status === "SUSPENDED" ? "activate" : "suspend", t)}
                        className={`inline-flex items-center gap-1 text-xs disabled:opacity-40 ${t.status === "SUSPENDED" ? "text-status-green hover:underline" : "text-status-red hover:underline"}`}
                      >
                        {t.status === "SUSPENDED" ? <><PlayCircle className="h-3.5 w-3.5" /> Aktifkan</> : <><PauseCircle className="h-3.5 w-3.5" /> Suspend</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted text-sm">Belum ada tenant.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted">
        Belum ada di versi ini: MFA, hard-delete tenant (butuh alur reminder 90 hari), billing / generate &amp; force-mark-paid invoice,
        broadcast notification, kelola akun Super Admin. Suspend tenant kini benar-benar memblokir login &amp; akses; impersonate
        SUPPORT bersifat lihat-saja untuk aksi uang/pembatalan/koreksi. Semua aksi tercatat di <code>tenant_audit_logs</code>.
      </p>

      {detailId && (
        <TenantDetailDrawer
          tenantId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
