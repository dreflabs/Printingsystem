"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Wallet, PlayCircle, Lock, CheckCircle2, ShieldAlert, ChevronLeft, Printer, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/actions/session";
import {
  getPayrollPeriods,
  getPayrollPeriodDetail,
  generatePayrollPeriod,
  finalizePayrollPeriod,
  markPayrollRecordPaid,
  updatePayrollLateDeductionRate,
} from "@/actions/payroll";

type Periods = Extract<Awaited<ReturnType<typeof getPayrollPeriods>>, { success: true }>["data"];
type Detail = Extract<Awaited<ReturnType<typeof getPayrollPeriodDetail>>, { success: true }>["data"];

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const formatRp = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function PayrollPage() {
  const [role, setRole] = useState("");
  const isOwner = role === "owner";

  const [periods, setPeriods] = useState<Periods>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const [genYear, setGenYear] = useState(now.getFullYear());
  const [genMonth, setGenMonth] = useState(now.getMonth() + 1);
  const [lateRateDraft, setLateRateDraft] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    getSessionUser().then((r) => r.ok && setRole(r.user.role));
  }, []);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    const res = await getPayrollPeriods();
    if (res.success) setPeriods(res.data);
    else setMessage({ type: "error", text: res.error });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const openDetail = async (periodId: string) => {
    setMessage(null);
    const res = await getPayrollPeriodDetail(periodId);
    if (res.success) setDetail(res.data);
    else setMessage({ type: "error", text: res.error });
  };

  const handleGenerate = async () => {
    setBusy(true);
    setMessage(null);
    const res = await generatePayrollPeriod(genYear, genMonth);
    setBusy(false);
    if (res.success) {
      setMessage({ type: "success", text: "Periode payroll berhasil digenerate." });
      loadPeriods();
    } else {
      setMessage({ type: "error", text: res.error });
    }
  };

  const handleFinalize = async (periodId: string) => {
    setBusy(true);
    const res = await finalizePayrollPeriod(periodId);
    setBusy(false);
    if (res.success) {
      setMessage({ type: "success", text: "Periode difinalisasi." });
      loadPeriods();
      openDetail(periodId);
    } else {
      setMessage({ type: "error", text: res.error });
    }
  };

  const handleMarkPaid = async (recordId: string, periodId: string) => {
    setBusy(true);
    const res = await markPayrollRecordPaid(recordId);
    setBusy(false);
    if (res.success) {
      setMessage({ type: "success", text: "Ditandai lunas." });
      openDetail(periodId);
      loadPeriods();
    } else {
      setMessage({ type: "error", text: res.error });
    }
  };

  const handleSaveLateRate = async () => {
    const amount = Number(lateRateDraft);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage({ type: "error", text: "Nominal tidak valid." });
      return;
    }
    setBusy(true);
    const res = await updatePayrollLateDeductionRate(amount);
    setBusy(false);
    if (res.success) {
      setMessage({ type: "success", text: "Pengaturan potongan keterlambatan disimpan." });
      setShowSettings(false);
    } else {
      setMessage({ type: "error", text: res.error });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Wallet className="h-6 w-6 text-accent-teal" />
            Gaji Pegawai
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {isOwner
              ? "Kelola periode payroll, gaji pokok, dan slip gaji per pegawai."
              : "Status payroll per periode. Nominal gaji hanya bisa dilihat Owner."}
          </p>
        </div>
        {isOwner && !detail && (
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-muted hover:text-primary hover:bg-elevated transition-colors"
          >
            <Settings2 className="h-4 w-4" /> Pengaturan Potongan
          </button>
        )}
      </div>

      {message && (
        <div
          className={cn(
            "p-4 rounded-xl border text-sm font-semibold flex items-center gap-2",
            message.type === "success" ? "bg-status-green/10 border-status-green/30 text-status-green" : "bg-status-red/10 border-status-red/30 text-status-red"
          )}
        >
          {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      {isOwner && showSettings && !detail && (
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-muted uppercase tracking-wide">Potongan Keterlambatan (Rp / menit)</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={lateRateDraft}
              onChange={(e) => setLateRateDraft(e.target.value)}
              className="mt-1 w-full sm:w-48 px-3 py-2 bg-base border border-border rounded-xl text-sm text-primary focus:outline-none focus:border-accent-teal"
            />
          </div>
          <button
            onClick={handleSaveLateRate}
            disabled={busy}
            className="bg-accent-teal text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
      )}

      {!detail ? (
        <>
          {isOwner && (
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end gap-3">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wide">Bulan</label>
                <select
                  value={genMonth}
                  onChange={(e) => setGenMonth(Number(e.target.value))}
                  className="mt-1 px-3 py-2 bg-base border border-border rounded-xl text-sm text-primary focus:outline-none focus:border-accent-teal block"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wide">Tahun</label>
                <input
                  type="number"
                  value={genYear}
                  onChange={(e) => setGenYear(Number(e.target.value))}
                  className="mt-1 w-24 px-3 py-2 bg-base border border-border rounded-xl text-sm text-primary focus:outline-none focus:border-accent-teal block"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={busy}
                className="bg-accent-teal text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" /> Generate Periode
              </button>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-elevated border-b border-border text-muted uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Periode</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Pegawai</th>
                    {isOwner && <th className="px-6 py-4">Total Net</th>}
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted">Memuat...</td></tr>
                  ) : periods.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-muted">Belum ada periode payroll.</td></tr>
                  ) : (
                    periods.map((p) => (
                      <tr key={p.id} className="hover:bg-elevated/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-primary">{MONTHS[p.month - 1]} {p.year}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold",
                            p.status === "FINALIZED" ? "bg-status-green/10 text-status-green" : "bg-status-yellow/10 text-status-yellow-text"
                          )}>
                            {p.status === "FINALIZED" ? "Final" : "Draft"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted">{p.paidCount}/{p.employeeCount} lunas</td>
                        {isOwner && <td className="px-6 py-4 font-semibold text-primary">{formatRp(p.totalNet ?? 0)}</td>}
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openDetail(p.id)} className="text-accent-teal font-bold text-xs hover:underline">
                            Lihat Detail
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setDetail(null)} className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
            <ChevronLeft className="h-4 w-4" /> Kembali ke daftar periode
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-primary">{MONTHS[detail.month - 1]} {detail.year}</h2>
            {isOwner && detail.status === "DRAFT" && (
              <button
                onClick={() => handleFinalize(detail.id)}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-status-green/10 text-status-green font-bold text-sm hover:bg-status-green/20 disabled:opacity-50"
              >
                <Lock className="h-4 w-4" /> Finalisasi Periode
              </button>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-elevated border-b border-border text-muted uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Pegawai</th>
                    <th className="px-6 py-4">Hadir/Absen</th>
                    <th className="px-6 py-4">Telat</th>
                    {isOwner && <th className="px-6 py-4">Net Salary</th>}
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {detail.records.map((r: any) => (
                    <tr key={r.id} className="hover:bg-elevated/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-primary">{r.name}</div>
                        <div className="text-xs text-muted">@{r.username}</div>
                      </td>
                      <td className="px-6 py-4 text-muted">{r.presentDays}/{r.workingDays} hari ({r.absentDays} absen)</td>
                      <td className="px-6 py-4 text-muted">{r.lateMinutes} menit</td>
                      {isOwner && <td className="px-6 py-4 font-semibold text-primary">{formatRp(r.netSalary)}</td>}
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          r.status === "PAID" ? "bg-status-green/10 text-status-green" : "bg-status-red/10 text-status-red"
                        )}>
                          {r.status === "PAID" ? "Lunas" : "Belum Lunas"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isOwner && (
                          <div className="flex items-center justify-end gap-3">
                            <Link href={`/print/payslip/${r.id}`} target="_blank" className="text-muted hover:text-accent-teal" title="Cetak Slip Gaji">
                              <Printer className="h-4 w-4" />
                            </Link>
                            {r.status !== "PAID" && (
                              <button onClick={() => handleMarkPaid(r.id, detail.id)} disabled={busy} className="text-accent-teal font-bold text-xs hover:underline disabled:opacity-50">
                                Tandai Lunas
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
