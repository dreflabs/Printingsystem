"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, ClipboardList, ScanLine, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGudangQueues } from "@/actions/queries";
import { submitQC } from "@/actions/production";

const CHECKLIST_ITEMS = [
  { id: "qty", label: "Jumlah (Quantity vs Planned)" },
  { id: "size", label: "Ukuran (Size sesuai order)" },
  { id: "color", label: "Warna (Color accuracy)" },
  { id: "print", label: "Kualitas cetak (bintik, blur, stripe)" },
  { id: "defect", label: "Defect fisik (sobek, kotor, lipatan)" },
  { id: "finishing", label: "Finishing (laminasi, cutting, welding sesuai order)" },
];

type CheckResult = "OK" | "MINOR" | "MAJOR";
type QCJob = {
  jobCode: string;
  orderCode: string;
  customerName: string;
  status: string;
  plannedQty: number;
  deadline: string | Date | null;
};

const fmtDeadline = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—";

function QCInspectionModal({ job, onClose, onDone }: { job: QCJob; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"checklist" | "fail_detail">("checklist");
  const [checklist, setChecklist] = useState<Record<string, CheckResult>>({});
  const [failCategory, setFailCategory] = useState("");
  const [failDesc, setFailDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setCheck = (id: string, val: CheckResult) => setChecklist((p) => ({ ...p, [id]: val }));
  const hasMajor = Object.values(checklist).includes("MAJOR");
  const allChecked = CHECKLIST_ITEMS.every((i) => checklist[i.id]);

  async function submit(result: "PASS" | "FAIL") {
    setBusy(true);
    setErr(null);
    const res = await submitQC(job.jobCode, {
      result,
      checklist,
      notes: result === "FAIL" ? failDesc : notes || undefined,
      category: result === "FAIL" ? failCategory : undefined,
    });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-[0_8px_56px_rgba(0,0,0,0.6)] flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-border shrink-0">
          <h3 className="text-base font-bold text-primary">Form Inspeksi QC</h3>
          <p className="text-xs text-muted font-mono">{job.jobCode} · {job.orderCode} · {job.plannedQty} pcs</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

          {step === "checklist" && (
            <div className="space-y-3">
              <p className="text-xs text-muted font-medium">Nilai setiap item inspeksi:</p>
              {CHECKLIST_ITEMS.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-elevated border border-border">
                  <p className="text-xs font-semibold text-primary mb-2">{item.label}</p>
                  <div className="flex gap-2">
                    {(["OK", "MINOR", "MAJOR"] as CheckResult[]).map((val) => (
                      <button
                        key={val}
                        onClick={() => setCheck(item.id, val)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border",
                          checklist[item.id] === val
                            ? val === "OK" ? "bg-status-green text-white border-status-green"
                              : val === "MINOR" ? "bg-status-yellow text-primary border-status-yellow"
                              : "bg-status-red text-white border-status-red"
                            : "bg-elevated/50 text-muted border-border hover:text-primary"
                        )}
                      >
                        {val === "OK" ? "✅ OK" : val === "MINOR" ? "⚠️ Minor" : "❌ Mayor"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Catatan tambahan (opsional untuk PASS)"
                className="w-full rounded-xl bg-elevated border border-border text-sm text-primary p-3 outline-none focus:border-accent-teal resize-none"
              />
            </div>
          )}

          {step === "fail_detail" && (
            <div className="space-y-4">
              <div className="p-3 bg-status-red/10 border border-status-red/30 rounded-xl text-xs text-status-red font-semibold">
                Anda memilih FAIL. Lengkapi detail temuan.
              </div>
              <div>
                <label className="text-xs text-muted font-medium mb-1 block">Kategori Masalah *</label>
                <select
                  value={failCategory}
                  onChange={(e) => setFailCategory(e.target.value)}
                  className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-status-red"
                >
                  <option value="">Pilih kategori...</option>
                  <option>Defect Fisik (Sobek / Kotor)</option>
                  <option>Kualitas Cetak (Blur / Bintik)</option>
                  <option>Warna Tidak Sesuai</option>
                  <option>Ukuran Salah</option>
                  <option>Finishing Kurang Rapi</option>
                  <option>Jumlah Kurang</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted font-medium mb-1 block">
                  Deskripsi Defect * <span className="text-muted">(min. 20 karakter — {failDesc.length}/20)</span>
                </label>
                <textarea
                  value={failDesc}
                  onChange={(e) => setFailDesc(e.target.value)}
                  rows={3}
                  placeholder="Jelaskan temuan defect secara detail..."
                  className="w-full rounded-xl bg-elevated border border-border text-sm text-primary p-3 outline-none focus:border-status-red resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-border shrink-0">
          <button onClick={step === "fail_detail" ? () => setStep("checklist") : onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary">
            {step === "fail_detail" ? "Kembali" : "Batal"}
          </button>
          {step === "checklist" ? (
            <>
              <button
                onClick={() => setStep("fail_detail")}
                disabled={!allChecked || busy}
                className="flex-1 h-11 rounded-xl bg-status-red/10 text-status-red text-sm font-bold hover:bg-status-red/20 transition-all disabled:opacity-40"
              >
                <XCircle className="h-4 w-4 inline mr-1" /> FAIL
              </button>
              <button
                onClick={() => submit("PASS")}
                disabled={!allChecked || hasMajor || busy}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-status-green to-status-green/75 text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-40"
              >
                <CheckCircle2 className="h-4 w-4 inline mr-1" /> PASS
              </button>
            </>
          ) : (
            <button
              onClick={() => submit("FAIL")}
              disabled={!failCategory || failDesc.length < 20 || busy}
              className="flex-1 h-11 rounded-xl bg-status-red text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-40"
            >
              Submit FAIL & Catat Defect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function QCTab() {
  const [queue, setQueue] = useState<QCJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [qcFor, setQcFor] = useState<QCJob | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");

  const load = useCallback(async () => {
    const res = await getGudangQueues();
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setQueue(res.data.qcQueue);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const kpi = [
    { label: "Menunggu Inspeksi", value: queue.length, color: "text-status-yellow-text" },
    { label: "Antrian Finishing (next)", value: "—", color: "text-status-blue" },
  ];

  return (
    <div className="space-y-6">
      {qcFor && (
        <QCInspectionModal
          job={qcFor}
          onClose={() => setQcFor(null)}
          onDone={() => { setQcFor(null); load(); }}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Inspeksi kualitas cetak — checklist PASS / FAIL per job (SCAN 3)</p>
        <a href="/scan" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-teal to-accent-teal/70 text-white text-sm font-semibold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all">
          <ScanLine className="h-4 w-4" /> Scan Cepat
        </a>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        {kpi.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-sm">
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1 font-medium">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 bg-elevated p-1 rounded-xl border border-border w-fit">
        <button
          onClick={() => setActiveTab("queue")}
          className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
            activeTab === "queue" ? "bg-accent-teal text-white shadow-sm" : "text-muted hover:text-primary")}
        >
          <ClipboardList className="h-4 w-4" /> Antrian QC
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono", activeTab === "queue" ? "bg-white/20" : "bg-elevated")}>{queue.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5",
            activeTab === "history" ? "bg-accent-teal text-white shadow-sm" : "text-muted hover:text-primary")}
        >
          <History className="h-4 w-4" /> Riwayat
        </button>
      </div>

      {activeTab === "queue" && (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-border">
            <ClipboardList className="h-5 w-5 text-status-yellow-text" />
            <h2 className="text-base font-semibold text-primary">Antrian Job PRODUCTION_COMPLETE</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow-text border border-status-yellow/30">{queue.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated border-b border-border text-muted font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Kode Job</th>
                  <th className="px-4 py-3">Kode Order</th>
                  <th className="px-4 py-3">Konsumen</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {queue.map((j) => (
                  <tr key={j.jobCode} className="hover:bg-elevated/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-accent-teal font-bold">{j.jobCode}</td>
                    <td className="px-4 py-3 font-mono text-muted">{j.orderCode}</td>
                    <td className="px-4 py-3 text-primary">{j.customerName}</td>
                    <td className="px-4 py-3 text-muted">{j.plannedQty} pcs</td>
                    <td className="px-4 py-3 font-mono text-muted">{fmtDeadline(j.deadline)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setQcFor(j)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-accent-teal to-accent-teal/70 text-white font-bold hover:brightness-110 transition-all flex items-center gap-1.5 ml-auto"
                      >
                        <ScanLine className="h-3.5 w-3.5" /> Mulai Inspeksi
                      </button>
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted">Tidak ada antrian QC saat ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm p-8 text-center text-sm text-muted">
          Riwayat inspeksi lengkap tersedia di menu Laporan / audit-logs.
        </div>
      )}
    </div>
  );
}
