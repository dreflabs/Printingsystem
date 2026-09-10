"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Printer, Loader2 } from "lucide-react";
import { getPaymentReceipt } from "@/actions/queries";
import { terbilangRupiah } from "@/lib/terbilang";

type Kwitansi = Extract<Awaited<ReturnType<typeof getPaymentReceipt>>, { success: true }>["data"];

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const METHOD_LABEL: Record<string, string> = { CASH: "Tunai", TRANSFER: "Transfer", QRIS: "QRIS" };
const KIND_LABEL: Record<string, string> = {
  DP: "Uang Muka (DP)",
  CICILAN: "Cicilan Pembayaran",
  PELUNASAN: "Pelunasan",
  REFUND: "Pengembalian Dana",
};

export default function PrintKwitansiPage() {
  const params = useParams();
  const search = useSearchParams();
  const autoPrint = search.get("noprint") === null;
  const id = decodeURIComponent((params.id as string) ?? "");
  const [k, setK] = useState<Kwitansi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPaymentReceipt(id).then((res) => {
      if (!alive) return;
      if (res.success) {
        setK(res.data);
        if (autoPrint) setTimeout(() => window.print(), 600);
      } else setError(res.error);
    });
    return () => { alive = false; };
  }, [id, autoPrint]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elevated p-6">
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-6 py-4 text-sm text-status-red">
          {error} <span className="font-mono">({id})</span>
        </div>
      </div>
    );
  }
  if (!k) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elevated">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  const title = k.isRefund ? "KWITANSI PENGEMBALIAN DANA" : "KWITANSI PEMBAYARAN";
  const forText =
    `${KIND_LABEL[k.kind] ?? "Pembayaran"} pesanan ${k.orderCode}` +
    ` (${METHOD_LABEL[k.method] ?? k.method}` +
    (k.reference ? ` · ref ${k.reference}` : "") + ")";

  return (
    <div className="w-full flex justify-center bg-elevated min-h-screen py-10 print:bg-white print:py-0">
      <button
        onClick={() => window.print()}
        className="fixed top-4 right-4 print:hidden flex items-center gap-2 bg-accent-teal text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:brightness-110"
      >
        <Printer className="h-5 w-5" /> Cetak Sekarang
      </button>

      {/* A5 landscape-ish kwitansi */}
      <div className="bg-white text-black p-8 shadow print:shadow-none" style={{ width: "180mm" }}>
        <div className="flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <div className="text-xl font-extrabold uppercase tracking-wide">{k.shop.name}</div>
            {k.shop.address && <div className="text-xs whitespace-pre-line max-w-[90mm]">{k.shop.address}</div>}
            {k.shop.phone && <div className="text-xs">Telp {k.shop.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold tracking-widest">{title}</div>
            <div className="text-xs font-mono text-neutral-600 mt-1">No. {k.paymentId.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>

        <table className="w-full text-sm mt-5">
          <tbody>
            <tr>
              <td className="py-1.5 w-[42mm] align-top text-neutral-600">Sudah terima dari</td>
              <td className="py-1.5 font-semibold">: {k.customerName}{k.customerPhone ? ` (${k.customerPhone})` : ""}</td>
            </tr>
            <tr>
              <td className="py-1.5 align-top text-neutral-600">Uang sejumlah</td>
              <td className="py-1.5">
                <span className="inline-block bg-neutral-100 border border-neutral-300 rounded px-3 py-1 font-bold italic">
                  {terbilangRupiah(k.amount)}
                </span>
              </td>
            </tr>
            <tr>
              <td className="py-1.5 align-top text-neutral-600">Untuk pembayaran</td>
              <td className="py-1.5">: {forText}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex items-end justify-between mt-6">
          <div className="border-2 border-black px-5 py-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-600">Jumlah</div>
            <div className="text-2xl font-extrabold">{k.isRefund ? "-" : ""}{rp(k.amount)}</div>
          </div>
          <div className="text-xs text-right leading-relaxed">
            {!k.isRefund && (
              <>
                <div>Total tagihan: <span className="font-semibold">{rp(k.total)}</span></div>
                {k.kind === "DP" && <div>DP wajib: <span className="font-semibold">{rp(k.dpRequired)}</span></div>}
                <div>Dibayar s/d kwitansi ini: <span className="font-semibold">{rp(k.paidThrough)}</span></div>
                <div className="text-sm font-bold mt-0.5">
                  Sisa tagihan: {rp(k.balanceAfter)}
                  {k.balanceAfter <= 0 ? " (LUNAS)" : ""}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-10">
          <div className="text-center text-sm">
            <div>{fmtDate(k.paidAt)}</div>
            <div className="h-16" />
            <div className="border-t border-black pt-1 px-6 font-semibold">{k.cashier}</div>
            <div className="text-[10px] text-neutral-500">Penerima</div>
          </div>
        </div>

        <div className="text-[9px] text-neutral-400 mt-8 border-t border-neutral-200 pt-2">
          Dicetak {new Date(k.printedAt).toLocaleString("id-ID")} · dokumen sah tanpa tanda tangan basah bila dicetak dari sistem.
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 8mm; size: A5 landscape; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
