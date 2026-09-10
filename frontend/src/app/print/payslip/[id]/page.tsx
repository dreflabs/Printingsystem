"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, Loader2 } from "lucide-react";
import { getPayslip } from "@/actions/payroll";

type Slip = Extract<Awaited<ReturnType<typeof getPayslip>>, { success: true }>["data"];

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const formatRp = (n: number) => "Rp " + n.toLocaleString("id-ID");
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  designer_sales: "Designer/Setting",
  operator: "Operator Cetak",
  gudang: "Finishing & Gudang",
};

export default function PayslipPage() {
  const params = useParams();
  const id = decodeURIComponent((params.id as string) ?? "");
  const [slip, setSlip] = useState<Slip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPayslip(id).then((res) => {
      if (!alive) return;
      if (res.success) setSlip(res.data);
      else setError(res.error);
    });
    return () => { alive = false; };
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elevated p-6">
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-6 py-4 text-sm text-status-red">{error}</div>
      </div>
    );
  }

  if (!slip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elevated">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  const row = (label: string, value: string, bold = false, negative = false) => (
    <div className="flex justify-between py-1.5 border-b border-dashed border-gray-300">
      <span className={bold ? "font-bold" : ""}>{label}</span>
      <span className={bold ? "font-bold" : negative ? "text-red-600" : ""}>{value}</span>
    </div>
  );

  return (
    <div className="w-full flex justify-center bg-elevated min-h-screen py-10 print:bg-white print:py-0">
      <button
        onClick={() => window.print()}
        className="fixed top-4 right-4 print:hidden flex items-center gap-2 bg-accent-teal text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:brightness-110"
      >
        <Printer className="h-5 w-5" /> Cetak Slip
      </button>

      <div className="w-[210mm] min-h-[148mm] bg-white text-black p-10 border border-gray-300 print:border-none shadow-xl print:shadow-none">
        <div className="text-center border-b-2 border-black pb-3 mb-6">
          <h1 className="text-xl font-extrabold uppercase">Slip Gaji</h1>
          <p className="text-sm text-gray-600">Periode {MONTHS[slip.month - 1]} {slip.year}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 mb-6 text-sm">
          <div>
            <span className="text-gray-500">Nama Pegawai</span>
            <p className="font-bold">{slip.employeeName}</p>
          </div>
          <div>
            <span className="text-gray-500">Jabatan</span>
            <p className="font-bold">{ROLE_LABEL[slip.role] ?? slip.role}</p>
          </div>
          <div className="mt-2">
            <span className="text-gray-500">Username</span>
            <p className="font-mono">@{slip.username}</p>
          </div>
          <div className="mt-2">
            <span className="text-gray-500">Status</span>
            <p className={"font-bold " + (slip.status === "PAID" ? "text-green-600" : "text-red-600")}>
              {slip.status === "PAID" ? `Lunas${slip.paidAt ? " · " + new Date(slip.paidAt).toLocaleDateString("id-ID") : ""}` : "Belum Dibayar"}
            </p>
          </div>
        </div>

        <div className="text-sm mb-6">
          <div className="bg-gray-100 px-3 py-1.5 font-bold text-xs uppercase tracking-wide">Rincian Absensi</div>
          <div className="px-3">
            {row("Hari Kerja", `${slip.workingDays} hari`)}
            {row("Hadir", `${slip.presentDays} hari`)}
            {row("Tidak Hadir", `${slip.absentDays} hari`)}
            {row("Total Keterlambatan", `${slip.lateMinutes} menit`)}
          </div>
        </div>

        <div className="text-sm">
          <div className="bg-gray-100 px-3 py-1.5 font-bold text-xs uppercase tracking-wide">Rincian Gaji</div>
          <div className="px-3">
            {row("Gaji Pokok", formatRp(slip.baseSalary))}
            {row("Potongan Tidak Hadir", "− " + formatRp(slip.deductionAbsent), false, true)}
            {row("Potongan Keterlambatan", "− " + formatRp(slip.deductionLate), false, true)}
            {row("Total Potongan", "− " + formatRp(slip.totalDeduction), false, true)}
            <div className="flex justify-between py-3 mt-2 border-t-2 border-black text-lg">
              <span className="font-extrabold">GAJI BERSIH (NET)</span>
              <span className="font-extrabold">{formatRp(slip.netSalary)}</span>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-500 mt-10 text-center">
          Slip ini dibuat otomatis oleh sistem pada {new Date(slip.generatedAt).toLocaleString("id-ID")}.
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 10mm; size: A4 landscape; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
