"use client";

import { useState, useEffect, useCallback } from "react";
import { CreditCard, AlertTriangle, X, Plus, Pencil } from "lucide-react";
import {
  listSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
} from "@/actions/platform-billing";

type Plan = {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  maxUsers: number | null;
  maxOrdersPerMonth: number | null;
  features: string[];
  active: boolean;
  tenantCount: number;
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Plan | "new" | null>(null);

  const load = useCallback(async () => {
    const r = await listSubscriptionPlans();
    if (r.success) { setPlans(r.data); setError(null); }
    else setError(r.error);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Paket Langganan</h1>
          <p className="text-sm text-muted mt-0.5">
            Katalog harga &amp; batasan. Harga di sini menentukan MRR dan nominal invoice tenant.
          </p>
        </div>
        <button
          onClick={() => setEdit("new")}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Paket baru
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col">
            <div className="flex items-start justify-between">
              <div className="inline-flex p-2 rounded-xl bg-accent-teal/10">
                <CreditCard className="h-5 w-5 text-accent-teal" />
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  p.active
                    ? "bg-status-green/10 text-status-green border-status-green/30"
                    : "bg-muted/10 text-muted border-muted/30"
                }`}
              >
                {p.active ? "AKTIF" : "NONAKTIF"}
              </span>
            </div>
            <p className="text-base font-bold text-primary mt-3">{p.name}</p>
            <p className="text-[11px] text-muted font-mono">{p.slug}</p>
            <p className="text-xl font-bold text-primary font-mono mt-2">
              {rupiah(p.priceMonthly)}<span className="text-xs text-muted font-normal">/bln</span>
            </p>
            <ul className="mt-3 space-y-1 text-xs text-muted flex-1">
              <li>Maks. user: <span className="text-primary">{p.maxUsers ?? "tanpa batas"}</span></li>
              <li>Maks. order/bln: <span className="text-primary">{p.maxOrdersPerMonth ?? "tanpa batas"}</span></li>
              {p.features.map((f, i) => <li key={i}>• {f}</li>)}
            </ul>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-muted">{p.tenantCount} tenant memakai</span>
              <button
                onClick={() => setEdit(p)}
                className="inline-flex items-center gap-1 text-xs font-bold text-accent-teal hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" /> Ubah
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && !error && (
          <p className="text-sm text-muted col-span-full py-8 text-center">Belum ada paket.</p>
        )}
      </div>

      {edit && (
        <PlanModal
          plan={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onDone={() => { setEdit(null); load(); }}
        />
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onDone }: { plan: Plan | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [price, setPrice] = useState(String(plan?.priceMonthly ?? ""));
  const [maxUsers, setMaxUsers] = useState(plan?.maxUsers != null ? String(plan.maxUsers) : "");
  const [maxOrders, setMaxOrders] = useState(plan?.maxOrdersPerMonth != null ? String(plan.maxOrdersPerMonth) : "");
  const [features, setFeatures] = useState((plan?.features ?? []).join("\n"));
  const [active, setActive] = useState(plan?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const payload = {
      name,
      slug: slug.trim().toLowerCase(),
      priceMonthly: Number(price),
      maxUsers: maxUsers.trim() === "" ? null : Number(maxUsers),
      maxOrdersPerMonth: maxOrders.trim() === "" ? null : Number(maxOrders),
      features: features.split("\n").map((f) => f.trim()).filter(Boolean),
      active,
    };
    const r = plan ? await updateSubscriptionPlan(plan.id, payload) : await createSubscriptionPlan(payload);
    setBusy(false);
    if (r.success) onDone();
    else setErr(r.error ?? "Gagal.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-modal space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">{plan ? "Ubah Paket" : "Paket Baru"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

        <Field label="Nama">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pro"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal" />
        </Field>
        <Field label="Slug (huruf kecil, dipakai internal — hati-hati mengubah)">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="pro"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
        </Field>
        <Field label="Harga / bulan (Rp)">
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="599000"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Maks. user (kosong = ∞)">
            <input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
          </Field>
          <Field label="Maks. order/bln (kosong = ∞)">
            <input type="number" min={1} value={maxOrders} onChange={(e) => setMaxOrders(e.target.value)}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
          </Field>
        </div>
        <Field label="Fitur (satu per baris)">
          <textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={3}
            placeholder={"Multi-cabang\nLaporan lanjutan"}
            className="w-full rounded-lg bg-elevated border border-border p-3 text-sm text-primary outline-none focus:border-accent-teal resize-none" />
        </Field>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Paket aktif (bisa dipilih untuk tenant baru)
        </label>

        <button
          onClick={submit}
          disabled={busy}
          className="w-full h-10 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Menyimpan…" : plan ? "Simpan perubahan" : "Buat paket"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}
