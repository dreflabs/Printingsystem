"use client";

import { useWorkflowStore } from "@/store/useWorkflowStore";
import { Camera, ScanLine, Clock, CheckCircle2, ChevronRight, PackageCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { StatusPill } from "@/components/ui";

export default function GudangPage() {
  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore(s => s.updateOrderStatus);
  
  // Pisahkan data menjadi 2 kelompok utama (sangat simpel)
  // Kiri: Barang yang baru keluar mesin dan perlu di-QC/Finishing
  const masukQueue = jobs.filter(j => j.status === "WAITING_QC" || j.status === "FINISHING" || j.status === "QC_FAILED");
  
  // Kanan: Barang yang sudah selesai Finishing dan siap diserahkan ke Admin (atau sudah di admin)
  const selesaiQueue = jobs.filter(j => j.status === "STORED" || j.status === "QC_PASSED"); // QC_PASSED asumsinya antri masuk storage/diambil

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
      
      {/* Header & Tombol Pintas Scanner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">Monitor Finishing</h1>
          <p className="text-sm text-muted mt-1">Papan antrian visual. Gunakan HP Anda untuk scan atau klik tombol di bawah.</p>
        </div>

        <Link href="/scan" className="group">
          <button className="h-14 px-6 rounded-2xl bg-gradient-to-r from-accent-teal to-blue-600 text-white font-black text-lg shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 w-full sm:w-auto">
            <ScanLine className="h-6 w-6 group-hover:scale-110 transition-transform" /> 
            BUKA SCANNER
          </button>
        </Link>
      </div>

      {/* 2 Kolom Papan Antrian */}
      <div className="flex-1 flex gap-6 overflow-hidden pb-4">
        
        {/* KOLOM KIRI: BARANG MASUK */}
        <div className="flex-1 flex flex-col bg-card/40 border border-border rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
          
          {/* Header Kolom Kiri */}
          <div className="bg-gradient-to-b from-status-yellow/20 to-transparent p-5 border-b border-status-yellow/20 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-status-yellow text-white rounded-xl flex items-center justify-center shadow-lg shadow-status-yellow/30">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-status-yellow">1. MASUK DARI MESIN</h2>
                <p className="text-xs text-muted font-bold">Proses & Selesaikan Barang</p>
              </div>
            </div>
            <span className="text-3xl font-black text-status-yellow bg-status-yellow/10 px-4 py-1 rounded-2xl border border-status-yellow/30">
              {masukQueue.length}
            </span>
          </div>

          {/* List Barang Masuk */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {masukQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted opacity-50">
                <PackageCheck className="h-16 w-16 mb-2" />
                <p className="font-bold">Tidak ada antrian masuk</p>
              </div>
            ) : (
              masukQueue.map((job) => {
                const order = orders.find(o => o.id === job.orderId);
                return (
                <div key={job.id} className={cn(
                  "p-5 rounded-2xl border bg-elevated shadow-sm hover:scale-[1.02] transition-transform",
                  job.status === "FINISHING" ? "border-accent-teal shadow-accent-teal/10" :
                  job.status === "QC_FAILED" ? "border-status-red shadow-status-red/10" : "border-status-yellow/50"
                )}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-black font-mono text-primary bg-base px-2 py-1 rounded-md border border-border">
                      {job.id}
                    </span>
                    <StatusPill status={job.status} />
                  </div>
                  
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">{order?.customerName || "Tanpa Nama"}</p>
                  <p className="text-xl font-black text-primary leading-tight mb-1">{job.product}</p>
                  <p className="text-sm text-muted font-bold">{job.material} • {job.qty} pcs</p>
                  
                  <div className="mt-4 p-3 bg-base border border-border rounded-xl mb-4">
                    <p className="text-[10px] uppercase font-bold text-status-yellow tracking-wider mb-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Instruksi Finishing
                    </p>
                    <p className="font-semibold text-primary">{job.finishing}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    {job.status === "WAITING_QC" && (
                      <>
                        <button 
                          onClick={() => updateJobStatus(job.id, "FINISHING")}
                          className="flex-1 h-10 bg-accent-teal text-white rounded-lg text-xs font-bold hover:brightness-110 transition-all"
                        >
                          Lolos QC
                        </button>
                        <button 
                          onClick={() => updateJobStatus(job.id, "QC_FAILED")}
                          className="flex-1 h-10 bg-status-red/10 text-status-red border border-status-red/30 rounded-lg text-xs font-bold hover:bg-status-red/20 transition-all"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(job.status === "FINISHING" || job.status === "QC_FAILED") && (
                      <button 
                        onClick={() => {
                          updateJobStatus(job.id, "STORED");
                          if (order) updateOrderStatus(order.id, "READY_FOR_PICKUP");
                        }}
                        className="w-full h-10 bg-gradient-to-r from-status-green to-emerald-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="h-4 w-4" /> SELESAI & SERAHKAN
                      </button>
                    )}
                  </div>
                </div>
              )})
            )}
          </div>
        </div>


        {/* KOLOM KANAN: SELESAI */}
        <div className="flex-1 flex flex-col bg-card/40 border border-border rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
          
          {/* Header Kolom Kanan */}
          <div className="bg-gradient-to-b from-status-green/20 to-transparent p-5 border-b border-status-green/20 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-status-green text-white rounded-xl flex items-center justify-center shadow-lg shadow-status-green/30">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-status-green">2. SELESAI (SIAP AMBIL)</h2>
                <p className="text-xs text-muted font-bold">Menunggu Admin Kasir mengambil barang</p>
              </div>
            </div>
            <span className="text-3xl font-black text-status-green bg-status-green/10 px-4 py-1 rounded-2xl border border-status-green/30">
              {selesaiQueue.length}
            </span>
          </div>

          {/* List Barang Selesai */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {selesaiQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted opacity-50">
                <CheckCircle2 className="h-16 w-16 mb-2" />
                <p className="font-bold">Belum ada barang selesai</p>
              </div>
            ) : (
              selesaiQueue.map((job) => {
                const order = orders.find(o => o.id === job.orderId);
                return (
                <div key={job.id} className="p-4 rounded-2xl border border-status-green/30 bg-status-green/5 shadow-sm flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-status-green/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-6 w-6 text-status-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-black font-mono text-status-green">{job.id}</span>
                      {job.status === "QC_PASSED" && (
                        <span className="text-[9px] font-bold bg-status-green text-white px-1.5 py-0.5 rounded-full">BARU</span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{order?.customerName || "Tanpa Nama"}</p>
                    <p className="text-base font-bold text-primary truncate">{job.product}</p>
                    <p className="text-xs text-muted font-semibold">{job.qty} pcs • Selesai Finishing</p>
                  </div>
                </div>
              )})
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
