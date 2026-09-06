"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Wrench, CheckCircle2, Tag, ScanLine, QrCode } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getGudangQueues } from "@/actions/queries";
import { startFinishing, finishFinishing } from "@/actions/production";

type Row = {
  jobCode: string;
  orderCode: string;
  customerName: string;
  status: string;
  plannedQty: number;
  actualQty: number;
  deadline: string | Date | null;
};

const fmtDeadline = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—";

function LabelButton({ jobCode, className }: { jobCode: string; className?: string }) {
  return (
    <button
      onClick={() => window.open(`/print/label/${encodeURIComponent(jobCode)}`, "_blank", "noopener")}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-elevated border border-border text-xs font-bold text-muted hover:text-primary hover:border-accent-teal transition-all cursor-pointer",
        className
      )}
    >
      <QrCode className="h-3.5 w-3.5" /> Cetak Label
    </button>
  );
}

export function FinishingTab() {
  const [queue, setQueue] = useState<Row[]>([]);
  const [active, setActive] = useState<Row | null>(null);
  const [storageReady, setStorageReady] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDoneForm, setShowDoneForm] = useState(false);
  const [qty, setQty] = useState("");

  const load = useCallback(async () => {
    const res = await getGudangQueues();
    if (!res.success) { setError(res.error); return; }
    setError(null);
    const fq = res.data.finishingQueue;
    setQueue(fq.filter((j) => j.status === "QC_PASSED"));
    setActive(fq.find((j) => j.status === "FINISHING_STARTED") ?? null);
    setStorageReady(res.data.storageQueue);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function begin(jobCode: string) {
    setBusy(true);
    const res = await startFinishing(jobCode);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    await load();
  }

  async function complete() {
    if (!active) return;
    setBusy(true);
    const res = await finishFinishing(active.jobCode, { actualQty: Number(qty) });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setShowDoneForm(false);
    setQty("");
    await load();
  }

  const kpi = [
    { label: "Menunggu Finishing", value: queue.length, color: "text-status-yellow-text", bg: "bg-status-yellow/10", icon: Package },
    { label: "Sedang Dikerjakan", value: active ? 1 : 0, color: "text-accent-teal", bg: "bg-accent-teal/10", icon: Wrench },
    { label: "Siap Simpan ke Rak", value: storageReady.length, color: "text-status-green", bg: "bg-status-green/10", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Produk cetak yang lolos QC dan siap proses finishing (mata itik, laminasi, potong, dll).</p>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {kpi.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className={cn("inline-flex p-2 rounded-xl mb-3", k.bg)}>
              <k.icon className={cn("h-5 w-5", k.color)} />
            </div>
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {active ? (
        <div className="bg-gradient-to-br from-accent-teal/10 to-accent-teal/5 border border-accent-teal/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-accent-teal animate-pulse" />
            <span className="text-xs font-semibold text-accent-teal uppercase tracking-wide">Finishing Berjalan</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-primary text-lg">{active.jobCode}</p>
              <p className="text-sm text-muted mb-4">{active.orderCode} · {active.customerName} · Planned {active.plannedQty} pcs</p>
            </div>
            <LabelButton jobCode={active.jobCode} />
          </div>
          {!showDoneForm ? (
            <button
              onClick={() => { setQty(String(active.plannedQty || "")); setShowDoneForm(true); }}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-accent-teal to-accent-teal/70 text-white text-base font-bold hover:brightness-110 transition-all cursor-pointer"
            >
              🔧 SELESAI FINISHING
            </button>
          ) : (
            <div className="space-y-3">
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Qty aktual finishing..."
                className="w-full h-12 rounded-xl bg-card border border-border text-primary text-lg font-bold px-4 outline-none focus:border-accent-teal transition-all"
              />
              <button
                disabled={!qty || busy}
                onClick={complete}
                className="w-full h-12 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
              >
                Selesai Finishing (SCAN 5)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-8 text-center">
          <p className="text-muted">Tidak ada job finishing aktif saat ini.</p>
        </div>
      )}

      <a
        href="/scan"
        className="w-full h-14 rounded-xl bg-elevated border-2 border-dashed border-accent-teal/40 text-accent-teal font-semibold flex items-center justify-center gap-2 hover:bg-accent-teal/10 transition-all cursor-pointer"
      >
        <ScanLine className="h-5 w-5" /> SCAN QR untuk mulai / simpan job
      </a>

      {storageReady.length > 0 && (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-border">
            <CheckCircle2 className="h-5 w-5 text-status-green" />
            <h2 className="text-base font-semibold text-primary">Siap Simpan ke Rak</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-green/10 text-status-green border border-status-green/30">
              {storageReady.length} Item
            </span>
          </div>
          <div className="divide-y divide-border/50">
            {storageReady.map((j) => (
              <div key={j.jobCode} className="flex items-center gap-4 p-4 hover:bg-elevated/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-accent-teal">{j.jobCode}</span>
                    <StatusPill status={j.status} />
                  </div>
                  <p className="font-bold text-primary text-base mb-0.5">{j.orderCode} · {j.customerName}</p>
                  <span className="inline-flex items-center gap-1.5 bg-elevated px-2 py-1 rounded-md text-primary text-xs font-medium border border-border">
                    <Tag className="h-3.5 w-3.5 text-accent-teal" /> {j.actualQty || j.plannedQty} pcs
                  </span>
                </div>
                <LabelButton jobCode={j.jobCode} />
                <a
                  href="/scan"
                  className="shrink-0 h-10 px-4 rounded-xl bg-accent-teal/20 border border-accent-teal/40 text-accent-teal text-xs font-bold hover:bg-accent-teal/30 transition-all cursor-pointer inline-flex items-center"
                >
                  Simpan
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <Wrench className="h-5 w-5 text-status-yellow-text" />
          <h2 className="text-base font-semibold text-primary">Antrian Finishing</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow-text border border-status-yellow/30">
            {queue.length} Item
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {queue.length === 0 && <p className="p-6 text-center text-sm text-muted">Antrian kosong.</p>}
          {queue.map((j) => (
            <div key={j.jobCode} className="flex items-center gap-4 p-4 hover:bg-elevated/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-accent-teal">{j.jobCode}</span>
                  <StatusPill status={j.status} />
                </div>
                <p className="font-bold text-primary text-base mb-0.5">{j.orderCode} · {j.customerName}</p>
                <span className="inline-flex items-center gap-1.5 bg-elevated px-2 py-1 rounded-md text-primary text-xs font-medium border border-border">
                  <Tag className="h-3.5 w-3.5 text-accent-teal" /> {j.plannedQty} pcs
                </span>
              </div>
              <div className="text-right shrink-0 text-xs hidden sm:block">
                <p className="text-muted mb-1">Deadline:</p>
                <p className="font-bold text-status-red">{fmtDeadline(j.deadline)}</p>
              </div>
              <LabelButton jobCode={j.jobCode} />
              <button
                disabled={busy}
                onClick={() => begin(j.jobCode)}
                className="shrink-0 h-10 px-4 rounded-xl bg-accent-teal/20 border border-accent-teal/40 text-accent-teal text-xs font-bold hover:bg-accent-teal/30 transition-all cursor-pointer disabled:opacity-50"
              >
                Mulai
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
