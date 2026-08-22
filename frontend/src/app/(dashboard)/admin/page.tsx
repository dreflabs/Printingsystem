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
  if (overdue) return "text-status-red font-semibold";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = new Date(deadline);
  if (d.toDateString() === tomorrow.toDateString()) return "text-status-yellow font-semibold";
  return "text-muted";
}

function payStatusLabel(o: Order) {
  const total = Number(o.totalPrice);
  const dp = Number(o.dpAmount);
  if (dp >= total) return { label: "Lunas", color: "text-status-green" };
  if (dp > 0) return { label: "DP Terpenuhi", color: "text-status-yellow" };
  return { label: "Belum DP", color: "text-muted" };
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
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-[0_8px_56px_rgba(0,0,0,0.6)] flex flex-col max-h-[90vh]">
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
                        auditResult[item.id] === "PASS" ? "bg-status-green text-white border-status-green" : "bg-elevated/50 text-muted border-border hover:text-primary"
                      )}>✅ PASS</button>
                    <button onClick={() => setItem(item.id, "FAIL")}
                      className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                        auditResult[item.id] === "FAIL" ? "bg-status-red text-white border-status-red" : "bg-elevated/50 text-muted border-border hover:text-primary"
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
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-accent-teal to-blue-600 text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
              >
                Submit Audit
              </button>
            </div>
          </>
        ) : (
          <div className="p-8 text-center space-y-4">
            <div className={cn("h-16 w-16 rounded-full flex items-center justify-center mx-auto text-2xl",
              finalResult === "GREEN" ? "bg-status-green/20" : "bg-status-yellow/20"
            )}>
              {finalResult === "GREEN" ? "🟢" : "🟡"}
            </div>
            <p className="text-lg font-bold text-primary">Audit Selesai</p>
            <p className="text-sm text-muted">
              {finalResult === "GREEN"
                ? "Semua aspek PASS. Order dapat di-CLOSE."
                : "Ada item FAIL. Menunggu approval Owner."}
            </p>
            <button onClick={onClose} className="w-full h-11 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 cursor-pointer">
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
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-primary flex items-center gap-2">
              <MessageCircleCheck className="h-5 w-5 text-status-green" /> Konfirmasi Approval Desain Online
            </h3>
            <p className="text-xs text-muted mt-0.5">ORD-20260820-0023 · Budi Santoso · Online</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="bg-elevated/60 border border-border rounded-xl p-4 space-y-2 text-xs">
          <p className="font-semibold text-primary">Preview Desain V2 telah dikirim ke konsumen via WhatsApp</p>
          <p className="text-muted">Dikirim: Sabtu, 22 Agt 2026 · 14:30 WIB</p>
          <p className="text-muted">Konfirmasi persetujuan dilakukan secara manual oleh Admin berdasarkan percakapan WA.</p>
        </div>
        {!confirmed ? (
          <div className="space-y-3">
            <p className="text-xs text-muted font-medium">Apakah konsumen sudah menyetujui desain ini via WhatsApp?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmed("no")}
                className="flex-1 h-11 rounded-xl bg-status-red/10 text-status-red text-sm font-bold hover:bg-status-red/20 cursor-pointer flex items-center justify-center gap-1.5">
                <XCircle className="h-4 w-4" /> Belum / Revisi
              </button>
              <button onClick={() => setConfirmed("yes")}
                className="flex-1 h-11 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 cursor-pointer flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Sudah ACC
              </button>
            </div>
          </div>
        ) : confirmed === "yes" ? (
          <div className="p-4 bg-status-green/10 border border-status-green/30 rounded-xl text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-status-green mx-auto" />
            <p className="text-sm font-bold text-status-green">Desain disetujui! Order lanjut ke produksi.</p>
            <button onClick={onClose} className="w-full h-10 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 cursor-pointer">
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
    { label: "Order Baru Hari Ini", value: newOrdersToday.toString(), icon: ShoppingCart, color: "text-accent-teal", bg: "bg-accent-teal/10", filter: "" as const },
    { label: "Menunggu Pembayaran", value: waitingPayment.toString(), icon: Clock, color: "text-status-yellow", bg: "bg-status-yellow/10", filter: "WAITING_PAYMENT" as const },
    { label: "Siap Diambil", value: readyPickup.toString(), icon: Package, color: "text-status-green", bg: "bg-status-green/10", filter: "READY_FOR_PICKUP" as const },
    { label: "Overdue", value: overdue.toString(), icon: AlertTriangle, color: "text-status-red", bg: "bg-status-red/10", filter: "OVERDUE" as const },
    { label: "Notif WA Gagal", value: "2", icon: MessageSquareX, color: "text-status-red", bg: "bg-status-red/10", filter: "" as const },
    { label: "Menunggu Diskon", value: "1", icon: BadgePercent, color: "text-status-yellow", bg: "bg-status-yellow/10", filter: "" as const },
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
    return matchStatus && matchType && matchPay && matchSearch;
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
          <a href="/scan" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary hover:border-accent-teal/50 transition-all">
            <ScanLine className="h-4 w-4" /> Scan QR
          </a>
          <a href="/pos" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary hover:border-accent-teal/50 transition-all">
            <ShoppingCart className="h-4 w-4" /> Kasir POS
          </a>
          <button
            id="btn-order-baru"
            onClick={() => setShowOrderModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-sm font-semibold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all"
          >
            <Plus className="h-4 w-4" /> Order Baru
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_DATA.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setStatusFilter((prev) => prev === kpi.filter ? "" : (kpi.filter as OrderStatus | ""))}
            className={cn(
              "bg-card/70 backdrop-blur-xl border rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all text-left",
              statusFilter === kpi.filter && kpi.filter !== "" ? "border-accent-teal/60 ring-1 ring-accent-teal/30" : "border-border hover:border-accent-teal/30"
            )}
          >
            <div className={cn("inline-flex p-2 rounded-xl mb-3", kpi.bg)}>
              <kpi.icon className={cn("h-5 w-5", kpi.color)} />
            </div>
            <p className={cn("text-4xl font-bold", kpi.color)}>{kpi.value}</p>
            <p className="text-xs text-muted mt-1 leading-tight">{kpi.label}</p>
          </button>
        ))}
      </div>

      {/* Priority Panels — 3 kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order Siap Diambil */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-status-green" />
              <h2 className="text-base font-semibold text-primary">Siap Diambil</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-green/20 text-status-green border border-status-green/30">{readyJobs.length}</span>
            </div>
            <button onClick={() => setStatusFilter("READY_FOR_PICKUP")} className="text-xs text-accent-teal hover:underline flex items-center gap-1 cursor-pointer">
              Lihat Semua <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {readyJobs.map((j) => {
              const o = orders.find((ord) => ord.id === j.orderId);
              if (!o) return null;
              return (
                <div key={j.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-elevated hover:bg-elevated/80 transition-colors cursor-pointer" onClick={() => openDetail(o)}>
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
            {readyJobs.length === 0 && <p className="text-xs text-muted p-3 text-center">Belum ada order siap diambil.</p>}
          </div>
        </div>

        {/* Notifikasi WA Gagal */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquareX className="h-5 w-5 text-status-red" />
            <h2 className="text-base font-semibold text-primary">Notifikasi WA Gagal</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-red/20 text-status-red border border-status-red/30">2</span>
          </div>
          <div className="space-y-2">
            {["ORD-20260820-0018 · Siti Rahayu · READY_FOR_PICKUP", "ORD-20260819-0044 · Ahmad Fauzi · Desain ACC"].map((msg) => (
              <div key={msg} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated">
                <p className="text-xs text-muted truncate">{msg}</p>
                <button className="text-xs text-accent-teal hover:underline shrink-0 cursor-pointer">Kirim Ulang</button>
              </div>
            ))}
          </div>

          {/* Antrian Diskon */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <BadgePercent className="h-4 w-4 text-status-yellow" />
              <h3 className="text-sm font-semibold text-primary">Antrian Persetujuan Diskon</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/20 text-status-yellow border border-status-yellow/30">1</span>
            </div>
            <div className="p-2.5 rounded-xl bg-elevated flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-primary font-medium">ORD-20260820-0021 · PT Abadi Makmur</p>
                <p className="text-xs text-muted">Diskon 10% · Rp 350.000 · Pelanggan Setia</p>
              </div>
              <span className="text-xs text-status-yellow bg-status-yellow/10 border border-status-yellow/30 px-2 py-0.5 rounded-full shrink-0 font-bold">Menunggu Owner</span>
            </div>
          </div>
        </div>

        {/* Panel Approval Desain WA — BARU */}
        <div className="bg-card/70 backdrop-blur-xl border border-status-green/20 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircleCheck className="h-5 w-5 text-status-green" />
            <h2 className="text-base font-semibold text-primary">Approval Desain via WA</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-green/20 text-status-green border border-status-green/30">1</span>
          </div>
          {!waAccepted ? (
            <div className="p-3 bg-elevated/60 border border-border rounded-xl space-y-3">
              <div>
                <p className="text-xs font-bold text-primary">ORD-20260820-0023 · Budi Santoso</p>
                <p className="text-[10px] text-muted">Brosur A5 · 1000pcs · Tipe: Online</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-status-yellow animate-pulse" />
                Preview V2 terkirim 14:30 · Menunggu konfirmasi ACC dari Admin
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowWAApproval(true)}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-status-green to-emerald-600 text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Konfirmasi ACC WA
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-status-green/10 border border-status-green/30 rounded-xl text-center">
              <p className="text-xs font-bold text-status-green">✅ Desain ACC! Order lanjut ke produksi.</p>
            </div>
          )}

          {/* Final Audit shortcut */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="h-4 w-4 text-accent-teal" />
              <h3 className="text-sm font-semibold text-primary">Final Audit</h3>
            </div>
            <p className="text-[10px] text-muted mb-3">Submit hasil audit sebelum order di-CLOSE (GREEN/YELLOW/RED)</p>
            {orders.filter((o) => o.status === "READY_FOR_PICKUP").slice(0, 2).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated mb-2">
                <div>
                  <p className="text-xs font-medium text-primary truncate">{o.id}</p>
                  <p className="text-[10px] text-muted">{o.customerName}</p>
                </div>
                <button
                  id={`btn-audit-${o.id}`}
                  onClick={() => openFinalAudit(o.id)}
                  className="text-xs text-accent-teal hover:underline shrink-0 cursor-pointer font-semibold whitespace-nowrap"
                >
                  Audit →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Supervisor Panel: Reassignment */}
      <div className="bg-card/70 backdrop-blur-xl border border-status-yellow/30 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-status-yellow" />
          <h2 className="text-base font-semibold text-primary">Panel Reassignment (Supervisor)</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/20 text-status-yellow border border-status-yellow/30">1</span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-elevated/60 border border-status-red/20">
          <div>
            <p className="text-xs font-bold text-primary">JOB-0042 · Brosur A5</p>
            <p className="text-[10px] text-status-red mt-0.5">Operator (Budi) tidak hadir. Mesin Roland A menganggur.</p>
          </div>
          <button className="h-8 px-4 rounded-lg bg-status-yellow text-white text-xs font-bold hover:brightness-110 cursor-pointer">
            Reassign
          </button>
        </div>
      </div>

      {/* Tabel Daftar Order */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
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
