"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Users, Package, UserRound, Clock, ScrollText, CreditCard } from "lucide-react";
import { getTenantDetail, updateTenantPlan, type PlanName } from "@/actions/platform";

type Detail = Extract<Awaited<ReturnType<typeof getTenantDetail>>, { success: true }>["data"];

const PLANS: PlanName[] = ["STARTER", "PRO", "ENTERPRISE"];
const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const dt = (d: Date | string | null) => (d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function TenantDetailDrawer({ tenantId, onClose, onChanged }: { tenantId: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanName>("STARTER");
  const [maxUsers, setMaxUsers] = useState<string>("");
  const [reason, setReason] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getTenantDetail(tenantId);
    if (r.success) {
      setDetail(r.data);
      setPlan(r.data.plan as PlanName);
      setMaxUsers(r.data.maxUsers != null ? String(r.data.maxUsers) : "");
      setError(null);
    } else setError(r.error);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  async function savePlan() {
    setSavingPlan(true);
    setPlanMsg(null);
    const r = await updateTenantPlan(tenantId, {
      plan,
      maxUsers: maxUsers.trim() === "" ? null : Number(maxUsers),
      reason: reason.trim() || undefined,
    });
    setSavingPlan(false);
    if (r.success) {
      setPlanMsg("Paket diperbarui.");
      setReason("");
      await load();
      onChanged();
    } else setPlanMsg(r.error ?? "Gagal.");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border-l border-border h-full overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold text-primary">
            {detail?.name ?? "Memuat…"} {detail && <span className="font-mono text-xs text-accent-teal ml-2">{detail.slug}</span>}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        </div>

        {error && <div className="m-5 rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red">{error}</div>}

        {detail && (
          <div className="p-5 space-y-6 text-sm">
            {/* Ringkas */}
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={Users} label="User" value={detail.counts.users} />
              <Stat icon={Package} label="Order" value={detail.counts.orders} />
              <Stat icon={UserRound} label="Customer" value={detail.counts.customers} />
            </div>

            <Section title="Profil">
              <Row k="Status" v={detail.status} />
              <Row k="Owner" v={detail.ownerName ?? "—"} />
              <Row k="Telepon Owner" v={detail.ownerPhone ?? "—"} />
              <Row k="Email Billing" v={detail.billingEmail ?? "—"} />
              <Row k="Domain Kustom" v={detail.customDomain ?? "—"} />
              <Row k="Provider WA" v={detail.waProvider ?? "—"} />
              <Row k="Trial berakhir" v={dt(detail.trialEndsAt)} />
              <Row k="Periode" v={`${dt(detail.currentPeriodStart)} — ${dt(detail.currentPeriodEnd)}`} />
              <Row k="Dibuat" v={dt(detail.createdAt)} />
            </Section>

            {/* Ubah paket */}
            <Section title="Paket & Batas User" icon={CreditCard}>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-muted">
                  Paket
                  <select value={plan} onChange={(e) => setPlan(e.target.value as PlanName)}
                    className="mt-1 block rounded-lg bg-elevated border border-border text-primary text-sm px-2 py-1.5 outline-none focus:border-accent-teal">
                    {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="text-xs text-muted">
                  Maks. user (kosong = tanpa batas)
                  <input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)}
                    className="mt-1 block w-40 rounded-lg bg-elevated border border-border text-primary text-sm px-2 py-1.5 outline-none focus:border-accent-teal" />
                </label>
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan (opsional, untuk audit)"
                className="mt-3 w-full rounded-lg bg-elevated border border-border text-primary text-sm px-3 py-2 outline-none focus:border-accent-teal" />
              <div className="mt-3 flex items-center gap-3">
                <button onClick={savePlan} disabled={savingPlan}
                  className="h-9 px-4 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-40">
                  Simpan Paket
                </button>
                {planMsg && <span className="text-xs text-muted">{planMsg}</span>}
              </div>
            </Section>

            <Section title="Riwayat Langganan">
              {detail.subscriptions.length === 0 ? <Empty /> : (
                <ul className="space-y-1.5">
                  {detail.subscriptions.map((s) => (
                    <li key={s.id} className="flex justify-between text-xs">
                      <span className="text-primary">{s.planName} · {rupiah(s.priceMonthly)}/bln</span>
                      <span className="text-muted">{s.status} · {dt(s.startedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Onboarding" icon={Clock}>
              {detail.onboarding.length === 0 ? <Empty /> : (
                <ul className="flex flex-wrap gap-2">
                  {detail.onboarding.map((o, i) => (
                    <li key={i} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-green/10 text-status-green border border-status-green/30">
                      {o.step}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Pengguna Tenant" icon={Users}>
              <ul className="space-y-1">
                {detail.users.map((u) => (
                  <li key={u.id} className="flex justify-between text-xs">
                    <span className="text-primary">{u.name} <span className="text-muted">@{u.username}</span></span>
                    <span className="text-muted">{u.role}{u.active ? "" : " · nonaktif"}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Audit Log Platform" icon={ScrollText}>
              {detail.auditLogs.length === 0 ? <Empty /> : (
                <ul className="space-y-2">
                  {detail.auditLogs.map((l) => (
                    <li key={l.id} className="text-xs border-l-2 border-border pl-3">
                      <div className="flex justify-between">
                        <span className="font-mono text-primary">{l.action}</span>
                        <span className="text-muted">{dt(l.createdAt)}</span>
                      </div>
                      <div className="text-muted">{l.actor} · {l.actorRole}</div>
                      {l.detail && <div className="text-muted/70 break-all">{l.detail}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="bg-elevated border border-border rounded-xl p-3">
      <Icon className="h-4 w-4 text-accent-teal mb-1.5" />
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-primary font-mono">{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Users; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </h3>
      <div className="bg-elevated/40 border border-border rounded-xl p-3">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-0.5 text-xs">
      <span className="text-muted">{k}</span>
      <span className="text-primary text-right">{v}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-muted">Belum ada data.</p>;
}
