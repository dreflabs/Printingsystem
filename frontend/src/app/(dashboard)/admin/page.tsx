"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { PaymentModal } from "@/components/orders/PaymentModal";
import { useWorkflowStore, Order, OrderStatus } from "@/store/useWorkflowStore";
import {
  ShoppingCart, Clock, Package, AlertTriangle, MessageSquareX,
  BadgePercent, Plus, ArrowRight, ScanLine, TrendingUp,
  MessageCircleCheck, CheckCircle2, XCircle, ClipboardCheck, X,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

function deadlineClass(deadline: string, overdue: boolean) {
  if (overdue) return "text-status-red font-bold";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = new Date(deadline);
  if (d.toDateString() === tomorrow.toDateString()) return "text-status-yellow font-semibold";
  return "text-muted";
}

function payStatusLabel(o: Order) {
  const total = Number(o.totalPrice);
  const dp = Number(o.dpAmount);
  if (dp >= total) return { label: "Lunas", color: "text-status-green font-medium" };
  if (dp > 0) return { label: "DP Terpenuhi", color: "text-status-yellow font-medium" };
  return { label: "Belum DP", color: "text-status-yellow font-medium" };
}

const fmt = (n: number) => n.toLocaleString("id-ID");
const fmtRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

// ── Final Audit Checklist Modal ────────────────────────────────────────────────
const AUDIT_ITEMS = [
  { id: "FINANCE", label: "Keuangan (DP & Pelunasan)" },
  { id: "MATERIAL", label: "Material (Pemakaian sesuai order)" },
  { id: "QUANTITY", label: "Jumlah (Qty aktual vs planned)" },
  { id: "PRODUCTION", label: "Produksi (Semua job selesai)" },
  { id: "QC", label: "QC (Hasil PASS tanpa defect terbuka)" },
  { id: "FINISHING", label: "Finishing (Laminasi / Potong / dst. selesai)" },
  { id: "STORAGE", label: "Penyimpanan (Barang di lokasi storage)" },
  { id: "PICKUP", label: "Pickup (Identitas & payment terverifikasi)" },
];

function FinalAuditModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [auditResult, setAuditResult] = useState<Record<string, "PASS" | "FAIL" | "">>({});
  const [submitted, setSubmitted] = useState(false);

  const setItem = (id: string, val: "PASS" | "FAIL") =>
    setAuditResult((prev) => ({ ...prev, [id]: val }));

  const allChecked = AUDIT_ITEMS.every((item) => auditResult[item.id]);
  const hasFail = Object.values(auditResult).includes("FAIL");

  const finalResult = !allChecked ? null : hasFail ? "YELLOW" : "GREEN";

  const handleSubmit = () => setSubmitted(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h3 className="text-base font-bold text-primary flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-accent-teal" /> Final Audit Order
            </h3>
            <p className="text-xs text-muted mt-0.5 font-mono">{orderId}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!submitted ? (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <p className="text-xs text-muted font-medium mb-3">
                Nilai setiap aspek. Jika semua PASS → GREEN (CLOSED). Ada FAIL → YELLOW (butuh approval Owner). RED = anomali kritis.
              </p>
              {AUDIT_ITEMS.map((item) => (
                <div key={item.id} className="p-3 bg-elevated rounded-xl border border-border">
                  <p className="text-xs font-semibold text-primary mb-2">{item.id}: {item.label}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setItem(item.id, "PASS")}
                      className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                        auditResult[item.id] === "PASS" ? "bg-status-green text-white border-status-green" : "bg-card text-muted border-border hover:text-primary"
                      )}>✅ PASS</button>
                    <button onClick={() => setItem(item.id, "FAIL")}
                      className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                        auditResult[item.id] === "FAIL" ? "bg-status-red text-white border-status-red" : "bg-card text-muted border-border hover:text-primary"
                      )}>❌ FAIL</button>
                  </div>
                </div>
              ))}
            </div>

            {finalResult && (
              <div className={cn("mx-5 mb-2 p-3 rounded-xl text-center text-sm font-bold border",
                finalResult === "GREEN"
                  ? "bg-status-green/10 text-status-green border-status-green/30"
                  : "bg-status-yellow/10 text-status-yellow border-status-yellow/30"
              )}>
                {finalResult === "GREEN" ? "🟢 Hasil: GREEN — Siap CLOSED" : "🟡 Hasil: YELLOW — Butuh Approval Owner"}
              </div>
            )}

            <div className="flex gap-3 p-5 border-t border-border shrink-0">
              <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary cursor-pointer">
                Batal
              </button>
              <button
                disabled={!allChecked}
                onClick={handleSubmit}
                className="flex-1 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-40"
              >
                Submit Audit
              </button>
            </div>
          </>
        ) : (
          <div className="p-8 text-center space-y-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center mx-auto text-2xl",
              finalResult === "GREEN" ? "bg-status-green/10 text-status-green" : "bg-status-yellow/10 text-status-yellow"
            )}>
              {finalResult === "GREEN" ? "🟢" : "🟡"}
            </div>
            <p className="text-lg font-bold text-primary">Audit Selesai</p>
            <p className="text-sm text-muted">
              {finalResult === "GREEN"
                ? "Semua aspek PASS. Order dapat di-CLOSE."
                : "Ada item FAIL. Menunggu approval Owner."}
            </p>
            <button onClick={onClose} className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:bg-blue-700 cursor-pointer">
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── WA Approval Modal ──────────────────────────────────────────────────────────
function WAApprovalModal({ onClose }: { onClose: () => void }) {
  const [confirmed, setConfirmed] = useState<"yes" | "no" | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-primary flex items-center gap-2">
              <MessageCircleCheck className="h-5 w-5 text-accent-teal" /> Konfirmasi Approval Desain Online
            </h3>
            <p className="text-xs text-muted mt-0.5">ORD-20260820-0023 · Budi Santoso · Online</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="bg-elevated border border-border rounded-xl p-4 space-y-2 text-xs">
          <p className="font-semibold text-primary">Preview Desain V2 telah dikirim ke konsumen via WhatsApp</p>
          <p className="text-muted">Dikirim: Sabtu, 22 Agt 2026 · 14:30 WIB</p>
          <p className="text-muted">Konfirmasi persetujuan dilakukan secara manual oleh Admin berdasarkan percakapan WA.</p>
        </div>
        {!confirmed ? (
          <div className="space-y-3">
            <p className="text-xs text-muted font-medium">Apakah konsumen sudah menyetujui desain ini via WhatsApp?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmed("no")}
                className="flex-1 h-11 rounded-xl bg-status-yellow/10 text-status-yellow border border-status-yellow/30 text-sm font-semibold hover:bg-status-yellow/20 cursor-pointer flex items-center justify-center gap-1.5">
                <XCircle className="h-4 w-4" /> Belum / Revisi
              </button>
              <button onClick={() => setConfirmed("yes")}
                className="flex-1 h-11 rounded-xl bg-accent-teal text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Sudah ACC
              </button>
            </div>
          </div>
        ) : confirmed === "yes" ? (
          <div className="p-4 bg-status-green/10 border border-status-green/30 rounded-xl text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-status-green mx-auto" />
            <p className="text-sm font-bold text-status-green">Desain disetujui! Order lanjut ke produksi.</p>
            <button onClick={onClose} className="w-full h-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:bg-blue-700 cursor-pointer">
              Tutup
            </button>
          </div>
        ) : (
          <div className="p-4 bg-status-yellow/10 border border-status-yellow/30 rounded-xl text-center space-y-2">
            <p className="text-sm font-bold text-status-yellow">Desain dikembalikan ke Designer untuk revisi.</p>
            <button onClick={onClose} className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary cursor-pointer">
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showFinalAudit, setShowFinalAudit] = useState(false);
  const [auditOrderId, setAuditOrderId] = useState("");
  const [showWAApproval, setShowWAApproval] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [waAccepted, setWaAccepted] = useState(false);

  const orders = useWorkflowStore((s) => s.orders);
  const jobs = useWorkflowStore((s) => s.jobs);
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore((s) => s.updateOrderStatus);
  const processPayment = useWorkflowStore((s) => s.processPayment);

  const today = new Date().toDateString();
  const newOrdersToday = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;
  const waitingPayment = orders.filter((o) => o.paymentStatus !== "PAID").length;
  const readyPickup = orders.filter((o) => o.status === "READY_FOR_PICKUP").length;
  const overdue = orders.filter((o) => o.overdue).length;

  const readyJobs = jobs.filter((j) => j.status === "STORED");

  const KPI_DATA = [
    { label: "Order Baru Hari Ini", value: newOrdersToday.toString(), dot: "bg-blue-600", isUrgent: false, filter: "" as const },
    { label: "Menunggu Bayar", value: waitingPayment.toString(), dot: "bg-amber-500", isUrgent: false, filter: "WAITING_PAYMENT" as const },
    { label: "Siap Diambil", value: readyPickup.toString(), dot: "bg-emerald-500", isUrgent: false, filter: "READY_FOR_PICKUP" as const },
    { label: "Overdue", value: overdue.toString(), dot: "bg-red-600 animate-pulse", isUrgent: true, filter: "OVERDUE" as const },
    { label: "Notif WA Gagal", value: "2", dot: "bg-red-600 animate-pulse", isUrgent: true, filter: "" as const },
    { label: "Menunggu Diskon", value: "1", dot: "bg-amber-500", isUrgent: false, filter: "" as const },
  ];

  // Filter dengan multi-parameter
  const filteredOrders = orders.filter((o) => {
    const matchStatus = statusFilter === "" || o.status === statusFilter;
    const matchType = typeFilter === "" || o.orderType === typeFilter;
    const matchPay = payFilter === "" ||
      (payFilter === "UNPAID" && o.paymentStatus === "UNPAID") ||
      (payFilter === "DP" && o.paymentStatus === "DP_PAID") ||
      (payFilter === "PAID" && o.paymentStatus === "PAID");
    const matchSearch = o.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      || o.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchOverdue = statusFilter === "OVERDUE" ? o.overdue : true;
    return matchStatus && matchType && matchPay && matchSearch && matchOverdue;
  });

  const openDetail = (order: Order) => { setSelectedOrder(order); setShowDetail(true); };
  const openPayment = (order: Order) => { setSelectedOrder(order); setShowPayment(true); };

  const handlePaymentSuccess = (amount: number, method: string) => {
    if (selectedOrder) processPayment(selectedOrder.id, amount, method);
    setShowPayment(false);
  };

  const openFinalAudit = (orderId: string) => {
    setAuditOrderId(orderId);
    setShowFinalAudit(true);
  };

  const hasUrgentItems = overdue > 0 || true; // 2 WA fail mock

  return (
    <div className="space-y-6">
      {/* Modals */}
      <NewOrderModal open={showOrderModal} onClose={() => setShowOrderModal(false)} />
      {showFinalAudit && <FinalAuditModal orderId={auditOrderId} onClose={() => setShowFinalAudit(false)} />}
      {showWAApproval && <WAApprovalModal onClose={() => setShowWAApproval(false)} />}
      {selectedOrder && (
        <>
          <OrderDetailModal
            open={showDetail}
            onClose={() => setShowDetail(false)}
            order={{
              id: selectedOrder.id,
              customerName: selectedOrder.customerName,
              totalPrice: selectedOrder.totalPrice,
              dpAmount: selectedOrder.dpAmount,
              deadline: selectedOrder.deadline,
              status: selectedOrder.status,
            }}
            onBayar={() => { setShowDetail(false); setShowPayment(true); }}
          />
          <PaymentModal
            open={showPayment}
            onClose={() => setShowPayment(false)}
            orderId={selectedOrder.id}
            sisaTagihan={Math.max(0, Number(selectedOrder.totalPrice) - Number(selectedOrder.dpAmount))}
            onSuccess={handlePaymentSuccess}
          />
        </>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Admin</h1>
          <p className="text-sm text-muted mt-0.5">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/scan" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-primary hover:bg-elevated hover:border-accent-teal/40 transition-all shadow-sm">
            <ScanLine className="h-4 w-4 text-accent-teal" /> Scan QR
          </a>
          <a href="/pos" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-primary hover:bg-elevated hover:border-accent-teal/40 transition-all shadow-sm">
            <ShoppingCart className="h-4 w-4 text-accent-teal" /> Kasir POS
          </a>
          <button
            id="btn-order-baru"
            onClick={() => setShowOrderModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-teal text-white text-sm font-semibold shadow-sm hover:bg-blue-700 hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Order Baru
          </button>
        </div>
      </div>

      {/* 🚨 1. BANNER PRIORITAS URGENT (OVERDUE + WA GAGAL) */}
      {hasUrgentItems && (
        <div className="bg-red-50/70 border border-red-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-status-red/10 text-status-red flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                Item Urgent Memerlukan Tindakan Segera
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {overdue > 0 ? `${overdue} order telah melewati batas deadline.` : "Semua order masih dalam batas waktu."} 2 notifikasi status pelanggan gagal terkirim via WhatsApp.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
            {overdue > 0 && (
              <button
                onClick={() => setStatusFilter("OVERDUE")}
                className="flex-1 md:flex-initial px-3.5 py-1.5 rounded-lg bg-status-red text-white text-xs font-bold hover:bg-red-700 transition-all cursor-pointer"
              >
                Lihat Overdue ({overdue})
              </button>
            )}
            <a
              href="#panel-wa-gagal"
              className="flex-1 md:flex-initial text-center px-3.5 py-1.5 rounded-lg bg-white border border-red-200 text-status-red text-xs font-bold hover:bg-red-50 transition-all shadow-2xs"
            >
              Tinjau WA Gagal (2)
            </a>
          </div>
        </div>
      )}

      {/* 📊 2. 6 CARD STATISTIK NETRAL (DENGAN STATUS DOT & BORDER MERAH TIPIS UNTUK URGENT) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_DATA.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setStatusFilter((prev) => prev === kpi.filter ? "" : (kpi.filter as OrderStatus | ""))}
            className={cn(
              "bg-card border rounded-2xl p-4 shadow-sm transition-all text-left cursor-pointer",
              kpi.isUrgent ? "border-red-300 hover:border-red-400 bg-red-50/15" : "border-border hover:border-accent-teal/40",
              statusFilter === kpi.filter && kpi.filter !== "" && "ring-2 ring-accent-teal/30 border-accent-teal"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted font-medium truncate">{kpi.label}</span>
              <span className={cn("h-2 w-2 rounded-full shrink-0", kpi.dot)} />
            </div>
            <p className={cn("text-2xl md:text-3xl font-bold tracking-tight", kpi.isUrgent ? "text-status-red" : "text-primary")}>
              {kpi.value}
            </p>
          </button>
        ))}
      </div>

      {/* 📋 3. PRIORITY PANELS (WA GAGAL & ANTRIAN DISKON DIPISAH MENJADI PANEL SENDIRI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Panel 1: Order Siap Diambil */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-status-green" />
              <h2 className="text-base font-semibold text-primary">Siap Diambil</h2>
              <span className="text-xs text-muted font-medium">({readyJobs.length})</span>
            </div>
            <button onClick={() => setStatusFilter("READY_FOR_PICKUP")} className="text-xs text-accent-teal hover:underline flex items-center gap-1 cursor-pointer font-medium">
              Lihat Semua <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {readyJobs.map((j) => {
              const o = orders.find((ord) => ord.id === j.orderId);
              if (!o) return null;
              return (
                <div key={j.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-elevated hover:bg-elevated/80 transition-colors cursor-pointer border border-border/60" onClick={() => openDetail(o)}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{o.customerName}</p>
                    <p className="text-xs text-muted truncate">{o.id}</p>
                  </div>
                  <button
                    id={`btn-pickup-${j.id}`}
                    onClick={(e) => { e.stopPropagation(); updateJobStatus(j.id, "PICKED_UP"); updateOrderStatus(o.id, "PICKED_UP"); }}
                    className="text-xs text-accent-teal hover:underline shrink-0 cursor-pointer font-semibold"
                  >
                    Proses Pickup
                  </button>
                </div>
              );
            })}
            {readyJobs.length === 0 && <p className="text-xs text-muted p-4 text-center">Belum ada order siap diambil.</p>}
          </div>
        </div>

        {/* Panel 2: Notifikasi WA Gagal (Panel Mandiri) */}
        <div id="panel-wa-gagal" className="bg-card border border-red-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareX className="h-5 w-5 text-status-red" />
              <h2 className="text-base font-semibold text-primary">Notifikasi WA Gagal</h2>
              <span className="text-xs text-status-red font-bold">(2 Gagal)</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              { id: "ORD-20260820-0018", name: "Siti Rahayu", type: "Siap Diambil", time: "10:15 WIB" },
              { id: "ORD-20260819-0044", name: "Ahmad Fauzi", type: "Desain ACC", time: "09:30 WIB" }
            ].map((msg) => (
              <div key={msg.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-elevated border border-border/60">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary truncate">{msg.id} · {msg.name}</p>
                  <p className="text-[11px] text-muted truncate">{msg.type} · Gagal dikirim {msg.time}</p>
                </div>
                <button className="text-xs text-accent-teal hover:underline shrink-0 cursor-pointer font-semibold px-2 py-1 bg-card rounded-lg border border-border shadow-2xs">
                  Kirim Ulang
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 3: Antrian Persetujuan Diskon (Panel Mandiri) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-status-yellow" />
              <h2 className="text-base font-semibold text-primary">Antrian Persetujuan Diskon</h2>
              <span className="text-xs text-muted font-medium">(1 Order)</span>
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-elevated border border-border/60 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-primary">ORD-20260820-0021 · PT Abadi Makmur</p>
                  <p className="text-[11px] text-muted">Pengajuan Diskon 10% · Nilai Potongan Rp 350.000</p>
                </div>
                <span className="text-[11px] text-status-yellow bg-status-yellow/10 border border-status-yellow/30 px-2 py-0.5 rounded-full shrink-0 font-semibold">
                  Menunggu Owner
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 4: Approval Desain via WA */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircleCheck className="h-5 w-5 text-status-yellow" />
            <h2 className="text-base font-semibold text-primary">Approval Desain via WA</h2>
            <span className="text-xs text-muted font-medium">(1 Pending)</span>
          </div>
          {!waAccepted ? (
            <div className="p-3 bg-elevated border border-border/60 rounded-xl space-y-3">
              <div>
                <p className="text-xs font-bold text-primary">ORD-20260820-0023 · Budi Santoso</p>
                <p className="text-[11px] text-muted">Brosur A5 · 1000pcs · Tipe: Online</p>
              </div>
              <p className="text-[11px] text-muted">
                Preview V2 terkirim 14:30 · Menunggu konfirmasi ACC dari Admin
              </p>
              <button
                onClick={() => setShowWAApproval(true)}
                className="w-full py-2 rounded-xl bg-accent-teal text-white text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Konfirmasi ACC WA
              </button>
            </div>
          ) : (
            <div className="p-4 bg-status-green/10 border border-status-green/30 rounded-xl text-center">
              <p className="text-xs font-bold text-status-green">✅ Desain ACC! Order lanjut ke produksi.</p>
            </div>
          )}
        </div>

        {/* Panel 5: Final Audit Shortcut */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">Final Audit Siap Close</h2>
          </div>
          <p className="text-xs text-muted mb-3">Submit hasil checklist audit sebelum status order di-CLOSE.</p>
          <div className="space-y-2">
            {orders.filter((o) => o.status === "READY_FOR_PICKUP").slice(0, 2).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated border border-border/60">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary truncate">{o.id}</p>
                  <p className="text-[10px] text-muted truncate">{o.customerName}</p>
                </div>
                <button
                  id={`btn-audit-${o.id}`}
                  onClick={() => openFinalAudit(o.id)}
                  className="text-xs text-accent-teal hover:underline shrink-0 cursor-pointer font-semibold whitespace-nowrap px-2.5 py-1 bg-card rounded-lg border border-border shadow-2xs"
                >
                  Audit →
                </button>
              </div>
            ))}
            {orders.filter((o) => o.status === "READY_FOR_PICKUP").length === 0 && (
              <p className="text-xs text-muted p-2 text-center">Tidak ada order menunggu audit.</p>
            )}
          </div>
        </div>

        {/* Panel 6: Supervisor Panel (Reassignment) */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="h-5 w-5 text-status-yellow" />
            <h2 className="text-base font-semibold text-primary">Reassignment Mesin</h2>
          </div>
          <div className="p-3 rounded-xl bg-elevated border border-border/60 space-y-2">
            <div>
              <p className="text-xs font-bold text-primary">JOB-0042 · Brosur A5</p>
              <p className="text-[11px] text-muted mt-0.5">Operator (Budi) absen · Mesin Roland A idle</p>
            </div>
            <button className="w-full h-8 rounded-lg bg-accent-teal text-white text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-2xs">
              Reassign Job
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Daftar Order */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">Daftar Order</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">
              {filteredOrders.length}
            </span>
            {(statusFilter || typeFilter || payFilter) && (
              <button onClick={() => { setStatusFilter(""); setTypeFilter(""); setPayFilter(""); }}
                className="text-xs text-status-red hover:underline cursor-pointer">✕ Hapus Filter</button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              placeholder="Cari nama / kode order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-48 rounded-lg bg-elevated border border-border text-sm text-primary px-3 outline-none placeholder:text-muted focus:border-accent-teal transition-colors"
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
              className="h-9 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal appearance-none cursor-pointer">
              <option value="">Semua Status</option>
              <option value="WAITING_PAYMENT">Menunggu Bayar</option>
              <option value="DESIGNING">Desain</option>
              <option value="PRODUCTION_STARTED">Produksi</option>
              <option value="READY_FOR_PICKUP">Siap Diambil</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PICKED_UP">Selesai</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal appearance-none cursor-pointer">
              <option value="">Semua Tipe</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Online">Online</option>
              <option value="Makloon">Makloon</option>
              <option value="RETAIL">RETAIL</option>
            </select>
            <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)}
              className="h-9 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal appearance-none cursor-pointer">
              <option value="">Semua Bayar</option>
              <option value="UNPAID">Belum DP</option>
              <option value="DP">DP Terpenuhi</option>
              <option value="PAID">Lunas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50">
                {["Kode Order", "Konsumen", "Tipe", "Status", "Pembayaran", "Total", "Sisa", "Deadline", "Dibuat Oleh", "Aksi"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o, i) => {
                const total = Number(o.totalPrice);
                const dp = Number(o.dpAmount);
                const sisa = Math.max(0, total - dp);
                const isLunas = sisa <= 0;
                const pay = payStatusLabel(o);
                const isReadyForAudit = o.status === "READY_FOR_PICKUP";
                return (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-elevated/30 transition-colors cursor-pointer" onClick={() => openDetail(o)}>
                    <td className="px-4 py-3 font-mono text-xs text-accent-teal whitespace-nowrap">{o.id}</td>
                    <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{o.customerName}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">{o.orderType}</td>
                    <td className="px-4 py-3"><StatusPill status={o.status as any} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn("text-xs font-medium", pay.color)}>{pay.label}</span>
                    </td>
                    <td className="px-4 py-3 text-primary whitespace-nowrap font-mono text-xs">Rp {fmt(total)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn("text-xs font-mono", isLunas ? "text-status-green" : "text-status-yellow")}>
                        {isLunas ? "Lunas" : `Rp ${fmt(sisa)}`}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 whitespace-nowrap text-xs", deadlineClass(o.deadline, o.overdue))}>{o.deadline}</td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{o.createdBy}</td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button id={`btn-detail-${i}`} onClick={() => openDetail(o)} className="text-xs text-accent-teal hover:underline cursor-pointer">Detail</button>
                        {!isLunas && (
                          <>
                            <span className="text-border">·</span>
                            <button id={`btn-bayar-${i}`} onClick={() => openPayment(o)} className="text-xs text-status-yellow hover:underline cursor-pointer">Bayar</button>
                          </>
                        )}
                        {isReadyForAudit && (
                          <>
                            <span className="text-border">·</span>
                            <button onClick={() => openFinalAudit(o.id)} className="text-xs text-accent-teal hover:underline cursor-pointer font-semibold">Audit</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-muted text-sm">Tidak ada order yang ditemukan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
