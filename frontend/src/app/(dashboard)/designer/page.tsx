"use client";

import { useState } from "react";
import { Palette, Clock, CheckCircle2, RefreshCw, Upload, Eye, MoreHorizontal, Search } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

// Hapus KPI statis
// (Hapus dummy data DESIGN_QUEUE)
function UploadModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [url, setUrl] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)]">
        <h3 className="text-base font-bold text-primary mb-1">Upload Versi Desain Baru</h3>
        <p className="text-xs text-muted mb-5">{code}</p>
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center mb-4 hover:border-accent-teal/50 transition-colors cursor-pointer group">
          <Upload className="h-8 w-8 text-muted mx-auto mb-2 group-hover:text-accent-teal transition-colors" />
          <p className="text-sm text-muted">Klik untuk pilih file atau drag & drop</p>
          <p className="text-xs text-muted mt-1">.ai .psd .pdf .jpg .png (maks 50MB)</p>
        </div>
        <div className="mb-5">
          <label className="text-xs text-muted font-medium mb-1.5 block">URL Preview Desain (opsional)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal transition-colors placeholder:text-muted"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary transition-colors cursor-pointer">Batal</button>
          <button className="flex-1 h-10 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-sm font-semibold hover:brightness-110 transition-all cursor-pointer">Upload</button>
        </div>
      </div>
    </div>
  );
}

export default function DesignerDashboardPage() {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  
  const jobs = useWorkflowStore((s) => s.jobs);
  const orders = useWorkflowStore((s) => s.orders);
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore((s) => s.updateOrderStatus);

  // Filter jobs only for designer
  const designerJobs = jobs.filter(j => 
    j.status === "WAITING_DESIGN" || j.status === "DESIGN_REVIEW"
  );

  const waitingDesignCount = designerJobs.filter(j => j.status === "WAITING_DESIGN").length;
  const reviewCount = designerJobs.filter(j => j.status === "DESIGN_REVIEW").length;

  const KPI = [
    { label: "Semua Job Aktif", value: designerJobs.length.toString(), filter: null, color: "text-status-blue", bg: "bg-status-blue/10", icon: Palette },
    { label: "Menunggu Desain", value: waitingDesignCount.toString(), filter: "WAITING_DESIGN", color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Clock },
    { label: "Menunggu Approval", value: reviewCount.toString(), filter: "DESIGN_REVIEW", color: "text-status-orange", bg: "bg-status-orange/10", icon: Eye },
    { label: "Disetujui Hari Ini", value: "0", filter: "APPROVED", color: "text-status-green", bg: "bg-status-green/10", icon: CheckCircle2 },
  ];

  const filtered = designerJobs.filter((j) => {
    const matchSearch = j.id.toLowerCase().includes(search.toLowerCase()) || 
           j.orderId.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filterStatus ? j.status === filterStatus : true;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6">
      <NewOrderModal open={showOrderModal} onClose={() => setShowOrderModal(false)} />
      {uploadFor && <UploadModal code={uploadFor} onClose={() => setUploadFor(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Designer</h1>
          <p className="text-sm text-muted mt-0.5">Antrian pekerjaan desain Anda</p>
        </div>
        <button
          id="btn-order-baru-designer"
          onClick={() => setShowOrderModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-sm font-semibold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all cursor-pointer"
        >
          <Palette className="h-4 w-4" /> Order Baru
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI.map((k) => (
          <button
            key={k.label}
            onClick={() => setFilterStatus(k.filter)}
            className={cn(
              "text-left bg-card/70 backdrop-blur-xl border rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all cursor-pointer",
              filterStatus === k.filter ? "border-accent-teal ring-2 ring-accent-teal/20" : "border-border hover:border-accent-teal/50"
            )}
          >
            <div className={cn("inline-flex p-2 rounded-xl mb-3", k.bg)}>
              <k.icon className={cn("h-5 w-5", k.color)} />
            </div>
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">
              {filterStatus ? `Antrian: ${filterStatus}` : "Semua Antrian Desain"}
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode / nama..."
              className="h-9 w-52 rounded-lg bg-elevated border border-border text-sm text-primary pl-9 pr-3 outline-none focus:border-accent-teal transition-colors placeholder:text-muted"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50">
                {["Kode Order", "Konsumen", "Tipe", "Produk", "Versi", "Status", "Deadline", "Aksi"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((j, i) => {
                const order = orders.find(o => o.id === j.orderId);
                const isOverdue = false; // logic sederhana
                
                return (
                  <tr key={j.id} className={cn("border-b border-border/50 hover:bg-elevated/30 transition-colors", isOverdue && "bg-status-red/5")}>
                    <td className="px-4 py-3 font-mono text-xs text-accent-teal whitespace-nowrap">{j.orderId}</td>
                    <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{order?.customerName || "-"}</td>
                    <td className="px-4 py-3 text-muted">{order?.orderType || "Walk-in"}</td>
                    <td className="px-4 py-3 text-primary whitespace-nowrap">{j.product}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-purple/10 text-accent-purple border border-accent-purple/30">V1</span>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={j.status as any} /></td>
                    <td className={cn("px-4 py-3 text-xs whitespace-nowrap", isOverdue ? "text-status-red font-semibold" : "text-muted")}>
                      {isOverdue && "🔴 "}{order?.deadline}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button id={`btn-upload-${i}`} onClick={() => setUploadFor(j.id)} className="text-xs text-accent-teal hover:underline cursor-pointer flex items-center gap-1">
                          <Upload className="h-3 w-3" /> Upload
                        </button>
                        <button id={`btn-acc-${i}`} onClick={() => { updateJobStatus(j.id, "WAITING_PRINT"); updateOrderStatus(j.orderId, "PRODUCTION_STARTED"); }} className="text-xs text-status-green hover:underline cursor-pointer">ACC</button>
                        <button id={`btn-detail-${i}`} className="text-muted hover:text-primary transition-colors cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
