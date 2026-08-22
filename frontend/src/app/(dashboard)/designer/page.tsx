"use client";

import { useState } from "react";
import {
  Palette,
  Clock,
  CheckCircle2,
  RefreshCw,
  Upload,
  Eye,
  MoreHorizontal,
  Search,
  FileText,
  X,
  Sparkles,
  Filter,
  Layers,
  ArrowRight
} from "lucide-react";
import { StatusPill } from "@/components/ui";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { useWorkflowStore, Job, Order } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

// Modal Upload Versi Desain Baru
function UploadModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [version, setVersion] = useState("V2");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore((s) => s.updateOrderStatus);

  const handleUpload = () => {
    // Ubah status ke DESIGN_REVIEW (Menunggu Approval)
    updateJobStatus(job.id, "DESIGN_REVIEW");
    updateOrderStatus(job.orderId, "DESIGN_REVIEW");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-primary">Upload Versi Desain Baru</h3>
            <p className="text-xs text-muted font-mono">{job.id} · {job.product}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="text-xs text-muted font-medium mb-1 block">Pilih Label Versi</label>
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal"
          >
            <option value="V1">V1 — Concept Awal</option>
            <option value="V2">V2 — Revisi Konsumen</option>
            <option value="V3">V3 — Final Touch</option>
          </select>
        </div>

        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-accent-teal/50 transition-colors cursor-pointer group bg-elevated/30">
          <Upload className="h-8 w-8 text-muted mx-auto mb-2 group-hover:text-accent-teal transition-colors" />
          <p className="text-sm font-semibold text-primary">Klik untuk unggah file cetak</p>
          <p className="text-[10px] text-muted mt-1">Format: .AI, .PSD, .PDF, .JPG (maks 100MB)</p>
        </div>

        <div>
          <label className="text-xs text-muted font-medium mb-1 block">Link Cloud Preview (Drive / Dropbox)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full h-10 rounded-xl bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal placeholder:text-muted"
          />
        </div>

        <div>
          <label className="text-xs text-muted font-medium mb-1 block">Catatan Revisi / Perubahan</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misal: Penyesuaian warna logo & ukuran font..."
            className="w-full min-h-[60px] rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal placeholder:text-muted resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs text-muted hover:text-primary transition-colors cursor-pointer">
            Batal
          </button>
          <button
            onClick={handleUpload}
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-accent-teal to-blue-600 text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer shadow-md shadow-accent-teal/20"
          >
            Submit Versi Desain
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Detail Order untuk Designer (Tanpa Data HP Konsumen & Nominal Harga)
function OrderDetailModal({ job, order, onClose }: { job: Job; order?: Order; onClose: () => void }) {
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore((s) => s.updateOrderStatus);

  const handleApproveLisan = () => {
    updateJobStatus(job.id, "WAITING_PRINT");
    updateOrderStatus(job.orderId, "PRODUCTION_STARTED");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.6)] space-y-5">
        <div className="flex justify-between items-start border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent-teal font-bold">{job.id}</span>
              <span className="text-xs text-muted font-mono">({job.orderId})</span>
              <StatusPill status={job.status as any} />
            </div>
            <h2 className="text-lg font-bold text-primary mt-1">{job.product}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Specific Order Context */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-elevated/50 p-4 rounded-xl text-xs">
          <div>
            <p className="text-muted text-[10px] uppercase font-semibold">Konsumen</p>
            <p className="font-semibold text-primary">{order?.customerName || "-"}</p>
          </div>
          <div>
            <p className="text-muted text-[10px] uppercase font-semibold">Tipe Order</p>
            <p className="font-semibold text-accent-teal">{order?.orderType || "Walk-in"}</p>
          </div>
          <div>
            <p className="text-muted text-[10px] uppercase font-semibold">Deadline</p>
            <p className="font-semibold text-status-yellow">{order?.deadline || "-"}</p>
          </div>
          <div>
            <p className="text-muted text-[10px] uppercase font-semibold">Bahan / Material</p>
            <p className="font-semibold text-primary">{job.material}</p>
          </div>
          <div>
            <p className="text-muted text-[10px] uppercase font-semibold">Finishing</p>
            <p className="font-semibold text-primary">{job.finishing}</p>
          </div>
          <div>
            <p className="text-muted text-[10px] uppercase font-semibold">Status Bayar</p>
            <p className={cn("font-bold", order?.paymentStatus === "PAID" ? "text-status-green" : "text-status-yellow")}>
              {order?.paymentStatus === "PAID" ? "DP/Lunas Terpenuhi" : "Menunggu DP"}
            </p>
          </div>
        </div>

        {/* Spec Notes */}
        {order?.notes && (
          <div className="p-3 bg-elevated/30 rounded-xl border border-border text-xs">
            <p className="text-muted text-[10px] uppercase font-bold mb-1">Catatan Khusus Desain:</p>
            <p className="text-primary">{order.notes}</p>
          </div>
        )}

        {/* Version History Showcase */}
        <div>
          <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-accent-teal" /> Riwayat Versi Desain
          </h4>
          <div className="space-y-2">
            {[
              { ver: "V1", time: "2026-08-20 10:30", uploader: "Designer Ayu", note: "Draft awal konsep logo & layout", status: "WAITING_APPROVAL" },
            ].map((v) => (
              <div key={v.ver} className="flex items-center justify-between p-3 rounded-xl bg-elevated border border-border text-xs">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded-lg bg-accent-teal/10 text-accent-teal font-mono font-bold border border-accent-teal/30">
                    {v.ver}
                  </span>
                  <div>
                    <p className="font-semibold text-primary">{v.note}</p>
                    <p className="text-[10px] text-muted">{v.uploader} · {v.time}</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-status-yellow/10 text-status-yellow border border-status-yellow/30 font-bold">
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Approval Actions by Order Type */}
        <div className="pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs text-muted hover:text-primary transition-colors cursor-pointer">
            Tutup
          </button>

          {order?.orderType === "Walk-in" ? (
            <button
              onClick={handleApproveLisan}
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-status-green to-emerald-600 text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer shadow-md shadow-status-green/20"
            >
              ✅ ACC Lisan (Walk-in) & Lanjut Cetak
            </button>
          ) : order?.orderType === "Makloon" ? (
            <button
              onClick={handleApproveLisan}
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-accent-teal to-blue-600 text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
            >
              ⚡ Auto-ACC File Makloon
            </button>
          ) : (
            <button
              onClick={() => {
                updateJobStatus(job.id, "DESIGN_REVIEW");
                updateOrderStatus(job.orderId, "DESIGN_REVIEW");
                onClose();
              }}
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-accent-teal to-blue-600 text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
            >
              📲 Kirim Preview ke Admin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DesignerDashboardPage() {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [uploadForJob, setUploadForJob] = useState<Job | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("Semua");

  const jobs = useWorkflowStore((s) => s.jobs);
  const orders = useWorkflowStore((s) => s.orders);
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore((s) => s.updateOrderStatus);

  // Filter jobs for designer view
  const designerJobs = jobs.filter((j) =>
    j.status === "WAITING_DESIGN" || j.status === "DESIGN_REVIEW"
  );

  const activeDesignCount = designerJobs.filter((j) => j.status === "WAITING_DESIGN").length;
  const reviewCount = designerJobs.filter((j) => j.status === "DESIGN_REVIEW").length;
  const approvedTodayCount = jobs.filter(
    (j) => j.status !== "WAITING_DESIGN" && j.status !== "DESIGN_REVIEW"
  ).length;

  const KPI = [
    { label: "Job Desain Aktif", value: activeDesignCount.toString(), filter: "WAITING_DESIGN", color: "text-status-blue", bg: "bg-status-blue/10", icon: Palette },
    { label: "Menunggu Approval", value: reviewCount.toString(), filter: "DESIGN_REVIEW", color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Clock },
    { label: "Menunggu Revisi", value: "0", filter: "REVISION", color: "text-status-yellow", bg: "bg-status-yellow/10", icon: RefreshCw },
    { label: "Disetujui Hari Ini", value: approvedTodayCount.toString(), filter: "APPROVED", color: "text-status-green", bg: "bg-status-green/10", icon: CheckCircle2 },
  ];

  const filtered = designerJobs.filter((j) => {
    const order = orders.find((o) => o.id === j.orderId);
    const matchSearch =
      j.id.toLowerCase().includes(search.toLowerCase()) ||
      j.orderId.toLowerCase().includes(search.toLowerCase()) ||
      (order?.customerName && order.customerName.toLowerCase().includes(search.toLowerCase()));

    const matchStatus = filterStatus ? j.status === filterStatus : true;
    const matchType = filterType === "Semua" || order?.orderType === filterType;

    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-6">
      <NewOrderModal open={showOrderModal} onClose={() => setShowOrderModal(false)} />
      {uploadForJob && <UploadModal job={uploadForJob} onClose={() => setUploadForJob(null)} />}
      {selectedJob && (
        <OrderDetailModal
          job={selectedJob}
          order={orders.find((o) => o.id === selectedJob.orderId)}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Designer Sales</h1>
          <p className="text-sm text-muted mt-0.5">Pengelolaan alur desain, revisi, dan ACC spesifikasi konsumen</p>
        </div>
        <button
          id="btn-order-baru-designer"
          onClick={() => setShowOrderModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-sm font-semibold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all cursor-pointer"
        >
          <Palette className="h-4 w-4" /> Buat Order Baru
        </button>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI.map((k) => (
          <button
            key={k.label}
            onClick={() => setFilterStatus(filterStatus === k.filter ? null : k.filter)}
            className={cn(
              "text-left bg-card/70 backdrop-blur-xl border rounded-2xl p-4 shadow-sm transition-all cursor-pointer",
              filterStatus === k.filter ? "border-accent-teal ring-2 ring-accent-teal/20" : "border-border hover:border-accent-teal/50"
            )}
          >
            <div className={cn("inline-flex p-2 rounded-xl mb-3", k.bg)}>
              <k.icon className={cn("h-5 w-5", k.color)} />
            </div>
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1 font-medium">{k.label}</p>
          </button>
        ))}
      </div>

      {/* Table & Toolbar */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-bold text-primary">Antrian Desain Saya</h2>
            <span className="text-xs text-muted font-mono bg-elevated px-2 py-0.5 rounded-md border border-border">
              {filtered.length} job
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tipe Order */}
            <div className="flex items-center gap-1.5 bg-elevated p-1 rounded-xl border border-border text-xs">
              <Filter className="h-3.5 w-3.5 text-muted ml-2" />
              {["Semua", "Walk-in", "Makloon", "Online"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={cn(
                    "px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                    filterType === t ? "bg-accent-teal text-white shadow-sm" : "text-muted hover:text-primary"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode / konsumen..."
                className="w-full h-9 rounded-xl bg-elevated border border-border text-xs text-primary pl-9 pr-3 outline-none focus:border-accent-teal transition-colors placeholder:text-muted"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-elevated/70 border-b border-border text-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Kode Order</th>
                <th className="px-4 py-3">Konsumen</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Produk & Spesifikasi</th>
                <th className="px-4 py-3">Versi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((j) => {
                const order = orders.find((o) => o.id === j.orderId);
                return (
                  <tr key={j.id} className="hover:bg-elevated/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-accent-teal font-bold">{j.orderId}</td>
                    <td className="px-4 py-3 font-medium text-primary">{order?.customerName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold",
                        order?.orderType === "Makloon" ? "bg-accent-teal/10 text-accent-teal" : order?.orderType === "Online" ? "bg-status-yellow/10 text-status-yellow" : "bg-status-blue/10 text-status-blue"
                      )}>
                        {order?.orderType || "Walk-in"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-primary">{j.product}</p>
                      <p className="text-[10px] text-muted">{j.material} · {j.finishing}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-accent-teal/15 text-accent-teal border border-accent-teal/30">
                        V1
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={j.status as any} />
                    </td>
                    <td className="px-4 py-3 font-mono text-muted">{order?.deadline || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setUploadForJob(j)}
                          className="px-2.5 py-1 rounded-lg bg-accent-teal/10 text-accent-teal font-bold hover:bg-accent-teal/20 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="h-3 w-3" /> Upload
                        </button>
                        <button
                          onClick={() => {
                            updateJobStatus(j.id, "WAITING_PRINT");
                            updateOrderStatus(j.orderId, "PRODUCTION_STARTED");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-status-green/10 text-status-green font-bold hover:bg-status-green/20 transition-all cursor-pointer"
                        >
                          ACC
                        </button>
                        <button
                          onClick={() => setSelectedJob(j)}
                          className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer"
                          title="Buka Detail Order"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    Tidak ada antrian desain yang sesuai dengan pencarian / filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
