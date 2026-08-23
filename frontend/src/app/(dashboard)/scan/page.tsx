"use client";

import { useState, useEffect, useRef } from "react";
import { ScanLine, Camera, Package, CreditCard, CheckCircle2, AlertCircle, RotateCcw, ImageIcon, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useWorkflowStore, Job, Order } from "@/store/useWorkflowStore";
import { Scanner } from "@yudiel/react-qr-scanner";

type ScanMode = "keyboard" | "camera";
type ScanState = "idle" | "scanning" | "found" | "error";

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode>("camera");
  const [state, setState] = useState<ScanState>("idle");
  const [scanInput, setScanInput] = useState("");
  
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [scanError, setScanError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore(s => s.updateOrderStatus);
  const addLog = useWorkflowStore(s => s.addLog);

  // Auto-focus keyboard scanner input
  useEffect(() => {
    if (mode === "keyboard" && state === "idle") {
      inputRef.current?.focus();
    }
  }, [mode, state]);

  function handleScan(code: string) {
    if (!code || !code.trim() || state === "found") return;
    
    setState("scanning");
    const searchCode = code.trim().toLowerCase();
    
    // Temukan Job dan Order terkait
    const matchedJob = jobs.find(j => j.id.toLowerCase().includes(searchCode));
    
    if (matchedJob) {
      const matchedOrder = orders.find(o => o.id === matchedJob.orderId);
      if (matchedOrder) {
        setActiveJob(matchedJob);
        setActiveOrder(matchedOrder);
        setState("found");
        setScanInput("");
        return;
      }
    }
    
    // Jika tidak ditemukan Job, coba cari Order secara langsung (kasus barcode berisi Order ID)
    const matchedOrderDirect = orders.find(o => o.id.toLowerCase().includes(searchCode));
    if (matchedOrderDirect) {
      // Ambil job pertama dari order ini sebagai perwakilan
      const firstJob = jobs.find(j => j.orderId === matchedOrderDirect.id);
      if (firstJob) {
        setActiveJob(firstJob);
        setActiveOrder(matchedOrderDirect);
        setState("found");
        setScanInput("");
        return;
      }
    }

    // Jika gagal
    setTimeout(() => {
      setState("error");
      setScanError(`Kode "${code}" tidak ditemukan.`);
      setScanInput("");
    }, 500);
  }

  function handleReset() {
    setState("idle");
    setActiveJob(null);
    setActiveOrder(null);
    setScanInput("");
    setScanError("");
  }

  function executeAction(newJobStatus: any, newOrderStatus?: any, logMessage?: string) {
    if (!activeJob) return;
    
    updateJobStatus(activeJob.id, newJobStatus);
    if (newOrderStatus && activeOrder) {
      updateOrderStatus(activeOrder.id, newOrderStatus);
    }
    
    if (logMessage) {
      addLog({
        type: "GENERAL",
        title: "Update Status via Barcode",
        description: `${logMessage} (Job: ${activeJob.id})`,
        operator: "Sistem Barcode"
      });
    }
    
    // Reset kembali ke kamera setelah sukses
    handleReset();
  }

  // Merender aksi secara dinamis berdasarkan status pekerjaan (Mobile First Design)
  function renderActionButtons() {
    if (!activeJob) return null;
    
    const s = activeJob.status;
    
    if (s === "WAITING_QC") {
      return (
        <div className="space-y-3">
          <button onClick={() => executeAction("FINISHING", undefined, "Lolos QC, Lanjut Finishing")} className="w-full h-16 rounded-2xl bg-gradient-to-r from-accent-teal to-blue-500 text-white font-black text-lg shadow-lg hover:brightness-110 active:scale-95 transition-all">
            LOLOS QC ➔ KE FINISHING
          </button>
          <button onClick={() => executeAction("QC_FAILED", undefined, "Gagal QC (Reject)")} className="w-full h-14 rounded-2xl bg-status-red/10 text-status-red font-bold text-base border border-status-red/30 active:bg-status-red/20 transition-all">
            GAGAL (REJECT / REWORK)
          </button>
        </div>
      );
    }
    
    if (s === "FINISHING") {
      return (
        <button onClick={() => executeAction("STORED", undefined, "Selesai Finishing, Serahkan ke Admin")} className="w-full h-16 rounded-2xl bg-gradient-to-r from-status-green to-emerald-500 text-white font-black text-lg shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">
          <CheckCircle2 className="h-6 w-6" /> SELESAI & SERAHKAN ADMIN
        </button>
      );
    }
    
    if (s === "STORED") {
      return (
        <button onClick={() => executeAction("PICKED_UP", "PICKED_UP", "Diserahkan ke Konsumen")} className="w-full h-16 rounded-2xl bg-gradient-to-r from-accent-teal to-blue-600 text-white font-black text-lg shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">
          <Package className="h-6 w-6" /> SERAHKAN KE KONSUMEN
        </button>
      );
    }
    
    if (s === "PICKED_UP") {
      return (
        <div className="bg-status-green/10 text-status-green p-4 rounded-2xl text-center font-bold border border-status-green/20">
          BARANG SUDAH DIAMBIL KONSUMEN
        </div>
      );
    }

    return (
      <div className="bg-elevated text-muted p-4 rounded-2xl text-center text-sm border border-border">
        Tidak ada aksi instan untuk status saat ini ({s}).
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary tracking-tight">Scanner Universal</h1>
        <p className="text-sm text-muted mt-1">Satu alat untuk QC, Finishing, dan Penyerahan</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex bg-elevated rounded-xl p-1.5 gap-1 mb-6">
        <button
          onClick={() => { setMode("camera"); handleReset(); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-bold transition-all",
            mode === "camera" ? "bg-accent-teal text-white shadow-md" : "text-muted hover:text-primary"
          )}
        >
          <Camera className="h-4 w-4" /> Kamera HP
        </button>
        <button
          onClick={() => { setMode("keyboard"); handleReset(); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-bold transition-all",
            mode === "keyboard" ? "bg-accent-teal text-white shadow-md" : "text-muted hover:text-primary"
          )}
        >
          <ScanLine className="h-4 w-4" /> Scanner Tembak
        </button>
      </div>

      {/* Scanner Area */}
      {state !== "found" && (
        <div className="flex-1 flex flex-col">
          {mode === "camera" ? (
            <div className="flex-1 bg-black rounded-3xl overflow-hidden border border-border shadow-2xl relative">
              <Scanner
                onScan={(result) => handleScan(result[0]?.rawValue)}
                onError={(error) => console.log(error)}
                components={{
                  tracker: true,
                  audio: false, // Matikan suara bip default bawaan library jika tidak suka
                }}
                styles={{
                  container: { width: "100%", height: "100%" },
                  video: { objectFit: "cover" }
                }}
              />
              {/* Overlay Panduan */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 bg-black/20">
                <div className="w-full max-w-[250px] aspect-square border-2 border-accent-teal/50 rounded-2xl relative">
                   {/* Sudut-sudut scanner */}
                   <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-accent-teal rounded-tl-xl" />
                   <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-accent-teal rounded-tr-xl" />
                   <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-accent-teal rounded-bl-xl" />
                   <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-accent-teal rounded-br-xl" />
                </div>
                <p className="mt-8 text-white font-semibold text-center bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                  Arahkan kamera ke Barcode Nota
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-card/70 backdrop-blur-xl border border-border rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center text-center">
              <div className={cn(
                "h-28 w-28 mx-auto rounded-3xl border-4 flex items-center justify-center mb-6 transition-all",
                state === "scanning" ? "border-accent-teal bg-accent-teal/10 animate-pulse" : "border-dashed border-border bg-elevated"
              )}>
                <ScanLine className={cn("h-12 w-12", state === "scanning" ? "text-accent-teal" : "text-muted")} />
              </div>
              {state === "idle" && <p className="text-muted">Arahkan scanner hardware ke QR Code atau ketik kode di bawah.</p>}
              {state === "scanning" && <p className="text-accent-teal font-bold text-lg">Mencari Data...</p>}
              
              {state === "error" && (
                <div className="mt-4 p-4 bg-status-red/10 border border-status-red/30 rounded-2xl text-status-red">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                  <p className="font-bold">{scanError}</p>
                </div>
              )}

              {/* Hidden keyboard capture input */}
              <input
                ref={inputRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanInput); }}
                className="opacity-0 absolute"
                aria-label="Input scanner hardware"
              />

              <div className="w-full mt-8">
                <div className="flex gap-2">
                  <input
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanInput); }}
                    placeholder="Input Manual..."
                    className="flex-1 h-14 rounded-2xl bg-base border border-border text-primary text-center text-lg font-bold outline-none focus:border-accent-teal transition-colors placeholder:font-normal placeholder:text-muted"
                  />
                  <button
                    onClick={() => handleScan(scanInput)}
                    className="h-14 px-6 rounded-2xl bg-accent-teal text-white font-bold hover:brightness-110 active:scale-95 transition-all"
                  >
                    Cari
                  </button>
                </div>
                {/* TOMBOL SIMULASI DEV */}
                <button
                    onClick={() => handleScan(jobs[0]?.id || "")}
                    className="w-full mt-4 h-12 rounded-xl bg-status-blue/10 text-status-blue font-bold border border-status-blue/30 text-sm"
                  >
                    (Dev) Simulasi Scan JOB ke-1
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result Card UI - Dioptimalkan untuk Mobile (Besar & Jelas) */}
      {state === "found" && activeJob && activeOrder && (
        <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header / Identitas Job */}
            <div className="bg-elevated p-6 border-b border-border">
              <div className="flex justify-between items-start mb-4">
                <StatusPill status={activeJob.status} />
                <span className="text-xs font-mono font-bold text-muted bg-base px-3 py-1.5 rounded-full border border-border">
                  {activeJob.id}
                </span>
              </div>
              <h2 className="text-2xl font-black text-primary leading-tight">{activeOrder.customerName}</h2>
              <p className="text-accent-teal font-bold mt-1 text-lg">{activeJob.product}</p>
            </div>

            {/* Konten Utama (Visual + Instruksi) */}
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                {/* Kotak Thumbnail Design */}
                <div className="w-24 h-24 rounded-2xl bg-base border border-border flex flex-col items-center justify-center shrink-0 text-muted/50">
                  <ImageIcon className="h-8 w-8 mb-1" />
                  <span className="text-[10px] font-bold">PREVIEW</span>
                </div>
                
                {/* Instruksi Fisik */}
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted">Bahan & Ukuran</p>
                    <p className="font-bold text-primary text-base">{activeJob.material}</p>
                    {activeJob.width && activeJob.height && (
                      <p className="text-sm font-medium text-status-blue">{activeJob.width}cm × {activeJob.height}cm</p>
                    )}
                  </div>
                  <div className="p-3 bg-status-yellow/10 border border-status-yellow/30 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-status-yellow mb-1">Instruksi Finishing</p>
                    <p className="font-bold text-primary leading-tight">{activeJob.finishing}</p>
                  </div>
                </div>
              </div>

              {/* Tagihan (Penting untuk Kasir/Admin) */}
              <div className="bg-base rounded-2xl border border-border p-4 flex justify-between items-center">
                 <div>
                   <p className="text-xs font-bold text-muted uppercase">Status Bayar</p>
                   <p className={cn("font-black text-lg", activeOrder.paymentStatus === "PAID" ? "text-status-green" : "text-status-red")}>
                     {activeOrder.paymentStatus === "PAID" ? "LUNAS" : "BELUM LUNAS"}
                   </p>
                 </div>
                 <div className="text-right">
                   <p className="text-xs font-bold text-muted uppercase">Sisa Tagihan</p>
                   <p className="font-black text-xl text-primary">
                     Rp {Math.max(0, Number(activeOrder.totalPrice) - Number(activeOrder.dpAmount)).toLocaleString("id-ID")}
                   </p>
                 </div>
              </div>
            </div>

            {/* Area Tombol Aksi Bawah */}
            <div className="p-6 bg-elevated border-t border-border mt-auto space-y-4">
              {renderActionButtons()}
              
              <button
                onClick={handleReset}
                className="w-full h-14 rounded-2xl bg-base border border-border text-muted font-bold hover:text-primary hover:border-accent-teal transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-5 w-5" /> SCAN BARANG LAIN
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
