"use client";

import { useState, useEffect, useCallback } from "react";
import { ScanLine, Camera, Package, CreditCard, CheckCircle2, AlertCircle, RotateCcw, FileDown } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { QRScanner } from "@/components/ui/QRScanner";
import { getScanContext, startProduction, pauseProduction, resumeProduction, finishProduction, submitQC } from "@/actions/production";
import { startFinishing, finishFinishing } from "@/actions/production";
import { decideRework, bounceDesignFromProduction } from "@/actions/production";
import { assignStorageLocation, confirmItemAtCounter, releaseOrder, reportStorageIncident } from "@/actions/storage";
import { getOrderFormData } from "@/actions/orders";

type ScanMode = "keyboard" | "camera";
type ScanState = "idle" | "scanning" | "found" | "error";

type ScanCtx = {
  jobCode: string;
  orderCode: string;
  orderId: string;
  jobStatus: string;
  orderStatus: string;
  plannedQty: number;
  actualQty: number;
  isAssignedOperator: boolean;
  paidAmount: number;
  balance: number;
  fileUrl: string | null;
  fileName: string | null;
  items: { description: string; quantity: number; size: string | null }[];
  availableActions: { action: string; label: string }[];
};
type MaterialOpt = { id: string; name: string };

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default function ScanPage() {
  const [mode, setMode] = useState<ScanMode>("keyboard");
  const [state, setState] = useState<ScanState>("idle");
  const [scanInput, setScanInput] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ctx, setCtx] = useState<ScanCtx | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialOpt[]>([]);

  useEffect(() => {
    getOrderFormData().then((r) => { if (r.success) setMaterials(r.data.materials); });
  }, []);

  const runScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setState("scanning");
    setErrorMsg("");
    const res = await getScanContext(code.trim());
    setScanInput("");
    if (res.success) {
      setCtx(res.data);
      setActiveAction(null);
      setState("found");
    } else {
      setErrorMsg(res.error);
      setState("error");
    }
  }, []);

  // Mode Hardware Scanner: tangkap ketikan cepat + Enter dari alat pemindai
  // (keyboard-wedge) di level window, jadi tetap jalan walau fokus tidak di
  // kolom input. Ketikan lambat (manusia) diabaikan.
  useEffect(() => {
    if (mode !== "keyboard" || state === "found") return;
    let buf = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Biarkan kolom "ketik manual" ditangani handler-nya sendiri.
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const now = Date.now();
      if (now - last > 120) buf = ""; // jeda panjang = manusia, mulai ulang buffer
      last = now;
      if (e.key === "Enter") {
        const code = buf.trim();
        buf = "";
        if (code.length >= 3) runScan(code);
        return;
      }
      if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, state, runScan]);

  async function refresh() {
    if (!ctx) return;
    const res = await getScanContext(ctx.jobCode);
    if (res.success) setCtx(res.data);
  }

  function handleReset() {
    setState("idle");
    setCtx(null);
    setActiveAction(null);
    setErrorMsg("");
    setScanInput("");
    setCameraOpen(false);
  }

  async function dispatch(action: string, payload?: Record<string, unknown>) {
    if (!ctx) return;
    setBusy(true);
    setErrorMsg("");
    try {
      const jc = ctx.jobCode;
      let res: { success: boolean; error?: string };
      switch (action) {
        case "start_production": res = await startProduction(jc); break;
        case "pause_production": res = await pauseProduction(jc, String(payload?.reason ?? "")); break;
        case "resume_production": res = await resumeProduction(jc); break;
        case "finish_production":
          res = await finishProduction(jc, {
            actualQty: Number(payload?.actualQty),
            wasteQty: Number(payload?.wasteQty) || 0,
            wasteReason: (payload?.wasteReason as string) || undefined,
            materials: (payload?.materials as { materialId: string; usageQty: number }[]) ?? [],
          });
          break;
        case "submit_qc":
          res = await submitQC(jc, {
            result: payload?.result as "PASS" | "FAIL",
            checklist: {},
            notes: (payload?.notes as string) || undefined,
            category: (payload?.category as string) || undefined,
          });
          break;
        case "start_finishing": res = await startFinishing(jc); break;
        case "finish_finishing": res = await finishFinishing(jc, { actualQty: Number(payload?.actualQty) }); break;
        case "assign_storage": res = await assignStorageLocation(jc, String(payload?.locationCode ?? "")); break;
        case "confirm_counter": res = await confirmItemAtCounter(jc); break;
        case "report_incident": res = await reportStorageIncident(jc, { notes: String(payload?.notes ?? "") }); break;
        case "bounce_design": res = await bounceDesignFromProduction(jc, { reason: String(payload?.reason ?? "") }); break;
        case "decide_rework":
          res = await decideRework(jc, { decision: payload?.decision as "APPROVED" | "REJECTED" | "HOLD", reason: String(payload?.reason ?? "") });
          break;
        case "release":
          res = await releaseOrder(jc, {
            receiverName: String(payload?.receiverName ?? ""),
            ownerOverrideReason: (payload?.ownerOverrideReason as string) || undefined,
          });
          break;
        default: res = { success: true }; break;
      }
      if (!res.success) { setErrorMsg(res.error ?? "Aksi gagal."); return; }
      setToast("Berhasil.");
      setTimeout(() => setToast(null), 2500);
      setActiveAction(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {cameraOpen && (
        <QRScanner onScan={(text) => { setCameraOpen(false); runScan(text); }} onClose={() => setCameraOpen(false)} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-primary">QR / Barcode Scanner</h1>
        <p className="text-sm text-muted mt-0.5">Scan Job QR untuk melihat status dan menjalankan aksi</p>
      </div>

      {toast && (
        <div className="rounded-xl bg-status-green/10 border border-status-green/30 px-4 py-2 text-sm font-semibold text-status-green">{toast}</div>
      )}

      <div className="flex bg-elevated rounded-xl p-1 gap-1">
        <button
          onClick={() => { setMode("keyboard"); handleReset(); }}
          className={cn("flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all cursor-pointer",
            mode === "keyboard" ? "bg-accent-teal text-white shadow" : "text-muted hover:text-primary")}
        >
          <ScanLine className="h-4 w-4" /> Hardware Scanner
        </button>
        <button
          onClick={() => { setMode("camera"); handleReset(); }}
          className={cn("flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-all cursor-pointer",
            mode === "camera" ? "bg-accent-teal text-white shadow" : "text-muted hover:text-primary")}
        >
          <Camera className="h-4 w-4" /> Kamera HP
        </button>
      </div>

      {state !== "found" && (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          {mode === "keyboard" ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className={cn("h-24 w-24 mx-auto rounded-2xl border-4 flex items-center justify-center mb-4 transition-all",
                  state === "scanning" ? "border-accent-teal bg-accent-teal/10 animate-pulse" : "border-dashed border-border")}>
                  <ScanLine className={cn("h-10 w-10", state === "scanning" ? "text-accent-teal" : "text-muted")} />
                </div>
                {state === "idle" && (
                  <p className="text-sm font-semibold text-status-green flex items-center justify-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-status-green animate-pulse" />
                    Siap memindai — scan sekarang atau ketik manual
                  </p>
                )}
                {state === "scanning" && <p className="text-sm text-accent-teal font-semibold">Memproses...</p>}
                {state === "error" && (
                  <div className="flex items-center justify-center gap-2 text-status-red">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-semibold">{errorMsg || "Kode tidak dikenali."}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted mb-2 text-center">Atau ketik manual:</p>
                <div className="flex gap-2">
                  <input
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runScan(scanInput); }}
                    placeholder="Ketik kode job / order..."
                    className="flex-1 h-11 rounded-xl bg-elevated border border-border text-primary text-sm px-4 outline-none focus:border-accent-teal transition-colors placeholder:text-muted"
                  />
                  <button onClick={() => runScan(scanInput)} className="h-11 px-5 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer">
                    Cari
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-24 w-24 mx-auto rounded-2xl border-4 border-dashed border-accent-teal/40 flex items-center justify-center">
                <Camera className="h-10 w-10 text-accent-teal" />
              </div>
              <p className="text-sm text-muted text-center px-4">Buka kamera untuk memindai QR job/order</p>
              <button onClick={() => setCameraOpen(true)} className="w-full h-12 rounded-xl bg-gradient-to-r from-accent-teal to-accent-teal/70 text-white text-sm font-bold hover:brightness-110 transition-all cursor-pointer">
                Buka Kamera
              </button>
            </div>
          )}
        </div>
      )}

      {state === "found" && ctx && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-status-green/10 border border-status-green/30 rounded-2xl px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-status-green shrink-0" />
            <p className="text-sm font-semibold text-status-green">Job ditemukan</p>
          </div>

          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="bg-gradient-to-r from-accent-teal/10 to-accent-teal/5 border-b border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-accent-teal font-bold">{ctx.jobCode}</p>
                  <p className="text-xs text-muted">{ctx.orderCode}</p>
                </div>
                <StatusPill status={ctx.jobStatus} />
              </div>
            </div>

            <div className="p-5 grid grid-cols-2 gap-3">
              {[
                { label: "Status Order", val: ctx.orderStatus, icon: Package },
                { label: "Qty Rencana", val: `${ctx.plannedQty} pcs`, icon: Package },
                { label: "Qty Aktual", val: `${ctx.actualQty} pcs`, icon: Package },
                { label: "Operator Job Ini", val: ctx.isAssignedOperator ? "Anda" : "Bukan Anda", icon: Package },
              ].map((info) => (
                <div key={info.label} className="bg-elevated rounded-xl p-3">
                  <p className="text-[10px] text-muted uppercase tracking-wide mb-0.5">{info.label}</p>
                  <p className="text-sm font-semibold text-primary">{info.val}</p>
                </div>
              ))}
            </div>

            <div className="mx-5 mb-5 bg-elevated rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted flex items-center gap-1"><CreditCard className="h-3 w-3" /> Dibayar</p>
                <p className="text-base font-bold text-primary">{rupiah(ctx.paidAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Sisa Tagihan</p>
                <p className={cn("text-base font-bold", ctx.balance > 0 ? "text-status-yellow-text" : "text-status-green")}>
                  {ctx.balance > 0 ? rupiah(ctx.balance) : "Lunas"}
                </p>
              </div>
            </div>

            {ctx.fileUrl && (
              <a
                href={ctx.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-5 mb-5 flex items-center gap-2 rounded-xl border border-accent-teal/30 bg-accent-teal/10 px-4 py-3 text-sm font-bold text-accent-teal hover:bg-accent-teal/20 transition-colors"
              >
                <FileDown className="h-4 w-4 shrink-0" />
                <span className="truncate">{ctx.fileName || "Buka file cetak"}</span>
              </a>
            )}

            {errorMsg && (
              <div className="mx-5 mb-4 rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">{errorMsg}</div>
            )}

            <div className="px-5 pb-5 space-y-2">
              {ctx.availableActions.map((a, i) => (
                <div key={a.action}>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (a.action === "view") return;
                      const noForm = ["start_production", "resume_production", "start_finishing", "confirm_counter"];
                      if (noForm.includes(a.action)) dispatch(a.action);
                      else setActiveAction(activeAction === a.action ? null : a.action);
                    }}
                    className={cn("w-full h-12 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50",
                      i === 0 && a.action !== "view"
                        ? "bg-gradient-to-r from-accent-teal to-accent-teal/70 text-white hover:brightness-110 shadow-lg shadow-accent-teal/20"
                        : "bg-elevated border border-border text-muted hover:text-primary")}
                  >
                    {a.label}
                  </button>
                  {activeAction === a.action && (
                    <ActionForm action={a.action} ctx={ctx} materials={materials} busy={busy} onSubmit={(p) => dispatch(a.action, p)} />
                  )}
                </div>
              ))}
            </div>
          </div>

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

// ─── Inline forms per aksi ───────────────────────────────────────────────────
function ActionForm({
  action, ctx, materials, busy, onSubmit,
}: {
  action: string;
  ctx: ScanCtx;
  materials: MaterialOpt[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState<Record<string, string>>({ actualQty: String(ctx.plannedQty || "") });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const field = "w-full h-10 rounded-lg bg-background border border-border text-primary text-sm px-3 outline-none focus:border-accent-teal";
  const submitBtn = "w-full h-10 rounded-lg bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-50";

  const wrap = (children: React.ReactNode, payload: () => Record<string, unknown>, canSubmit = true) => (
    <div className="mt-2 space-y-2 rounded-xl border border-border bg-background/50 p-3">
      {children}
      <button disabled={busy || !canSubmit} onClick={() => onSubmit(payload())} className={submitBtn}>Kirim</button>
    </div>
  );

  if (action === "pause_production")
    return wrap(<input className={field} placeholder="Alasan jeda (mesin macet, dll)" value={f.reason ?? ""} onChange={(e) => set("reason", e.target.value)} />,
      () => ({ reason: f.reason }), !!f.reason?.trim());

  if (action === "finish_production")
    return wrap(
      <>
        <input className={field} type="number" placeholder="Qty aktual" value={f.actualQty ?? ""} onChange={(e) => set("actualQty", e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className={field} type="number" placeholder="Qty waste" value={f.wasteQty ?? ""} onChange={(e) => set("wasteQty", e.target.value)} />
          <input className={field} placeholder="Alasan waste" value={f.wasteReason ?? ""} onChange={(e) => set("wasteReason", e.target.value)} />
        </div>
        <select className={field} value={f.materialId ?? ""} onChange={(e) => set("materialId", e.target.value)}>
          <option value="">Pilih material dipakai…</option>
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input className={field} type="number" placeholder="Jumlah pemakaian material" value={f.usageQty ?? ""} onChange={(e) => set("usageQty", e.target.value)} />
        {materials.length === 0 && <p className="text-[11px] text-status-yellow-text">Belum ada master material — tambahkan dulu di Katalog.</p>}
      </>,
      () => ({
        actualQty: f.actualQty, wasteQty: f.wasteQty, wasteReason: f.wasteReason,
        materials: f.materialId && f.usageQty ? [{ materialId: f.materialId, usageQty: Number(f.usageQty) }] : [],
      }),
      !!(Number(f.actualQty) > 0 && f.materialId && Number(f.usageQty) > 0),
    );

  if (action === "submit_qc")
    return wrap(
      <>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => set("result", "PASS")} className={cn("h-10 rounded-lg text-sm font-bold border", f.result === "PASS" ? "bg-status-green text-white border-status-green" : "border-border text-muted")}>PASS</button>
          <button onClick={() => set("result", "FAIL")} className={cn("h-10 rounded-lg text-sm font-bold border", f.result === "FAIL" ? "bg-status-red text-white border-status-red" : "border-border text-muted")}>FAIL</button>
        </div>
        {f.result === "FAIL" && (
          <>
            <input className={field} placeholder="Kategori masalah (print/qty/size)" value={f.category ?? ""} onChange={(e) => set("category", e.target.value)} />
            <textarea className={cn(field, "h-20 py-2")} placeholder="Deskripsi masalah (min 20 karakter)" value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </>
        )}
        {f.result === "PASS" && (
          <textarea className={cn(field, "h-16 py-2")} placeholder="Catatan (opsional)" value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        )}
      </>,
      () => ({ result: f.result, notes: f.notes, category: f.category }),
      f.result === "PASS" || (f.result === "FAIL" && !!f.category && (f.notes?.trim().length ?? 0) >= 20),
    );

  if (action === "finish_finishing")
    return wrap(<input className={field} type="number" placeholder="Actual qty finishing" value={f.actualQty ?? ""} onChange={(e) => set("actualQty", e.target.value)} />,
      () => ({ actualQty: f.actualQty }), Number(f.actualQty) > 0);

  if (action === "assign_storage")
    return wrap(<input className={field} placeholder="Kode lokasi (mis. LT3-A-01-01)" value={f.locationCode ?? ""} onChange={(e) => set("locationCode", e.target.value)} />,
      () => ({ locationCode: f.locationCode }), !!f.locationCode?.trim());

  if (action === "report_incident")
    return wrap(<textarea className={cn(field, "h-20 py-2")} placeholder="Catatan insiden (last seen, dll)" value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />,
      () => ({ notes: f.notes }), !!f.notes?.trim());

  if (action === "bounce_design")
    return wrap(<textarea className={cn(field, "h-20 py-2")} placeholder="Masalah file (resolusi pecah / salah ukuran / warna). Min. 10 karakter — order balik ke desainer." value={f.reason ?? ""} onChange={(e) => set("reason", e.target.value)} />,
      () => ({ reason: f.reason }), (f.reason?.trim().length ?? 0) >= 10);

  if (action === "decide_rework")
    return wrap(
      <>
        <select className={field} value={f.decision ?? ""} onChange={(e) => set("decision", e.target.value)}>
          <option value="">Pilih keputusan…</option>
          <option value="APPROVED">APPROVE — buat Child Job</option>
          <option value="REJECTED">REJECT — reprint baru</option>
          <option value="HOLD">HOLD — investigasi</option>
        </select>
        <input className={field} placeholder="Alasan keputusan" value={f.reason ?? ""} onChange={(e) => set("reason", e.target.value)} />
      </>,
      () => ({ decision: f.decision, reason: f.reason }), !!(f.decision && f.reason?.trim()));

  if (action === "release")
    return wrap(
      <>
        {ctx.items.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-2 text-xs">
            <p className="font-semibold text-primary mb-1">Cek jumlah barang:</p>
            {ctx.items.map((it, i) => (
              <div key={i} className="flex justify-between text-muted">
                <span className="truncate">{it.description}{it.size ? ` · ${it.size}` : ""}</span>
                <span className="font-mono shrink-0">{it.quantity} pcs</span>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={f.qtyChecked === "1"} onChange={(e) => set("qtyChecked", e.target.checked ? "1" : "")} />
          Jumlah &amp; kondisi barang sudah dicek, sesuai
        </label>
        <input className={field} placeholder="Nama penerima" value={f.receiverName ?? ""} onChange={(e) => set("receiverName", e.target.value)} />
        {ctx.balance > 0 && (
          <input className={field} placeholder="Alasan override Owner (sisa tagihan belum lunas)" value={f.ownerOverrideReason ?? ""} onChange={(e) => set("ownerOverrideReason", e.target.value)} />
        )}
      </>,
      () => ({ receiverName: f.receiverName, ownerOverrideReason: f.ownerOverrideReason }),
      !!f.receiverName?.trim() && f.qtyChecked === "1" && (ctx.balance <= 0 || !!f.ownerOverrideReason?.trim()),
    );

  return null;
}
