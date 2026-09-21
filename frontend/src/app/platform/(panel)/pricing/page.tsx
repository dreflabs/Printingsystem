"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Coins, Loader2, Save, Ticket, Users } from "lucide-react";
import { getPricingSettingsAdmin, updatePricingSettings } from "@/actions/platform-pricing";
import type { PricingConfig } from "@/lib/saas-catalog";

type AdminData = Extract<Awaited<ReturnType<typeof getPricingSettingsAdmin>>, { success: true }>["data"];

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default function PlatformPricingPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [cfg, setCfg] = useState<PricingConfig | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getPricingSettingsAdmin();
    if (r.success) {
      setData(r.data);
      setCfg(r.data.config);
      setWarnings(r.data.warnings);
      setError(null);
    } else {
      setError(r.error);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const r = await updatePricingSettings(cfg);
    setSaving(false);
    if (r.success) {
      setCfg(r.data.config);
      setWarnings(r.data.warnings);
      setSavedAt(new Date().toLocaleTimeString("id-ID"));
      setError(null);
    } else {
      setError(r.error);
    }
  };

  if (!cfg || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }

  const setTermPaidMonths = (months: number, paidMonths: number) =>
    setCfg({ ...cfg, terms: cfg.terms.map((t) => (t.months === months ? { ...t, paidMonths } : t)) });

  const setService = (key: string, patch: { listPrice?: number; promoFree?: boolean }) =>
    setCfg({ ...cfg, services: cfg.services.map((s) => (s.key === key ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Harga &amp; Add-on</h1>
          <p className="text-sm text-muted mt-0.5">
            Parameter komersial yang dipakai wizard pendaftaran, invoice, dan halaman tagihan tenant. Perubahan berlaku
            tanpa deploy.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-50 shrink-0"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {warnings.map((w) => (
        <div key={w} className="rounded-xl border border-status-yellow/40 bg-status-yellow/10 px-4 py-3 text-xs text-status-yellow-text flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {w}
        </div>
      ))}
      {savedAt && !error && (
        <p className="text-xs text-status-green font-semibold">Tersimpan pukul {savedAt}.</p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <Users className="h-4 w-4 text-accent-teal" /> Kursi / User Tambahan
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Harga per user / bulan (Rp)">
            <input
              type="number"
              min={0}
              value={cfg.seatPriceMonthly}
              onChange={(e) => setCfg({ ...cfg, seatPriceMonthly: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Batas maksimum kursi per tenant">
            <input
              type="number"
              min={1}
              value={cfg.maxSeats}
              onChange={(e) => setCfg({ ...cfg, maxSeats: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Jatuh tempo invoice (hari)">
            <input
              type="number"
              min={1}
              value={cfg.paymentDueDays}
              onChange={(e) => setCfg({ ...cfg, paymentDueDays: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>
        <p className="text-[11px] text-muted">
          Acuan anti-kanibalisasi: selisih harga per kursi antara Business dan Pro adalah{" "}
          {rupiah(Math.round((data.plans.find((p) => p.slug === "business")!.priceMonthly - data.plans.find((p) => p.slug === "pro")!.priceMonthly) / Math.max(1, (data.plans.find((p) => p.slug === "business")!.maxUsers ?? 0) - (data.plans.find((p) => p.slug === "pro")!.maxUsers ?? 0))))}.
          Harga di bawah angka itu membuat menambah kursi lebih murah daripada naik paket.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <Coins className="h-4 w-4 text-accent-teal" /> Diskon Termin
        </h2>
        <p className="text-[11px] text-muted">
          Jumlah bulan yang dibayar untuk tiap durasi. Contoh: 12 bulan dibayar 10 = gratis 2 bulan.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cfg.terms.map((t) => {
            const meta = data.terms.find((x) => x.months === t.months);
            return (
              <div key={t.months} className="rounded-xl border border-border p-3 space-y-2">
                <p className="text-xs font-bold text-primary">
                  {meta?.label ?? `${t.months} bulan`}
                  {meta?.badge ? <span className="ml-1.5 text-[9px] font-bold text-accent-teal">{meta.badge}</span> : null}
                </p>
                <Field label={`Dibayar (dari ${t.months} bulan)`}>
                  <input
                    type="number"
                    min={1}
                    max={t.months}
                    value={t.paidMonths}
                    onChange={(e) => setTermPaidMonths(t.months, Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
                <p className="text-[10px] text-muted">
                  {t.paidMonths < t.months ? `Gratis ${t.months - t.paidMonths} bulan` : "Tanpa diskon"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <Ticket className="h-4 w-4 text-accent-teal" /> Layanan Tambahan
        </h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={cfg.servicePromoActive}
            onChange={(e) => setCfg({ ...cfg, servicePromoActive: e.target.checked })}
          />
          Promo aktif — semua layanan yang ditandai gratis ditagih Rp0
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          {cfg.services.map((s) => {
            const meta = data.services.find((x) => x.key === s.key);
            return (
              <div key={s.key} className="rounded-xl border border-border p-3 space-y-2">
                <p className="text-xs font-bold text-primary">{meta?.name ?? s.key}</p>
                <Field label="Harga list (Rp)">
                  <input
                    type="number"
                    min={0}
                    value={s.listPrice}
                    onChange={(e) => setService(s.key, { listPrice: Number(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={s.promoFree}
                    onChange={(e) => setService(s.key, { promoFree: e.target.checked })}
                  />
                  Gratis selama promo
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-primary mb-2">Harga Paket (rujukan)</h2>
        <p className="text-[11px] text-muted mb-3">
          Harga paket diatur di halaman Paket Langganan dan kini menjadi sumber penagihan (invoice memakai harga baris
          ini, bukan konstanta kode).
        </p>
        <div className="grid grid-cols-3 gap-3">
          {data.plans.map((p) => (
            <div key={p.slug} className="rounded-xl border border-border bg-elevated px-3 py-2">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{p.name}</p>
              <p className="text-sm font-bold text-primary font-mono mt-0.5">{rupiah(p.priceMonthly)}</p>
              <p className="text-[10px] text-muted">{p.maxUsers ?? "∞"} user</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const inputCls =
  "w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}
