"use client";

import { X, Clock, CreditCard, Package, User, Phone, Hash, Calendar, FileText, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui";

interface Order {
  id: string;
  customerName: string;
  totalPrice: string;
  dpAmount: string;
  deadline: string;
  status?: string;
  [key: string]: unknown;
}

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  onBayar?: () => void;
}

const TIMELINE = [
  { status: "Order Dibuat", time: "20 Agt 2026, 09:15", by: "Admin Rere", done: true },
  { status: "Menunggu Pembayaran DP", time: "20 Agt 2026, 09:15", by: "Sistem", done: true },
  { status: "DP Terbayar", time: "20 Agt 2026, 10:30", by: "Admin Rere", done: true },
  { status: "Antri Desain", time: "20 Agt 2026, 10:31", by: "Sistem", done: true },
  { status: "Proses Produksi", time: "20 Agt 2026, 14:00", by: "Operator Budi", done: false },
  { status: "QC & Finishing", time: "-", by: "-", done: false },
  { status: "Siap Diambil", time: "-", by: "-", done: false },
];

export function OrderDetailModal({ open, onClose, order, onBayar }: OrderDetailModalProps) {
  if (!open || !order) return null;

  const totalNum = parseFloat(String(order.totalPrice).replace(/\./g, "")) || 0;
  const dpNum = parseFloat(String(order.dpAmount).replace(/\./g, "")) || 0;
  const sisa = totalNum - dpNum;
  const isLunas = sisa <= 0;

  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-primary">{order.id}</h2>
            <p className="text-xs text-muted mt-0.5">Detail Order Pelanggan</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status="WAITING_PAYMENT" />
            <button onClick={onClose} className="p-2 hover:bg-elevated rounded-full text-muted transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Pelanggan */}
          <div className="bg-elevated rounded-xl p-4 grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted">Pelanggan</p>
                <p className="text-sm font-semibold text-primary">{order.customerName}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted">No. Telepon</p>
                <p className="text-sm font-semibold text-primary">0812xxxx1234</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Hash className="h-4 w-4 text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted">Tipe Order</p>
                <p className="text-sm font-semibold text-primary">Walk-in / Printing</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted">Deadline</p>
                <p className={`text-sm font-semibold ${new Date(order.deadline) < new Date() ? "text-status-red" : "text-primary"}`}>
                  {order.deadline}
                </p>
              </div>
            </div>
          </div>

          {/* Produk */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted" /> Produk / Pesanan
            </h3>
            <div className="bg-elevated rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="text-left px-4 py-2">Produk</th>
                    <th className="text-right px-4 py-2">Qty</th>
                    <th className="text-right px-4 py-2">Harga</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="px-4 py-3 text-primary">
                      <p className="font-medium">Spanduk MMT</p>
                      <p className="text-xs text-muted">4m x 1m · Bahan Flexi Korea</p>
                    </td>
                    <td className="px-4 py-3 text-right text-muted">2</td>
                    <td className="px-4 py-3 text-right text-primary font-mono">{fmt(totalNum)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pembayaran */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted" /> Ringkasan Pembayaran
            </h3>
            <div className="bg-elevated rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Total Harga</span>
                <span className="font-mono text-primary">{fmt(totalNum)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">DP Dibayar</span>
                <span className="font-mono text-status-green">{fmt(dpNum)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="font-semibold text-primary">Sisa Tagihan</span>
                <span className={`font-mono font-bold text-lg ${isLunas ? "text-status-green" : "text-status-yellow"}`}>
                  {isLunas ? "LUNAS" : fmt(sisa)}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted" /> Riwayat Status
            </h3>
            <div className="relative pl-5">
              {TIMELINE.map((item, i) => (
                <div key={i} className="relative mb-3">
                  {i < TIMELINE.length - 1 && (
                    <div className={`absolute left-[-13px] top-5 w-0.5 h-full ${item.done ? "bg-status-green/50" : "bg-border"}`} />
                  )}
                  <div className={`absolute left-[-17px] top-1.5 h-3 w-3 rounded-full border-2 ${item.done ? "bg-status-green border-status-green" : "bg-background border-border"}`} />
                  <div className="bg-elevated rounded-lg p-3">
                    <div className="flex justify-between">
                      <p className={`text-sm font-medium ${item.done ? "text-primary" : "text-muted"}`}>{item.status}</p>
                      <p className="text-xs text-muted">{item.time}</p>
                    </div>
                    <p className="text-xs text-muted mt-0.5">oleh: {item.by}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Catatan */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted" /> Catatan Order
            </h3>
            <div className="bg-elevated rounded-xl p-4 text-sm text-muted italic">
              "Warna dominan merah, logo sudah di-ACC via WhatsApp."
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border shrink-0 flex justify-between items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-elevated transition-colors text-muted">
            Tutup
          </button>
          {!isLunas && onBayar && (
            <button
              onClick={() => { onBayar(); onClose(); }}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-status-green text-white hover:brightness-110 shadow-md shadow-status-green/20 transition-all"
            >
              <CreditCard className="h-4 w-4" />
              Proses Pembayaran <span className="opacity-80">({fmt(sisa)})</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {isLunas && (
            <span className="px-4 py-2 rounded-lg text-sm font-bold bg-status-green/10 text-status-green border border-status-green/30">
              ✓ Pembayaran Lunas
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
