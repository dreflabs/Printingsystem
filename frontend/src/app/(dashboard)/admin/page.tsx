"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusPill } from "@/components/ui";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import {
  ShoppingCart, Package, AlertTriangle, Plus, ArrowRight, ScanLine, TrendingUp,
  CheckCircle2, ClipboardCheck, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrders, getOrderDetail } from "@/actions/queries";
import { addPayment } from "@/actions/orders";
import { submitFinalAudit } from "@/actions/audit";

type OrderRow = {
  id: string; orderCode: string; type: string; customerName: string; status: string;
  total: number; paidAmount: number; balance: number; deadline: string | Date | null;
  createdAt: string | Date; overdue: boolean; itemCount: number;
};
type Detail = Extract<Awaited<ReturnType<typeof getOrderDetail>>, { success: true }>["data"];

const fmtRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—");

// ── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ orderId, onClose, onBayar }: { orderId: string; onClose: () => void; onBayar: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    getOrderDetail(orderId).then((r) => (r.success ? setD(r.data as Detail) : setErr(r.error)));
  }, [orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h3 className="text-base font-bold text-primary">Detail Order {d?.orderCode ?? ""}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {err && <p className="text-status-red text-xs">{err}</p>}
          {!d && !err && <p className="text-muted text-xs">Memuat…</p>}
          {d && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-elevated/50 p-4 rounded-xl text-xs">
                <div><p className="text-muted text-[10px] uppercase">Konsumen</p><p className="font-semibold text-primary">{d.customer?.name ?? "-"}</p></div>
                <div><p className="text-muted text-[10px] uppercase">Tipe</p><p className="font-semibold text-primary">{d.type}</p></div>
                <div><p className="text-muted text-[10px] uppercase">Status</p><StatusPill status={d.status} /></div>
                <div><p className="text-muted text-[10px] uppercase">Deadline</p><p className="font-semibold text-primary">{fmtDate(d.deadline)}</p></div>
                <div><p className="text-muted text-[10px] uppercase">Dibuat oleh</p><p className="font-semibold text-primary">{d.createdBy}</p></div>
                <div><p className="text-muted text-[10px] uppercase">Designer</p><p className="font-semibold text-primary">{d.designer ?? "-"}</p></div>
              </div>

              <div>
                <p className="text-xs font-bold text-primary mb-2">Item ({d.items.length})</p>
                <div className="border border-border rounded-xl divide-y divide-border/60 text-xs">
                  {d.items.map((it, i) => (
                    <div key={i} className="flex justify-between px-3 py-2">
                      <span className="text-primary">{it.name} · {it.quantity} pcs {it.size ? `· ${it.size}` : ""}</span>
                      <span className="font-mono text-muted">{fmtRp(it.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-elevated/50 p-3 rounded-xl">
                  <p className="text-muted text-[10px] uppercase">Total / DP wajib</p>
                  <p className="font-mono font-bold text-primary">{fmtRp(d.total)} / {fmtRp(d.dpRequired)}</p>
                </div>
                <div className="bg-elevated/50 p-3 rounded-xl">
                  <p className="text-muted text-[10px] uppercase">Dibayar / Sisa</p>
                  <p className={cn("font-mono font-bold", d.balance > 0 ? "text-status-yellow" : "text-status-green")}>
                    {fmtRp(d.paidAmount)} / {d.balance > 0 ? fmtRp(d.balance) : "Lunas"}
                  </p>
                </div>
              </div>

              {d.payments.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-primary mb-2">Pembayaran</p>
                  <div className="border border-border rounded-xl divide-y divide-border/60 text-xs">
                    {d.payments.map((p, i) => (
                      <div key={i} className="flex justify-between px-3 py-2">
                        <span className="text-muted">{p.method} · {p.status} · {p.receivedBy}</span>
                        <span className="font-mono text-primary">{fmtRp(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {d.productionJobs.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-primary mb-2">Job Produksi</p>
                  <div className="border border-border rounded-xl divide-y divide-border/60 text-xs">
                    {d.productionJobs.map((j) => (
                      <div key={j.jobCode} className="flex justify-between px-3 py-2">
                        <span className="font-mono text-accent-teal">{j.jobCode}</span>
                        <span className="text-muted">{j.status} · {j.machine} · {j.operator} · {j.actualQty}/{j.plannedQty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-border shrink-0">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary">Tutup</button>
          {d && d.balance > 0 && (
            <button onClick={onBayar} className="flex-1 h-11 rounded-xl bg-status-yellow text-black text-sm font-bold hover:brightness-105">Catat Pembayaran</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({ order, onClose, onDone }: { order: OrderRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(order.balance));
  const [method, setMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("TRANSFER");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    const res = await addPayment(order.id, { amount: Number(amount), method, reference: reference.trim() || undefined });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }
  const inp = "w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div><h3 className="text-base font-bold text-primary">Catat Pembayaran</h3><p className="text-xs text-muted font-mono">{order.orderCode}</p></div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>
        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
        <p className="text-xs text-muted">Sisa tagihan: <span className="font-bold text-status-yellow">{fmtRp(order.balance)}</span></p>
        <div><label className="text-xs text-muted mb-1 block">Jumlah</label><input type="number" className={inp} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="text-xs text-muted mb-1 block">Metode</label>
          <select className={inp} value={method} onChange={(e) => setMethod(e.target.value as "CASH" | "TRANSFER" | "QRIS")}>
            <option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option><option value="QRIS">QRIS</option>
          </select>
        </div>
        <div><label className="text-xs text-muted mb-1 block">No. Referensi (opsional)</label><input className={inp} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        <button disabled={busy || !(Number(amount) > 0)} onClick={submit}
          className="w-full h-11 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 disabled:opacity-40">
          Konfirmasi Pembayaran
        </button>
      </div>
    </div>
  );
}

// ── Final Audit Modal ────────────────────────────────────────────────────────
const AUDIT_ITEMS = [
  { id: "financial", label: "Keuangan (DP & Pelunasan)" },
  { id: "material", label: "Material (Pemakaian sesuai order)" },
  { id: "quantity", label: "Jumlah (Qty aktual vs planned)" },
  { id: "production", label: "Produksi (Semua job selesai)" },
  { id: "storage", label: "Penyimpanan & Pickup" },
] as const;

function FinalAuditModal({ order, onClose, onDone }: { order: OrderRow; onClose: () => void; onDone: () => void }) {
  const [r, setR] = useState<Record<string, "PASS" | "FAIL">>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const allChecked = AUDIT_ITEMS.every((i) => r[i.id]);
  const hasFail = Object.values(r).includes("FAIL");
  const result: "GREEN" | "YELLOW" = hasFail ? "YELLOW" : "GREEN";

  async function submit() {
    setBusy(true); setErr(null);
    const s = (k: string) => (r[k] === "FAIL" ? "WARNING" : "OK");
    const res = await submitFinalAudit(order.id, {
      result,
      financialStatus: s("financial"),
      materialStatus: s("material"),
      quantityStatus: s("quantity"),
      productionStatus: s("production"),
      storageStatus: s("storage"),
      notes: notes.trim() || undefined,
      items: AUDIT_ITEMS.filter((i) => r[i.id] === "FAIL").map((i) => ({ category: i.id.toUpperCase(), severity: "WARNING" as const, status: "FAIL" })),
    });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h3 className="text-base font-bold text-primary flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-accent-teal" /> Final Audit · {order.orderCode}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
          <p className="text-xs text-muted mb-2">Semua PASS → GREEN (CLOSED). Ada FAIL → YELLOW (approval Owner).</p>
          {AUDIT_ITEMS.map((item) => (
            <div key={item.id} className="p-3 bg-elevated rounded-xl border border-border">
              <p className="text-xs font-semibold text-primary mb-2">{item.label}</p>
              <div className="flex gap-2">
                <button onClick={() => setR((p) => ({ ...p, [item.id]: "PASS" }))}
                  className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border", r[item.id] === "PASS" ? "bg-status-green text-white border-status-green" : "bg-card text-muted border-border")}>✅ PASS</button>
                <button onClick={() => setR((p) => ({ ...p, [item.id]: "FAIL" }))}
                  className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border", r[item.id] === "FAIL" ? "bg-status-red text-white border-status-red" : "bg-card text-muted border-border")}>❌ FAIL</button>
              </div>
            </div>
          ))}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Catatan audit (opsional)"
            className="w-full rounded-xl bg-elevated border border-border text-sm text-primary p-3 outline-none focus:border-accent-teal resize-none" />
          {allChecked && (
            <div className={cn("p-2 rounded-xl text-center text-sm font-bold border", result === "GREEN" ? "bg-status-green/10 text-status-green border-status-green/30" : "bg-status-yellow/10 text-status-yellow border-status-yellow/30")}>
              {result === "GREEN" ? "🟢 GREEN — akan CLOSED" : "🟡 YELLOW — butuh approval Owner"}
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-border shrink-0">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary">Batal</button>
          <button disabled={!allChecked || busy} onClick={submit} className="flex-1 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40">Submit Audit</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [detailFor, setDetailFor] = useState<OrderRow | null>(null);
  const [payFor, setPayFor] = useState<OrderRow | null>(null);
  const [auditFor, setAuditFor] = useState<OrderRow | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "PRINTING" | "RETAIL">("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const res = await getOrders({ limit: 200, ...(statusFilter ? { status: statusFilter } : {}), ...(typeFilter ? { type: typeFilter } : {}), ...(search ? { search } : {}) });
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setOrders(res.data);
  }, [statusFilter, typeFilter, search]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const today = new Date().toDateString();
  const kpi = [
    { label: "Order Baru Hari Ini", value: orders.filter((o) => new Date(o.createdAt).toDateString() === today).length, filter: "", dot: "bg-blue-600" },
    { label: "Ada Sisa Tagihan", value: orders.filter((o) => o.balance > 0 && !["CANCELLED"].includes(o.status)).length, filter: "", dot: "bg-amber-500" },
    { label: "Siap Diambil", value: orders.filter((o) => o.status === "READY_FOR_PICKUP").length, filter: "READY_FOR_PICKUP", dot: "bg-emerald-500" },
    { label: "Overdue", value: orders.filter((o) => o.overdue).length, filter: "", dot: "bg-red-600", urgent: true },
    { label: "Menunggu Audit", value: orders.filter((o) => o.status === "FINAL_AUDIT_PENDING").length, filter: "FINAL_AUDIT_PENDING", dot: "bg-amber-500" },
  ];

  const readyPickup = orders.filter((o) => o.status === "READY_FOR_PICKUP");
  const awaitingAudit = orders.filter((o) => o.status === "FINAL_AUDIT_PENDING");

  return (
    <div className="space-y-6">
      <NewOrderModal open={showOrderModal} onClose={() => setShowOrderModal(false)} onCreated={() => load()} />
      {detailFor && <DetailModal orderId={detailFor.id} onClose={() => setDetailFor(null)} onBayar={() => { setPayFor(detailFor); setDetailFor(null); }} />}
      {payFor && <PaymentModal order={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />}
      {auditFor && <FinalAuditModal order={auditFor} onClose={() => setAuditFor(null)} onDone={() => { setAuditFor(null); load(); }} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Admin</h1>
          <p className="text-sm text-muted mt-0.5">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/scan" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-primary hover:bg-elevated"><ScanLine className="h-4 w-4 text-accent-teal" /> Scan QR</a>
          <a href="/pos" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-primary hover:bg-elevated"><ShoppingCart className="h-4 w-4 text-accent-teal" /> Kasir POS</a>
          <button onClick={() => setShowOrderModal(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-teal text-white text-sm font-semibold hover:brightness-110"><Plus className="h-4 w-4" /> Order Baru</button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpi.map((k) => (
          <button key={k.label} onClick={() => setStatusFilter((p) => (p === k.filter ? "" : k.filter))}
            className={cn("bg-card border rounded-2xl p-4 shadow-sm text-left transition-all",
              k.urgent ? "border-red-300 bg-red-50/15" : "border-border hover:border-accent-teal/40",
              statusFilter === k.filter && k.filter !== "" && "ring-2 ring-accent-teal/30 border-accent-teal")}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted font-medium truncate">{k.label}</span>
              <span className={cn("h-2 w-2 rounded-full shrink-0", k.dot)} />
            </div>
            <p className={cn("text-2xl md:text-3xl font-bold", k.urgent ? "text-status-red" : "text-primary")}>{k.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-status-green" />
            <h2 className="text-base font-semibold text-primary">Siap Diambil</h2>
            <span className="text-xs text-muted">({readyPickup.length})</span>
          </div>
          <div className="space-y-2">
            {readyPickup.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-elevated border border-border/60 cursor-pointer" onClick={() => setDetailFor(o)}>
                <div className="min-w-0"><p className="text-sm font-medium text-primary truncate">{o.customerName}</p><p className="text-xs text-muted truncate">{o.orderCode}</p></div>
                <ArrowRight className="h-4 w-4 text-muted shrink-0" />
              </div>
            ))}
            {readyPickup.length === 0 && <p className="text-xs text-muted p-4 text-center">Belum ada order siap diambil.</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">Menunggu Final Audit</h2>
            <span className="text-xs text-muted">({awaitingAudit.length})</span>
          </div>
          <div className="space-y-2">
            {awaitingAudit.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated border border-border/60">
                <div className="min-w-0"><p className="text-xs font-medium text-primary truncate">{o.orderCode}</p><p className="text-[10px] text-muted truncate">{o.customerName}</p></div>
                <button onClick={() => setAuditFor(o)} className="text-xs text-accent-teal hover:underline shrink-0 font-semibold px-2.5 py-1 bg-card rounded-lg border border-border">Audit →</button>
              </div>
            ))}
            {awaitingAudit.length === 0 && <p className="text-xs text-muted p-2 text-center">Tidak ada order menunggu audit.</p>}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">Daftar Order</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">{orders.length}</span>
            {(statusFilter || typeFilter) && (
              <button onClick={() => { setStatusFilter(""); setTypeFilter(""); }} className="text-xs text-status-red hover:underline">✕ Hapus Filter</button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input placeholder="Cari nama / kode..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48 rounded-lg bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal cursor-pointer">
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="WAITING_PAYMENT">Menunggu Bayar</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PRODUCTION_STARTED">Produksi</option>
              <option value="READY_FOR_PICKUP">Siap Diambil</option>
              <option value="FINAL_AUDIT_PENDING">Menunggu Audit</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | "PRINTING" | "RETAIL")}
              className="h-9 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal cursor-pointer">
              <option value="">Semua Tipe</option>
              <option value="PRINTING">Printing</option>
              <option value="RETAIL">Retail</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50">
                {["Kode Order", "Konsumen", "Tipe", "Status", "Total", "Sisa", "Deadline", "Aksi"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-elevated/30 transition-colors cursor-pointer" onClick={() => setDetailFor(o)}>
                  <td className="px-4 py-3 font-mono text-xs text-accent-teal whitespace-nowrap">{o.orderCode}</td>
                  <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{o.customerName}</td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{o.type}</td>
                  <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap">{fmtRp(o.total)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn("text-xs font-mono", o.balance > 0 ? "text-status-yellow" : "text-status-green")}>{o.balance > 0 ? fmtRp(o.balance) : "Lunas"}</span>
                  </td>
                  <td className={cn("px-4 py-3 whitespace-nowrap text-xs", o.overdue ? "text-status-red font-bold" : "text-muted")}>{fmtDate(o.deadline)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDetailFor(o)} className="text-xs text-accent-teal hover:underline">Detail</button>
                      {o.balance > 0 && o.type === "PRINTING" && (
                        <><span className="text-border">·</span><button onClick={() => setPayFor(o)} className="text-xs text-status-yellow hover:underline">Bayar</button></>
                      )}
                      {o.status === "FINAL_AUDIT_PENDING" && (
                        <><span className="text-border">·</span><button onClick={() => setAuditFor(o)} className="text-xs text-accent-teal hover:underline font-semibold">Audit</button></>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted text-sm">Tidak ada order.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
