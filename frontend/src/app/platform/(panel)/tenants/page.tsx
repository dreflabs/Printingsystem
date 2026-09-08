"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Building2, PauseCircle, PlayCircle, LogIn, AlertTriangle, X, Eye, Trash2, Search } from "lucide-react";
import { listTenants, setTenantStatus, impersonateTenant, deleteTenantNow } from "@/actions/platform";
import { TenantDetailDrawer } from "@/components/platform/TenantDetailDrawer";

type Tenant = {
  id: string; slug: string; name: string; status: string; plan: string;
  ownerName: string | null; userCount: number; orderCount: number;
  activePlanName: string | null; mrr: number;
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const PAGE = 20;

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-status-green/10 text-status-green border-status-green/30",
  TRIAL: "bg-status-blue/10 text-status-blue border-status-blue/30",
  SUSPENDED: "bg-status-red/10 text-status-red border-status-red/30",
  CHURNED: "bg-muted/10 text-muted border-muted/30",
};
const FILTERS = ["ALL", "ACTIVE", "TRIAL", "SUSPENDED", "CHURNED"] as const;
type Filter = (typeof FILTERS)[number];

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [limit, setLimit] = useState(PAGE);
  const [prompt, setPrompt] = useState<
    | { kind: "suspend" | "activate" | "impersonate"; tenant: Tenant; reason: string }
    | null
  >(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [del, setDel] = useState<{ tenant: Tenant; slug: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    const t = await listTenants();
    if (t.success) { setTenants(t.data); setError(null); }
    else setError(t.error);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tenants.length };
    for (const t of tenants) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tenants]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tenants.filter((t) => {
      if (filter !== "ALL" && t.status !== filter) return false;
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        t.slug.toLowerCase().includes(needle) ||
        (t.ownerName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [tenants, q, filter]);

  const shown = filtered.slice(0, limit);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLimit(PAGE); }, [q, filter]);

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

  async function confirmDelete() {
    if (!del) return;
    setBusy(del.tenant.id);
    setError(null);
    const res = await deleteTenantNow(del.tenant.id, del.slug, del.reason || undefined);
    setBusy(null);
    if (!res.success) { setError(res.error ?? "Gagal menghapus tenant."); return; }
    setDel(null);
    await load();
  }

  const promptCopy = {
    suspend: { title: "Suspend Tenant", desc: "Semua user tenant ini tidak akan bisa akses sampai diaktifkan lagi.", cta: "Suspend", danger: true, reasonRequired: false },
    activate: { title: "Aktifkan Tenant", desc: "Tenant kembali bisa diakses.", cta: "Aktifkan", danger: false, reasonRequired: false },
    impersonate: { title: "Login sebagai Tenant", desc: "Anda masuk sebagai Owner tenant. Alasan dikirim ke Owner untuk transparansi & dicatat di audit log.", cta: "Masuk", danger: false, reasonRequired: true },
  } as const;

  return (
    <div className="space-y-5">
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
        <h1 className="text-2xl font-bold text-primary">Tenant</h1>
        <p className="text-sm text-muted mt-0.5">Kelola seluruh percetakan pelanggan Print Pilot SaaS.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari toko / subdomain / owner…"
            className="w-full h-9 rounded-lg bg-elevated border border-border pl-9 pr-3 text-sm text-primary outline-none focus:border-accent-teal"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 h-9 rounded-lg text-xs font-bold border transition-colors ${
                filter === f
                  ? "bg-accent-teal/15 text-accent-teal border-accent-teal/30"
                  : "bg-elevated text-muted border-border hover:text-primary"
              }`}
            >
              {f === "ALL" ? "Semua" : f}
              <span className="ml-1 opacity-60">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Building2 className="h-4 w-4 text-accent-teal" />
          <h2 className="text-sm font-semibold text-primary">
            {filtered.length} tenant{filtered.length !== tenants.length ? ` (dari ${tenants.length})` : ""}
          </h2>
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
              {shown.map((t) => (
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
                      <span className="text-border">·</span>
                      <button
                        disabled={busy === t.id}
                        onClick={() => { setError(null); setDel({ tenant: t, slug: "", reason: "" }); }}
                        className="inline-flex items-center gap-1 text-xs text-status-red hover:underline disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted text-sm">
                  {tenants.length === 0 ? "Belum ada tenant." : "Tidak ada tenant yang cocok."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div className="p-3 border-t border-border text-center">
            <button
              onClick={() => setLimit((n) => n + PAGE)}
              className="text-xs font-bold text-accent-teal hover:underline"
            >
              Muat lebih banyak ({filtered.length - limit} lagi)
            </button>
          </div>
        )}
      </div>

      {del && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setDel(null)} />
          <div className="relative w-full max-w-sm bg-card border border-status-red/40 rounded-2xl p-6 shadow-modal space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-status-red">Hapus Tenant Permanen</h3>
                <p className="text-xs text-muted mt-1">{del.tenant.name} · <span className="font-mono">{del.tenant.slug}</span></p>
              </div>
              <button onClick={() => setDel(null)} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
            </div>
            <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-3 py-2.5 text-xs text-status-red">
              Seluruh data tenant ini — user, order, produksi, pembayaran, absensi, gaji, audit log — dihapus dari database dan <b>tidak bisa dikembalikan</b>. Hanya tersisa nisan <span className="font-mono">RetiredTenant</span> untuk arsip.
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted">Ketik <span className="font-mono text-primary">{del.tenant.slug}</span> untuk konfirmasi</label>
              <input
                autoFocus
                value={del.slug}
                onChange={(e) => setDel({ ...del, slug: e.target.value })}
                placeholder={del.tenant.slug}
                className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-status-red font-mono"
              />
            </div>
            <textarea
              value={del.reason}
              onChange={(e) => setDel({ ...del, reason: e.target.value })}
              rows={2}
              placeholder="Alasan (opsional, untuk audit)…"
              className="w-full rounded-xl bg-elevated border border-border text-sm text-primary p-3 outline-none focus:border-accent-teal resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setDel(null)} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs font-bold text-muted hover:text-primary">Batal</button>
              <button
                disabled={busy === del.tenant.id || del.slug.trim() !== del.tenant.slug}
                onClick={confirmDelete}
                className="flex-1 h-10 rounded-xl text-xs font-bold text-white bg-status-red hover:brightness-110 disabled:opacity-40"
              >
                {busy === del.tenant.id ? "Menghapus…" : "Hapus permanen"}
              </button>
            </div>
          </div>
        </div>
      )}

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
