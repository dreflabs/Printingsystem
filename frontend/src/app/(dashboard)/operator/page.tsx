"use client";

import { useState, useEffect } from "react";
import { Settings2, ScanLine, CheckCircle2, AlertCircle, Timer, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { useWorkflowStore, Job } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

const KPI = [
  { label: "Job Aktif Saya", value: "1", color: "text-status-blue", bg: "bg-status-blue/10", icon: Settings2 },
  { label: "Antrian Berikutnya", value: "3", color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Timer },
  { label: "Selesai Hari Ini", value: "4", color: "text-status-green", bg: "bg-status-green/10", icon: CheckCircle2 },
  { label: "Total Waste Hari Ini", value: "12 lbr", color: "text-status-orange", bg: "bg-status-orange/10", icon: AlertCircle },
];

// Hapus dummy data ACTIVE_JOB dan QUEUE

function useTimer(start: Date) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start.getTime()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [start]);
  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function DoneModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore(s => s.updateOrderStatus);
  const deductInventory = useWorkflowStore(s => s.deductInventory);
  const [qty, setQty] = useState("");
  const [waste, setWaste] = useState("");
  const [wasteReason, setWasteReason] = useState("");
  const needReason = parseInt(waste) > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)]">
        <h3 className="text-base font-bold text-primary mb-1">Selesai Produksi</h3>
        <p className="text-xs text-muted mb-5">{job.id} · {job.product}</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted font-medium mb-1.5 block">Qty Berhasil (Target: {job.qty}) *</label>
            <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="Jumlah produk jadi..."
              className="w-full h-12 rounded-xl bg-elevated border border-border text-primary text-lg font-bold px-4 outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20 transition-all" />
          </div>
          <div>
            <label className="text-xs text-muted font-medium mb-1.5 block">Qty Waste</label>
            <input type="number" min="0" value={waste} onChange={(e) => setWaste(e.target.value)}
              placeholder="0"
              className="w-full h-12 rounded-xl bg-elevated border border-border text-primary text-lg font-bold px-4 outline-none focus:border-status-orange focus:ring-2 focus:ring-status-orange/20 transition-all" />
          </div>
          {needReason && (
            <div>
              <label className="text-xs text-status-orange font-medium mb-1.5 block">Alasan Waste * (wajib jika &gt; 0)</label>
              <textarea value={wasteReason} onChange={(e) => setWasteReason(e.target.value)}
                placeholder="Jelaskan penyebab waste..."
                className="w-full min-h-[80px] rounded-xl bg-elevated border border-status-orange text-primary text-sm px-4 py-3 outline-none focus:ring-2 focus:ring-status-orange/20 transition-all resize-none" />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary transition-colors cursor-pointer">Batal</button>
          <button
            onClick={() => {
              let usage = parseInt(qty) || 0;
              if (job.width && job.height) {
                usage = ((job.width * job.height) / 10000) * usage;
              }
              usage += parseInt(waste) || 0;
              
              deductInventory(job.material, usage);
              updateJobStatus(job.id, "WAITING_QC");
              updateOrderStatus(job.orderId, "PRODUCTION_DONE");
              onClose();
            }}
            disabled={!qty || (needReason && !wasteReason)}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-status-green to-emerald-500 text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OperatorPage() {
  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  
  const operatorJobs = jobs.filter(j => j.status === "WAITING_PRINT" || j.status === "PRINTING");
  const activeJob = operatorJobs.length > 0 ? operatorJobs[0] : null;
  const queueJobs = operatorJobs.slice(1);
  
  const timer = useTimer(new Date()); // Mock timer
  const [showDone, setShowDone] = useState(false);

  return (
    <div className="space-y-5">
      {showDone && activeJob && <DoneModal job={activeJob} onClose={() => setShowDone(false)} />}

      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard Operator</h1>
        <p className="text-sm text-muted mt-0.5">Job yang di-assign ke Anda hari ini</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className={cn("inline-flex p-2 rounded-xl mb-3", k.bg)}>
              <k.icon className={cn("h-5 w-5", k.color)} />
            </div>
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Active Job Panel */}
      {activeJob ? (
        <div className="bg-gradient-to-br from-status-blue/10 to-accent-teal/5 border border-status-blue/30 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full bg-status-blue animate-pulse" />
                <span className="text-xs font-semibold text-status-blue uppercase tracking-wide">Job Aktif Sekarang</span>
              </div>
              <h2 className="text-xl font-bold text-primary">{activeJob.product}</h2>
              <p className="text-sm text-muted mt-0.5">{activeJob.material} · {activeJob.finishing} · {activeJob.qty} pcs</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted mb-0.5">Durasi</p>
              <p className="text-2xl font-bold text-accent-teal font-mono">{timer}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Kode Job", val: activeJob.id },
              { label: "Material", val: activeJob.material },
              { label: "Target Qty", val: `${activeJob.qty} pcs` },
              { label: "Deadline", val: orders.find(o => o.id === activeJob.orderId)?.deadline || "-" },
            ].map((info) => (
              <div key={info.label} className="bg-card/50 rounded-xl p-3">
                <p className="text-xs text-muted mb-0.5">{info.label}</p>
                <p className="text-sm font-semibold text-primary">{info.val}</p>
              </div>
            ))}
          </div>
          <button
            id="btn-selesai-produksi"
            onClick={() => setShowDone(true)}
            className="w-full h-14 rounded-xl bg-gradient-to-r from-status-green to-emerald-500 text-white text-base font-bold shadow-lg shadow-status-green/20 hover:brightness-110 transition-all cursor-pointer"
          >
            ✅ SELESAI PRODUKSI
          </button>
        </div>
      ) : (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-8 text-center">
          <p className="text-muted">Tidak ada job aktif saat ini.</p>
        </div>
      )}

      {/* Scan CTA */}
      <button
        id="btn-scan-mulai"
        className="w-full h-14 rounded-xl bg-elevated border-2 border-dashed border-accent-teal/40 text-accent-teal font-semibold flex items-center justify-center gap-2 hover:bg-accent-teal/10 transition-all cursor-pointer"
      >
        <ScanLine className="h-5 w-5" /> SCAN QR MULAI JOB BERIKUTNYA
      </button>

      {/* Queue */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <Timer className="h-5 w-5 text-status-yellow" />
          <h2 className="text-base font-semibold text-primary">Antrian Job Berikutnya</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow border border-status-yellow/30">{queueJobs.length}</span>
        </div>
        <div className="divide-y divide-border/50">
          {queueJobs.map((j, i) => {
            const order = orders.find(o => o.id === j.orderId);
            return (
            <div key={j.id} className={cn("flex items-center gap-4 p-4 hover:bg-elevated/30 transition-colors")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-accent-teal">{j.id}</span>
                  <StatusPill status={j.status as any} />
                </div>
                <p className="font-medium text-primary text-sm">{j.product}</p>
                <p className="text-xs text-muted">{j.material} · {j.finishing}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-primary">{j.qty} pcs</p>
                <p className={cn("text-xs text-muted")}>
                  {order?.deadline || "-"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" />
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
