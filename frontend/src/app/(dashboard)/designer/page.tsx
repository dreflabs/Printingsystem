"use client";

import { useState, useEffect, useCallback } from "react";
import { Palette, Clock, CheckCircle2, RefreshCw, Upload, Search, X } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { cn } from "@/lib/utils";
import { getDesignQueue } from "@/actions/queries";
import { uploadDesignVersion, approveDesign, requestDesignRevision } from "@/actions/design";

type Row = {
  orderId: string;
  orderCode: string;
  orderStatus: string;
  customerName: string;
  designer: string;
  method: string;
  status: string;
  currentVersion: number;
  latestVersionStatus: string | null;
  deadline: string | Date | null;
};

const fmtDeadline = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—";

function UploadModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const [filePath, setFilePath] = useState("");
  const [previewPath, setPreviewPath] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inp = "w-full h-10 rounded-xl bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal";

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await uploadDesignVersion(row.orderId, {
      filePath: filePath.trim(),
      previewPath: previewPath.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-primary">Upload Versi Desain</h3>
            <p className="text-xs text-muted font-mono">{row.orderCode} · versi berikutnya: V{row.currentVersion + 1}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>

        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

        <div>
          <label className="text-xs text-muted font-medium mb-1 block">Path / Link File Desain *</label>
          <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="uploads/2026/ORD-.../v2.pdf atau link cloud" className={inp} />
        </div>
        <div>
          <label className="text-xs text-muted font-medium mb-1 block">Path Preview (opsional)</label>
          <input value={previewPath} onChange={(e) => setPreviewPath(e.target.value)} placeholder="uploads/.../v2-preview.jpg" className={inp} />
        </div>
        <div>
          <label className="text-xs text-muted font-medium mb-1 block">Catatan Revisi / Perubahan</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Misal: penyesuaian warna logo & ukuran font..."
            className="w-full min-h-[60px] rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal resize-none" />
        </div>

        {row.method === "MAKLOON" && (
          <p className="text-[11px] text-accent-teal">File MAKLOON otomatis di-approve setelah diupload.</p>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs text-muted hover:text-primary">Batal</button>
          <button disabled={!filePath.trim() || busy} onClick={submit}
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-accent-teal to-blue-600 text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 shadow-md shadow-accent-teal/20">
            Submit Versi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DesignerDashboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [uploadFor, setUploadFor] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getDesignQueue();
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setRows(res.data);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Aksi gagal."); return; }
    await load();
  }

  const pending = rows.filter((r) => r.status === "PENDING").length;
  const designing = rows.filter((r) => r.status === "DESIGNING").length;
  const approved = rows.filter((r) => r.status === "APPROVED").length;

  const KPI = [
    { label: "Belum Ada Versi", value: pending, filter: "PENDING", color: "text-status-blue", bg: "bg-status-blue/10", icon: Palette },
    { label: "Sedang Dikerjakan", value: designing, filter: "DESIGNING", color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Clock },
    { label: "Sudah Disetujui", value: approved, filter: "APPROVED", color: "text-status-green", bg: "bg-status-green/10", icon: CheckCircle2 },
  ];

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase();
    const matchSearch = !s || r.orderCode.toLowerCase().includes(s) || r.customerName.toLowerCase().includes(s);
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <NewOrderModal open={showOrderModal} onClose={() => setShowOrderModal(false)} onCreated={() => load()} />
      {uploadFor && <UploadModal row={uploadFor} onClose={() => setUploadFor(null)} onDone={() => { setUploadFor(null); load(); }} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Designer Sales</h1>
          <p className="text-sm text-muted mt-0.5">Alur desain, revisi, dan ACC spesifikasi konsumen</p>
        </div>
        <button
          onClick={() => setShowOrderModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-sm font-semibold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all"
        >
          <Palette className="h-4 w-4" /> Buat Order Baru
        </button>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {KPI.map((k) => (
          <button
            key={k.label}
            onClick={() => setFilterStatus(filterStatus === k.filter ? null : k.filter)}
            className={cn(
              "text-left bg-card/70 backdrop-blur-xl border rounded-2xl p-4 shadow-sm transition-all",
              filterStatus === k.filter ? "border-accent-teal ring-2 ring-accent-teal/20" : "border-border hover:border-accent-teal/50"
            )}
          >
            <div className={cn("inline-flex p-2 rounded-xl mb-3", k.bg)}><k.icon className={cn("h-5 w-5", k.color)} /></div>
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1 font-medium">{k.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-bold text-primary">Antrian Desain</h2>
            <span className="text-xs text-muted font-mono bg-elevated px-2 py-0.5 rounded-md border border-border">{filtered.length} job</span>
          </div>
          <div className="relative md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode / konsumen..."
              className="w-full h-9 rounded-xl bg-elevated border border-border text-xs text-primary pl-9 pr-3 outline-none focus:border-accent-teal placeholder:text-muted"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-elevated/70 border-b border-border text-muted font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Kode Order</th>
                <th className="px-4 py-3">Konsumen</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3">Versi</th>
                <th className="px-4 py-3">Status Desain</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.orderId} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-accent-teal font-bold">{r.orderCode}</td>
                  <td className="px-4 py-3 font-medium text-primary">{r.customerName}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold",
                      r.method === "MAKLOON" ? "bg-accent-teal/10 text-accent-teal"
                        : r.method === "ONLINE" ? "bg-status-yellow/10 text-status-yellow"
                        : "bg-status-blue/10 text-status-blue")}>
                      {r.method}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-accent-teal/15 text-accent-teal border border-accent-teal/30">
                      V{r.currentVersion}{r.latestVersionStatus ? ` · ${r.latestVersionStatus}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 font-mono text-muted">{fmtDeadline(r.deadline)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setUploadFor(r)}
                        disabled={busy}
                        className="px-2.5 py-1 rounded-lg bg-accent-teal/10 text-accent-teal font-bold hover:bg-accent-teal/20 transition-all flex items-center gap-1 disabled:opacity-40"
                      >
                        <Upload className="h-3 w-3" /> Upload
                      </button>
                      <button
                        onClick={() => run(() => approveDesign(r.orderId, {}))}
                        disabled={busy || r.status === "APPROVED" || r.latestVersionStatus == null}
                        className="px-2.5 py-1 rounded-lg bg-status-green/10 text-status-green font-bold hover:bg-status-green/20 transition-all disabled:opacity-40"
                        title={r.latestVersionStatus == null ? "Upload versi dulu" : "Setujui desain"}
                      >
                        ACC
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt("Alasan minta revisi:");
                          if (reason) run(() => requestDesignRevision(r.orderId, { reason }));
                        }}
                        disabled={busy || r.latestVersionStatus == null}
                        className="px-2.5 py-1 rounded-lg bg-status-yellow/10 text-status-yellow font-bold hover:bg-status-yellow/20 transition-all flex items-center gap-1 disabled:opacity-40"
                      >
                        <RefreshCw className="h-3 w-3" /> Revisi
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted">Tidak ada antrian desain yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
