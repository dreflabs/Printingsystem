"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Printer, Loader2 } from "lucide-react";
import { getOrderReceipt } from "@/actions/queries";

type Nota = Extract<Awaited<ReturnType<typeof getOrderReceipt>>, { success: true }>["data"];

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDay = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const METHOD_LABEL: Record<string, string> = { CASH: "Tunai", TRANSFER: "Transfer", QRIS: "QRIS" };

export default function PrintNotaPage() {
  const params = useParams();
  const search = useSearchParams();
  const autoPrint = search.get("noprint") === null;
  const id = decodeURIComponent((params.id as string) ?? "");
  const [nota, setNota] = useState<Nota | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getOrderReceipt(id).then((res) => {
      if (!alive) return;
      if (res.success) {
        setNota(res.data);
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
  if (!nota) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elevated">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  const isPrinting = nota.order.type === "PRINTING";
  const showDiscount = nota.discount > 0;

  return (
    <div className="w-full flex justify-center bg-elevated min-h-screen py-10 print:bg-white print:py-0">
      <button
        onClick={() => window.print()}
        className="fixed top-4 right-4 print:hidden flex items-center gap-2 bg-accent-teal text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:brightness-110"
      >
        <Printer className="h-5 w-5" /> Cetak Sekarang
      </button>

      <div className="bg-white text-black font-mono text-[11px] leading-tight p-3 shadow print:shadow-none" style={{ width: "80mm" }}>
        {/* Kepala toko */}
        <div className="text-center">
          <div className="text-[13px] font-bold uppercase tracking-wide">{nota.shop.name}</div>
          {nota.shop.address && <div className="whitespace-pre-line">{nota.shop.address}</div>}
          {nota.shop.phone && <div>Telp {nota.shop.phone}</div>}
        </div>

        <Sep />

        <div className="flex justify-between">
          <span>{isPrinting ? "NOTA PESANAN" : "NOTA PENJUALAN"}</span>
          <span>{nota.order.type}</span>
        </div>
        <Row k="No." v={nota.order.code} />
        <Row k="Tanggal" v={fmtDate(nota.order.createdAt)} />
        {nota.customer && <Row k="Pelanggan" v={nota.customer.name + (nota.customer.phone ? ` (${nota.customer.phone})` : "")} />}
        <Row k="Kasir" v={nota.cashier} />
        {isPrinting && nota.order.deadline && <Row k="Ambil" v={fmtDay(nota.order.deadline)} />}

        <Sep />

        {/* Item */}
        {nota.items.map((it, i) => (
          <div key={i} className="mb-1">
            <div>{it.description}{it.size ? ` — ${it.size}` : ""}{it.finishing ? ` / ${it.finishing}` : ""}</div>
            <div className="flex justify-between">
              <span>{it.qty} x {rp(it.unitPrice)}</span>
              <span>{rp(it.totalPrice)}</span>
            </div>
          </div>
        ))}

        <Sep />

        <Row k="Subtotal" v={rp(nota.subtotal)} />
        {showDiscount && (
          <Row k={`Diskon${nota.discountApproved ? "" : " (menunggu ACC)"}`} v={`- ${rp(nota.discount)}`} />
        )}
        <div className="flex justify-between font-bold text-[12px] mt-0.5">
          <span>TOTAL</span><span>{rp(nota.total)}</span>
        </div>

        <div className="mt-1">
          <Row k="Dibayar" v={rp(nota.paid)} />
          <div className="flex justify-between font-bold">
            <span>{nota.balance > 0 ? "SISA" : "KEMBALI/LUNAS"}</span>
            <span>{rp(Math.abs(nota.balance))}</span>
          </div>
        </div>

        {nota.payments.length > 0 && (
          <>
            <Sep />
            <div className="text-[10px]">Riwayat bayar:</div>
            {nota.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span>{fmtDay(p.paidAt)} · {METHOD_LABEL[p.method] ?? p.method}</span>
                <span>{rp(p.amount)}</span>
              </div>
            ))}
          </>
        )}

        <Sep />

        <div className="text-center">
          <div className={nota.balance > 0 ? "font-bold" : ""}>
            {nota.balance > 0
              ? (isPrinting ? "Belum lunas — pelunasan saat pengambilan" : "Belum lunas")
              : "LUNAS"}
          </div>
          {isPrinting && (
            <div className="text-[10px] mt-0.5">Simpan nota ini sebagai bukti pengambilan.</div>
          )}
          <div className="mt-1">Terima kasih 🙏</div>
          <div className="text-[9px] text-neutral-500 mt-1">
            Dicetak {fmtDate(nota.printedAt)} · harga termasuk PPN
          </div>
        </div>
      </div>
    </div>
  );
}

function Sep() {
  return <div className="border-t border-dashed border-black my-1.5" />;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-neutral-600 shrink-0">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
