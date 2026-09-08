"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Receipt, AlertTriangle, X, FileText, CheckCircle2, Ban, Search, RefreshCw,
} from "lucide-react";
import {
  getBillingMetrics, listInvoices, generateInvoicesForPeriod, markInvoicePaid, waiveInvoice,
} from "@/actions/platform-billing";

type Metrics = {
  unpaidAmount: number; unpaidCount: number;
  overdueAmount: number; overdueCount: number;
  paidThisMonthAmount: number; paidThisMonthCount: number;
  mrr: number;
};
type Invoice = {
  id: string; number: string; tenantName: string; tenantSlug: string; tenantStatus: string;
  amount: number; status: "PENDING" | "PAID" | "FAILED" | "WAIVED";
  dueDate: string | Date; paidAt: string | Date | null;
  paymentMethod: string | null; paymentReference: string | null;
  createdAt: string | Date; overdue: boolean;
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const d = (x: string | Date | null) => (x ? new Date(x).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—");
const STATUS_FILTERS = ["ALL", "PENDING", "FAILED", "PAID", "WAIVED"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-status-blue/10 text-status-blue border-status-blue/30",
  FAILED: "bg-status-red/10 text-status-red border-status-red/30",
  PAID: "bg-status-green/10 text-status-green border-status-green/30",
  WAIVED: "bg-muted/10 text-muted border-muted/30",
};

export default function PlatformBillingPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [pay, setPay] = useState<Invoice | null>(null);
  const [waive, setWaive] = useState<Invoice | null>(null);

  const loadList = useCallback(
    async (reset: boolean, fromCursor: string | null) => {
      setLoading(true);
      const r = await listInvoices({
        status,
        onlyOverdue,
        q: q.trim() || undefined,
        cursor: fromCursor ?? undefined,
        limit: 40,
      });
      setLoading(false);
      if (!r.success) { setError(r.error); return; }
      setError(null);
      setInvoices((prev) => (reset ? r.data.invoices : [...prev, ...r.data.invoices]));
      setCursor(r.data.nextCursor);
    },
    [status, onlyOverdue, q],
  );

  const loadMetrics = useCallback(async () => {
    const m = await getBillingMetrics();
    if (m.success) setMetrics(m.data);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMetrics(); }, [loadMetrics]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadList(true, null); }, [loadList]);

  async function refreshAll() {
    await Promise.all([loadMetrics(), loadList(true, null)]);
  }

  const cards = [
    { label: "Belum dibayar", value: metrics ? rupiah(metrics.unpaidAmount) : "—", hint: metrics ? `${metrics.unpaidCount} invoice` : "", danger: false },
    { label: "Jatuh tempo lewat", value: metrics ? rupiah(metrics.overdueAmount) : "—", hint: metrics ? `${metrics.overdueCount} invoice` : "", danger: true },
    { label: "Lunas bulan ini", value: metrics ? rupiah(metrics.paidThisMonthAmount) : "—", hint: metrics ? `${metrics.paidThisMonthCount} invoice` : "", danger: false },
    { label: "MRR (tenant aktif)", value: metrics ? rupiah(metrics.mrr) : "—", hint: "langganan aktif", danger: false },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Billing &amp; Invoice</h1>
          <p className="text-sm text-muted mt-0.5">Terbitkan tagihan langganan, catat pembayaran manual, pantau tunggakan.</p>
        </div>
        <button
          onClick={() => setGenOpen(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 shrink-0"
        >
          <FileText className="h-3.5 w-3.5" /> Terbitkan invoice
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`bg-card border rounded-2xl p-5 ${c.danger && metrics && metrics.overdueCount > 0 ? "border-status-red/40" : "border-border"}`}>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{c.label}</p>
            <p className={`text-xl font-bold mt-1 font-mono ${c.danger && metrics && metrics.overdueCount > 0 ? "text-status-red" : "text-primary"}`}>{c.value}</p>
            <p className="text-[10px] text-muted mt-1">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nomor / tenant…"
            className="w-full h-9 rounded-lg bg-elevated border border-border pl-9 pr-3 text-sm text-primary outline-none focus:border-accent-teal"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => { setStatus(f); setOnlyOverdue(false); }}
              className={`px-2.5 h-9 rounded-lg text-xs font-bold border transition-colors ${
                status === f && !onlyOverdue
                  ? "bg-accent-teal/15 text-accent-teal border-accent-teal/30"
                  : "bg-elevated text-muted border-border hover:text-primary"
              }`}
            >
              {f === "ALL" ? "Semua" : f}
            </button>
          ))}
          <button
            onClick={() => { setOnlyOverdue((v) => !v); setStatus("ALL"); }}
            className={`px-2.5 h-9 rounded-lg text-xs font-bold border transition-colors ${
              onlyOverdue
                ? "bg-status-red/15 text-status-red border-status-red/30"
                : "bg-elevated text-muted border-border hover:text-primary"
            }`}
          >
            Nunggak
          </button>
          <button
            onClick={refreshAll}
            className="px-2.5 h-9 rounded-lg text-xs font-bold border bg-elevated text-muted border-border hover:text-primary inline-flex items-center gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Receipt className="h-4 w-4 text-accent-teal" />
          <h2 className="text-sm font-semibold text-primary">{invoices.length} invoice</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Nomor</th>
                <th className="px-4 py-2.5">Tenant</th>
                <th className="px-4 py-2.5">Nominal</th>
                <th className="px-4 py-2.5">Jatuh tempo</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Bayar</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-elevated/30 align-top">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{inv.number}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="text-primary">{inv.tenantName}</span>
                    <span className="text-muted font-mono block">{inv.tenantSlug}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{rupiah(inv.amount)}</td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    <span className={inv.overdue ? "text-status-red font-bold" : "text-muted"}>{d(inv.dueDate)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[inv.status]}`}>
                      {inv.overdue ? "NUNGGAK" : inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-muted">
                    {inv.status === "PAID" ? (
                      <>
                        {d(inv.paidAt)}
                        {inv.paymentMethod && <span className="block">{inv.paymentMethod}</span>}
                        {inv.paymentReference && <span className="block font-mono">{inv.paymentReference}</span>}
                      </>
                    ) : inv.status === "WAIVED" ? "dibebaskan" : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {(inv.status === "PENDING" || inv.status === "FAILED") ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={busy === inv.id}
                          onClick={() => setPay(inv)}
                          className="inline-flex items-center gap-1 text-xs text-status-green hover:underline disabled:opacity-40"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Tandai lunas
                        </button>
                        <span className="text-border">·</span>
                        <button
                          disabled={busy === inv.id}
                          onClick={() => setWaive(inv)}
                          className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary disabled:opacity-40"
                        >
                          <Ban className="h-3.5 w-3.5" /> Bebaskan
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted text-sm">Belum ada invoice.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {cursor && (
          <div className="p-3 border-t border-border text-center">
            <button
              onClick={() => loadList(false, cursor)}
              disabled={loading}
              className="text-xs font-bold text-accent-teal hover:underline disabled:opacity-40"
            >
              {loading ? "Memuat…" : "Muat lebih banyak"}
            </button>
          </div>
        )}
      </div>

      {genOpen && (
        <GenerateModal
          onClose={() => setGenOpen(false)}
          onDone={async () => { setGenOpen(false); await refreshAll(); }}
        />
      )}
      {pay && (
        <PayModal
          invoice={pay}
          busy={busy === pay.id}
          onClose={() => setPay(null)}
          onSubmit={async (method, reference, paidAt) => {
            setBusy(pay.id);
            const r = await markInvoicePaid(pay.id, { method, reference, paidAt });
            setBusy(null);
            if (!r.success) return r.error ?? "Gagal.";
            setPay(null);
            await refreshAll();
            return null;
          }}
        />
      )}
      {waive && (
        <WaiveModal
          invoice={waive}
          busy={busy === waive.id}
          onClose={() => setWaive(null)}
          onSubmit={async (reason) => {
            setBusy(waive.id);
            const r = await waiveInvoice(waive.id, reason);
            setBusy(null);
            if (!r.success) return r.error ?? "Gagal.";
            setWaive(null);
            await refreshAll();
            return null;
          }}
        />
      )}
    </div>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-modal space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GenerateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [dueInDays, setDueInDays] = useState("14");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; period: string } | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    const r = await generateInvoicesForPeriod({ period, dueInDays: Number(dueInDays) || 14 });
    setBusy(false);
    if (!r.success) { setErr(r.error ?? "Gagal."); return; }
    setResult({ created: r.data.created.length, skipped: r.data.skipped.length, period: r.data.period });
  }

  return (
    <Shell title="Terbitkan Invoice Bulanan" onClose={onClose}>
      {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
      {result ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-status-green/10 border border-status-green/30 px-3 py-2 text-xs text-status-green">
            Periode {result.period}: {result.created} invoice dibuat, {result.skipped} dilewati (sudah ada / harga 0).
          </p>
          <button onClick={onDone} className="w-full h-10 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110">
            Selesai
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">
            Membuat invoice <b>PENDING</b> untuk setiap tenant <b>ACTIVE</b> berlangganan yang belum ditagih di periode ini.
            Aman diulang — tidak menggandakan.
          </p>
          <label className="block">
            <span className="text-[11px] text-muted mb-1 block">Periode (YYYY-MM)</span>
            <input value={period} onChange={(e) => setPeriod(e.target.value)}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted mb-1 block">Jatuh tempo (hari sejak awal periode)</span>
            <input type="number" min={1} value={dueInDays} onChange={(e) => setDueInDays(e.target.value)}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
          </label>
          <button onClick={run} disabled={busy}
            className="w-full h-10 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-40">
            {busy ? "Memproses…" : "Terbitkan"}
          </button>
        </>
      )}
    </Shell>
  );
}

function PayModal({
  invoice, busy, onClose, onSubmit,
}: {
  invoice: Invoice; busy: boolean; onClose: () => void;
  onSubmit: (method: string, reference: string, paidAt: string) => Promise<string | null>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [method, setMethod] = useState("Transfer BCA");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Shell title="Tandai Lunas" onClose={onClose}>
      <p className="text-xs text-muted">
        <span className="font-mono text-primary">{invoice.number}</span> · {rupiah(invoice.amount)} · {invoice.tenantSlug}
      </p>
      {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
      <label className="block">
        <span className="text-[11px] text-muted mb-1 block">Metode pembayaran</span>
        <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Transfer BCA"
          className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal" />
      </label>
      <label className="block">
        <span className="text-[11px] text-muted mb-1 block">Referensi / no. bukti (opsional)</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)}
          className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
      </label>
      <label className="block">
        <span className="text-[11px] text-muted mb-1 block">Tanggal bayar</span>
        <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)}
          className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal" />
      </label>
      <button
        disabled={busy || !method.trim()}
        onClick={async () => { setErr(null); const e = await onSubmit(method, reference, paidAt); if (e) setErr(e); }}
        className="w-full h-10 rounded-lg bg-status-green text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
      >
        {busy ? "Menyimpan…" : "Konfirmasi lunas"}
      </button>
    </Shell>
  );
}

function WaiveModal({
  invoice, busy, onClose, onSubmit,
}: {
  invoice: Invoice; busy: boolean; onClose: () => void;
  onSubmit: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <Shell title="Bebaskan Invoice (Waive)" onClose={onClose}>
      <p className="text-xs text-muted">
        <span className="font-mono text-primary">{invoice.number}</span> · {rupiah(invoice.amount)} · {invoice.tenantSlug}
      </p>
      <p className="text-xs text-muted">Invoice ditandai <b>WAIVED</b> dan tidak lagi dihitung sebagai tunggakan.</p>
      {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Alasan (wajib)…"
        className="w-full rounded-lg bg-elevated border border-border p-3 text-sm text-primary outline-none focus:border-accent-teal resize-none" />
      <button
        disabled={busy || !reason.trim()}
        onClick={async () => { setErr(null); const e = await onSubmit(reason); if (e) setErr(e); }}
        className="w-full h-10 rounded-lg bg-status-red text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
      >
        {busy ? "Menyimpan…" : "Bebaskan"}
      </button>
    </Shell>
  );
}
