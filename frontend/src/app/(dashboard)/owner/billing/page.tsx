"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Mail, Users, ShoppingCart, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Check } from "lucide-react";
import { useToast } from "@/components/ui";
import { getTenantBillingSummary, changeTenantPlan, type TenantBillingSummary } from "@/actions/billing";
import { BILLING_CONTACT_EMAIL } from "@/lib/billing-contact";

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

const INVOICE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu bayar",
  PAID: "Lunas",
  FAILED: "Gagal",
  WAIVED: "Dibebaskan",
};

function upgradeMailto(subject: string) {
  return `mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

function QuotaBar({ label, used, max, icon: Icon }: { label: string; used: number; max: number | null; icon: typeof Users }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const full = max != null && used >= max;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold text-primary flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted" /> {label}
        </span>
        <span className={full ? "font-bold text-status-red" : "text-muted"}>
          {used}
          {max != null ? ` / ${max}` : " (tak terbatas)"}
        </span>
      </div>
      {max != null && (
        <div className="h-2 rounded-full bg-base overflow-hidden">
          <div
            className={"h-full rounded-full transition-all " + (full ? "bg-status-red" : "bg-accent-teal")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const { toast } = useToast();
  const [data, setData] = useState<TenantBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getTenantBillingSummary();
    if (res.success) setData(res.data);
    else toast({ type: "error", title: "Gagal memuat", message: res.error });
    setLoading(false);
  }, [toast]);

  const pickPlan = async (key: TenantBillingSummary["availablePlans"][number]["key"], name: string) => {
    setChangingPlan(key);
    const res = await changeTenantPlan(key);
    setChangingPlan(null);
    if (res.success) {
      toast({ type: "success", title: `Paket diganti ke ${name}` });
      void load();
    } else {
      toast({ type: "error", title: "Gagal mengganti paket", message: res.error });
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }
  if (!data) return null;

  const trialActive = data.status === "TRIAL";
  const trialUrgent = trialActive && data.trialDaysLeft != null && data.trialDaysLeft <= 3;
  const userQuotaFull = data.maxUsers != null && data.activeUsers >= data.maxUsers;
  const orderQuotaFull = data.maxOrdersPerMonth != null && data.ordersThisMonth >= data.maxOrdersPerMonth;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-primary">Paket &amp; Tagihan</h1>
        <p className="text-sm text-muted mt-0.5">Paket aktif, sisa kuota, dan riwayat tagihan workspace Anda.</p>
      </div>

      {trialActive && (
        <div
          className={
            "rounded-2xl border px-4 py-3 text-sm flex items-start gap-3 " +
            (trialUrgent
              ? "border-status-red/30 bg-status-red/10 text-status-red"
              : "border-status-yellow/30 bg-status-yellow/10 text-status-yellow-text")
          }
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">
              {data.trialDaysLeft != null && data.trialDaysLeft > 0
                ? `Masa uji coba berakhir ${data.trialDaysLeft} hari lagi`
                : "Masa uji coba sudah berakhir"}
            </p>
            <p className="mt-0.5 opacity-90">Berlangganan sekarang supaya workspace tidak terhenti saat trial habis.</p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-card">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-accent-teal" /> Paket Saat Ini
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-primary">{data.planName}</p>
            <p className="text-xs text-muted mt-0.5">
              {data.priceMonthly != null ? `${rupiah(data.priceMonthly)} / bulan` : "Harga khusus — hubungi Sales"}
            </p>
          </div>
          <span
            className={
              "text-[11px] font-bold px-2.5 py-1 rounded-full border " +
              (data.status === "ACTIVE"
                ? "bg-status-green/10 text-status-green border-status-green/20"
                : data.status === "TRIAL"
                ? "bg-status-yellow/10 text-status-yellow-text border-status-yellow/20"
                : "bg-status-red/10 text-status-red border-status-red/20")
            }
          >
            {data.status}
          </span>
        </div>

        <div className="space-y-3 border-t border-border pt-3">
          <QuotaBar label="Pegawai aktif" used={data.activeUsers} max={data.maxUsers} icon={Users} />
          <QuotaBar label="Order bulan ini" used={data.ordersThisMonth} max={data.maxOrdersPerMonth} icon={ShoppingCart} />
        </div>

        {(userQuotaFull || orderQuotaFull) && (
          <p className="text-[11px] text-status-red">
            Kuota paket Anda sudah penuh. Upgrade paket supaya tidak terblokir saat menambah pegawai atau order baru.
          </p>
        )}

        <a
          href={upgradeMailto(
            trialActive
              ? "Ingin berlangganan sebelum masa trial berakhir"
              : `Ingin mengatur pembayaran paket ${data.planName}`,
          )}
          className="w-full inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110"
        >
          <Mail className="h-4 w-4" />
          {trialActive ? "Berlangganan Sekarang" : "Atur Pembayaran"}
        </a>
        <p className="text-[11px] text-muted text-center">
          Mengirim email ke <span className="font-mono">{BILLING_CONTACT_EMAIL}</span> — tim kami akan membalas dengan cara pembayaran.
        </p>
      </section>

      {data.canManagePlan && data.availablePlans.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-card">
          <div>
            <h2 className="text-sm font-bold text-primary">Ubah Paket</h2>
            <p className="text-[11px] text-muted mt-0.5">
              Ganti sendiri kapan saja, berlaku langsung. Tagihan bulanan menyesuaikan paket baru.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.availablePlans.map((p) => {
              const isUp = p.priceMonthly > (data.priceMonthly ?? 0);
              return (
                <div
                  key={p.key}
                  className={
                    "rounded-xl border p-3 space-y-2 " +
                    (p.current ? "border-accent-teal bg-accent-teal/5" : "border-border")
                  }
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-primary">{p.name}</p>
                    {p.current && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-teal">
                        <Check className="h-3 w-3" /> Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted">{rupiah(p.priceMonthly)} / bulan</p>
                  <p className="text-[11px] text-muted">
                    Maks. {p.maxUsers != null ? `${p.maxUsers} pegawai` : "pegawai tak terbatas"}
                  </p>
                  {!p.current && (
                    <button
                      onClick={() => pickPlan(p.key, p.name)}
                      disabled={changingPlan !== null}
                      className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-elevated border border-border text-xs font-bold text-primary hover:border-accent-teal/50 disabled:opacity-50"
                    >
                      {changingPlan === p.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isUp ? (
                        <ArrowUpCircle className="h-3.5 w-3.5 text-status-green" />
                      ) : (
                        <ArrowDownCircle className="h-3.5 w-3.5 text-status-yellow-text" />
                      )}
                      {isUp ? "Upgrade" : "Turunkan"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-card">
        <h2 className="text-sm font-bold text-primary">Riwayat Tagihan</h2>
        {data.invoices.length === 0 ? (
          <p className="text-xs text-muted">Belum ada invoice untuk workspace ini.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.invoices.map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-primary truncate">{inv.number}</p>
                  <p className="text-muted mt-0.5">
                    Periode {inv.period} · Jatuh tempo {new Date(inv.dueDate).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-bold text-primary">{rupiah(inv.amount)}</p>
                  <p
                    className={
                      "mt-0.5 " +
                      (inv.status === "PAID"
                        ? "text-status-green"
                        : inv.status === "PENDING"
                        ? "text-status-yellow-text"
                        : "text-muted")
                    }
                  >
                    {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
