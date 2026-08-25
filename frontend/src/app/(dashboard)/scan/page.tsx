"use client";

import { useState, useEffect, useRef } from "react";
import { ScanLine, Camera, Package, CreditCard, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";

// Dummy job fallback jika tidak ada yang cocok di store
const MOCK_JOB = {
  jobCode: "JOB-20260820-0041",
  orderCode: "ORD-20260820-0021",
  customerName: "PT Abadi Makmur",
  product: "Banner Outdoor 4×6m — Flexi Korea · Eyelet",
  qty: 3,
  deadline: "2026-08-20",
  machine: "Mesin Roland 1",
  operator: "Budi Santoso",
  currentStatus: "PRODUCTION_STARTED" as const,
  paymentStatus: "DP Terpenuhi",
  totalAmount: "Rp 3.500.000",
  remainingAmount: "Rp 1.750.000",
  availableActions: [{ label: "SELESAI PRODUKSI (SCAN 2)", action: "next" }, { label: "LIHAT DETAIL", action: "view" }],
};

type ScanMode = "keyboard" | "camera";
type ScanState = "idle" | "scanning" | "found" | "error";

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode>("keyboard");
  const [state, setState] = useState<ScanState>("idle");
  const [scanInput, setScanInput] = useState("");
  const [result, setResult] = useState<typeof MOCK_JOB | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);

  // Auto-focus keyboard scanner input
  useEffect(() => {
    if (mode === "keyboard") inputRef.current?.focus();
    
    let html5QrcodeScanner: Html5QrcodeScanner | null = null;
    if (mode === "camera" && state !== "found") {
      setTimeout(() => {
        html5QrcodeScanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: {width: 250, height: 250} },
          /* verbose= */ false
        );
        html5QrcodeScanner.render(
          (decodedText) => {
            handleScan(decodedText);
            html5QrcodeScanner?.clear();
          },
          (error) => {
            // ignore
          }
        );
      }, 100);
    }
    
    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.log(e));
      }
    };
  }, [mode, state]);

  function handleScan(code: string) {
    if (!code.trim()) return;
    setState("scanning");
    setTimeout(() => {
      const searchCode = code.trim().toLowerCase();
      const matchedJob = jobs.find(j => j.id.toLowerCase().includes(searchCode) || j.orderId.toLowerCase().includes(searchCode));
      const matchedOrder = matchedJob ? orders.find(o => o.id === matchedJob.orderId) : orders.find(o => o.id.toLowerCase().includes(searchCode));

      if (matchedJob || matchedOrder) {
        const order = matchedOrder || orders[0];
        const job = matchedJob || jobs[0];
        const totalNum = Number(order.totalPrice || 0);
        const dpNum = Number(order.dpAmount || 0);
        const sisaNum = Math.max(0, totalNum - dpNum);

        setState("found");
        setResult({
          jobCode: job.id,
          orderCode: order.id,
          customerName: order.customerName,
          product: `${job.product} — ${job.material}`,
          qty: job.qty,
          deadline: order.deadline || "-",
          machine: "Mesin Cetak 1",
          operator: "Operator Staff",
          currentStatus: order.status as any,
          paymentStatus: order.paymentStatus === "PAID" ? "Lunas" : dpNum > 0 ? "DP Terpenuhi" : "Belum DP",
          totalAmount: `Rp ${totalNum.toLocaleString("id-ID")}`,
          remainingAmount: sisaNum <= 0 ? "Lunas" : `Rp ${sisaNum.toLocaleString("id-ID")}`,
          availableActions: getDynamicActions(job.status, order.status),
        });
      } else if (code.length > 3) {
        setState("found");
        setResult(MOCK_JOB);
      } else {
        setState("error");
      }
      setScanInput("");
    }, 600);
  }
  
  function getDynamicActions(jobStatus: string, orderStatus: string) {
    const actions = [];
    if (jobStatus === "WAITING_QC") {
      actions.push({ label: "Lolos QC & Finishing", action: "qc_pass" });
    } else if (jobStatus === "PRINTING") {
      actions.push({ label: "Selesai Produksi", action: "prod_done" });
    } else if (orderStatus === "READY_FOR_PICKUP" || jobStatus === "STORED") {
      actions.push({ label: "Serahkan Konsumen", action: "pickup" });
    }
    actions.push({ label: "Lihat Detail", action: "view" });
    return actions;
  }

  function handleReset() {
    setState("idle");
    setResult(null);
    setScanInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">QR / Barcode Scanner</h1>
        <p className="text-sm text-muted mt-0.5">Scan Job QR untuk melihat detail dan melakukan aksi</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex bg-elevated rounded-xl p-1 gap-1">
        <button
          id="btn-mode-keyboard"
          onClick={() => { setMode("keyboard"); handleReset(); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all cursor-pointer",
            mode === "keyboard" ? "bg-accent-teal text-white shadow" : "text-muted hover:text-primary"
          )}
        >
          <ScanLine className="h-4 w-4" /> Hardware Scanner
        </button>
        <button
          id="btn-mode-camera"
          onClick={() => { setMode("camera"); handleReset(); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all cursor-pointer",
            mode === "camera" ? "bg-accent-teal text-white shadow" : "text-muted hover:text-primary"
          )}
        >
          <Camera className="h-4 w-4" /> Kamera HP
        </button>
      </div>

      {/* Scanner Area */}
      {state !== "found" && (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          {mode === "keyboard" ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className={cn(
                  "h-24 w-24 mx-auto rounded-2xl border-4 flex items-center justify-center mb-4 transition-all",
                  state === "scanning" ? "border-accent-teal bg-accent-teal/10 animate-pulse" : "border-dashed border-border"
                )}>
                  <ScanLine className={cn("h-10 w-10", state === "scanning" ? "text-accent-teal" : "text-muted")} />
                </div>
                {state === "idle" && <p className="text-sm text-muted">Arahkan scanner barcode ke QR Code job</p>}
                {state === "scanning" && <p className="text-sm text-accent-teal font-semibold">Memproses...</p>}
                {state === "error" && (
                  <div className="flex items-center justify-center gap-2 text-status-red">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-semibold">Kode tidak dikenali. Coba scan ulang.</p>
                  </div>
                )}
              </div>

              {/* Hidden keyboard capture input */}
              <input
                ref={inputRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanInput); }}
                className="sr-only"
                aria-label="Input scanner hardware"
              />

              {/* Manual input fallback */}
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted mb-2 text-center">Atau ketik manual:</p>
                <div className="flex gap-2">
                  <input
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanInput); }}
                    placeholder="Ketik kode job / order..."
                    className="flex-1 h-11 rounded-xl bg-elevated border border-border text-primary text-sm px-4 outline-none focus:border-accent-teal transition-colors placeholder:text-muted"
                  />
                  <button
                    onClick={() => handleScan(scanInput)}
                    className="h-11 px-5 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer"
                  >
                    Cari
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Camera Mode — html5-qrcode
            <div className="space-y-4">
              <div id="reader" className="w-full max-w-xs mx-auto overflow-hidden rounded-2xl border-2 border-dashed border-accent-teal/40 bg-black"></div>
              <p className="text-sm text-muted text-center px-4">Kamera aktif, arahkan ke barcode/QR</p>
              <button
                onClick={() => handleScan("JOB-20260820-0041")}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-accent-teal to-blue-500 text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer"
              >
                Simulasi Scan (Demo)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result Card */}
      {state === "found" && result && (
        <div className="space-y-4">
          {/* Success indicator */}
          <div className="flex items-center gap-3 bg-status-green/10 border border-status-green/30 rounded-2xl px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-status-green shrink-0" />
            <p className="text-sm font-semibold text-status-green">Job ditemukan!</p>
          </div>

          {/* Job detail card — ala nota digital */}
          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Job header */}
            <div className="bg-gradient-to-r from-accent-teal/10 to-blue-500/10 border-b border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-accent-teal font-bold">{result.jobCode}</p>
                  <p className="text-xs text-muted">{result.orderCode}</p>
                  <h2 className="text-lg font-bold text-primary mt-2">{result.product}</h2>
                </div>
                <StatusPill status={result.currentStatus} />
              </div>
            </div>

            {/* Details */}
            <div className="p-5 grid grid-cols-2 gap-3">
              {[
                { label: "Konsumen", val: result.customerName, icon: Package },
                { label: "Qty", val: `${result.qty} pcs`, icon: Package },
                { label: "Deadline", val: result.deadline, icon: Package },
                { label: "Mesin", val: result.machine, icon: Package },
                { label: "Operator", val: result.operator, icon: Package },
                { label: "Pembayaran", val: result.paymentStatus, icon: CreditCard },
              ].map((info) => (
                <div key={info.label} className="bg-elevated rounded-xl p-3">
                  <p className="text-[10px] text-muted uppercase tracking-wide mb-0.5">{info.label}</p>
                  <p className={cn("text-sm font-semibold text-primary", info.label === "Pembayaran" && "text-status-yellow")}>
                    {info.val}
                  </p>
                </div>
              ))}
            </div>

            {/* Payment summary */}
            <div className="mx-5 mb-5 bg-elevated rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted">Total Order</p>
                <p className="text-base font-bold text-primary">{result.totalAmount}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Sisa Tagihan</p>
                <p className="text-base font-bold text-status-yellow">{result.remainingAmount}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 space-y-2">
              {result.availableActions.map((actionInfo, i) => (
                <button
                  key={actionInfo.label}
                  id={`btn-scan-action-${i}`}
                  className={cn(
                    "w-full h-12 rounded-xl text-sm font-bold transition-all cursor-pointer",
                    i === 0
                      ? "bg-gradient-to-r from-accent-teal to-blue-500 text-white hover:brightness-110 shadow-lg shadow-accent-teal/20"
                      : "bg-elevated border border-border text-muted hover:text-primary"
                  )}
                >
                  {actionInfo.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="w-full h-12 rounded-xl bg-elevated border border-dashed border-border text-sm text-muted flex items-center justify-center gap-2 hover:border-accent-teal/40 hover:text-accent-teal transition-all cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" /> Scan Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}
