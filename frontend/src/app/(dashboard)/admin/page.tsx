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
} from "lucide-react";

function deadlineClass(deadline: string, overdue: boolean) {
  if (overdue) return "text-status-red font-semibold";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = new Date(deadline);
  if (d.toDateString() === tomorrow.toDateString()) return "text-status-orange font-semibold";
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

export default function AdminDashboardPage() {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Store (single source of truth) ──────────────────────────────────────────
  const orders = useWorkflowStore((s) => s.orders);
  const jobs = useWorkflowStore((s) => s.jobs);
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore((s) => s.updateOrderStatus);
  const processPayment = useWorkflowStore((s) => s.processPayment);

  // ── Derived counts (realtime dari store) ────────────────────────────────────
  const today = new Date().toDateString();
  const newOrdersToday = orders.filter(o => new Date(o.createdAt).toDateString() === today).length;
  const waitingPayment = orders.filter(o => o.paymentStatus !== "PAID").length;
  const readyPickup = orders.filter(o => o.status === "READY_FOR_PICKUP").length;
  const overdue = orders.filter(o => o.overdue).length;

  const readyJobs = jobs.filter(j => j.status === "STORED");

  // KPI Cards - nilai dari store langsung
  const KPI_DATA = [
    { label: "Order Baru Hari Ini", value: newOrdersToday.toString(), icon: ShoppingCart, color: "text-accent-teal", bg: "bg-accent-teal/10", filter: "" as const },
    { label: "Menunggu Pembayaran", value: waitingPayment.toString(), icon: Clock, color: "text-status-yellow", bg: "bg-status-yellow/10", filter: "WAITING_PAYMENT" as const },
    { label: "Siap Diambil", value: readyPickup.toString(), icon: Package, color: "text-status-green", bg: "bg-status-green/10", filter: "READY_FOR_PICKUP" as const },
    { label: "Overdue", value: overdue.toString(), icon: AlertTriangle, color: "text-status-red", bg: "bg-status-red/10", filter: "OVERDUE" as const },
    { label: "Notif WA Gagal", value: "2", icon: MessageSquareX, color: "text-status-red", bg: "bg-status-red/10", filter: "" as const },
    { label: "Menunggu Diskon", value: "1", icon: BadgePercent, color: "text-status-yellow", bg: "bg-status-yellow/10", filter: "" as const },
  ];

  // ── Filter orders ────────────────────────────────────────────────────────────
  const filteredOrders = orders.filter(o => {
    const matchStatus = statusFilter === "" || o.status === statusFilter;
    const matchSearch = o.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      || o.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openDetail = (order: Order) => { setSelectedOrder(order); setShowDetail(true); };
  const openPayment = (order: Order) => { setSelectedOrder(order); setShowPayment(true); };

  const handlePaymentSuccess = (amount: number, method: string) => {
    if (selectedOrder) {
      processPayment(selectedOrder.id, amount, method);
    }
    setShowPayment(false);
  };

  return (
    <div className="space-y-6">
      {/* ── Modals ── */}
      <NewOrderModal open={showOrderModal} onClose={() => setShowOrderModal(false)} />
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

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Admin Sales</h1>
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

      {/* ── KPI Cards (nilai real dari store) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_DATA.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setStatusFilter(prev => prev === kpi.filter ? "" : (kpi.filter as OrderStatus | ""))}
            className={`bg-card/70 backdrop-blur-xl border rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all text-left ${
              statusFilter === kpi.filter && kpi.filter !== "" ? "border-accent-teal/60 ring-1 ring-accent-teal/30" : "border-border hover:border-accent-teal/30"
            }`}
          >
            <div className={`inline-flex p-2 rounded-xl ${kpi.bg} mb-3`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <p className={`text-4xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted mt-1 leading-tight">{kpi.label}</p>
          </button>
        ))}
      </div>

      {/* ── Priority Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Order Siap Diambil — dari store */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-status-green" />
              <h2 className="text-base font-semibold text-primary">Order Siap Diambil</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-green/20 text-status-green border border-status-green/30">
                {readyJobs.length}
              </span>
            </div>
            <button onClick={() => setStatusFilter("READY_FOR_PICKUP")} className="text-xs text-accent-teal hover:underline flex items-center gap-1">
              Lihat Semua <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {readyJobs.map((j) => {
              const o = orders.find(ord => ord.id === j.orderId);
              if (!o) return null;
              return (
                <div
                  key={j.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-elevated hover:bg-elevated/80 transition-colors cursor-pointer"
                  onClick={() => openDetail(o)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{o.customerName}</p>
                    <p className="text-xs text-muted truncate">{o.id} · {j.product}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-status-green">{fmtRp(Number(o.totalPrice))}</p>
                    <button
                      id={`btn-pickup-${j.id}`}
                      onClick={(e) => { e.stopPropagation(); updateJobStatus(j.id, "PICKED_UP"); updateOrderStatus(o.id, "PICKED_UP"); }}
                      className="text-xs text-accent-teal hover:underline cursor-pointer"
                    >
                      Proses Pickup
                    </button>
                  </div>
                </div>
              );
            })}
            {readyJobs.length === 0 && (
              <p className="text-xs text-muted p-4 text-center">Belum ada order siap diambil.</p>
            )}
          </div>
        </div>

        {/* WA Failed + Discount */}
        <div className="space-y-4">
          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquareX className="h-5 w-5 text-status-red" />
              <h2 className="text-base font-semibold text-primary">Notifikasi WA Gagal</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-red/20 text-status-red border border-status-red/30">2</span>
            </div>
            <div className="space-y-2">
              {["ORD-20260820-0018 · Siti Rahayu · 0812xxxx3456", "ORD-20260819-0044 · Ahmad Fauzi · 0857xxxx7890"].map((msg) => (
                <div key={msg} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated">
                  <p className="text-xs text-muted truncate">{msg}</p>
                  <button className="text-xs text-accent-teal hover:underline shrink-0 cursor-pointer">Kirim Ulang</button>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2 mb-3">
              <BadgePercent className="h-5 w-5 text-status-yellow" />
              <h2 className="text-base font-semibold text-primary">Antrian Persetujuan Diskon</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/20 text-status-yellow border border-status-yellow/30">1</span>
            </div>
            <div className="p-2.5 rounded-xl bg-elevated flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-primary font-medium">ORD-20260820-0021 · PT Abadi Makmur</p>
                <p className="text-xs text-muted">Diskon 10% · Rp 350.000 · Alasan: Pelanggan Setia</p>
              </div>
              <span className="text-xs text-status-yellow bg-status-yellow/10 border border-status-yellow/30 px-2 py-0.5 rounded-full shrink-0">Menunggu Owner</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabel Daftar Order (dari store) ── */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">Daftar Order</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">
              {filteredOrders.length}
            </span>
            {statusFilter && (
              <button onClick={() => setStatusFilter("")} className="text-xs text-status-red hover:underline ml-1">✕ Hapus Filter</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Cari nama / kode order..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 w-56 rounded-lg bg-elevated border border-border text-sm text-primary px-3 outline-none placeholder:text-muted focus:border-accent-teal transition-colors"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as OrderStatus | "")}
              className="h-9 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal appearance-none cursor-pointer transition-colors"
            >
              <option value="">Semua Status</option>
              <option value="WAITING_PAYMENT">MENUNGGU BAYAR</option>
              <option value="DESIGNING">DESAIN</option>
              <option value="PRODUCTION_STARTED">PRODUKSI</option>
              <option value="READY_FOR_PICKUP">SIAP DIAMBIL</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="PICKED_UP">SELESAI</option>
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
                return (
                  <tr
                    key={o.id}
                    className="border-b border-border/50 hover:bg-elevated/30 transition-colors cursor-pointer"
                    onClick={() => openDetail(o)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-accent-teal whitespace-nowrap">{o.id}</td>
                    <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{o.customerName}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{o.orderType}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.status as any} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-medium ${pay.color}`}>{pay.label}</span>
                    </td>
                    <td className="px-4 py-3 text-primary whitespace-nowrap font-mono">Rp {fmt(total)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={isLunas ? "text-status-green font-mono" : "text-status-orange font-mono"}>
                        {isLunas ? "Lunas" : `Rp ${fmt(sisa)}`}
                      </span>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-xs ${deadlineClass(o.deadline, o.overdue)}`}>{o.deadline}</td>
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{o.createdBy}</td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button id={`btn-detail-${i}`} onClick={() => openDetail(o)} className="text-xs text-accent-teal hover:underline cursor-pointer">Detail</button>
                        {!isLunas && (
                          <>
                            <span className="text-border">·</span>
                            <button id={`btn-bayar-${i}`} onClick={() => openPayment(o)} className="text-xs text-status-yellow hover:underline cursor-pointer">Bayar</button>
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
