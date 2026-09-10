"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ScanLine, CheckCircle2, Timer, Layers, Pause, Play,
  ShieldAlert, FileWarning, FileDown, MoreVertical, Clock,
} from "lucide-react";
import { StatusPill, Modal, DropdownMenu, DropdownMenuItem } from "@/components/ui";
import { cn } from "@/lib/utils";
import { RoleGuide } from "@/components/dashboard/RoleGuide";
import { AbsenCard } from "@/components/dashboard/AbsenCard";
import { getOperatorJobs } from "@/actions/queries";
import { getOrderFormData } from "@/actions/orders";
import { startProduction, pauseProduction, resumeProduction, finishProduction, bounceDesignFromProduction } from "@/actions/production";

type JobItem = { product: string; size: string | null; qty: number; material: string | null; finishing: string | null };
type Job = {
  jobCode: string;
  orderCode: string;
  customerName: string;
  machine: string;
  status: string;
  priority: number;
  plannedQty: number;
  actualQty: number;
  deadline: string | Date | null;
  startedAt: string | Date | null;
  items: JobItem[];
  suggestedMaterialId: string | null;
  fileUrl: string | null;
  fileName: string | null;
};
type MaterialOpt = { id: string; name: string; type: string; unitUsage: string; unitCustom: string | null };

/** Alasan potong reject (hasil cetak tidak terpakai). */
const REJECT_REASONS = [
  "Tinta blobor / kotor",
  "Warna beda dari proof",
  "Defect fisik (sobek / lipat / kotor)",
  "Salah setting margin / warna",
  "Lainnya",
];

/** Alasan sisa bahan terbuang (bukan hasil cetak — setup / offcut). */
const OFFCUT_REASONS = [
  "Leader / trailer roll",
  "Kalibrasi / test warna",
  "Sisa roll tak terpakai",
  "Bahan macet / sobek saat proses",
  "Lainnya",
];

/** Prioritas job → badge. Prioritas 1 (normal) tidak diberi badge. */
function priorityBadge(p: number): { label: string; text: string; bar: string } | null {
  if (p >= 3) return { label: "MENDESAK", text: "text-status-red", bar: "border-l-status-red" };
  if (p === 2) return { label: "SEGERA", text: "text-status-yellow-text", bar: "border-l-status-yellow" };
  return null;
}

/** Deadline relatif + nada warna. */
function deadlineInfo(d: string | Date | null): { label: string; tone: "red" | "amber" | "muted" } | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { label: `Terlambat ${-days} hr`, tone: "red" };
  if (days === 0) return { label: "Deadline hari ini", tone: "red" };
  if (days === 1) return { label: "Deadline besok", tone: "amber" };
  if (days <= 3) return { label: `${days} hari lagi`, tone: "amber" };
  return { label: `${days} hari lagi`, tone: "muted" };
}

const TONE_CLS = {
  red: "text-status-red",
  amber: "text-status-yellow-text",
  muted: "text-muted",
} as const;

/** Durasi sejak `from` → "1j 20m" / "45m". */
function fmtElapsed(from: string | Date | null): string {
  if (!from) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function JobItems({ items, dense }: { items: JobItem[]; dense?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className={dense ? "space-y-0.5" : "space-y-1"}>
      {items.map((it, i) => (
        <div key={i}>
          <p className="font-bold text-primary leading-tight">
            {it.product}
            {it.size ? <span className="font-semibold text-muted"> · {it.size}</span> : null}
            <span className="text-accent-teal"> · {it.qty} pcs</span>
          </p>
          {(it.material || it.finishing) && (
            <p className="text-[11px] text-muted leading-tight">
              {[it.material, it.finishing].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/** Tombol buka file cetak (dibuka di tab baru untuk di-RIP ke mesin). */
function FileButton({ url, name }: { url: string | null; name: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={name || "Buka file cetak"}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-accent-teal/40 bg-accent-teal/10 px-3 text-xs font-bold text-accent-teal hover:bg-accent-teal/20 transition-colors"
    >
      <FileDown className="h-4 w-4 shrink-0" />
      <span className="hidden truncate sm:inline">File</span>
    </a>
  );
}

function QueueCard({
  job, busy, onStart, onBounce,
}: {
  job: Job;
  busy: boolean;
  onStart: () => void;
  onBounce: () => void;
}) {
  const pr = priorityBadge(job.priority);
  const dl = deadlineInfo(job.deadline);
  return (
    <div className={cn("rounded-2xl border border-border bg-base p-4", pr && `border-l-4 ${pr.bar}`)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cn("text-[11px] font-black tracking-wide", pr?.text)}>{pr?.label ?? ""}</span>
        {dl && <span className={cn("text-[11px] font-bold", TONE_CLS[dl.tone])}>{dl.label}</span>}
      </div>

      <JobItems items={job.items} />

      <p className="mt-2 font-mono text-[11px] text-muted">{job.jobCode} · {job.machine}</p>

      <div className="mt-3 flex items-stretch gap-2">
        <button
          disabled={busy}
          onClick={onStart}
          className="h-11 flex-1 rounded-xl bg-accent-teal text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-40"
        >
          {job.status === "PRODUCTION_QUEUED" ? "AMBIL & MULAI" : "MULAI PRODUKSI"}
        </button>
        <FileButton url={job.fileUrl} name={job.fileName} />
        <DropdownMenu
          label={`Aksi lain untuk ${job.jobCode}`}
          trigger={<MoreVertical className="h-4 w-4" />}
          triggerClassName="h-11 w-11 flex items-center justify-center rounded-xl border border-border bg-card"
        >
          <DropdownMenuItem danger icon={<FileWarning className="h-4 w-4" />} onSelect={onBounce}>
            Lapor file bermasalah
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ActiveCard({
  job, busy, onPause, onResume, onFinish,
}: {
  job: Job;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}) {
  const paused = job.status === "PRODUCTION_PAUSED";
  const dl = deadlineInfo(job.deadline);
  return (
    <div
      className={cn(
        "rounded-2xl border-2 bg-card p-4 shadow-sm",
        paused ? "border-status-yellow/40" : "border-status-blue/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <JobItems items={job.items} dense />
          <p className="mt-1 font-mono text-[11px] text-muted">
            {job.jobCode} · {job.machine}
            {dl && <span className={cn("ml-1.5 font-sans font-bold", TONE_CLS[dl.tone])}>· {dl.label}</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <StatusPill status={job.status} />
          <p className={cn("mt-1.5 flex items-center justify-end gap-1 text-xs font-semibold", paused ? "text-status-yellow-text" : "text-muted")}>
            <Clock className="h-3.5 w-3.5" /> {paused ? "dijeda" : fmtElapsed(job.startedAt)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        <FileButton url={job.fileUrl} name={job.fileName} />
        {paused ? (
          <button
            disabled={busy}
            onClick={onResume}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-status-blue/30 bg-status-blue/10 px-4 text-sm font-bold text-status-blue hover:bg-status-blue/20 disabled:opacity-40"
          >
            <Play className="h-4 w-4" /> Lanjutkan
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={onPause}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-elevated px-4 text-sm font-bold text-muted hover:text-primary disabled:opacity-40"
          >
            <Pause className="h-4 w-4" /> Jeda
          </button>
        )}
        <button
          onClick={onFinish}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-status-green text-sm font-black text-white transition-all hover:brightness-110"
        >
          <CheckCircle2 className="h-5 w-5" /> SELESAI
        </button>
      </div>
    </div>
  );
}

const USAGE_UNIT: Record<string, string> = { METER: "m", LEMBAR: "lembar", ML: "ml", GRAM: "g", PCS: "pcs", LITER: "L", KG: "kg" };
function usageUnit(m: MaterialOpt | undefined): string {
  if (!m) return "";
  return USAGE_UNIT[m.unitUsage] ?? m.unitCustom ?? m.unitUsage.toLowerCase();
}

type MatRow = { key: number; materialId: string; usageQty: string; wasteQty: string; wasteReason: string };
let rowSeq = 0;
const newRow = (materialId = ""): MatRow => ({ key: ++rowSeq, materialId, usageQty: "", wasteQty: "", wasteReason: "" });

const fInp = "w-full h-11 rounded-xl bg-elevated border border-border text-primary text-sm px-3 outline-none focus:border-accent-teal";
const fLbl = "text-xs font-bold text-primary mb-1 block";
const fSection = "text-[11px] font-black uppercase tracking-wider text-muted";

function FinishForm({ job, materials, onDone }: { job: Job; materials: MaterialOpt[]; onDone: () => void }) {
  const [actualQty, setActualQty] = useState(String(job.plannedQty || ""));
  const [rows, setRows] = useState<MatRow[]>([newRow(job.suggestedMaterialId ?? "")]);
  const [showWaste, setShowWaste] = useState(false);
  const [rejectQty, setRejectQty] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectCustom, setRejectCustom] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setRow = (key: number, patch: Partial<MatRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const matById = (id: string) => materials.find((m) => m.id === id);

  const rejectN = Number(rejectQty) || 0;
  const rejectFinal = rejectReason === "Lainnya" ? rejectCustom.trim() : rejectReason;
  const filledRows = rows.filter((r) => r.materialId && Number(r.usageQty) > 0);

  const canSubmit =
    Number(actualQty) > 0 &&
    filledRows.length > 0 &&
    filledRows.every((r) => Number(r.wasteQty) <= 0 || !!r.wasteReason) &&
    (rejectN === 0 || !!rejectFinal);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await finishProduction(job.jobCode, {
      actualQty: Number(actualQty),
      wasteQty: rejectN > 0 ? rejectN : 0,
      wasteReason: rejectN > 0 ? rejectFinal : undefined,
      notes: notes.trim() || undefined,
      materials: filledRows.map((r) => ({
        materialId: r.materialId,
        usageQty: Number(r.usageQty),
        wasteQty: Number(r.wasteQty) > 0 ? Number(r.wasteQty) : undefined,
        wasteReason: Number(r.wasteQty) > 0 ? r.wasteReason : undefined,
      })),
    });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }

  return (
    <div className="space-y-5">
      {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

      {/* 1. Hasil */}
      <div className="space-y-2">
        <p className={fSection}>Hasil</p>
        <div>
          <label className={fLbl}>Jumlah jadi (pcs) *</label>
          <input type="number" inputMode="numeric" className={fInp} value={actualQty} onChange={(e) => setActualQty(e.target.value)} />
          <p className="mt-1 text-[11px] text-muted">Target: {job.plannedQty} pcs</p>
        </div>
      </div>

      {/* 2. Bahan */}
      <div className="space-y-2">
        <p className={fSection}>Bahan dipakai</p>
        {materials.length === 0 && (
          <p className="text-[11px] text-status-yellow-text">Belum ada master material — tambahkan di Katalog dulu.</p>
        )}
        {rows.map((r, i) => {
          const mat = matById(r.materialId);
          const unit = usageUnit(mat);
          return (
            <div key={r.key} className="rounded-xl border border-border bg-base p-3 space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
                <select className={fInp} value={r.materialId} onChange={(e) => setRow(r.key, { materialId: e.target.value })}>
                  <option value="">Pilih material…</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="relative">
                  <input
                    type="number" inputMode="decimal" placeholder="Pakai"
                    className={cn(fInp, unit && "pr-10")}
                    value={r.usageQty} onChange={(e) => setRow(r.key, { usageQty: e.target.value })}
                  />
                  {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted">{unit}</span>}
                </div>
              </div>
              {showWaste && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
                  <div className="relative">
                    <input
                      type="number" inputMode="decimal" placeholder="Sisa" min="0"
                      className={cn(fInp, unit && "pr-12")}
                      value={r.wasteQty} onChange={(e) => setRow(r.key, { wasteQty: e.target.value })}
                    />
                    {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted">{unit}</span>}
                  </div>
                  <select
                    className={cn(fInp, Number(r.wasteQty) > 0 && !r.wasteReason && "border-status-yellow")}
                    value={r.wasteReason} onChange={(e) => setRow(r.key, { wasteReason: e.target.value })}
                    disabled={!(Number(r.wasteQty) > 0)}
                  >
                    <option value="">Alasan sisa bahan…</option>
                    {OFFCUT_REASONS.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
              )}
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-[11px] font-bold text-status-red hover:underline">
                  Hapus bahan {i + 1}
                </button>
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => setRows((rs) => [...rs, newRow()])} className="text-[11px] font-bold text-accent-teal hover:underline">
          + Tambah bahan
        </button>
      </div>

      {/* 3. Gagal / sisa */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowWaste((v) => !v)}
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-muted hover:text-primary"
        >
          {showWaste ? "−" : "+"} Ada potong gagal / sisa bahan?
        </button>
        {showWaste && (
          <div className="rounded-xl border border-status-yellow/30 bg-status-yellow/5 p-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
              <div className="relative">
                <input
                  type="number" inputMode="numeric" min="0" placeholder="0"
                  className={cn(fInp, "pr-10")}
                  value={rejectQty} onChange={(e) => setRejectQty(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted">pcs</span>
              </div>
              <select
                className={cn(fInp, rejectN > 0 && !rejectReason && "border-status-yellow")}
                value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                disabled={rejectN === 0}
              >
                <option value="">Alasan potong gagal…</option>
                {REJECT_REASONS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            {rejectReason === "Lainnya" && (
              <input className={fInp} placeholder="Ketik alasan…" value={rejectCustom} onChange={(e) => setRejectCustom(e.target.value)} />
            )}
            <p className="text-[11px] text-muted">
              <b>Potong gagal</b> = hasil cetak tak terpakai. <b>Sisa bahan</b> (di tiap baris bahan) = leader/kalibrasi/offcut, bukan hasil cetak.
            </p>
          </div>
        )}
      </div>

      {/* 4. Catatan */}
      <div>
        <label className={fLbl}>Catatan <span className="font-normal text-muted">(opsional)</span></label>
        <textarea
          className="w-full min-h-[56px] rounded-xl bg-elevated border border-border text-primary text-sm p-3 outline-none focus:border-accent-teal resize-none"
          placeholder="Hal tak biasa: warna, bahan, gangguan…"
          value={notes} onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button
        disabled={!canSubmit || busy}
        onClick={submit}
        className="w-full h-12 rounded-xl bg-status-green text-white text-sm font-black hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="h-5 w-5" /> {busy ? "Menyimpan…" : "Selesai Produksi (SCAN 2)"}
      </button>
    </div>
  );
}

function CardSkeleton() {
  return <div className="h-40 rounded-2xl border border-border bg-elevated/40 animate-pulse" />;
}

export default function OperatorPage() {
  const [mine, setMine] = useState<Job[]>([]);
  const [claimable, setClaimable] = useState<Job[]>([]);
  const [hasMachines, setHasMachines] = useState(true); // default true biar ga flash
  const [materials, setMaterials] = useState<MaterialOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [finishFor, setFinishFor] = useState<string | null>(null);
  const [pausePromptFor, setPausePromptFor] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [bounceFor, setBounceFor] = useState<Job | null>(null);
  const [bounceReason, setBounceReason] = useState("");

  const load = useCallback(async () => {
    const res = await getOperatorJobs();
    setIsLoading(false);
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setMine(res.data.mine);
    setClaimable(res.data.queue);
    setHasMachines(res.data.hasMachines);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    getOrderFormData().then((r) => {
      if (r.success) {
        setMaterials(
          r.data.materials.map((m) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            unitUsage: (m as { unit_usage?: string }).unit_usage ?? "",
            unitCustom: (m as { unit_custom?: string | null }).unit_custom ?? null,
          }))
        );
      }
    });
  }, [load]);

  const pinned = mine.filter((j) => j.status === "PRODUCTION_ASSIGNED");
  const actives = mine.filter((j) => j.status === "PRODUCTION_STARTED" || j.status === "PRODUCTION_PAUSED");
  const queue = [...pinned, ...claimable];

  async function act(fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Aksi gagal."); return; }
    setFinishFor(null);
    await load();
  }

  const finishJob = actives.find((j) => j.jobCode === finishFor) ?? null;

  return (
    <div className="space-y-5">
      {/* Header ringkas + Scan selalu terjangkau */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Mesin Produksi</h1>
          <p className="mt-0.5 text-sm text-muted">
            {actives.length} job jalan · {queue.length} antrian
          </p>
        </div>
        <a
          href="/scan"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent-teal px-5 text-sm font-bold text-white hover:brightness-110 transition-all"
        >
          <ScanLine className="h-5 w-5" /> Scan QR Job
        </a>
      </div>

      {!hasMachines && (
        <div className="bg-status-red/10 border border-status-red/30 p-5 rounded-2xl flex items-start gap-4">
          <ShieldAlert className="h-6 w-6 text-status-red shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-status-red">Anda belum punya akses mesin</h3>
            <p className="text-sm text-status-red mt-1">
              Belum ditugaskan ke mesin cetak apa pun, jadi antrian job tidak akan muncul.
              Hubungi Owner untuk mengatur penugasan mesin lewat Manajemen Pegawai.
            </p>
          </div>
        </div>
      )}

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Antrian */}
        <div className="flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Timer className="h-5 w-5 text-status-yellow-text" />
            <h2 className="text-base font-bold text-primary">Antrian Masuk</h2>
            <span className="rounded-full bg-status-yellow px-2 py-0.5 text-xs font-black text-primary">{queue.length}</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {isLoading ? (
              <><CardSkeleton /><CardSkeleton /></>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center p-10 text-center text-sm text-muted">
                <Timer className="mb-2 h-9 w-9 opacity-20" /> Tidak ada job di antrian.
              </div>
            ) : (
              queue.map((j) => (
                <QueueCard
                  key={j.jobCode}
                  job={j}
                  busy={busy}
                  onStart={() => act(() => startProduction(j.jobCode))}
                  onBounce={() => { setBounceReason(""); setBounceFor(j); }}
                />
              ))
            )}
          </div>
        </div>

        {/* Job aktif */}
        <div className="space-y-4 lg:col-span-2">
          {isLoading ? (
            <CardSkeleton />
          ) : actives.length > 0 ? (
            actives.map((job) => (
              <ActiveCard
                key={job.jobCode}
                job={job}
                busy={busy}
                onPause={() => { setPauseReason(""); setPausePromptFor(job.jobCode); }}
                onResume={() => act(() => resumeProduction(job.jobCode))}
                onFinish={() => setFinishFor(job.jobCode)}
              />
            ))
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-border bg-elevated">
                <Layers className="h-8 w-8 text-muted/50" />
              </div>
              <h2 className="mb-1 text-lg font-bold text-primary">Belum ada job berjalan</h2>
              <p className="max-w-sm text-sm text-muted">
                Ambil job dari <strong className="text-accent-teal">Antrian Masuk</strong>. Boleh menjalankan beberapa job sekaligus.
              </p>
            </div>
          )}
        </div>
      </div>

      <RoleGuide role="operator" defaultCollapsed />

      <AbsenCard />

      {/* Modal: Selesai Produksi */}
      <Modal
        open={!!finishJob}
        onClose={() => setFinishFor(null)}
        title="Selesai Produksi (SCAN 2)"
        description={finishJob ? `${finishJob.jobCode} · ${finishJob.orderCode}` : undefined}
        size="md"
      >
        {finishJob && (
          <FinishForm
            job={finishJob}
            materials={materials}
            onDone={() => act(async () => ({ success: true }))}
          />
        )}
      </Modal>

      {/* Modal: Jeda Produksi */}
      <Modal
        open={!!pausePromptFor}
        onClose={() => setPausePromptFor(null)}
        title="Jeda Produksi"
        description={pausePromptFor ?? undefined}
        size="sm"
        footer={
          <div className="flex w-full gap-2">
            <button
              onClick={() => setPausePromptFor(null)}
              className="flex-1 h-10 rounded-xl bg-elevated border border-border text-sm font-bold text-muted hover:text-primary"
            >
              Batal
            </button>
            <button
              disabled={busy || pauseReason.trim().length < 5}
              onClick={() => {
                const reason = pauseReason.trim();
                const code = pausePromptFor!;
                setPausePromptFor(null);
                act(() => pauseProduction(code, reason));
              }}
              className="flex-1 h-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
            >
              Jeda
            </button>
          </div>
        }
      >
        <label className="text-xs text-muted font-medium mb-1 block">Alasan jeda (min. 5 karakter)</label>
        <textarea
          value={pauseReason}
          onChange={(e) => setPauseReason(e.target.value)}
          autoFocus
          placeholder="mis. mesin macet / nunggu bahan / listrik padam"
          className="w-full min-h-[80px] rounded-xl bg-elevated border border-border text-sm text-primary p-3 outline-none focus:border-accent-teal resize-none"
        />
      </Modal>

      {/* Modal: Lapor File Bermasalah */}
      <Modal
        open={!!bounceFor}
        onClose={() => setBounceFor(null)}
        title="Lapor File Bermasalah"
        description={bounceFor ? `${bounceFor.jobCode} · ${bounceFor.orderCode}` : undefined}
        size="sm"
        footer={
          <div className="flex w-full gap-2">
            <button
              onClick={() => setBounceFor(null)}
              className="flex-1 h-10 rounded-xl bg-elevated border border-border text-sm font-bold text-muted hover:text-primary"
            >
              Batal
            </button>
            <button
              disabled={busy || bounceReason.trim().length < 10}
              onClick={() => {
                const code = bounceFor!.jobCode;
                const reason = bounceReason.trim();
                setBounceFor(null);
                act(() => bounceDesignFromProduction(code, { reason }));
              }}
              className="flex-1 h-10 rounded-xl bg-status-red text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
            >
              Kembalikan ke Desainer
            </button>
          </div>
        }
      >
        <p className="mb-2 text-[11px] text-muted">
          Order kembali ke antrean desainer untuk revisi. Job produksi ini dibatalkan.
          Hanya untuk file yang <b>belum</b> mulai dicetak.
        </p>
        <label className="text-xs text-muted font-medium mb-1 block">Masalahnya apa? (min. 10 karakter)</label>
        <textarea
          value={bounceReason}
          onChange={(e) => setBounceReason(e.target.value)}
          autoFocus
          placeholder="mis. resolusi file pecah / ukuran tidak sesuai / warna beda dari brief"
          className="w-full min-h-[90px] rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-status-red resize-none"
        />
      </Modal>
    </div>
  );
}
