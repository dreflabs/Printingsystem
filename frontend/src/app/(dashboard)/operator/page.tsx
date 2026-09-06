"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings2, ScanLine, CheckCircle2, AlertCircle, Timer, Layers, Pause, Play } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getOperatorJobs } from "@/actions/queries";
import { getOrderFormData } from "@/actions/orders";
import { startProduction, pauseProduction, resumeProduction, finishProduction } from "@/actions/production";

type Job = {
  jobCode: string;
  orderCode: string;
  customerName: string;
  machine: string;
  status: string;
  plannedQty: number;
  actualQty: number;
  deadline: string | Date | null;
  startedAt: string | Date | null;
};
type MaterialOpt = { id: string; name: string };

const WASTE_REASONS = [
  "Tinta blobor / kotor",
  "Bahan mampet / nyangkut",
  "Salah setting warna / margin",
  "Mesin error / mati listrik",
  "Lainnya",
];

const fmtDeadline = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—";

function FinishForm({ job, materials, onDone }: { job: Job; materials: MaterialOpt[]; onDone: () => void }) {
  const [actualQty, setActualQty] = useState(String(job.plannedQty || ""));
  const [waste, setWaste] = useState("");
  const [wasteReason, setWasteReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [usageQty, setUsageQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wasteN = Number(waste) || 0;
  const finalReason = wasteReason === "Lainnya" ? customReason : wasteReason;
  const canSubmit = Number(actualQty) > 0 && !!materialId && Number(usageQty) > 0 && (wasteN === 0 || !!finalReason);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await finishProduction(job.jobCode, {
      actualQty: Number(actualQty),
      wasteQty: wasteN,
      wasteReason: finalReason || undefined,
      materials: [{ materialId, usageQty: Number(usageQty) }],
    });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }

  const inp = "w-full h-11 rounded-xl bg-elevated border border-border text-primary text-sm px-4 outline-none focus:border-accent-teal";

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-border bg-base p-4">
      {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
      <div>
        <label className="text-xs font-bold text-primary mb-1 block">Actual Qty *</label>
        <input type="number" className={inp} value={actualQty} onChange={(e) => setActualQty(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-primary mb-1 block">Material Dipakai *</label>
          <select className={inp} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Pilih…</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-primary mb-1 block">Jumlah Pemakaian *</label>
          <input type="number" className={inp} value={usageQty} onChange={(e) => setUsageQty(e.target.value)} />
        </div>
      </div>
      {materials.length === 0 && <p className="text-[11px] text-status-yellow-text">Belum ada master material — tambahkan di Katalog dulu.</p>}
      <div>
        <label className="text-xs font-bold text-status-yellow-text mb-1 block">Jumlah Gagal / Waste</label>
        <input type="number" min="0" className={inp} value={waste} onChange={(e) => setWaste(e.target.value)} placeholder="0" />
      </div>
      {wasteN > 0 && (
        <div className="p-3 bg-status-yellow/10 border border-status-yellow/30 rounded-xl space-y-2">
          <select className={inp} value={wasteReason} onChange={(e) => setWasteReason(e.target.value)}>
            <option value="">-- Pilih alasan waste --</option>
            {WASTE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {wasteReason === "Lainnya" && (
            <input className={inp} value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Ketik alasan…" />
          )}
        </div>
      )}
      <button
        disabled={!canSubmit || busy}
        onClick={submit}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-status-green to-status-green/75 text-white text-sm font-black hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="h-5 w-5" /> Selesai Produksi (SCAN 2)
      </button>
    </div>
  );
}

export default function OperatorPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [materials, setMaterials] = useState<MaterialOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [pausePrompt, setPausePrompt] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  const load = useCallback(async () => {
    const res = await getOperatorJobs();
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setJobs(res.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    getOrderFormData().then((r) => { if (r.success) setMaterials(r.data.materials); });
  }, [load]);

  const queue = jobs.filter((j) => j.status === "PRODUCTION_ASSIGNED");
  const active = jobs.find((j) => j.status === "PRODUCTION_STARTED" || j.status === "PRODUCTION_PAUSED") ?? null;

  async function act(fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Aksi gagal."); return; }
    setShowFinish(false);
    await load();
  }

  const kpi = [
    { label: "Job Aktif", value: active ? 1 : 0, color: "text-status-blue", bg: "bg-status-blue/10", icon: Layers },
    { label: "Sisa Antrian", value: queue.length, color: "text-status-yellow-text", bg: "bg-status-yellow/10", icon: Timer },
    { label: "Status Mesin", value: active ? (active.status === "PRODUCTION_PAUSED" ? "Jeda" : "Jalan") : "Idle", color: "text-status-green", bg: "bg-status-green/10", icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Mesin Produksi</h1>
        <p className="text-sm text-muted mt-0.5">Antrian job cetak yang di-assign ke Anda</p>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {kpi.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className={cn("inline-flex p-3 rounded-xl", k.bg)}><k.icon className={cn("h-6 w-6", k.color)} /></div>
            <div>
              <p className={cn("text-2xl font-bold", k.color)}>{k.value}</p>
              <p className="text-xs text-muted font-medium">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Antrian */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-3xl shadow-sm flex flex-col max-h-[800px] overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Timer className="h-5 w-5 text-status-yellow-text" />
            <h2 className="text-lg font-bold text-primary">Antrian Masuk</h2>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-status-yellow text-primary">{queue.length}</span>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {queue.length === 0 && (
              <div className="p-8 text-center text-muted text-sm flex flex-col items-center">
                <Timer className="h-10 w-10 opacity-20 mb-2" /> Tidak ada antrian.
              </div>
            )}
            {queue.map((j) => (
              <div key={j.jobCode} className="bg-base border border-border/50 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">{j.customerName}</p>
                <p className="font-mono text-xs text-accent-teal mb-1">{j.jobCode} · {j.orderCode}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted">{j.machine} · deadline {fmtDeadline(j.deadline)}</p>
                  <p className="text-lg font-black text-primary">{j.plannedQty}<span className="text-[10px] font-medium text-muted"> pcs</span></p>
                </div>
                <button
                  disabled={busy || !!active}
                  onClick={() => act(() => startProduction(j.jobCode))}
                  className="mt-3 w-full h-10 rounded-xl bg-accent-teal text-white text-xs font-black hover:brightness-110 disabled:opacity-40 transition-all"
                >
                  {active ? "Selesaikan job aktif dulu" : "MULAI PRODUKSI (SCAN 1)"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Job aktif */}
        <div className="lg:col-span-2 space-y-6">
          {active ? (
            <div className="bg-card border-2 border-status-blue/30 rounded-3xl overflow-hidden shadow-lg shadow-status-blue/5">
              <div className="bg-status-blue/10 px-6 py-4 border-b border-status-blue/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    {active.status === "PRODUCTION_STARTED" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-blue opacity-75" />}
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-status-blue" />
                  </span>
                  <span className="font-bold text-status-blue tracking-wide uppercase text-sm">Job Aktif</span>
                  <StatusPill status={active.status} />
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-base text-xs font-bold text-primary border border-border">{active.machine}</span>
              </div>

              <div className="p-6">
                <div className="bg-base border border-border rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-bold text-status-blue uppercase tracking-wider mb-0.5">{active.customerName}</p>
                  <p className="font-mono text-sm text-primary">{active.jobCode} · {active.orderCode}</p>
                  <p className="text-2xl font-black text-primary mt-2">{active.plannedQty} <span className="text-sm">pcs target</span></p>
                </div>

                <div className="flex gap-3">
                  {active.status === "PRODUCTION_STARTED" ? (
                    <button
                      disabled={busy}
                      onClick={() => { setPauseReason(""); setPausePrompt(true); }}
                      className="h-12 px-5 rounded-xl bg-elevated border border-border text-sm font-bold text-muted hover:text-primary flex items-center gap-2 disabled:opacity-40"
                    >
                      <Pause className="h-4 w-4" /> Jeda
                    </button>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => act(() => resumeProduction(active.jobCode))}
                      className="h-12 px-5 rounded-xl bg-status-blue/10 border border-status-blue/30 text-sm font-bold text-status-blue hover:bg-status-blue/20 flex items-center gap-2 disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" /> Lanjutkan
                    </button>
                  )}
                  <button
                    onClick={() => setShowFinish((v) => !v)}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-status-green to-status-green/75 text-white text-sm font-black hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-5 w-5" /> {showFinish ? "Tutup Form" : "SELESAI PRODUKSI"}
                  </button>
                </div>

                {showFinish && <FinishForm job={active} materials={materials} onDone={() => act(async () => ({ success: true }))} />}
              </div>
            </div>
          ) : (
            <div className="bg-card/70 backdrop-blur-xl border border-border rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[360px]">
              <div className="w-20 h-20 bg-elevated rounded-full flex items-center justify-center mb-4 border border-dashed border-border">
                <Layers className="h-10 w-10 text-muted/50" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-2">Mesin Idle</h2>
              <p className="text-muted max-w-sm">Pilih job dari antrian di kiri lalu klik <strong className="text-accent-teal">Mulai Produksi</strong>. Anda hanya bisa punya 1 job aktif.</p>
            </div>
          )}

          <a
            href="/scan"
            className="w-full h-14 rounded-2xl bg-elevated border-2 border-dashed border-accent-teal/40 text-accent-teal font-bold flex items-center justify-center gap-3 hover:bg-accent-teal/10 transition-all"
          >
            <ScanLine className="h-5 w-5" /> Scan QR Job
          </a>

          {jobs.length === 0 && !error && (
            <p className="text-center text-xs text-muted flex items-center justify-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Belum ada job yang di-assign ke akun Anda.
            </p>
          )}
        </div>
      </div>

      {pausePrompt && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={() => setPausePrompt(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] space-y-4">
            <div>
              <h3 className="text-base font-bold text-primary">Jeda Produksi</h3>
              <p className="text-xs text-muted font-mono">{active.jobCode}</p>
            </div>
            <div>
              <label className="text-xs text-muted font-medium mb-1 block">Alasan jeda</label>
              <textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                autoFocus
                className="w-full min-h-[80px] rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPausePrompt(false)}
                className="flex-1 h-10 rounded-xl bg-elevated border border-border text-sm font-bold text-muted hover:text-primary"
              >
                Batal
              </button>
              <button
                disabled={busy || !pauseReason.trim()}
                onClick={() => {
                  const reason = pauseReason.trim();
                  const code = active.jobCode;
                  setPausePrompt(false);
                  act(() => pauseProduction(code, reason));
                }}
                className="flex-1 h-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
              >
                Jeda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
