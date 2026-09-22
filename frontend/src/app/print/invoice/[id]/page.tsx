"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { getTenantInvoiceDetail, type TenantInvoiceDetail } from "@/actions/billing";

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "—";

export default function PrintInvoicePage() {
  const params = useParams();
  const search = useSearchParams();
  const autoPrint = search.get("noprint") === null;
  const id = decodeURIComponent((params.id as string) ?? "");
  const [data, setData] = useState<TenantInvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getTenantInvoiceDetail(id).then((res) => {
      if (!alive) return;
      if (res.success) {
        setData(res.data);
        if (autoPrint) setTimeout(() => window.print(), 600);
      } else {
        setError(res.error);
      }
    });
    return () => { alive = false; };
  }, [id, autoPrint]);

  if (error) {
    return <div className="p-10 text-sm text-red-600">{error}</div>;
  }
  if (!data) {
    return (
      <div className="p-10 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat invoice…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-10 text-black">
      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <p className="text-2xl font-extrabold">Print Pilot</p>
          <p className="text-xs text-gray-600">Invoice Langganan</p>
        </div>
        <div className="text-right text-xs">
          <p className="text-lg font-bold font-mono">{data.number}</p>
          <p className="text-gray-600">Status: {data.status}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 text-xs">
        <div>
          <p className="text-gray-500">Ditagihkan kepada</p>
          <p className="font-bold">{data.tenantName}</p>
        </div>
        <div>
          <p className="text-gray-500">Jatuh tempo</p>
          <p className="font-bold">{fmt(data.dueDate)}</p>
        </div>
        <div>
          <p className="text-gray-500">Periode</p>
          <p className="font-bold">
            {fmt(data.periodStart)} – {fmt(data.periodEnd)}
          </p>
        </div>
      </div>

      <table className="w-full mt-8 text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            <th className="py-2">Deskripsi</th>
            <th className="py-2 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-right">{rp(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="py-3 font-bold text-sm">Total</td>
            <td className="py-3 text-right font-extrabold text-base">{rp(data.amount)}</td>
          </tr>
        </tfoot>
      </table>

      {data.status !== "PAID" && data.status !== "WAIVED" && data.bankAccounts.length > 0 && (
        <div className="mt-8 border-t border-gray-300 pt-4 text-xs">
          <p className="font-bold mb-2">Informasi Pembayaran (Transfer Bank)</p>
          {data.bankAccounts.map((b) => (
            <div key={b.id} className="mb-2">
              <p className="font-semibold">
                {b.bankName} {b.label ? `(${b.label})` : ""}
              </p>
              <p className="font-mono text-base font-bold">{b.accountNumber}</p>
              <p className="text-gray-600">a.n. {b.accountHolder}</p>
            </div>
          ))}
          <p className="text-gray-600 mt-2">{data.manualInstructions}</p>
        </div>
      )}

      {data.status === "PAID" && (
        <p className="mt-8 text-xs font-bold text-green-700">
          LUNAS{data.paidAt ? ` — dibayar ${fmt(data.paidAt)}` : ""}
          {data.paymentMethod ? ` (${data.paymentMethod})` : ""}
        </p>
      )}

      <div className="mt-10 flex items-center justify-between print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-black text-white text-xs font-bold"
        >
          <Printer className="h-4 w-4" /> Cetak / Simpan PDF
        </button>
        <p className="text-[10px] text-gray-500">Dokumen ini dibuat otomatis oleh Print Pilot.</p>
      </div>
    </div>
  );
}
