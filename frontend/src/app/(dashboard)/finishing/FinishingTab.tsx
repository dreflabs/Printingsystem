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

// Label printing logic removed as per user request (Struk is printed by Admin POS)

export function FinishingTab() {
  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore(s => s.updateOrderStatus);

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

  const [showDoneForm, setShowDoneForm] = useState(false);
  const [qty, setQty] = useState("");

  return (
    <div className="space-y-6">

      <p className="text-sm text-muted">Daftar produk cetak yang sudah lolos QC dan siap untuk proses finishing (Mata Itik, Laminasi, Potong, dll).</p>

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
                onClick={() => { 
                  setShowDoneForm(false); 
                  updateJobStatus(activeJob.id, "STORED");
                  updateOrderStatus(activeJob.orderId, "READY_FOR_PICKUP");
                }}
                className="w-full h-12 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
              >
                Selesai & Simpan ke Rak
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
          <h2 className="text-base font-semibold text-primary">Daftar Barang Perlu Finishing</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow border border-status-yellow/30">{queueJobs.length} Item</span>
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
                <p className="font-bold text-primary text-base mb-0.5">{j.product}</p>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5 bg-elevated px-2 py-1 rounded-md text-primary font-medium border border-border">
                    <Tag className="h-3.5 w-3.5 text-accent-teal" /> {j.qty} pcs
                  </span>
                  <span className="flex items-center gap-1.5 bg-status-blue/10 px-2 py-1 rounded-md text-status-blue font-medium border border-status-blue/20">
                    <Wrench className="h-3.5 w-3.5" /> {j.finishing || "Finishing Standar"}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 text-xs hidden sm:block">
                <p className="text-muted mb-1">Deadline:</p>
                <p className="font-bold text-status-red">{order?.deadline || "Hari Ini"}</p>
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
