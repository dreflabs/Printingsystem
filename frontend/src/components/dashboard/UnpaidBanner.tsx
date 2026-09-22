"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getPaymentBannerStatus } from "@/actions/billing";

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/**
 * Banner untuk tenant yang belum menyelesaikan pembayaran (status UNPAID).
 * Tanpa free trial: akses aplikasi penuh baru terbuka setelah invoice pertama
 * dibayar dan diverifikasi, jadi banner ini tidak bisa ditutup.
 */
export function UnpaidBanner() {
  const [status, setStatus] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [overdue, setOverdue] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const r = await getPaymentBannerStatus();
    if (r.success) {
      setStatus(r.data.status);
      setInvoiceNumber(r.data.invoiceNumber);
      setAmount(r.data.amount);
      setDueDate(r.data.dueDate);
      setOverdue(r.data.dueDate ? new Date(r.data.dueDate).getTime() < Date.now() : false);
    }
    setReady(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (!ready || status !== "UNPAID") return null;

  return (
    <div
      className={
        "rounded-2xl border px-4 py-3 flex items-start gap-3 " +
        (overdue
          ? "border-status-red/30 bg-status-red/10 text-status-red"
          : "border-status-yellow/30 bg-status-yellow/10 text-status-yellow-text")
      }
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">
          {overdue ? "Pembayaran melewati jatuh tempo" : "Selesaikan pembayaran untuk membuka akses penuh"}
        </p>
        <p className="text-xs mt-0.5 opacity-90">
          {invoiceNumber
            ? `Invoice ${invoiceNumber}${amount != null ? ` sebesar ${rupiah(amount)}` : ""}${
                dueDate ? ` · jatuh tempo ${new Date(dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}` : ""
              }.`
            : "Invoice pertama Anda sedang disiapkan."}
        </p>
      </div>
      <Link
        href="/owner/billing"
        className={
          "shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap " +
          (overdue ? "bg-status-red text-white hover:brightness-110" : "bg-status-yellow text-white hover:brightness-110")
        }
      >
        Bayar Sekarang
      </Link>
    </div>
  );
}
