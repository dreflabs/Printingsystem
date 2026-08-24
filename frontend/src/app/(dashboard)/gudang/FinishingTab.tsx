"use client";

import { useState } from "react";
import { Package, Wrench, CheckCircle2, Tag, Printer, ScanLine, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { useWorkflowStore, Job } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

const KPI = [
  { label: "Menunggu Finishing", value: "4", color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Package },
  { label: "Sedang Dikerjakan", value: "1", color: "text-accent-teal", bg: "bg-accent-teal/10", icon: Wrench },
  { label: "Selesai Hari Ini", value: "6", color: "text-status-green", bg: "bg-status-green/10", icon: CheckCircle2 },
  { label: "Label Tercetak", value: "6", color: "text-accent-teal", bg: "bg-accent-teal/10", icon: Tag },
];

// Hapus QUEUE statis
function LabelPreviewModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore(s => s.updateOrderStatus);
  const orders = useWorkflowStore(s => s.orders);
  const order = orders.find(o => o.id === job.orderId);
  const [printed, setPrinted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-[0_8px_48px_rgba(0,0,0,0.6)] p-6">
        <h3 className="text-base font-bold text-primary mb-4">Preview Label</h3>
        {/* Label Preview */}
        <div className="bg-white text-black rounded-xl p-4 mb-5 border-2 border-dashed border-border">
          <div className="text-center mb-3">
            <p className="text-sm font-bold text-black">🖨️ Print Pilot Percetakan</p>
            <p className="text-xs text-muted">Jl. Contoh No. 123 · Telp: 0800-xxxx</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 bg-elevated rounded-lg flex items-center justify-center shrink-0">
              <Tag className="h-8 w-8 text-muted" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-black truncate">{job.id}</p>
              <p className="text-[10px] text-gray-500">{job.orderId}</p>
              <p className="text-xs font-bold text-blue-600 truncate">{order?.customerName || "Konsumen"}</p>
              <p className="text-xs font-semibold text-black mt-0.5 truncate">{job.product}</p>
              <p className="text-[10px] text-gray-500">Qty: {job.qty} · {job.finishing}</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => {
              setPrinted(true);
              window.open(`/print/label/${job.id}`, "_blank");
            }}
            className={cn(
              "w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
              printed ? "bg-status-green/20 border border-status-green/40 text-status-green" : "bg-gradient-to-r from-accent-teal to-blue-500 text-white hover:brightness-110"
            )}
          >
            <Printer className="h-4 w-4" />
            {printed ? "✅ Label Tercetak" : "CETAK LABEL"}
          </button>
          {printed && (
            <label className="flex items-center gap-3 p-3 rounded-xl bg-elevated cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 accent-status-green" />
              <span className="text-sm text-primary">Label sudah ditempel ke barang fisik</span>
            </label>
          )}
          {confirmed && (
            <button onClick={() => {
              updateJobStatus(job.id, "STORED");
              updateOrderStatus(job.orderId, "READY_FOR_PICKUP");
              onClose();
            }} className="w-full h-11 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer">
              Serahkan ke Gudang →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FinishingTab() {
  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);

  const finishingJobs = jobs.filter(j => j.status === "FINISHING" || j.status === "QC_PASSED");
  const activeJob = finishingJobs.find(j => j.status === "FINISHING");
  const queueJobs = finishingJobs.filter(j => j.status === "QC_PASSED");

  const completedFinishingCount = jobs.filter(j => j.status === "STORED" || j.status === "PICKED_UP").length;

  const dynamicKPI = [
    { label: "Menunggu Finishing", value: queueJobs.length.toString(), color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Package },
    { label: "Sedang Dikerjakan", value: activeJob ? "1" : "0", color: "text-accent-teal", bg: "bg-accent-teal/10", icon: Wrench },
    { label: "Selesai Hari Ini", value: completedFinishingCount.toString(), color: "text-status-green", bg: "bg-status-green/10", icon: CheckCircle2 },
    { label: "Label Tercetak", value: completedFinishingCount.toString(), color: "text-accent-teal", bg: "bg-accent-teal/10", icon: Tag },
  ];

  const [labelFor, setLabelFor] = useState<Job | null>(null);
  const [showDoneForm, setShowDoneForm] = useState(false);
  const [qty, setQty] = useState("");

  return (
    <div className="space-y-6">
      {labelFor && <LabelPreviewModal job={labelFor} onClose={() => setLabelFor(null)} />}

      <p className="text-sm text-muted">Antrian job QC PASSED siap di-finishing</p>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {dynamicKPI.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className={cn("inline-flex p-2 rounded-xl mb-3", k.bg)}>
              <k.icon className={cn("h-5 w-5", k.color)} />
            </div>
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Active Job */}
      {activeJob ? (
        <div className="bg-gradient-to-br from-accent-teal/10 to-accent-teal/5 border border-accent-teal/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-accent-teal animate-pulse" />
            <span className="text-xs font-semibold text-accent-teal uppercase tracking-wide">Finishing Berjalan</span>
          </div>
          <p className="font-bold text-primary text-lg">{activeJob.product} — {activeJob.finishing}</p>
          <p className="text-sm text-muted mb-4">{activeJob.id} · Qty: {activeJob.qty} pcs</p>
          {!showDoneForm ? (
            <button
              id="btn-selesai-finishing"
              onClick={() => setShowDoneForm(true)}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-base font-bold hover:brightness-110 transition-all cursor-pointer"
            >
              🔧 SELESAI FINISHING
            </button>
          ) : (
            <div className="space-y-3">
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)}
                placeholder="Qty aktual finishing..."
                className="w-full h-12 rounded-xl bg-card border border-border text-primary text-lg font-bold px-4 outline-none focus:border-accent-teal transition-all" />
              <button
                disabled={!qty}
                onClick={() => { setShowDoneForm(false); setLabelFor(activeJob); }}
                className="w-full h-12 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
              >
                Submit & Cetak Label
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-8 text-center">
          <p className="text-muted">Tidak ada job finishing aktif saat ini.</p>
        </div>
      )}

      {/* Scan CTA */}
      <button className="w-full h-14 rounded-xl bg-elevated border-2 border-dashed border-accent-teal/40 text-accent-teal font-semibold flex items-center justify-center gap-2 hover:bg-accent-teal/10 transition-all cursor-pointer">
        <ScanLine className="h-5 w-5" /> SCAN QR MULAI FINISHING BERIKUTNYA
      </button>

      {/* Queue */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <Wrench className="h-5 w-5 text-status-yellow" />
          <h2 className="text-base font-semibold text-primary">Antrian QC_PASSED</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow border border-status-yellow/30">{queueJobs.length}</span>
        </div>
        <div className="divide-y divide-border/50">
          {queueJobs.map((j, i) => {
            const order = orders.find(o => o.id === j.orderId);
            return (
            <div key={j.id} className={cn("flex items-center gap-4 p-4 hover:bg-elevated/30 transition-colors")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-accent-teal">{j.id}</span>
                  <StatusPill status="QC_PASSED" />
                </div>
                <p className="font-semibold text-primary text-sm">{j.product}</p>
                <p className="text-xs text-muted">{j.finishing} · {j.qty} pcs</p>
              </div>
              <div className="text-right shrink-0 text-xs">
                <p className={cn("text-muted")}>{order?.deadline}</p>
              </div>
              <button
                id={`btn-mulai-finishing-${i}`}
                onClick={() => updateJobStatus(j.id, "FINISHING")}
                className="shrink-0 h-10 px-4 rounded-xl bg-accent-teal/20 border border-accent-teal/40 text-accent-teal text-xs font-bold hover:bg-accent-teal/30 transition-all cursor-pointer"
              >
                Mulai
              </button>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
