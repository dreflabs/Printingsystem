"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Loader2 } from "lucide-react";
import { getJobLabel } from "@/actions/queries";

type Label = Extract<Awaited<ReturnType<typeof getJobLabel>>, { success: true }>["data"];

export default function PrintLabelPage() {
  const params = useParams();
  const search = useSearchParams();
  const autoPrint = search.get("noprint") === null;
  const id = decodeURIComponent((params.id as string) ?? "");
  const [label, setLabel] = useState<Label | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getJobLabel(id).then((res) => {
      if (!alive) return;
      if (res.success) {
        setLabel(res.data);
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

  if (!label) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elevated">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  const fmt = (d: string | Date | null) =>
    d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="w-full flex justify-center bg-elevated min-h-screen pt-10 print:bg-white print:pt-0">
      <button
        onClick={() => window.print()}
        className="fixed top-4 right-4 print:hidden flex items-center gap-2 bg-accent-teal text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:brightness-110"
      >
        <Printer className="h-5 w-5" /> Cetak Sekarang
      </button>

      {/* Stiker thermal 100mm x 150mm */}
      <div className="w-[100mm] h-[150mm] bg-white text-black p-4 border border-gray-300 print:border-none shadow-xl print:shadow-none relative">
        <div className="text-center border-b-2 border-black pb-2 mb-3">
          <h1 className="text-xl font-extrabold uppercase leading-tight">{label.company.name}</h1>
          {label.company.phone && <p className="text-[10px] font-medium">{label.company.phone}</p>}
        </div>

        <div className="flex justify-center mb-2">
          <QRCodeSVG value={label.jobCode} size={150} level="M" marginSize={2} />
        </div>

        <div className="text-center font-mono font-bold text-lg mb-1 tracking-wider">{label.jobCode}</div>
        <div className="text-center font-mono text-xs text-gray-600 mb-3">Order: {label.orderCode}</div>

        <div className="space-y-1.5 text-sm border-t-2 border-dashed border-black pt-3">
          <div className="flex justify-between gap-2">
            <span className="font-semibold shrink-0">Pelanggan:</span>
            <span className="text-right">{label.customerName}</span>
          </div>
          {label.items.slice(0, 3).map((it, i) => (
            <div key={i} className="border-t border-gray-200 pt-1.5">
              <div className="flex justify-between gap-2">
                <span className="font-semibold shrink-0">Produk:</span>
                <span className="text-right font-bold">{it.description}</span>
              </div>
              {it.size && (
                <div className="flex justify-between gap-2">
                  <span className="font-semibold shrink-0">Ukuran:</span>
                  <span className="text-right">{it.size}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="font-semibold shrink-0">Qty:</span>
                <span className="text-right font-bold">{it.quantity} pcs</span>
              </div>
              {it.finishing && (
                <div className="flex justify-between gap-2">
                  <span className="font-semibold shrink-0">Finishing:</span>
                  <span className="text-right">{it.finishing}</span>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between gap-2 border-t-2 border-black pt-1.5 mt-1">
            <span className="font-bold shrink-0">TOTAL QTY:</span>
            <span className="text-right font-bold text-lg">{label.quantity} pcs</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="font-semibold shrink-0">Deadline:</span>
            <span className="text-right">{fmt(label.deadline)}</span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-center border-t border-black pt-2">
          <p className="text-[10px] font-bold">Harap periksa barang sebelum diterima.</p>
          <p className="text-[8px]">Dicetak: {new Date(label.printedAt).toLocaleString("id-ID")}</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 0; size: 100mm 150mm; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
