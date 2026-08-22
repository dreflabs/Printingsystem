"use client";

import { useState } from "react";
import { Search, CheckCircle2, XCircle, ClipboardList, Camera, ScanLine } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { PINModal } from "@/components/ui/PINModal";
import { QRScanner } from "@/components/ui/QRScanner";
import { useWorkflowStore, Job } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

const KPI = [
  { label: "Menunggu Pencocokan", value: "0", color: "text-status-yellow", bg: "bg-status-yellow/10" },
  { label: "Cocok & Lanjut Finishing", value: "0", color: "text-status-green", bg: "bg-status-green/10" },
];

// Tidak ada checklist cacat lagi

import { PINModal } from "@/components/ui/PINModal";

function QCMatchingModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore(s => s.updateOrderStatus);
  const [scanned, setScanned] = useState(false);
  const [physW, setPhysW] = useState("");
  const [physH, setPhysH] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const handleNext = () => {
    const sw = job.width || 0;
    const sh = job.height || 0;
    const pw = parseFloat(physW) || 0;
    const ph = parseFloat(physH) || 0;

    // Jika ukuran fisik melebih ukuran sistem (ada indikasi markup/fraud)
    if (sw > 0 && sh > 0 && (pw > sw + 2 || ph > sh + 2)) {
      setShowPin(true);
      return;
    }

    submitQC();
  };

  const submitQC = () => {
    updateJobStatus(job.id, "QC_PASSED");
    updateOrderStatus(job.orderId, "QC_PASSED");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <PINModal 
        open={showPin} 
        onClose={() => setShowPin(false)} 
        onSuccess={() => { setShowPin(false); submitQC(); }} 
        title="Indikasi Fraud Terdeteksi"
        description="Ukuran fisik cetakan melebihi ukuran di sistem. Butuh PIN Supervisor untuk melanjutkan."
      />
      
      {showScanner && (
        <QRScanner 
          onClose={() => setShowScanner(false)} 
          onScan={(data) => {
            if (data === job.id) {
              setScanned(true);
              setShowScanner(false);
            } else {
              alert("QR Code tidak cocok dengan Job ini!");
            }
          }}
        />
      )}
      
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-[0_8px_48px_rgba(0,0,0,0.6)] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-primary">Pencocokan Resi & Barang</h3>
            <p className="text-xs text-muted">{job.id} · {job.product}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-status-blue/5 border border-status-blue/20 rounded-xl p-4 text-center">
            <ScanLine className="h-10 w-10 text-status-blue mx-auto mb-2 opacity-50" />
            <p className="text-sm text-primary font-medium mb-1">Pindai QR Code di Resi Operator</p>
            <p className="text-xs text-muted">Pastikan barang cetakan fisik sesuai dengan data resi.</p>
          </div>
          
          <button
            onClick={() => scanned ? null : setShowScanner(true)}
            className={cn(
              "w-full h-12 rounded-xl border-2 border-dashed font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2",
              scanned ? "bg-status-green/10 border-status-green/30 text-status-green" : "border-accent-teal/40 text-accent-teal hover:bg-accent-teal/10"
            )}
          >
            {scanned ? "✅ QR Resi Cocok" : "📷 Buka Kamera Scan QR"}
          </button>

          {scanned && job.width && job.height && (
            <div className="pt-3 border-t border-border mt-3">
              <p className="text-xs font-semibold text-status-orange mb-3">⚠️ Validasi Ukuran (Anti-Fraud)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase">Lebar Fisik (cm)</label>
                  <input type="number" value={physW} onChange={e => setPhysW(e.target.value)} placeholder={`Sistem: ${job.width}`} className="w-full h-10 mt-1 bg-elevated border border-border rounded-lg px-3 text-sm text-primary outline-none focus:border-accent-teal" />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase">Tinggi Fisik (cm)</label>
                  <input type="number" value={physH} onChange={e => setPhysH(e.target.value)} placeholder={`Sistem: ${job.height}`} className="w-full h-10 mt-1 bg-elevated border border-border rounded-lg px-3 text-sm text-primary outline-none focus:border-accent-teal" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary transition-colors cursor-pointer">Batal</button>
          <button
            onClick={handleNext}
            disabled={!scanned || (job.width && (!physW || !physH))}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-status-green to-emerald-500 text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Teruskan ke Finishing
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QCPage() {
  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  
  const qcJobs = jobs.filter(j => j.status === "WAITING_QC");
  const [qcFor, setQcFor] = useState<Job | null>(null);

  return (
    <div className="space-y-6">
      {qcFor && <QCMatchingModal job={qcFor} onClose={() => setQcFor(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard QC & Pencocokan</h1>
          <p className="text-sm text-muted mt-0.5">Pos pencocokan resi dan pengiriman ke Finishing</p>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-sm font-semibold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all cursor-pointer"
        >
          <ScanLine className="h-4 w-4" /> Scan Resi Cepat
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4">
        {KPI.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <p className={cn("text-5xl font-bold", k.color)}>
              {k.label === "Menunggu Pencocokan" ? qcJobs.length : "0"}
            </p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Queue Table */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <ClipboardList className="h-5 w-5 text-status-yellow" />
          <h2 className="text-base font-semibold text-primary">Barang Cetakan Menunggu Resi</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow border border-status-yellow/30">{qcJobs.length}</span>
        </div>
        <div className="divide-y divide-border/50">
          {qcJobs.map((j, i) => {
            const order = orders.find(o => o.id === j.orderId);
            return (
            <div key={j.id} className={cn("flex items-center gap-4 p-4 hover:bg-elevated/30 transition-colors")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-accent-teal">{j.id}</span>
                  <StatusPill status="WAITING_QC" />
                </div>
                <p className="font-semibold text-primary text-sm">{j.product}</p>
                <p className="text-xs text-muted">{j.material} · {j.finishing}</p>
              </div>
              <div className="text-right shrink-0 text-xs text-muted">
                <p>Qty: {j.qty}</p>
                <p>{order?.deadline}</p>
              </div>
              <button
                id={`btn-inspect-${i}`}
                onClick={() => setQcFor(j)}
                className="shrink-0 h-10 px-4 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Cocokkan Resi
              </button>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
