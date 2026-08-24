"use client";

import { useState } from "react";
import { Search, CheckCircle2, XCircle, ClipboardList, Camera, ScanLine, AlertTriangle, History, Filter } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { PINModal } from "@/components/ui/PINModal";
import { QRScanner } from "@/components/ui/QRScanner";
import { useWorkflowStore, Job } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

// QC Checklist items sesuai dokumen GUDANG-DASHBOARD.md
const CHECKLIST_ITEMS = [
  { id: "qty", label: "Jumlah (Quantity vs Planned)" },
  { id: "size", label: "Ukuran (Size sesuai order)" },
  { id: "color", label: "Warna (Color accuracy)" },
  { id: "print", label: "Kualitas cetak (bintik, blur, stripe)" },
  { id: "defect", label: "Defect fisik (sobek, kotor, lipatan)" },
  { id: "finishing", label: "Finishing (laminasi, cutting, welding sesuai order)" },
];

type CheckResult = "OK" | "MINOR" | "MAJOR";
type ChecklistState = Record<string, CheckResult>;

// Riwayat inspeksi (mock data)
const QC_HISTORY = [
  { jobId: "JOB-004", date: "2026-08-22 15:00", result: "PASS", category: "-", rework: 0, followUp: "Selesai" },
  { jobId: "JOB-003", date: "2026-08-21 14:00", result: "FAIL", category: "Defect Fisik", rework: 1, followUp: "Rework Disetujui" },
  { jobId: "JOB-002", date: "2026-08-20 10:30", result: "PASS", category: "-", rework: 0, followUp: "Selesai" },
];

function QCInspectionModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore((s) => s.updateOrderStatus);
  const orders = useWorkflowStore((s) => s.orders);
  const order = orders.find((o) => o.id === job.orderId);

  const [step, setStep] = useState<"scan" | "checklist" | "fail_detail" | "done">("scan");
  const [scanned, setScanned] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const [failCategory, setFailCategory] = useState("");
  const [failDesc, setFailDesc] = useState("");
  const [failRecommendation, setFailRecommendation] = useState<"rework" | "reprint" | "escalate" | "">("");
  const [physW, setPhysW] = useState("");
  const [physH, setPhysH] = useState("");

  const setCheck = (id: string, val: CheckResult) =>
    setChecklist((prev) => ({ ...prev, [id]: val }));

  const hasMajor = Object.values(checklist).includes("MAJOR");
  const hasMinor = Object.values(checklist).includes("MINOR");
  const allChecked = CHECKLIST_ITEMS.every((item) => checklist[item.id]);

  const handlePass = () => {
    updateJobStatus(job.id, "QC_PASSED");
    updateOrderStatus(job.orderId, "QC_PASSED");
    setStep("done");
  };

  const handleFail = () => {
    if (!failDesc || failDesc.length < 20 || !failRecommendation) return;
    updateJobStatus(job.id, "QC_FAILED");
    updateOrderStatus(job.orderId, "QC_FAILED");
    setStep("done");
  };

  const handleSizeCheck = () => {
    const sw = job.width || 0;
    const sh = job.height || 0;
    const pw = parseFloat(physW) || 0;
    const ph = parseFloat(physH) || 0;
    if (sw > 0 && sh > 0 && (pw > sw + 2 || ph > sh + 2)) {
      setShowPin(true);
      return;
    }
    setStep("checklist");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <PINModal
        open={showPin}
        onClose={() => setShowPin(false)}
        onSuccess={() => { setShowPin(false); setStep("checklist"); }}
        title="Indikasi Fraud Terdeteksi"
        description="Ukuran fisik melebihi ukuran di sistem. Butuh PIN Admin."
      />
      {showScanner && (
        <QRScanner
          onClose={() => setShowScanner(false)}
          onScan={(data) => {
            if (data === job.id) {
              setScanned(true);
              setShowScanner(false);
            } else {
              alert("QR Code tidak cocok!");
            }
          }}
        />
      )}

      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-[0_8px_56px_rgba(0,0,0,0.6)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h3 className="text-base font-bold text-primary">Form Inspeksi QC</h3>
            <p className="text-xs text-muted font-mono">{job.id} · {job.product} · Qty: {job.qty}</p>
          </div>
          <div className="flex items-center gap-2">
            {["scan", "checklist", step === "fail_detail" ? "fail" : "result"].map((s, i) => (
              <div key={i} className={cn("h-1.5 w-8 rounded-full transition-all",
                (step === "scan" && i === 0) || (step === "checklist" && i === 1) || ((step === "fail_detail" || step === "done") && i === 2)
                  ? "bg-accent-teal" : "bg-border"
              )} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step 1: Scan QR */}
          {step === "scan" && (
            <div className="space-y-4">
              <div className="bg-status-blue/5 border border-status-blue/20 rounded-xl p-4 text-center">
                <ScanLine className="h-10 w-10 text-status-blue mx-auto mb-2 opacity-60" />
                <p className="text-sm text-primary font-medium">Pindai QR Code pada Barang Cetakan</p>
                <p className="text-xs text-muted mt-1">Pastikan barang fisik ada di depan Anda sebelum memulai inspeksi.</p>
              </div>

              <button
                onClick={() => scanned ? null : setShowScanner(true)}
                className={cn("w-full h-12 rounded-xl border-2 border-dashed font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2",
                  scanned ? "bg-status-green/10 border-status-green/30 text-status-green" : "border-accent-teal/40 text-accent-teal hover:bg-accent-teal/10"
                )}
              >
                {scanned ? "✅ QR Terverifikasi" : <><ScanLine className="h-4 w-4" /> Buka Kamera Scan QR</>}
              </button>

              {/* Anti-fraud size check */}
              {scanned && job.width && job.height && (
                <div className="space-y-3 p-4 bg-elevated/40 rounded-xl border border-border">
                  <p className="text-xs font-bold text-status-yellow flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Validasi Ukuran Fisik (Anti-Fraud)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted uppercase">Lebar Fisik (cm)</label>
                      <input type="number" value={physW} onChange={(e) => setPhysW(e.target.value)}
                        placeholder={`Sistem: ${job.width}`}
                        className="w-full h-10 mt-1 bg-elevated border border-border rounded-lg px-3 text-sm text-primary outline-none focus:border-accent-teal" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted uppercase">Tinggi Fisik (cm)</label>
                      <input type="number" value={physH} onChange={(e) => setPhysH(e.target.value)}
                        placeholder={`Sistem: ${job.height}`}
                        className="w-full h-10 mt-1 bg-elevated border border-border rounded-lg px-3 text-sm text-primary outline-none focus:border-accent-teal" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Checklist Inspeksi */}
          {step === "checklist" && (
            <div className="space-y-3">
              <p className="text-xs text-muted font-medium">Nilai setiap item inspeksi di bawah ini:</p>
              <div className="space-y-2">
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
                                : val === "MINOR" ? "bg-status-yellow text-black border-status-yellow"
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
              </div>

              {(hasMinor || hasMajor) && (
                <div className="p-3 bg-status-yellow/10 border border-status-yellow/30 rounded-xl text-xs text-status-yellow font-semibold">
                  ⚠️ Terdapat item {hasMajor ? "MASALAH MAYOR" : "MASALAH MINOR"} — catatan wajib diisi pada langkah berikutnya jika memilih FAIL.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Fail Detail */}
          {step === "fail_detail" && (
            <div className="space-y-4">
              <div className="p-3 bg-status-red/10 border border-status-red/30 rounded-xl text-xs text-status-red font-semibold">
                Anda memilih FAIL. Lengkapi detail temuan defect untuk catatan produksi.
              </div>
              <div>
                <label className="text-xs text-muted font-medium mb-1 block">Kategori Masalah *</label>
                <select value={failCategory} onChange={(e) => setFailCategory(e.target.value)}
                  className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-status-red">
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
                <textarea value={failDesc} onChange={(e) => setFailDesc(e.target.value)}
                  rows={3} placeholder="Jelaskan temuan defect secara detail..."
                  className="w-full rounded-xl bg-elevated border border-border text-sm text-primary p-3 outline-none focus:border-status-red resize-none placeholder:text-muted" />
              </div>
              <div>
                <label className="text-xs text-muted font-medium mb-1 block">Rekomendasi Tindak Lanjut *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["rework", "reprint", "escalate"] as const).map((r) => (
                    <button key={r} onClick={() => setFailRecommendation(r)}
                      className={cn("py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        failRecommendation === r
                          ? "bg-status-red text-white border-status-red"
                          : "bg-elevated text-muted border-border hover:text-primary"
                      )}>
                      {r === "rework" ? "🔄 Rework" : r === "reprint" ? "🖨️ Reprint" : "⬆️ Eskalasi"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted font-medium mb-1 block">Upload Foto Defect (Opsional)</label>
                <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-status-red/40 transition-colors cursor-pointer bg-elevated/20">
                  <Camera className="h-6 w-6 text-muted mx-auto mb-1" />
                  <p className="text-xs text-muted">Klik untuk unggah foto / ambil gambar</p>
                </div>
              </div>
            </div>
          )}

          {/* Done State */}
          {step === "done" && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-16 w-16 text-status-green mx-auto" />
              <p className="text-lg font-bold text-primary">Inspeksi QC Selesai</p>
              <p className="text-sm text-muted">Hasil telah dicatat dan job dilanjutkan ke tahap berikutnya.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step !== "done" && (
          <div className="flex gap-3 p-5 border-t border-border shrink-0">
            <button onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary transition-colors cursor-pointer">
              Batal
            </button>

            {step === "scan" && (
              <button
                onClick={() => scanned ? (job.width && job.height ? handleSizeCheck() : setStep("checklist")) : null}
                disabled={!scanned}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-accent-teal to-blue-600 text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Lanjut ke Checklist →
              </button>
            )}

            {step === "checklist" && (
              <>
                <button
                  onClick={() => setStep("fail_detail")}
                  disabled={!allChecked}
                  className="flex-1 h-11 rounded-xl bg-status-red/10 text-status-red text-sm font-bold hover:bg-status-red/20 transition-all cursor-pointer disabled:opacity-40"
                >
                  <XCircle className="h-4 w-4 inline mr-1" /> FAIL
                </button>
                <button
                  onClick={handlePass}
                  disabled={!allChecked || hasMajor}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-status-green to-emerald-600 text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
                >
                  <CheckCircle2 className="h-4 w-4 inline mr-1" /> PASS
                </button>
              </>
            )}

            {step === "fail_detail" && (
              <button
                onClick={handleFail}
                disabled={!failCategory || failDesc.length < 20 || !failRecommendation}
                className="flex-1 h-11 rounded-xl bg-status-red text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit FAIL & Catat Defect
              </button>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="p-5 border-t border-border shrink-0">
            <button onClick={onClose}
              className="w-full h-11 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer">
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function QCTab() {
  const jobs = useWorkflowStore((s) => s.jobs);
  const orders = useWorkflowStore((s) => s.orders);

  const qcJobs = jobs.filter((j) => j.status === "WAITING_QC");
  const passedJobs = jobs.filter((j) => j.status === "QC_PASSED" || j.status === "FINISHING" || j.status === "STORED" || j.status === "PICKED_UP");
  const failedJobs = jobs.filter((j) => j.status === "QC_FAILED");

  const [qcFor, setQcFor] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");

  const dynamicKPI = [
    { label: "Menunggu Inspeksi", value: qcJobs.length, color: "text-status-yellow", bg: "bg-status-yellow/10" },
    { label: "Diperiksa Hari Ini", value: qcJobs.length + passedJobs.length + failedJobs.length, color: "text-status-blue", bg: "bg-status-blue/10" },
    { label: "PASS Hari Ini", value: passedJobs.length, color: "text-status-green", bg: "bg-status-green/10" },
    { label: "FAIL Hari Ini", value: failedJobs.length, color: "text-status-red", bg: "bg-status-red/10" },
  ];

  return (
    <div className="space-y-6">
      {qcFor && <QCInspectionModal job={qcFor} onClose={() => setQcFor(null)} />}

      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Inspeksi kualitas cetak — checklist PASS / FAIL per job</p>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-sm font-semibold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all cursor-pointer">
          <ScanLine className="h-4 w-4" /> Scan Cepat
        </button>
      </div>

      {/* KPI — 4 Card sesuai dokumen */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {dynamicKPI.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-sm">
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1 font-medium">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-elevated p-1 rounded-xl border border-border w-fit">
        <button onClick={() => setActiveTab("queue")}
          className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "queue" ? "bg-accent-teal text-white shadow-sm" : "text-muted hover:text-primary"
          )}>
          <ClipboardList className="h-4 w-4" /> Antrian QC
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono",
            activeTab === "queue" ? "bg-white/20" : "bg-elevated"
          )}>{qcJobs.length}</span>
        </button>
        <button onClick={() => setActiveTab("history")}
          className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "history" ? "bg-accent-teal text-white shadow-sm" : "text-muted hover:text-primary"
          )}>
          <History className="h-4 w-4" /> Riwayat Inspeksi
        </button>
      </div>

      {/* Queue Table */}
      {activeTab === "queue" && (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-border">
            <ClipboardList className="h-5 w-5 text-status-yellow" />
            <h2 className="text-base font-semibold text-primary">Antrian Job QC_PENDING</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow border border-status-yellow/30">
              {qcJobs.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated border-b border-border text-muted font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Kode Job</th>
                  <th className="px-4 py-3">Kode Order</th>
                  <th className="px-4 py-3">Nama Produk</th>
                  <th className="px-4 py-3">Mesin</th>
                  <th className="px-4 py-3">Operator</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {qcJobs.map((j, i) => {
                  const order = orders.find((o) => o.id === j.orderId);
                  return (
                    <tr key={j.id} className="hover:bg-elevated/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-accent-teal font-bold">{j.id}</td>
                      <td className="px-4 py-3 font-mono text-muted">{j.orderId}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-primary">{j.product}</p>
                        <p className="text-[10px] text-muted">{j.material} · {j.finishing} · {j.qty} pcs</p>
                      </td>
                      <td className="px-4 py-3 text-muted">Roland Outdoor 1</td>
                      <td className="px-4 py-3 text-muted">Budi</td>
                      <td className="px-4 py-3 font-mono text-muted">{order?.deadline || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          id={`btn-inspect-${i}`}
                          onClick={() => setQcFor(j)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-accent-teal to-blue-500 text-white font-bold hover:brightness-110 transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
                        >
                          <ScanLine className="h-3.5 w-3.5" /> Mulai Inspeksi
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {qcJobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      Tidak ada antrian QC saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Table */}
      {activeTab === "history" && (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-border">
            <History className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">Riwayat Inspeksi Saya</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated border-b border-border text-muted font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Kode Job</th>
                  <th className="px-4 py-3">Tanggal Inspeksi</th>
                  <th className="px-4 py-3">Hasil</th>
                  <th className="px-4 py-3">Kategori Masalah</th>
                  <th className="px-4 py-3">Rework Ke-</th>
                  <th className="px-4 py-3">Tindak Lanjut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {QC_HISTORY.map((h) => (
                  <tr key={h.jobId} className="hover:bg-elevated/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-accent-teal font-bold">{h.jobId}</td>
                    <td className="px-4 py-3 font-mono text-muted">{h.date}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold",
                        h.result === "PASS" ? "bg-status-green/10 text-status-green border border-status-green/30" :
                          "bg-status-red/10 text-status-red border border-status-red/30"
                      )}>
                        {h.result === "PASS" ? "✅ PASS" : "❌ FAIL"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{h.category}</td>
                    <td className="px-4 py-3 text-muted text-center">{h.rework}</td>
                    <td className="px-4 py-3 text-muted">{h.followUp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
