"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Wrench, AlertTriangle, Clock, Play, RotateCcw, ShieldAlert, RefreshCw, X } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getProductionOverview } from "@/actions/queries";
import { reassignProductionJob } from "@/actions/production";

type Data = Extract<Awaited<ReturnType<typeof getProductionOverview>>, { success: true }>["data"];
type JobRow = Data["jobs"][number];

const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—");

function ReassignModal({ job, opts, onClose, onDone }: {
  job: JobRow; opts: Data["reassignOptions"]; onClose: () => void; onDone: () => void;
}) {
  const [machineId, setMachineId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inp = "w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal";

  async function submit() {
    setBusy(true); setErr(null);
    const res = await reassignProductionJob(job.jobCode, { machineId, operatorId, reason });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-modal space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">Reassign {job.jobCode}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted">Saat ini: {job.machineName} · {job.operatorName}. Maks 2× / 24 jam untuk Admin; ke-3 wajib Owner.</p>
        {err && <div className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</div>}
        <select className={inp} value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">Pilih mesin baru…</option>
          {opts.machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className={inp} value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
          <option value="">Pilih operator baru…</option>
          {opts.operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input className={inp} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan reassignment (wajib)…" />
        <button disabled={busy || !machineId || !operatorId || !reason.trim()} onClick={submit}
          className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40">
          {busy ? "Memproses…" : "Alihkan Job"}
        </button>
      </div>
    </div>
  );
}

export default function ProductionPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [reassignJob, setReassignJob] = useState<JobRow | null>(null);

  const load = useCallback(async () => {
    const res = await getProductionOverview();
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setD(res.data);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const jobs = (d?.jobs ?? []).filter((j) => !statusFilter || j.status === statusFilter);

  const kpis = d ? [
    { label: "Belum Dimulai", value: d.kpi.assigned, color: "text-status-yellow-text", bg: "bg-status-yellow/10", icon: Clock },
    { label: "Sedang Berjalan", value: d.kpi.running, color: "text-status-blue", bg: "bg-status-blue/10", icon: Play },
    { label: "Dijeda", value: d.kpi.paused, color: "text-status-yellow-text", bg: "bg-status-yellow/10", icon: Wrench },
    { label: "Antrian QC", value: d.kpi.qcQueue, color: "text-accent-teal", bg: "bg-accent-teal/10", icon: Package },
    { label: "Rework Menunggu Owner", value: d.kpi.failedRework, color: "text-status-red", bg: "bg-status-red/10", icon: AlertTriangle },
    { label: "Stok Menipis", value: d.kpi.lowStock, color: "text-status-red", bg: "bg-status-red/10", icon: ShieldAlert },
  ] : [];

  return (
    <div className="space-y-6">
      {reassignJob && d && (
        <ReassignModal job={reassignJob} opts={d.reassignOptions} onClose={() => setReassignJob(null)} onDone={() => { setReassignJob(null); load(); }} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-primary">Admin — Produksi</h1>
        <p className="text-sm text-muted mt-0.5">Status mesin, antrian job, reassignment</p>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className={cn("inline-flex p-2 rounded-xl mb-3", k.bg)}><k.icon className={cn("h-5 w-5", k.color)} /></div>
            <p className={cn("text-3xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-base font-bold text-primary mb-3">Status Mesin</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(d?.machines ?? []).map((m) => (
            <div key={m.id} className={cn("p-4 rounded-2xl border shadow-sm bg-card", m.status === "MAINTENANCE" ? "border-status-yellow/40" : "border-border")}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs font-mono text-muted">{m.code}</p>
                  <h3 className="font-bold text-sm text-primary">{m.name}</h3>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border",
                  m.status === "ACTIVE" ? "bg-status-green/10 text-status-green border-status-green/30" : "bg-status-yellow/10 text-status-yellow-text border-status-yellow/30")}>
                  {m.status}
                </span>
              </div>
              {m.activeJob ? (
                <div className="mt-3 bg-elevated p-2.5 rounded-xl border border-border">
                  <p className="text-[10px] text-muted uppercase tracking-wide">Sedang Dikerjakan</p>
                  <p className="text-xs font-bold text-primary truncate">{m.activeJob.product}</p>
                  <p className="text-[10px] text-accent-teal font-mono">{m.activeJob.jobCode} · Qty {m.activeJob.qty}</p>
                </div>
              ) : (
                <div className="mt-3 bg-elevated/20 p-2.5 rounded-xl text-center border border-dashed border-border/50">
                  <p className="text-xs text-muted">Idle</p>
                </div>
              )}
            </div>
          ))}
          {d && d.machines.length === 0 && <p className="text-sm text-muted col-span-4">Belum ada mesin terdaftar (tambah di Katalog).</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center justify-between">
            <h2 className="text-base font-bold text-primary">Antrian Job</h2>
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-lg bg-elevated border border-border text-xs text-muted px-2 outline-none focus:border-accent-teal cursor-pointer">
                <option value="">Semua Status</option>
                <option value="PRODUCTION_ASSIGNED">Belum Dimulai</option>
                <option value="PRODUCTION_STARTED">Berjalan</option>
                <option value="PRODUCTION_PAUSED">Dijeda</option>
                <option value="PRODUCTION_COMPLETE">Menunggu QC</option>
                <option value="FAILED_REWORK">Rework</option>
                <option value="QC_PASSED">QC Lulus</option>
                <option value="FINISHING_STARTED">Finishing</option>
                <option value="STORED">Tersimpan</option>
              </select>
              <span className="text-xs text-muted">{jobs.length} job</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated border-b border-border text-muted font-semibold">
                <tr><th className="p-3">Kode Job</th><th className="p-3">Order / Konsumen</th><th className="p-3">Mesin / Operator</th><th className="p-3">Status</th><th className="p-3">Deadline</th><th className="p-3 text-right">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((j) => (
                  <tr key={j.jobCode} className="hover:bg-elevated/50 transition-colors">
                    <td className="p-3 font-mono text-accent-teal">{j.jobCode}{j.parentJobId ? " ↻" : ""}</td>
                    <td className="p-3"><p className="font-medium text-primary">{j.orderCode}</p><p className="text-muted text-[10px]">{j.customerName}</p></td>
                    <td className="p-3 text-muted">{j.machineName} · {j.operatorName}</td>
                    <td className="p-3"><StatusPill status={j.status} /></td>
                    <td className="p-3 text-muted">{fmtDate(j.deadline)}</td>
                    <td className="p-3 text-right">
                      {["PRODUCTION_ASSIGNED", "PRODUCTION_STARTED", "PRODUCTION_PAUSED"].includes(j.status) ? (
                        <button onClick={() => setReassignJob(j)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-status-yellow/10 text-status-yellow-text text-xs font-bold hover:bg-status-yellow/20 border border-status-yellow/30">
                          <RefreshCw className="h-3 w-3" /> Reassign
                        </button>
                      ) : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">Tidak ada job.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-5 w-5 text-status-red" />
              <h3 className="font-bold text-sm text-primary">Material Menipis</h3>
            </div>
            <div className="space-y-2">
              {(d?.lowStock ?? []).map((m) => (
                <div key={m.name} className="flex items-center justify-between p-2.5 rounded-xl bg-elevated text-xs">
                  <div><p className="font-semibold text-primary">{m.name}</p><p className="text-muted text-[10px]">min {m.min} {m.unit}</p></div>
                  <span className="font-bold font-mono px-2 py-0.5 rounded bg-status-red/10 text-status-red">{m.current} {m.unit}</span>
                </div>
              ))}
              {d && d.lowStock.length === 0 && <p className="text-xs text-muted text-center py-2">Semua stok aman.</p>}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <RotateCcw className="h-5 w-5 text-status-yellow-text" />
              <h3 className="font-bold text-sm text-primary">Rework (QC FAIL)</h3>
            </div>
            <p className="text-xs text-muted mb-3">Keputusan rework adalah wewenang <strong className="text-primary">Owner</strong> (semua level).</p>
            {(d?.jobs ?? []).filter((j) => j.status === "FAILED_REWORK").map((j) => (
              <div key={j.jobCode} className="p-3 rounded-xl bg-elevated border border-border text-xs mb-2">
                <div className="flex justify-between font-semibold">
                  <span className="text-primary font-mono">{j.jobCode}</span>
                  <span className="text-status-red">Rework ke-{(j.reworkCount ?? 0) + 1}</span>
                </div>
                <p className="text-muted mt-1">{j.orderCode} · menunggu keputusan Owner</p>
              </div>
            ))}
            {d && d.jobs.filter((j) => j.status === "FAILED_REWORK").length === 0 && (
              <div className="p-4 bg-elevated/40 rounded-xl text-center text-xs text-muted border border-dashed border-border">Tidak ada antrian rework.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
