"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Loader2, Mail, Users, ShoppingCart, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Check } from "lucide-react";
import { useToast } from "@/components/ui";
import { getTenantBillingSummary, changeTenantPlan, applyVoucher, removeVoucher, type TenantBillingSummary } from "@/actions/billing";
import { BILLING_CONTACT_EMAIL } from "@/lib/billing-contact";
import { SERVICE_OPTIONS } from "@/lib/saas-catalog";

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

const SERVICE_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_OPTIONS.map((s) => [s.key, s.name]),
);

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
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [nowTs, setNowTs] = useState(0);

  const load = useCallback(async () => {
    const res = await getTenantBillingSummary();
    if (res.success) {
      setData(res.data);
      setNowTs(Date.now());
    } else toast({ type: "error", title: "Gagal memuat", message: res.error });
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

  const submitVoucher = async () => {
    setVoucherBusy(true);
    const res = await applyVoucher(voucherInput);
    setVoucherBusy(false);
    if (res.success) {
      toast({ type: "success", title: `Voucher ${res.data.code} dipasang`, message: `Potongan ${res.data.label} (${rupiah(res.data.discountAmount)}) akan dipakai pada invoice berikutnya.` });
      setVoucherInput("");
      void load();
    } else {
      toast({ type: "error", title: "Voucher gagal", message: res.error });
    }
  };

  const dropVoucher = async () => {
    setVoucherBusy(true);
    const res = await removeVoucher();
    setVoucherBusy(false);
    if (res.success) {
      toast({ type: "success", title: "Voucher dihapus" });
      void load();
    } else {
      toast({ type: "error", title: "Gagal menghapus voucher", message: res.error });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }
  if (!data) return null;

  const unpaid = data.status === "UNPAID";
  const userQuotaFull = data.maxUsers != null && data.activeUsers >= data.maxUsers;
  const orderQuotaFull = data.maxOrdersPerMonth != null && data.ordersThisMonth >= data.maxOrdersPerMonth;
  const pendingInvoice = data.invoices.find((i) => i.status === "PENDING" || i.status === "FAILED") ?? null;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-primary">Paket &amp; Tagihan</h1>
        <p className="text-sm text-muted mt-0.5">Paket aktif, sisa kuota, dan riwayat tagihan workspace Anda.</p>
      </div>

      {unpaid && (
        <div
          className={
            "rounded-2xl border px-4 py-3 text-sm flex items-start gap-3 " +
            (pendingInvoice && nowTs > 0 && new Date(pendingInvoice.dueDate).getTime() < nowTs
              ? "border-status-red/30 bg-status-red/10 text-status-red"
              : "border-status-yellow/30 bg-status-yellow/10 text-status-yellow-text")
          }
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Selesaikan pembayaran untuk membuka akses penuh</p>
            <p className="mt-0.5 opacity-90">
              Selama status UNPAID, aplikasi hanya bisa dibuka di halaman tagihan ini. Transfer ke rekening di bawah,
              unggah bukti bayar, dan akses dibuka setelah diverifikasi.
            </p>
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
                : data.status === "UNPAID"
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

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="text-muted">Durasi langganan</p>
            <p className="font-bold text-primary">
              {data.termMonths} bulan{data.termMonths === 12 ? " — bayar 10" : ""}
            </p>
          </div>
          <div>
            <p className="text-muted">Kursi tambahan</p>
            <p className="font-bold text-primary">{data.addonUsers > 0 ? `${data.addonUsers} user` : "—"}</p>
          </div>
          <div>
            <p className="text-muted">Layanan tambahan</p>
            <p className="font-bold text-primary">
              {data.serviceKeys.length > 0 ? data.serviceKeys.map((k) => SERVICE_LABEL[k] ?? k).join(", ") : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted">Estimasi tagihan / termin</p>
            <p className="font-bold text-primary">{data.estimateTotal != null ? rupiah(data.estimateTotal) : "—"}</p>
          </div>
        </div>

        {(userQuotaFull || orderQuotaFull) && (
          <p className="text-[11px] text-status-red">
            Kuota paket Anda sudah penuh. Upgrade paket supaya tidak terblokir saat menambah pegawai atau order baru.
          </p>
        )}

        {pendingInvoice ? (
          <Link
            href={`/owner/billing/invoice/${pendingInvoice.id}`}
            className="w-full inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110"
          >
            <CreditCard className="h-4 w-4" />
            Bayar Tagihan {pendingInvoice.number} — {rupiah(pendingInvoice.amount)}
          </Link>
        ) : (
          <a
            href={upgradeMailto(`Ingin mengatur pembayaran paket ${data.planName}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110"
          >
            <Mail className="h-4 w-4" />
            Hubungi Tim Billing
          </a>
        )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <div>
          <h2 className="text-sm font-bold text-primary">Kode Voucher</h2>
          <p className="text-[11px] text-muted mt-0.5">Voucher dipakai sekali pada invoice berikutnya.</p>
        </div>
        {data.voucherCode ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-accent-teal bg-accent-teal/5 px-3 py-2">
            <div>
              <p className="text-sm font-bold text-primary font-mono">{data.voucherCode}</p>
              <p className="text-[10px] text-muted">Menunggu dipakai pada invoice berikutnya.</p>
            </div>
            <button
              onClick={dropVoucher}
              disabled={voucherBusy}
              className="h-8 px-3 rounded-lg bg-elevated border border-border text-xs font-bold text-primary hover:border-status-red/50 disabled:opacity-50"
            >
              {voucherBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Hapus"}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={voucherInput}
              onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
              placeholder="Masukkan kode voucher"
              className="flex-1 bg-base border border-border rounded-lg h-10 px-3 text-sm text-primary font-mono placeholder:text-muted/50 focus:border-accent-teal outline-none transition-all"
            />
            <button
              onClick={submitVoucher}
              disabled={voucherBusy || !voucherInput.trim()}
              className="h-10 px-4 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {voucherBusy ? "Memeriksa…" : "Gunakan"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-card">
        <h2 className="text-sm font-bold text-primary">Riwayat Tagihan</h2>
        {data.invoices.length === 0 ? (
          <p className="text-xs text-muted">Belum ada invoice untuk workspace ini.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.invoices.map((inv) => (
              <div key={inv.id} className="py-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <Link href={`/owner/billing/invoice/${inv.id}`} className="font-semibold text-accent-teal hover:underline truncate block">
                      {inv.number}
                    </Link>
                    <p className="text-muted mt-0.5">
                      Periode {inv.period} · Jatuh tempo {new Date(inv.dueDate).toLocaleDateString("id-ID")}
                    </p>
                    {inv.proofStatus && (
                      <p
                        className={
                          "mt-0.5 text-[10px] font-bold " +
                          (inv.proofStatus === "APPROVED"
                            ? "text-status-green"
                            : inv.proofStatus === "REJECTED"
                            ? "text-status-red"
                            : "text-status-yellow-text")
                        }
                      >
                        Bukti bayar: {inv.proofStatus === "APPROVED" ? "disetujui" : inv.proofStatus === "REJECTED" ? "ditolak" : "menunggu verifikasi"}
                      </p>
                    )}
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
                {inv.lines.length > 0 && (
                  <div className="mt-2 rounded-lg bg-elevated px-3 py-2 space-y-1">
                    {inv.lines.map((l, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 text-[11px]">
                        <span className="text-muted min-w-0">{l.description}</span>
                        <span className={"shrink-0 " + (l.amount < 0 ? "text-status-green font-semibold" : "text-primary")}>
                          {rupiah(l.amount)}
                        </span>
                      </div>
                    ))}
                    {inv.discount > 0 && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border">
                        <span className="text-muted">Subtotal</span>
                        <span className="text-primary">{rupiah(inv.subtotal)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
