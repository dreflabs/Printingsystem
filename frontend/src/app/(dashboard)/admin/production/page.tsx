"use client";

import { useState } from "react";
import {
  Package,
  Wrench,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Filter,
  ArrowUpRight,
} from "lucide-react";
import { StatusPill } from "@/components/ui";
import { useWorkflowStore, Job } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

// Mock reassignment data
const REASSIGN_QUEUE = [
  { jobId: "JOB-005", product: "Roll Banner", reason: "Operator tidak hadir", machine: "M-OUT-01", deadline: "2026-08-22" },
  { jobId: "JOB-006", product: "Brosur A4 2000pcs", reason: "Mesin M-UV-01 maintenance", machine: "M-UV-01", deadline: "2026-08-23" },
];

const MACHINES = [
  { id: "M-OUT-01", name: "Roland Outdoor 1", category: "OUTDOOR", status: "ACTIVE", activeJob: "JOB-002" },
  { id: "M-IND-01", name: "Epson Indoor 1", category: "INDOOR", status: "ACTIVE", activeJob: "JOB-001" },
  { id: "M-SUB-01", name: "Mimaki Sublimation", category: "SUBLIMASI", status: "MAINTENANCE", activeJob: null },
  { id: "M-UV-01", name: "Apex UV Flatbed", category: "UV", status: "ACTIVE", activeJob: null },
];

export default function ProductionPage() {
  const jobs = useWorkflowStore((s) => s.jobs);
  const orders = useWorkflowStore((s) => s.orders);
  const inventory = useWorkflowStore((s) => s.inventory);
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);

  const unassignedJobs = jobs.filter((j) => j.status === "WAITING_PRINT");
  const runningJobs = jobs.filter((j) => j.status === "PRINTING");
  const qcQueue = jobs.filter((j) => j.status === "WAITING_QC");
  const qcFailed = jobs.filter((j) => j.status === "QC_FAILED");
  const lowStock = inventory.filter((inv) => inv.stock < 100);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [machineFilter, setMachineFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reworkCounts, setReworkCounts] = useState<Record<string, number>>({});

  const filteredJobs = jobs.filter((j) => {
    const matchMachine = machineFilter === "" || true; // placeholder
    const matchStatus = statusFilter === "" || j.status === statusFilter;
    return matchMachine && matchStatus;
  });

  const kpis = [
    { label: "Job Belum Di-assign", value: unassignedJobs.length.toString(), color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Clock },
    { label: "Job Sedang Berjalan", value: runningJobs.length.toString(), color: "text-status-blue", bg: "bg-status-blue/10", icon: Play },
    { label: "Antrian QC", value: qcQueue.length.toString(), color: "text-accent-teal", bg: "bg-accent-teal/10", icon: Package },
    { label: "QC Fail / Rework", value: qcFailed.length.toString(), color: "text-status-red", bg: "bg-status-red/10", icon: AlertTriangle },
    { label: "Mesin Maintenance", value: "1", color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Wrench },
    { label: "Stok Material Menipis", value: lowStock.length.toString(), color: "text-status-red", bg: "bg-status-red/10", icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Admin — Produksi</h1>
          <p className="text-sm text-muted mt-0.5">Pengawasan alur mesin, re-assignment job, dan approval rework</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">
          Shift Pagi (8 Operator Aktif)
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-sm">
            <div className={cn("inline-flex p-2 rounded-xl mb-3", k.bg)}>
              <k.icon className={cn("h-5 w-5", k.color)} />
            </div>
            <p className={cn("text-3xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Mesin Status Board */}
      <div>
        <h2 className="text-base font-bold text-primary mb-3">Status Mesin Produksi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MACHINES.map((m) => {
            const currentJob = jobs.find((j) => j.id === m.activeJob);
            return (
              <div
                key={m.id}
                className={cn(
                  "p-4 rounded-2xl border backdrop-blur-xl transition-all shadow-sm",
                  m.status === "MAINTENANCE"
                    ? "bg-status-red/5 border-status-red/30 opacity-80"
                    : "bg-card/70 border-border hover:border-accent-teal/40"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs font-mono text-muted">{m.id}</p>
                    <h3 className="font-bold text-sm text-primary">{m.name}</h3>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold",
                      m.status === "ACTIVE" ? "bg-status-green/10 text-status-green" : "bg-status-red/10 text-status-red"
                    )}
                  >
                    {m.status}
                  </span>
                </div>
                {currentJob ? (
                  <div className="mt-3 bg-elevated/60 p-2.5 rounded-xl border border-border/50">
                    <p className="text-[10px] text-muted uppercase tracking-wide">Sedang Mencetak</p>
                    <p className="text-xs font-bold text-primary truncate">{currentJob.product}</p>
                    <p className="text-[10px] text-accent-teal font-mono">{currentJob.id} · Qty {currentJob.qty}</p>
                  </div>
                ) : (
                  <div className="mt-3 bg-elevated/20 p-2.5 rounded-xl text-center border border-dashed border-border/50">
                    <p className="text-xs text-muted">Mesin Standby / Idle</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel Reassignment */}
      <div className="bg-card/70 backdrop-blur-xl border border-status-yellow/20 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="h-5 w-5 text-status-yellow" />
          <h2 className="text-base font-bold text-primary">Job Perlu Reassignment</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow border border-status-yellow/30">
            {REASSIGN_QUEUE.length}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REASSIGN_QUEUE.map((r) => (
            <div key={r.jobId} className="p-4 bg-elevated rounded-xl border border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-accent-teal">{r.jobId}</span>
                  <span className="text-[10px] bg-status-yellow/10 text-status-yellow px-1.5 py-0.5 rounded font-bold">{r.machine}</span>
                </div>
                <p className="text-sm font-semibold text-primary truncate">{r.product}</p>
                <p className="text-xs text-muted">{r.reason}</p>
                <p className="text-[10px] text-muted mt-0.5">Deadline: {r.deadline}</p>
              </div>
              <button className="shrink-0 px-3 py-2 rounded-xl bg-status-yellow/10 text-status-yellow text-xs font-bold hover:bg-status-yellow/20 transition-all cursor-pointer border border-status-yellow/30">
                Reassign
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Job Queue Table */}
        <div className="lg:col-span-2 bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center justify-between">
            <h2 className="text-base font-bold text-primary">Antrian Job & Assignment</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-lg bg-elevated border border-border text-xs text-muted px-2 outline-none focus:border-accent-teal appearance-none cursor-pointer">
                <option value="">Semua Status</option>
                <option value="WAITING_PRINT">Menunggu Cetak</option>
                <option value="PRINTING">Sedang Cetak</option>
                <option value="WAITING_QC">Menunggu QC</option>
                <option value="QC_PASSED">QC Pass</option>
                <option value="QC_FAILED">QC Fail</option>
                <option value="FINISHING">Finishing</option>
                <option value="STORED">Tersimpan</option>
              </select>
              {statusFilter && (
                <button onClick={() => setStatusFilter("")} className="text-xs text-status-red hover:underline cursor-pointer">✕ Reset</button>
              )}
              <span className="text-xs text-muted">{filteredJobs.length} job</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated border-b border-border text-muted font-semibold">
                <tr>
                  <th className="p-3">Kode Job</th>
                  <th className="p-3">Produk</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-elevated/50 transition-colors">
                    <td className="p-3 font-mono text-accent-teal text-xs">{j.id}</td>
                    <td className="p-3 font-medium text-primary text-xs">{j.product}</td>
                    <td className="p-3 text-muted text-xs">{j.material}</td>
                    <td className="p-3">
                      <StatusPill status={j.status as any} />
                    </td>
                    <td className="p-3 text-right">
                      {j.status === "WAITING_PRINT" ? (
                        <button
                          onClick={() => updateJobStatus(j.id, "PRINTING")}
                          className="px-3 py-1 rounded-lg bg-status-blue/10 text-status-blue text-xs font-semibold hover:bg-status-blue/20 transition-all cursor-pointer"
                        >
                          Mulai Cetak
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedJob(j)}
                          className="text-muted hover:text-primary transition-colors cursor-pointer text-xs"
                        >
                          Detail
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-xs text-muted">Tidak ada job yang cocok dengan filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar: Material Warning & Rework Approval */}
        <div className="space-y-4">
          {/* Low Stock Warning Widget */}
          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-5 w-5 text-status-red" />
              <h3 className="font-bold text-sm text-primary">Peringatan Material Menipis</h3>
            </div>
            <div className="space-y-2">
              {inventory.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-xl bg-elevated text-xs">
                  <div>
                    <p className="font-semibold text-primary">{inv.name}</p>
                    <p className="text-muted text-[10px]">Satuan: {inv.unit}</p>
                  </div>
                  <span className={cn("font-bold font-mono px-2 py-0.5 rounded", inv.stock < 100 ? "bg-status-red/10 text-status-red" : "bg-status-green/10 text-status-green")}>
                    {inv.stock} {inv.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rework Approval */}
          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-status-yellow" />
                <h3 className="font-bold text-sm text-primary">Approval Rework</h3>
              </div>
              <span className="text-[10px] bg-status-yellow/10 text-status-yellow px-2 py-0.5 rounded-full font-bold">Level 1 & 2</span>
            </div>
            <p className="text-xs text-muted mb-3">Pengajuan rework akibat QC fail yang membutuhkan verifikasi Admin.</p>
            {qcFailed.length === 0 ? (
              <div className="p-4 bg-elevated/40 rounded-xl text-center text-xs text-muted border border-dashed border-border">
                Tidak ada antrian rework saat ini.
              </div>
            ) : (
              qcFailed.map((j) => {
                const reworkCount = reworkCounts[j.id] || 0;
                const isEscalation = reworkCount >= 2;
                return (
                  <div key={j.id} className={cn("p-3 rounded-xl space-y-2 text-xs border",
                    isEscalation ? "bg-status-red/5 border-status-red/30" : "bg-elevated border-border"
                  )}>
                    <div className="flex justify-between font-semibold">
                      <span className="text-primary">{j.id}</span>
                      <span className="text-status-red">Rework Ke-{reworkCount + 1}</span>
                    </div>
                    <p className="text-muted">{j.product}</p>
                    {!isEscalation ? (
                      <button
                        onClick={() => {
                          setReworkCounts(prev => ({ ...prev, [j.id]: (prev[j.id] || 0) + 1 }));
                          updateJobStatus(j.id, "WAITING_PRINT");
                        }}
                        className="w-full py-1.5 rounded-lg bg-status-green text-white font-bold hover:brightness-110 transition-all cursor-pointer"
                      >
                        Approve Rework Ke-{reworkCount + 1}
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-status-red">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span className="font-bold">Eskalasi ke Owner (2x FAIL)</span>
                        </div>
                        <p className="text-muted text-[10px]">Admin tidak berwenang approve rework ke-3. Sudah diteruskan ke Owner.</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
