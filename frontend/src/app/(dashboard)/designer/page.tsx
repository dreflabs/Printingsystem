"use client";

import { useState, useEffect, useCallback } from "react";
import { Palette, Clock, CheckCircle2, RefreshCw, Upload, Search, X, FileText, Paperclip, MoreVertical } from "lucide-react";
import { StatusPill, ErrorState, DropdownMenu, DropdownMenuItem, DropdownMenuDivider } from "@/components/ui";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { cn } from "@/lib/utils";
import { RoleGuide } from "@/components/dashboard/RoleGuide";
import { AbsenCard } from "@/components/dashboard/AbsenCard";
import { getDesignQueue } from "@/actions/queries";
import {
  createDesignUploadUrl,
  uploadDesignVersion,
  approveDesign,
  requestDesignRevision,
  takeDesignJob,
} from "@/actions/design";

const ACCEPT = ".pdf,.ai,.cdr,.eps,.svg,.psd,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,image/*";
const ALLOWED_EXT = ["pdf", "ai", "cdr", "eps", "svg", "psd", "png", "jpg", "jpeg", "webp", "tif", "tiff"];
const MAX_MB = 200;
const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** PUT file ke presigned URL R2 dengan progress. */
function putWithProgress(url: string, file: File, onPct: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload gagal (HTTP ${xhr.status}). Cek konfigurasi CORS bucket R2.`));
    xhr.onerror = () => reject(new Error("Upload gagal — jaringan atau CORS bucket R2."));
    xhr.send(file);
  });
}

type Row = {
  orderId: string;
  orderCode: string;
  orderStatus: string;
  customerName: string;
  designerId: string | null;
  designer: string;
  isOwnedByMe: boolean;
  isUnassigned: boolean;
  method: string;
  status: string;
  currentVersion: number;
  latestVersionStatus: string | null;
  latestVersionId: string | null;
  latestRejectionReason: string | null;
  latestFileName: string | null;
  latestFileUrl: string | null;
  deadline: string | Date | null;
  customerPhone: string | null;
  notes: string | null;
  pendingCount: number;
  items: {
    itemId: string;
    product: string;
    description: string | null;
    size: string | null;
    quantity: number;
    material: string | null;
    finishing: string | null;
    design: {
      status: string; // PENDING / APPROVED / REJECTED
      fileName: string | null;
      fileUrl: string | null;
      rejectionReason: string | null;
      wholeOrder: boolean; // dicakup file layout seluruh order
    } | null;
  }[];
};

const fmtDeadline = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—";

/** Nama file layak tampil = punya ekstensi (bukan uuid / object key). */
const looksLikeFilename = (s: string | null) => !!s && /\.[a-z0-9]{2,5}$/i.test(s.trim());

/** Kolom Aksi: 1 tombol utama sesuai konteks + menu ⋯ untuk sisanya. */
function DesignRowActions({
  r, busy, onDetail, onUpload, onRevisi, onTake, onAcc,
}: {
  r: Row;
  busy: boolean;
  onDetail: () => void;
  onUpload: () => void;
  onRevisi: () => void;
  onTake: () => void;
  onAcc: () => void;
}) {
  const owned = r.isOwnedByMe;
  const done = r.status === "APPROVED";
  const hasAnyDesign = r.items.some((i) => !!i.design);
  const canUpload = owned && !done;
  const canAcc = owned && !done && r.method !== "ONLINE" && r.items.some((i) => i.design && i.design.status !== "APPROVED");
  const canRevisi = owned && hasAnyDesign && !done;

  const primaryCls = "px-2.5 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-40";
  const ghost = "px-2.5 py-1 rounded-lg bg-elevated text-muted text-xs font-bold hover:text-primary transition-all inline-flex items-center gap-1";

  // ── Belum diambil ──────────────────────────────────────────────
  if (r.isUnassigned) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <button onClick={onTake} disabled={busy} className={cn(primaryCls, "bg-accent-teal text-white hover:brightness-110")}>
          Ambil Tugas
        </button>
        <button onClick={onDetail} className={ghost}><FileText className="h-3 w-3" /> Detail</button>
      </div>
    );
  }

  // ── Ditangani orang lain / tidak ada aksi ─────────────────────
  if (!owned) {
    return (
      <div className="flex justify-end">
        <button onClick={onDetail} className={ghost}><FileText className="h-3 w-3" /> Detail</button>
      </div>
    );
  }

  // ── Milik saya — tentukan tombol utama ───────────────────────
  const primary = done ? (
    <button onClick={onDetail} className={ghost}><FileText className="h-3 w-3" /> Detail</button>
  ) : canAcc ? (
    <button onClick={onAcc} disabled={busy} className={cn(primaryCls, "bg-status-green/15 text-status-green hover:bg-status-green/25")}>
      ACC
    </button>
  ) : r.method === "ONLINE" && hasAnyDesign ? (
    <span className="text-[10px] font-bold text-status-yellow-text">Tunggu ACC Admin</span>
  ) : (
    <button onClick={onUpload} disabled={busy} className={cn(primaryCls, "bg-accent-teal/15 text-accent-teal hover:bg-accent-teal/25 inline-flex items-center gap-1")}>
      <Upload className="h-3 w-3" /> Upload
    </button>
  );

  return (
    <div className="flex items-center justify-end gap-1.5">
      {primary}
      <DropdownMenu
        align="end"
        width={168}
        trigger={<MoreVertical className="h-4 w-4" />}
        label="Aksi lain"
        triggerClassName="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"
      >
        <DropdownMenuItem icon={<FileText className="h-4 w-4" />} onSelect={onDetail}>
          Lihat detail
        </DropdownMenuItem>
        {canUpload && (canAcc || r.method === "ONLINE") && (
          <DropdownMenuItem icon={<Upload className="h-4 w-4" />} onSelect={onUpload} disabled={busy}>
            {r.items.length > 1 ? "Upload / ganti per item" : "Upload versi baru"}
          </DropdownMenuItem>
        )}
        {(canRevisi || done) && (
          <>
            <DropdownMenuDivider />
            <DropdownMenuItem icon={<RefreshCw className="h-4 w-4" />} onSelect={onRevisi} disabled={busy || !hasAnyDesign}>
              Minta revisi
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenu>
    </div>
  );
}

function UploadModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const multiItem = row.items.length > 1;
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  // "" = berlaku seluruh order (file layout gabungan). id item = desain khusus item itu.
  const [itemId, setItemId] = useState<string>(multiItem ? (row.items.find((i) => !i.design || i.design.status !== "APPROVED")?.itemId ?? "") : "");
  const [phase, setPhase] = useState<"idle" | "preparing" | "uploading" | "saving">("idle");
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const busy = phase !== "idle";

  function pickFile(f: File | null) {
    setErr(null);
    if (!f) return setFile(null);
    const ext = (f.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setFile(null);
      return setErr(`Format .${ext || "?"} tidak didukung. Pakai: ${ALLOWED_EXT.join(", ")}.`);
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      return setErr(`File ${fmtSize(f.size)} melebihi batas ${MAX_MB} MB.`);
    }
    setFile(f);
  }

  async function submit() {
    if (!file) return;
    setErr(null);
    try {
      setPhase("preparing");
      const prep = await createDesignUploadUrl(row.orderId, {
        fileName: file.name,
        contentType: file.type || null,
        size: file.size,
      });
      if (!prep.success) throw new Error(prep.error);

      setPhase("uploading");
      setPct(0);
      await putWithProgress(prep.data.uploadUrl, file, setPct);

      setPhase("saving");
      const saved = await uploadDesignVersion(row.orderId, {
        filePath: prep.data.objectKey,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || null,
        notes: notes.trim() || undefined,
        orderItemId: itemId || null,
      });
      if (!saved.success) throw new Error(saved.error);
      onDone();
    } catch (e) {
      setPhase("idle");
      setErr(e instanceof Error ? e.message : "Gagal mengupload.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-primary">Upload Versi Desain</h3>
            <p className="text-xs text-muted font-mono">{row.orderCode} · versi berikutnya: V{row.currentVersion + 1}</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

        {multiItem && (
          <div>
            <label className="text-xs text-muted font-medium mb-1 block">Desain untuk *</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              disabled={busy}
              className="w-full h-10 rounded-xl bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal disabled:opacity-60"
            >
              {row.items.map((it) => (
                <option key={it.itemId} value={it.itemId}>
                  {it.product}{it.size ? ` · ${it.size}` : ""} · {it.quantity} pcs
                  {it.design?.status === "APPROVED" ? "  ✓ ada" : it.design ? "  • revisi" : ""}
                </option>
              ))}
              <option value="">— 1 file untuk SEMUA item (layout gabungan)</option>
            </select>
            <p className="text-[11px] text-muted mt-1">
              {row.items.filter((i) => i.design?.status === "APPROVED").length}/{row.items.length} item sudah punya desain final.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs text-muted font-medium mb-1 block">File Desain *</label>
          <label className={cn(
            "flex items-center gap-3 rounded-xl border border-dashed px-3 py-4 cursor-pointer transition-colors",
            file ? "border-accent-teal/50 bg-accent-teal/5" : "border-border hover:border-accent-teal/50",
            busy && "pointer-events-none opacity-60"
          )}>
            <input type="file" accept={ACCEPT} className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)} disabled={busy} />
            <Paperclip className="h-4 w-4 text-muted shrink-0" />
            {file ? (
              <span className="text-xs text-primary truncate">{file.name} <span className="text-muted">· {fmtSize(file.size)}</span></span>
            ) : (
              <span className="text-xs text-muted">Pilih file — PDF, AI, CDR, EPS, SVG, PSD, PNG, JPG, TIFF (maks {MAX_MB} MB)</span>
            )}
          </label>
        </div>

        <div>
          <label className="text-xs text-muted font-medium mb-1 block">Catatan Revisi / Perubahan</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} placeholder="Misal: penyesuaian warna logo & ukuran font..."
            className="w-full min-h-[60px] rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal resize-none disabled:opacity-60" />
        </div>

        {row.method === "MAKLOON" && (
          <p className="text-[11px] text-accent-teal">File MAKLOON otomatis di-approve setelah diupload.</p>
        )}

        {phase === "uploading" && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-elevated overflow-hidden">
              <div className="h-full bg-accent-teal transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-muted text-right">{pct}%</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} disabled={busy} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs text-muted hover:text-primary disabled:opacity-40">Batal</button>
          <button disabled={!file || busy} onClick={submit}
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-accent-teal to-accent-teal/70 text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 shadow-md shadow-accent-teal/20">
            {phase === "preparing" ? "Menyiapkan…" : phase === "uploading" ? "Mengupload…" : phase === "saving" ? "Menyimpan…" : "Submit Versi"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonModal({ title, label, orderCode, onClose, onSubmit }: {
  title: string; label: string; orderCode: string;
  onClose: () => void; onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-primary">{title}</h3>
            <p className="text-xs text-muted font-mono">{orderCode}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>
        <div>
          <label className="text-xs text-muted font-medium mb-1 block">{label}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
            className="w-full min-h-[80px] rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal resize-none" />
        </div>
        <button disabled={busy || !reason.trim()} onClick={async () => { setBusy(true); await onSubmit(reason.trim()); setBusy(false); }}
          className="w-full h-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40">
          {busy ? "Memproses…" : "Kirim"}
        </button>
      </div>
    </div>
  );
}

/** Detail brief + spesifikasi order untuk Designer (read-only, tanpa harga). */
function DesignDetailModal({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h3 className="text-base font-bold text-primary flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent-teal" /> {row.orderCode}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {row.customerName}
              {row.customerPhone ? ` · ${row.customerPhone}` : ""} · jatuh tempo {fmtDeadline(row.deadline)}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">Brief dari Admin</p>
            {row.notes?.trim() ? (
              <p className="text-sm text-primary whitespace-pre-wrap rounded-xl bg-elevated/60 border border-border p-3">{row.notes}</p>
            ) : (
              <p className="text-sm text-muted italic">Admin tidak menuliskan catatan. Hubungi Admin/konsumen bila perlu.</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">Spesifikasi ({row.items.length} item)</p>
            {row.items.length === 0 ? (
              <p className="text-sm text-muted italic">Tidak ada item tercatat.</p>
            ) : (
              <ul className="space-y-2">
                {row.items.map((it, i) => {
                  const d = it.design;
                  const badge =
                    d?.status === "APPROVED" ? { t: d.wholeOrder ? "Desain: file gabungan ✓" : "Desain: final ✓", c: "bg-status-green/15 text-status-green" }
                    : d?.status === "REJECTED" ? { t: "Desain: perlu revisi", c: "bg-status-red/15 text-status-red" }
                    : d ? { t: "Desain: menunggu ACC", c: "bg-status-yellow/15 text-status-yellow-text" }
                    : { t: "Desain: belum ada", c: "bg-muted/15 text-muted" };
                  return (
                  <li key={i} className="rounded-xl border border-border bg-elevated/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-primary">{it.product}</p>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", badge.c)}>{badge.t}</span>
                    </div>
                    {it.description && <p className="text-xs text-muted mt-0.5">{it.description}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      {it.size && <span>Ukuran: <span className="text-primary font-medium">{it.size}</span></span>}
                      <span>Jumlah: <span className="text-primary font-medium">{it.quantity}</span></span>
                      {it.material && <span>Bahan: <span className="text-primary font-medium">{it.material}</span></span>}
                      {it.finishing && <span>Finishing: <span className="text-primary font-medium">{it.finishing}</span></span>}
                    </div>
                    {d?.fileUrl && (
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-accent-teal hover:underline">
                        <Paperclip className="h-3 w-3" /> {d.fileName || "file desain"}
                      </a>
                    )}
                    {d?.status === "REJECTED" && d.rejectionReason && (
                      <p className="mt-1 text-[11px] text-status-red">Alasan: {d.rejectionReason}</p>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
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
  const [revisionFor, setRevisionFor] = useState<Row | null>(null);
  const [detailFor, setDetailFor] = useState<Row | null>(null);
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
    { label: "Sedang Dikerjakan", value: designing, filter: "DESIGNING", color: "text-status-yellow-text", bg: "bg-status-yellow/10", icon: Clock },
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
      {detailFor && <DesignDetailModal row={detailFor} onClose={() => setDetailFor(null)} />}
      {revisionFor && (
        <ReasonModal
          title="Minta Revisi Desain"
          label="Alasan minta revisi"
          orderCode={revisionFor.orderCode}
          onClose={() => setRevisionFor(null)}
          onSubmit={async (reason) => {
            const oid = revisionFor.orderId;
            setRevisionFor(null);
            await run(() => requestDesignRevision(oid, { reason }));
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Designer Sales</h1>
          <p className="text-sm text-muted mt-0.5">Alur desain, revisi, dan ACC spesifikasi konsumen</p>
        </div>
        <button
          onClick={() => setShowOrderModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-teal to-accent-teal/70 text-white text-sm font-semibold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all"
        >
          <Palette className="h-4 w-4" /> Buat Order Baru
        </button>
      </div>

      <RoleGuide role="designer_sales" defaultCollapsed />

      <AbsenCard />

      {error && <ErrorState message={error} onRetry={load} />}

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
                <th className="px-4 py-3">PIC</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3">Desain</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.orderId} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDetailFor(r)}
                      className="font-mono text-accent-teal font-bold hover:underline"
                      title="Lihat brief & spesifikasi"
                    >
                      {r.orderCode}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-primary">{r.customerName}</span>
                    {r.items[0] && (
                      <span className="block text-[10px] text-muted truncate max-w-[180px]">
                        {r.items[0].product}
                        {r.items[0].size ? ` · ${r.items[0].size}` : ""} · {r.items[0].quantity} pcs
                        {r.items.length > 1 ? ` +${r.items.length - 1}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold",
                      r.isUnassigned ? "bg-status-yellow/10 text-status-yellow-text border border-status-yellow/30" 
                      : r.isOwnedByMe ? "bg-status-green/10 text-status-green border border-status-green/30" 
                      : "bg-elevated text-muted border border-border"
                    )}>
                      {r.designer}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold",
                      r.method === "MAKLOON" ? "bg-accent-teal/10 text-accent-teal"
                        : r.method === "ONLINE" ? "bg-status-yellow/10 text-status-yellow-text"
                        : "bg-status-blue/10 text-status-blue")}>
                      {r.method}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusPill status={r.status} />
                      <span className="text-[10px] font-mono text-muted">V{r.currentVersion}</span>
                      {r.items.length > 1 && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold",
                          r.pendingCount === 0 ? "bg-status-green/15 text-status-green" : "bg-status-yellow/15 text-status-yellow-text"
                        )}>
                          {r.items.length - r.pendingCount}/{r.items.length} item
                        </span>
                      )}
                    </div>
                    {looksLikeFilename(r.latestFileName) && r.latestFileUrl && (
                      <a
                        href={r.latestFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted hover:text-accent-teal max-w-[170px]"
                        title={r.latestFileName ?? undefined}
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{r.latestFileName}</span>
                      </a>
                    )}
                    {r.latestVersionStatus === "REJECTED" && r.latestRejectionReason && (
                      <p className="mt-1 text-[10px] text-status-red max-w-[200px] truncate" title={r.latestRejectionReason}>
                        ⚠ {r.latestRejectionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{fmtDeadline(r.deadline)}</td>
                  <td className="px-4 py-3 text-right">
                    <DesignRowActions
                      r={r}
                      busy={busy}
                      onDetail={() => setDetailFor(r)}
                      onUpload={() => setUploadFor(r)}
                      onRevisi={() => setRevisionFor(r)}
                      onTake={() => run(() => takeDesignJob(r.orderId))}
                      onAcc={() => run(() => approveDesign(r.orderId, {}))}
                    />
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
