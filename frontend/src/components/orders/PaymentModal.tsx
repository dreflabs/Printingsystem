"use client";

import { X, CreditCard, Banknote, QrCode } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  sisaTagihan: number;
  onSuccess: (amount: number, method: string) => void;
}

const PAYMENT_METHODS = [
  { id: "cash", label: "Tunai (Cash)", icon: Banknote, color: "text-status-green", bg: "bg-status-green/10", border: "border-status-green/50" },
  { id: "transfer", label: "Transfer Bank", icon: CreditCard, color: "text-status-blue", bg: "bg-status-blue/10", border: "border-status-blue/50" },
  { id: "qris", label: "QRIS", icon: QrCode, color: "text-accent-teal", bg: "bg-accent-teal/10", border: "border-accent-teal/50" },
];

export function PaymentModal({ open, onClose, orderId, sisaTagihan, onSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(sisaTagihan);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
  const kembalian = amount - sisaTagihan;

  const handleConfirm = () => {
    setSuccess(true);
    setTimeout(() => {
      onSuccess(amount, method);
      setSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-primary">Proses Pembayaran</h2>
            <p className="text-xs text-muted mt-0.5">{orderId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-elevated rounded-full text-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!success ? (
          <div className="p-5 space-y-5">
            {/* Tagihan */}
            <div className="bg-status-yellow/5 border border-status-yellow/20 rounded-xl p-4 text-center">
              <p className="text-xs text-muted mb-1">Total Tagihan</p>
              <p className="text-3xl font-bold font-mono text-status-yellow">{fmt(sisaTagihan)}</p>
            </div>

            {/* Metode Pembayaran */}
            <div>
              <p className="text-sm font-semibold text-primary mb-3">Metode Pembayaran</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer",
                      method === m.id 
                        ? `${m.border} ${m.bg}` 
                        : "border-border hover:border-accent-teal/30 bg-elevated"
                    )}
                  >
                    <m.icon className={cn("h-6 w-6", method === m.id ? m.color : "text-muted")} />
                    <span className={`text-xs font-medium ${method === m.id ? m.color : "text-muted"}`}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Jumlah Bayar */}
            <div>
              <p className="text-sm font-semibold text-primary mb-2">
                {method === "cash" ? "Uang Diterima" : "Jumlah Transfer"}
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">Rp</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-lg font-mono font-bold text-primary outline-none focus:border-status-yellow"
                />
              </div>
              {method === "cash" && kembalian > 0 && (
                <p className="text-sm text-status-green mt-2 font-medium">
                  Kembalian: {fmt(kembalian)}
                </p>
              )}
              {method === "cash" && kembalian < 0 && (
                <p className="text-sm text-status-red mt-2 font-medium">
                  Kurang: {fmt(Math.abs(kembalian))}
                </p>
              )}
            </div>

            {/* Quick Amount */}
            {method === "cash" && (
              <div className="flex gap-2 flex-wrap">
                {[sisaTagihan, 100000, 200000, 500000].filter((v, i, a) => a.indexOf(v) === i).map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className="px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-medium hover:border-status-yellow/50 transition-colors"
                  >
                    {fmt(v)}
                  </button>
                ))}
              </div>
            )}

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              disabled={amount < sisaTagihan && method === "cash"}
              className="w-full h-12 rounded-xl bg-status-green text-white font-bold text-base hover:brightness-110 transition-all shadow-lg shadow-status-green/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Konfirmasi Pembayaran
            </button>
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full bg-status-green/20 flex items-center justify-center mb-4 animate-pulse">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-lg font-bold text-status-green">Pembayaran Berhasil!</p>
            <p className="text-sm text-muted mt-1">{orderId} — {fmt(amount)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
