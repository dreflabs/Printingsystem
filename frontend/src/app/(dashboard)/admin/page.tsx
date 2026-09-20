"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusPill , ErrorState} from "@/components/ui";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import {
  ShoppingCart, Package, Plus, ArrowRight, ScanLine, TrendingUp,
  ClipboardCheck, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleGuide } from "@/components/dashboard/RoleGuide";
import { OperationalAlerts } from "@/components/dashboard/OperationalAlerts";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getOrders, getOrderDetail } from "@/actions/queries";
import { addPayment } from "@/actions/orders";
import { approveDesign, assignProductionJob, getProductionAssignData } from "@/actions/design";
import { releaseOrderToProduction } from "@/actions/production";
import { releaseOrder } from "@/actions/storage";
import { submitFinalAudit, getFinalAuditChecks, createCorrection, approveCorrection, listCorrections, type AuditCheck } from "@/actions/audit";
import { getSessionUser } from "@/actions/session";
import { freezeOrder, unfreezeOrder } from "@/actions/hold";
import { cancelOrder, requestOrderCancellation } from "@/actions/cancel";
import { requestDiscount, updateOrderItem } from "@/actions/orders";

const FREEZE_BLOCKED = ["CLOSED", "CANCELLED", "PICKED_UP", "ON_HOLD"];
/** Samakan dengan TERMINAL di actions/cancel.ts — tidak bisa dibatalkan sama sekali. */
const CANCEL_TERMINAL = ["CLOSED", "CANCELLED", "PICKED_UP", "FINAL_AUDIT_PENDING", "FINAL_AUDIT_COMPLETE"];
/** Samakan dengan PRE_PRODUCTION di actions/cancel.ts — Admin boleh cancel langsung, DP refundable. */
const CANCEL_PRE_PRODUCTION = ["DRAFT", "DESIGNING", "WAITING_APPROVAL", "APPROVED", "WAITING_PAYMENT", "CONFIRMED"];
// Status di mana order sudah tidak perlu / tidak bisa di-assign ke produksi.
const ASSIGN_BLOCKED = ["DRAFT", "CANCELLED", "CLOSED", "PICKED_UP", "ON_HOLD"];

type OrderRow = {
  id: string; orderCode: string; type: string; customerName: string; status: string;
  total: number; paidAmount: number; balance: number; deadline: string | Date | null;
  createdAt: string | Date; overdue: boolean; itemCount: number;
};
type Detail = Extract<Awaited<ReturnType<typeof getOrderDetail>>, { success: true }>["data"];

const fmtRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—");
const fmtOverdue = (d: string | Date | null) => {
  if (!d) return "Terlambat";
  const days = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
  return `Terlambat ${days} hari`;
};

/** Progres mini per job produksi (antri → cetak → selesai → diambil). */
function JobProgress({ status }: { status: string }) {
  const step =
    ["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED"].includes(status) ? 1 :
    ["PRODUCTION_STARTED", "PRODUCTION_PAUSED"].includes(status) ? 2 :
    status === "PRODUCTION_COMPLETE" ? 3 :
    status === "PICKED_UP" ? 4 : 0;
  if (status === "FAILED_REWORK") return <div className="h-1 rounded-full bg-status-red/50" />;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={cn("h-1 flex-1 rounded-full", n <= step ? "bg-accent-teal" : "bg-border")} />
      ))}
    </div>
  );
}

// ── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ orderId, isOwner, onClose, onBayar, onChanged }: {
  orderId: string; isOwner: boolean; onClose: () => void; onBayar: () => void; onChanged: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [freezeMode, setFreezeMode] = useState(false);
  const [freezeReason, setFreezeReason] = useState("");
  const [holdBusy, setHoldBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundAmount, setCancelRefundAmount] = useState("");
  const [cancelRefundMethod, setCancelRefundMethod] = useState<"" | "CASH" | "TRANSFER">("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [discountMode, setDiscountMode] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReasonInput, setDiscountReasonInput] = useState("");
  const [discountBusy, setDiscountBusy] = useState(false);
  const [corrections, setCorrections] = useState<Extract<Awaited<ReturnType<typeof listCorrections>>, { success: true }>["data"]>([]);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionCategory, setCorrectionCategory] = useState<"FINANCIAL" | "MATERIAL" | "QUANTITY" | "OTHER">("OTHER");
  const [correctionField, setCorrectionField] = useState("");
  const [correctionOld, setCorrectionOld] = useState("");
  const [correctionNew, setCorrectionNew] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [designApprovalNotes, setDesignApprovalNotes] = useState("");
  const [designApprovalBusy, setDesignApprovalBusy] = useState(false);
  const [releaseMode, setReleaseMode] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [qtyChecked, setQtyChecked] = useState(false);
  const [releaseOverrideReason, setReleaseOverrideReason] = useState("");
  const [pickupBusy, setPickupBusy] = useState(false);
  const [editItemIdx, setEditItemIdx] = useState<number | null>(null);
  const [editItemSize, setEditItemSize] = useState("");
  const [editItemDesc, setEditItemDesc] = useState("");
  const [editItemBusy, setEditItemBusy] = useState(false);
  const reload = () => getOrderDetail(orderId).then((r) => (r.success ? setD(r.data as Detail) : setErr(r.error)));
  const reloadCorrections = () => listCorrections(orderId).then((r) => { if (r.success) setCorrections(r.data); });
  useEffect(() => {
    getOrderDetail(orderId).then((r) => (r.success ? setD(r.data as Detail) : setErr(r.error)));
    reloadCorrections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const designApproved = !!d?.designJobs.some((j) => j.status === "APPROVED");
  const dpMet = !!d && d.paidAmount + 1e-6 >= d.dpRequired;
  const discountOk = !!d && (d.discount <= 0 || d.discountApproved);
  const canAssign = !!d && d.productionJobs.length === 0 && !ASSIGN_BLOCKED.includes(d.status);
  // Tertahan gatekeeper "wajib rilis Admin" — data sudah lengkap, tinggal dilepas.
  const awaitingRelease = !!d && d.autoReleaseBlocked === "AWAITING_ADMIN_RELEASE";
  const assignBlockedReason = !designApproved
    ? "Desain belum disetujui."
    : !discountOk
      ? "Diskon masih menunggu keputusan Owner."
      : !dpMet
        ? "DP belum terpenuhi."
        : (d?.readyMissing?.length ? d.readyMissing.join(" · ") : null);
  const defaultQty = d ? d.items.reduce((s, it) => s + (it.quantity || 0), 0) : 0;
  const productionJobCount = d?.productionJobs.length ?? 0;
  const startedJobCount = d?.productionJobs.filter((j) => !["PRODUCTION_QUEUED", "PRODUCTION_ASSIGNED"].includes(j.status)).length ?? 0;
  const completedPrintJobCount = d?.productionJobs.filter((j) => [
    "PRODUCTION_COMPLETE", "QC_PENDING", "QC_PASSED", "FINISHING_STARTED", "FINISHING_COMPLETE",
    "STORAGE_PENDING", "STORED", "IN_TRANSIT", "PICKED_UP",
  ].includes(j.status)).length ?? 0;

  async function doRelease() {
    setReleaseBusy(true);
    const res = await releaseOrderToProduction(orderId);
    setReleaseBusy(false);
    if (!res.success) { setErr(res.error); return; }
    await reload();
    onChanged();
  }

  function openEditItem(idx: number) {
    const it = d?.items[idx];
    if (!it) return;
    setEditItemIdx(idx);
    setEditItemSize(it.size ?? "");
    setEditItemDesc(it.description ?? "");
    setErr(null);
  }

  async function doUpdateItem() {
    if (editItemIdx === null || !d) return;
    const it = d.items[editItemIdx];
    if (!it.id) return;
    setEditItemBusy(true); setErr(null);
    const res = await updateOrderItem(orderId, it.id, { size: editItemSize, description: editItemDesc });
    setEditItemBusy(false);
    if (!res.success) { setErr(res.error); return; }
    setEditItemIdx(null);
    await reload();
    if (res.data.autoReleasedJobs.length > 0) onChanged();
  }

  async function doFreeze() {
    setHoldBusy(true); setErr(null);
    const res = await freezeOrder(orderId, freezeReason);
    setHoldBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onChanged(); onClose();
  }
  async function doUnfreeze() {
    setHoldBusy(true); setErr(null);
    const res = await unfreezeOrder(orderId);
    setHoldBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onChanged(); onClose();
  }

  const cancelIsPreProduction = !!d && CANCEL_PRE_PRODUCTION.includes(d.status);

  async function doCancel() {
    if (!d) return;
    setCancelBusy(true); setErr(null);
    const res =
      cancelIsPreProduction || isOwner
        ? await cancelOrder(orderId, {
            reason: cancelReason,
            refundAmount: cancelRefundAmount ? Number(cancelRefundAmount) : undefined,
            refundMethod: cancelRefundMethod || undefined,
          })
        : await requestOrderCancellation(orderId, cancelReason);
    setCancelBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onChanged();
    if (cancelIsPreProduction || isOwner) onClose();
    else await reload();
  }

  async function doRequestDiscount() {
    setDiscountBusy(true); setErr(null);
    const res = await requestDiscount(orderId, { amount: Number(discountAmount) || 0, reason: discountReasonInput });
    setDiscountBusy(false);
    if (!res.success) { setErr(res.error); return; }
    setDiscountMode(false); setDiscountAmount(""); setDiscountReasonInput("");
    await reload();
    onChanged();
  }

  async function doCreateCorrection() {
    setCorrectionBusy(true); setErr(null);
    const res = await createCorrection(orderId, {
      correctedEntity: "Order",
      correctedId: orderId,
      category: correctionCategory,
      fieldName: correctionField,
      oldValue: correctionOld || undefined,
      newValue: correctionNew || undefined,
      reason: correctionReason,
    });
    setCorrectionBusy(false);
    if (!res.success) { setErr(res.error); return; }
    setCorrectionMode(false); setCorrectionField(""); setCorrectionOld(""); setCorrectionNew(""); setCorrectionReason(""); setCorrectionCategory("OTHER");
    await reloadCorrections();
  }

  async function doDecideCorrection(id: string, approve: boolean) {
    setErr(null);
    const res = await approveCorrection(id, { approve });
    if (!res.success) { setErr(res.error); return; }
    await reloadCorrections();
  }

  async function doPickup() {
    if (!d || d.productionJobs.length === 0) return;
    setPickupBusy(true); setErr(null);
    const res = await releaseOrder(d.productionJobs[0].jobCode, {
      receiverName,
      ownerOverrideReason: releaseOverrideReason.trim() || undefined,
    });
    setPickupBusy(false);
    if (!res.success) { setErr(res.error); return; }
    setReleaseMode(false); setReceiverName(""); setQtyChecked(false); setReleaseOverrideReason("");
    await reload();
    onChanged();
  }

  async function doApproveOnline() {
    if (!designApprovalNotes.trim()) return;
    setDesignApprovalBusy(true); setErr(null);
    const res = await approveDesign(orderId, { notes: designApprovalNotes.trim() });
    setDesignApprovalBusy(false);
    if (!res.success) { setErr(res.error); return; }
    setDesignApprovalNotes("");
    await reload();
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h3 className="text-base font-bold text-primary">Detail Order {d?.orderCode ?? ""}</h3>
          <button aria-label="Tutup detail order" onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {err && <p className="text-status-red text-xs">{err}</p>}
          {!d && !err && <p className="text-muted text-xs">Memuat…</p>}
          {d && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-elevated/50 p-4 rounded-xl text-xs">
                <div><p className="text-muted text-[10px] uppercase">Konsumen</p><p className="font-semibold text-primary">{d.customer?.name ?? "-"}</p></div>
                <div><p className="text-muted text-[10px] uppercase">Tipe</p><p className="font-semibold text-primary">{d.type}</p></div>
                <div><p className="text-muted text-[10px] uppercase">Status</p><StatusPill status={d.status} /></div>
                <div><p className="text-muted text-[10px] uppercase">Deadline</p><p className="font-semibold text-primary">{fmtDate(d.deadline)}</p></div>
                <div><p className="text-muted text-[10px] uppercase">Dibuat oleh</p><p className="font-semibold text-primary">{d.createdBy}</p></div>
                <div><p className="text-muted text-[10px] uppercase">Designer</p><p className="font-semibold text-primary">{d.designer ?? "-"}</p></div>
              </div>

              <div>
                <p className="text-xs font-bold text-primary mb-2">Item ({d.items.length})</p>
                <div className="border border-border rounded-xl divide-y divide-border/60 text-xs">
                  {d.items.map((it, i) => (
                    <div key={i} className="px-3 py-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-primary">
                          {it.name} · {it.quantity} pcs {it.size ? `· ${it.size}` : ""}
                          {it.sizeRequired && !it.size && (
                            <span className="ml-1 text-[10px] font-bold text-status-red">· ukuran belum diisi</span>
                          )}
                          {it.deadline && (
                            <span className="ml-1 text-[10px] font-bold text-status-yellow-text">· ⏱ {fmtDate(it.deadline)}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-muted">{fmtRp(it.totalPrice)}</span>
                          {d.editableItems && (
                            <button
                              onClick={() => (editItemIdx === i ? setEditItemIdx(null) : openEditItem(i))}
                              className="text-[10px] font-bold text-accent-teal hover:underline whitespace-nowrap"
                            >
                              {editItemIdx === i ? "Batal" : "Edit"}
                            </button>
                          )}
                        </div>
                      </div>
                      {editItemIdx === i && (
                        <div className="mt-2 space-y-2 rounded-lg border border-border bg-elevated/60 p-2.5">
                          <div>
                            <label className="text-[10px] font-bold text-muted uppercase">Ukuran</label>
                            <input
                              value={editItemSize}
                              onChange={(e) => setEditItemSize(e.target.value)}
                              placeholder="Contoh: 500x500 atau A3"
                              className="w-full h-8 rounded-lg bg-card border border-border text-xs text-primary px-2.5 outline-none focus:border-accent-teal"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted uppercase">Deskripsi</label>
                            <input
                              value={editItemDesc}
                              onChange={(e) => setEditItemDesc(e.target.value)}
                              placeholder="Catatan/nama item"
                              className="w-full h-8 rounded-lg bg-card border border-border text-xs text-primary px-2.5 outline-none focus:border-accent-teal"
                            />
                          </div>
                          <button
                            onClick={doUpdateItem}
                            disabled={editItemBusy}
                            className="h-8 rounded-lg bg-accent-teal px-3 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40"
                          >
                            {editItemBusy ? "Menyimpan…" : "Simpan"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!d.editableItems && (
                  <p className="mt-1.5 text-[10px] text-muted">Item tidak bisa diubah lagi — order sudah masuk produksi atau selesai.</p>
                )}
              </div>

              {d.designJobs.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-primary mb-2">Desain &amp; Approval</p>
                  <div className="border border-border rounded-xl divide-y divide-border/60 text-xs">
                    {d.designJobs.map((j, i) => {
                      const latest = j.versions[j.versions.length - 1];
                      const isOnlinePending = j.method === "ONLINE" && j.status !== "APPROVED" && !!latest && latest.approvalStatus === "PENDING";
                      return (
                        <div key={`${j.method}-${i}`} className="px-3 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-bold text-primary">{j.method === "ONLINE" ? "Online" : "Walk-in / Makloon"}</p>
                              <p className="text-[11px] text-muted">Versi saat ini: V{j.currentVersion || 0} · {j.versions.length} file tersimpan</p>
                            </div>
                            <StatusPill status={j.status} />
                          </div>
                          {latest && (
                            <div className="rounded-lg bg-elevated/60 px-2.5 py-2 text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted">V{latest.versionNo} · {latest.approvalStatus}</span>
                                {latest.fileUrl && <a href={latest.fileUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-teal hover:underline">Buka file</a>}
                              </div>
                              {latest.fileName && <p className="mt-1 truncate text-muted">{latest.fileName}</p>}
                              {latest.notes && <p className="mt-1 text-muted">Catatan: {latest.notes}</p>}
                            </div>
                          )}
                          {isOnlinePending && (
                            <div className="space-y-2 rounded-lg border border-status-yellow/30 bg-status-yellow/5 p-2.5">
                              <p className="text-[11px] text-status-yellow-text">Approval Online harus dicatat Admin setelah bukti persetujuan konsumen diverifikasi.</p>
                              <textarea
                                value={designApprovalNotes}
                                onChange={(e) => setDesignApprovalNotes(e.target.value)}
                                rows={2}
                                placeholder="Contoh: disetujui via WhatsApp 14 Sep 2026 15:20 oleh Budi"
                                className="w-full rounded-lg bg-elevated border border-border text-xs text-primary p-2.5 outline-none focus:border-accent-teal resize-none"
                              />
                              <button
                                onClick={doApproveOnline}
                                disabled={designApprovalBusy || designApprovalNotes.trim().length < 5}
                                className="h-9 rounded-lg bg-status-green px-3 text-xs font-bold text-white hover:brightness-110 disabled:opacity-40"
                              >
                                {designApprovalBusy ? "Menyimpan…" : "Konfirmasi Approval Online"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-elevated/50 p-3 rounded-xl">
                  <p className="text-muted text-[10px] uppercase">Total / DP wajib</p>
                  <p className="font-mono font-bold text-primary">{fmtRp(d.total)} / {fmtRp(d.dpRequired)}</p>
                </div>
                <div className="bg-elevated/50 p-3 rounded-xl">
                  <p className="text-muted text-[10px] uppercase">Dibayar / Sisa</p>
                  <p className={cn("font-mono font-bold", d.balance > 0 ? "text-status-yellow-text" : "text-status-green")}>
                    {fmtRp(d.paidAmount)} / {d.balance > 0 ? fmtRp(d.balance) : "Lunas"}
                  </p>
                </div>
              </div>

              {d.payments.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-primary mb-2">Pembayaran</p>
                  <div className="border border-border rounded-xl divide-y divide-border/60 text-xs">
                    {d.payments.map((p, i) => (
                      <div key={p.id ?? i} className="flex items-center justify-between px-3 py-2 gap-2">
                        <span className="text-muted truncate">{p.method} · {p.status} · {p.receivedBy}</span>
                        <span className="font-mono text-primary shrink-0">{fmtRp(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {d.productionJobs.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-bold text-primary">Progres Produksi per Mesin</p>
                    <p className="text-[11px] text-muted">{completedPrintJobCount}/{productionJobCount} selesai cetak · {startedJobCount}/{productionJobCount} sudah dimulai</p>
                  </div>
                  <div className="border border-border rounded-xl divide-y divide-border/60">
                    {d.productionJobs.map((j) => (
                      <div key={j.jobCode} className="px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-accent-teal">{j.jobCode}</span>
                          <StatusPill status={j.status} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span>{j.machine} · {j.operator}</span>
                          <span>
                            {j.actualQty}/{j.plannedQty} pcs
                            {j.deadline && <span className="font-bold text-status-yellow-text"> · ⏱ {fmtDate(j.deadline)}</span>}
                          </span>
                        </div>
                        <JobProgress status={j.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {corrections.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-primary mb-2">Riwayat Koreksi</p>
                  <div className="border border-border rounded-xl divide-y divide-border/60 text-xs">
                    {corrections.map((c) => (
                      <div key={c.id} className="px-3 py-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-primary">{c.category} · {c.field_name}</span>
                          <span className={cn("font-bold", c.approved_by ? "text-status-green" : "text-status-yellow-text")}>
                            {c.approved_by ? "Disetujui" : "Menunggu Owner"}
                          </span>
                        </div>
                        {(c.old_value || c.new_value) && (
                          <p className="text-muted">{c.old_value ?? "—"} → {c.new_value ?? "—"}</p>
                        )}
                        <p className="text-muted italic">&ldquo;{c.reason}&rdquo;</p>
                        {isOwner && !c.approved_by && (
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => doDecideCorrection(c.id, true)} className="px-2 py-1 rounded-lg bg-status-green/10 text-status-green font-bold hover:bg-status-green/20">Setujui</button>
                            <button onClick={() => doDecideCorrection(c.id, false)} className="px-2 py-1 rounded-lg bg-status-red/10 text-status-red font-bold hover:bg-status-red/20">Tolak</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {isOwner && d && freezeMode && (
          <div className="px-5 pb-3 pt-4 border-t border-border shrink-0 space-y-2">
            <label className="text-[11px] font-bold text-primary uppercase">Alasan pembekuan</label>
            <textarea value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} rows={2} autoFocus
              placeholder="mis. sengketa pembayaran / menunggu revisi brief dari konsumen"
              className="w-full rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal resize-none" />
          </div>
        )}
        {d && d.cancellationReason && !d.cancelledAt && (
          <div className="px-5 pb-3 pt-4 border-t border-border shrink-0">
            <p className="text-xs text-status-yellow-text bg-status-yellow/10 border border-status-yellow/30 rounded-xl p-3">
              Menunggu keputusan Owner untuk pembatalan — alasan: &ldquo;{d.cancellationReason}&rdquo;
            </p>
          </div>
        )}
        {d && cancelMode && (
          <div className="px-5 pb-3 pt-4 border-t border-border shrink-0 space-y-2">
            <label className="text-[11px] font-bold text-primary uppercase">Alasan pembatalan</label>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} autoFocus
              placeholder="mis. konsumen membatalkan pesanan / salah input"
              className="w-full rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-status-red resize-none" />
            {(cancelIsPreProduction || isOwner) && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted uppercase">Refund (Rp, opsional)</label>
                  <input type="number" value={cancelRefundAmount} onChange={(e) => setCancelRefundAmount(e.target.value)}
                    placeholder={cancelIsPreProduction ? `maks ${fmtRp(d.paidAmount)}` : `maks ${fmtRp(Math.max(0, d.paidAmount - d.dpRequired))} (di luar DP)`}
                    className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-status-red" />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase">Metode refund</label>
                  <select value={cancelRefundMethod} onChange={(e) => setCancelRefundMethod(e.target.value as "" | "CASH" | "TRANSFER")}
                    className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-2 outline-none focus:border-status-red">
                    <option value="">— tidak ada —</option>
                    <option value="CASH">Tunai</option>
                    <option value="TRANSFER">Transfer</option>
                  </select>
                </div>
              </div>
            )}
            {!cancelIsPreProduction && !isOwner && (
              <p className="text-[11px] text-status-yellow-text">
                Order sudah masuk produksi — DP hangus dan pengajuan ini akan menunggu keputusan Owner.
              </p>
            )}
          </div>
        )}
        {d && discountMode && (
          <div className="px-5 pb-3 pt-4 border-t border-border shrink-0 space-y-2">
            <label className="text-[11px] font-bold text-primary uppercase">Ajukan diskon</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} autoFocus
                placeholder={`maks ${fmtRp(d.subtotal - 1)}`}
                className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal" />
            </div>
            <textarea value={discountReasonInput} onChange={(e) => setDiscountReasonInput(e.target.value)} rows={2}
              placeholder="mis. pelanggan lama / kompensasi keterlambatan (min. 5 karakter)"
              className="w-full rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal resize-none" />
            <p className="text-[10px] text-muted">Keputusan akhir tetap di tangan Owner.</p>
          </div>
        )}
        {d && correctionMode && (
          <div className="px-5 pb-3 pt-4 border-t border-border shrink-0 space-y-2">
            <label className="text-[11px] font-bold text-primary uppercase">Ajukan koreksi (order sudah CLOSED)</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={correctionCategory} onChange={(e) => setCorrectionCategory(e.target.value as typeof correctionCategory)}
                className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-2 outline-none focus:border-accent-teal">
                <option value="OTHER">Lainnya</option>
                <option value="QUANTITY">Jumlah</option>
                <option value="MATERIAL">Material</option>
                {isOwner && <option value="FINANCIAL">Keuangan</option>}
              </select>
              <input value={correctionField} onChange={(e) => setCorrectionField(e.target.value)}
                placeholder="Nama field, mis. quantity item#1"
                className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={correctionOld} onChange={(e) => setCorrectionOld(e.target.value)} placeholder="Nilai lama (opsional)"
                className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal" />
              <input value={correctionNew} onChange={(e) => setCorrectionNew(e.target.value)} placeholder="Nilai baru (opsional)"
                className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal" />
            </div>
            <textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} rows={2}
              placeholder="Alasan koreksi (min. 20 karakter)"
              className="w-full rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal resize-none" />
            {!isOwner && (
              <p className="text-[10px] text-muted">
                {correctionCategory === "FINANCIAL" ? "Koreksi keuangan khusus Owner." : "Akan menunggu persetujuan Owner sebelum berlaku."}
              </p>
            )}
          </div>
        )}
        {d && releaseMode && (
          <div className="px-5 pb-3 pt-4 border-t border-border shrink-0 space-y-2">
            <label className="text-[11px] font-bold text-primary uppercase">Serahkan ke Konsumen</label>
            {d.items.length > 0 && (
              <div className="rounded-lg border border-border bg-elevated p-2 text-xs">
                <p className="font-semibold text-primary mb-1">Cek jumlah barang:</p>
                {d.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-muted">
                    <span className="truncate">{it.description || it.name}{it.size ? ` · ${it.size}` : ""}</span>
                    <span className="font-mono shrink-0">{it.quantity} pcs</span>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={qtyChecked} onChange={(e) => setQtyChecked(e.target.checked)} />
              Jumlah &amp; kondisi barang sudah dicek, sesuai
            </label>
            <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} autoFocus
              placeholder="Nama penerima"
              className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal" />
            {d.balance > 0 && (
              isOwner ? (
                <input value={releaseOverrideReason} onChange={(e) => setReleaseOverrideReason(e.target.value)}
                  placeholder="Alasan override (sisa tagihan belum lunas)"
                  className="w-full h-9 rounded-lg bg-elevated border border-border text-xs text-primary px-3 outline-none focus:border-accent-teal" />
              ) : (
                <p className="text-[11px] text-status-yellow-text">
                  Sisa tagihan {fmtRp(d.balance)} belum lunas — hanya Owner yang bisa override.
                </p>
              )
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-3 p-5 border-t border-border shrink-0">
          <button onClick={onClose} className="flex-1 min-w-[120px] h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary">Tutup</button>
          {d && (
            <button
              onClick={() => window.open(`/print/nota/${encodeURIComponent(d.orderCode)}`, "_blank", "noopener")}
              className="flex-1 min-w-[130px] h-11 rounded-xl bg-elevated border border-border text-sm font-bold text-primary hover:bg-elevated/70"
            >
              Cetak Nota
            </button>
          )}
          {d && d.balance > 0 && (
            <button onClick={onBayar} className="flex-1 min-w-[140px] h-11 rounded-xl bg-status-yellow text-black text-sm font-bold hover:brightness-105">Catat Pembayaran</button>
          )}
          {d && d.productionJobs.length > 0 && ["READY_FOR_PICKUP", "IN_TRANSIT"].includes(d.status) && !releaseMode && (
            <button onClick={() => setReleaseMode(true)}
              className="flex-1 min-w-[160px] h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110">
              Serahkan ke Konsumen
            </button>
          )}
          {d && releaseMode && (
            <button
              onClick={doPickup}
              disabled={pickupBusy || !receiverName.trim() || !qtyChecked || (d.balance > 0 && (!isOwner || !releaseOverrideReason.trim()))}
              className="flex-1 min-w-[160px] h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40">
              {pickupBusy ? "Memproses…" : "Konfirmasi Serah Terima"}
            </button>
          )}
          {canAssign && !freezeMode && awaitingRelease && (
            <div className="flex-1 min-w-[160px]">
              <button
                onClick={doRelease}
                disabled={releaseBusy}
                title="Lepas order ini ke antrean operator (mesin & operator dari default katalog)"
                className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
              >
                {releaseBusy ? "Merilis…" : "Rilis ke Produksi"}
              </button>
              <p className="text-[10px] text-muted mt-1 text-center">Data lengkap — menunggu rilis Admin.</p>
            </div>
          )}
          {canAssign && !freezeMode && !awaitingRelease && (
            <div className="flex-1 min-w-[160px]">
              <button
                onClick={() => setAssignOpen(true)}
                disabled={!!assignBlockedReason}
                title={assignBlockedReason ?? "Kirim order ini ke antrian produksi"}
                className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
              >
                Assign ke Produksi
              </button>
              {assignBlockedReason && <p className="text-[10px] text-muted mt-1 text-center">{assignBlockedReason}</p>}
            </div>
          )}
          {isOwner && d && d.status === "ON_HOLD" && (
            <button onClick={doUnfreeze} disabled={holdBusy}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
              {holdBusy ? "Memproses…" : "Cairkan Order"}
            </button>
          )}
          {isOwner && d && !FREEZE_BLOCKED.includes(d.status) && !freezeMode && (
            <button onClick={() => setFreezeMode(true)}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-status-red/10 border border-status-red/30 text-status-red text-sm font-bold hover:bg-status-red/20">
              Bekukan Order
            </button>
          )}
          {isOwner && d && freezeMode && (
            <button onClick={doFreeze} disabled={holdBusy || !freezeReason.trim()}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-status-red text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
              {holdBusy ? "Memproses…" : "Konfirmasi Bekukan"}
            </button>
          )}
          {d && !CANCEL_TERMINAL.includes(d.status) && !d.cancellationReason && !freezeMode && !cancelMode && (
            <button onClick={() => setCancelMode(true)}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-status-red/10 border border-status-red/30 text-status-red text-sm font-bold hover:bg-status-red/20">
              Batalkan Order
            </button>
          )}
          {d && cancelMode && (
            <button onClick={doCancel} disabled={cancelBusy || !cancelReason.trim()}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-status-red text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
              {cancelBusy ? "Memproses…" : cancelIsPreProduction || isOwner ? "Konfirmasi Batalkan" : "Ajukan ke Owner"}
            </button>
          )}
          {d && !["CLOSED", "CANCELLED"].includes(d.status) && !(d.discount > 0 && d.discountApproved) && !freezeMode && !cancelMode && !discountMode && (
            <button onClick={() => setDiscountMode(true)}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-elevated border border-border text-sm font-bold text-primary hover:bg-elevated/70">
              Ajukan Diskon
            </button>
          )}
          {d && discountMode && (
            <button onClick={doRequestDiscount} disabled={discountBusy || !discountReasonInput.trim() || Number(discountAmount) <= 0}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
              {discountBusy ? "Memproses…" : "Kirim Pengajuan"}
            </button>
          )}
          {d && d.status === "CLOSED" && !correctionMode && (
            <button onClick={() => setCorrectionMode(true)}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-elevated border border-border text-sm font-bold text-primary hover:bg-elevated/70">
              Ajukan Koreksi
            </button>
          )}
          {d && correctionMode && (
            <button onClick={doCreateCorrection} disabled={correctionBusy || !correctionField.trim() || correctionReason.trim().length < 20}
              className="flex-1 min-w-[140px] h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-50">
              {correctionBusy ? "Memproses…" : "Kirim Koreksi"}
            </button>
          )}
        </div>
      </div>

      {assignOpen && d && (
        <AssignProductionModal
          orderId={orderId}
          orderCode={d.orderCode}
          defaultQty={defaultQty}
          onClose={() => setAssignOpen(false)}
          onDone={async () => { setAssignOpen(false); await reload(); onChanged(); }}
        />
      )}
    </div>
  );
}

// ── Assign ke Produksi ───────────────────────────────────────────────────────
function AssignProductionModal({
  orderId, orderCode, defaultQty, onClose, onDone,
}: {
  orderId: string; orderCode: string; defaultQty: number; onClose: () => void; onDone: () => void;
}) {
  const [machines, setMachines] = useState<{ id: string; name: string; category: string }[]>([]);
  const [operators, setOperators] = useState<{ id: string; name: string; machineIds: string[] }[]>([]);
  const [machineId, setMachineId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [qty, setQty] = useState(String(defaultQty || ""));
  const [priority, setPriority] = useState("1");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getProductionAssignData().then((r) => {
      setLoading(false);
      if (!r.success) { setErr(r.error); return; }
      setMachines(r.data.machines);
      setOperators(r.data.operators);
    });
  }, []);

  async function submit() {
    setBusy(true); setErr(null);
    const res = await assignProductionJob(orderId, {
      assignments: [{
        machineId,
        operatorId,
        plannedQty: Math.max(1, Number(qty) || 0),
        priority: Number(priority) || 1,
        notes: notes.trim() || undefined,
      }],
    });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }

  const availableOperators = machineId
    ? operators.filter((operator) => operator.machineIds.includes(machineId))
    : [];

  const inp = "w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-primary">Assign ke Produksi</h3>
            <p className="text-xs text-muted font-mono">{orderCode}</p>
          </div>
          <button aria-label="Tutup penugasan produksi" onClick={onClose} disabled={busy} className="p-1 rounded-lg text-muted hover:text-primary disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

        {loading ? (
          <p className="text-xs text-muted">Memuat mesin & operator…</p>
        ) : machines.length === 0 || operators.length === 0 ? (
          <p className="text-xs text-status-red">
            {machines.length === 0 ? "Belum ada mesin ACTIVE." : "Belum ada pegawai dengan role Operator."} Tambahkan dulu di Katalog / Akun Pegawai.
          </p>
        ) : (
          <>
            <div>
              <label className="text-xs text-muted font-medium mb-1 block">Mesin *</label>
              <select
                value={machineId}
                onChange={(e) => { setMachineId(e.target.value); setOperatorId(""); }}
                className={inp}
              >
                <option value="">— pilih mesin —</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.category}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted font-medium mb-1 block">Operator *</label>
              <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} className={inp} disabled={!machineId || availableOperators.length === 0}>
                <option value="">
                  {!machineId ? "— pilih mesin terlebih dahulu —" : availableOperators.length === 0 ? "— belum ada operator berakses mesin ini —" : "— pilih operator —"}
                </option>
                {availableOperators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {machineId && availableOperators.length === 0 && (
                <p className="mt-1 text-[11px] text-status-yellow-text">Minta Owner menambahkan akses operator ke mesin ini melalui Pegawai → Akun &amp; Akses.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted font-medium mb-1 block">Qty rencana</label>
                <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="text-xs text-muted font-medium mb-1 block">Prioritas</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inp}>
                  <option value="1">Normal</option>
                  <option value="2">Tinggi</option>
                  <option value="3">Mendesak</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted font-medium mb-1 block">Catatan (opsional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full rounded-xl bg-elevated border border-border text-xs text-primary p-3 outline-none focus:border-accent-teal resize-none" />
            </div>
            <button
              onClick={submit}
              disabled={busy || !machineId || !operatorId || Number(qty) < 1}
              className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Memproses…" : "Kirim ke Produksi"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({ order, onClose, onDone }: { order: OrderRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(order.balance));
  const [method, setMethod] = useState<"CASH" | "TRANSFER" | "QRIS">("TRANSFER");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ balance: number; dpMet: boolean; fullyPaid: boolean } | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    const res = await addPayment(order.id, { amount: Number(amount), method, reference: reference.trim() || undefined });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    setDone({ balance: res.data.balance, dpMet: res.data.dpMet, fullyPaid: res.data.fullyPaid });
  }
  const inp = "w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={done ? onDone : onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div><h3 className="text-base font-bold text-primary">{done ? "Pembayaran Tercatat" : "Catat Pembayaran"}</h3><p className="text-xs text-muted font-mono">{order.orderCode}</p></div>
          <button aria-label={done ? "Tutup hasil pembayaran" : "Tutup catat pembayaran"} onClick={done ? onDone : onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>

        {done ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-status-green/10 border border-status-green/30 px-3 py-2.5 text-xs text-status-green">
              {fmtRp(Number(amount))} tercatat.{" "}
              {done.fullyPaid ? "Order LUNAS." : `Sisa tagihan ${fmtRp(done.balance)}.`}
              {!done.fullyPaid && (done.dpMet ? " DP terpenuhi." : " DP belum terpenuhi.")}
            </div>
            <button
              onClick={() => window.open(`/print/nota/${encodeURIComponent(order.orderCode)}`, "_blank", "noopener")}
              className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110"
            >
              Cetak Nota{done.fullyPaid ? "" : " / Bukti DP"}
            </button>
            <button onClick={onDone} className="w-full h-10 rounded-xl text-sm font-bold text-muted hover:text-primary">
              Selesai
            </button>
          </div>
        ) : (
          <>
            {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
            <p className="text-xs text-muted">Sisa tagihan: <span className="font-bold text-status-yellow-text">{fmtRp(order.balance)}</span></p>
            <div><label className="text-xs text-muted mb-1 block">Jumlah</label><input type="number" className={inp} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><label className="text-xs text-muted mb-1 block">Metode</label>
              <select className={inp} value={method} onChange={(e) => setMethod(e.target.value as "CASH" | "TRANSFER" | "QRIS")}>
                <option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option><option value="QRIS">QRIS</option>
              </select>
            </div>
            <div><label className="text-xs text-muted mb-1 block">No. Referensi (opsional)</label><input className={inp} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <button disabled={busy || !(Number(amount) > 0)} onClick={submit}
              className="w-full h-11 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 disabled:opacity-40">
              Konfirmasi Pembayaran
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Final Audit Modal ────────────────────────────────────────────────────────
const AUDIT_ITEMS = [
  { id: "financial", label: "Keuangan (DP & Pelunasan)" },
  { id: "material", label: "Material (Pemakaian sesuai order)" },
  { id: "quantity", label: "Jumlah (aktual vs rencana)" },
  { id: "production", label: "Produksi (Semua job selesai)" },
  { id: "storage", label: "Penyimpanan & Pickup" },
] as const;

const SEV_STYLE: Record<string, string> = {
  OK: "bg-status-green/10 text-status-green border-status-green/30",
  WARN: "bg-status-yellow/10 text-status-yellow-text border-status-yellow/30",
  CRIT: "bg-status-red/10 text-status-red border-status-red/30",
};
const SEV_ICON: Record<string, string> = { OK: "✅", WARN: "⚠️", CRIT: "⛔" };

function FinalAuditModal({ order, onClose, onDone }: { order: OrderRow; onClose: () => void; onDone: () => void }) {
  const [checks, setChecks] = useState<AuditCheck[] | null>(null);
  const [r, setR] = useState<Record<string, "PASS" | "FAIL">>({});
  const [notes, setNotes] = useState("");
  const [forceRed, setForceRed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getFinalAuditChecks(order.id).then((res) => {
      if (!alive) return;
      if (!res.success) { setErr(res.error); setChecks([]); return; }
      setChecks(res.data.checks);
      // Pra-isi PASS/FAIL dari hasil rekonsiliasi: OK → PASS, selain itu FAIL.
      const init: Record<string, "PASS" | "FAIL"> = {};
      for (const i of AUDIT_ITEMS) {
        const worst = res.data.checks.filter((c) => c.area === i.id);
        init[i.id] = worst.some((c) => c.severity !== "OK") ? "FAIL" : "PASS";
      }
      setR(init);
    });
    return () => { alive = false; };
  }, [order.id]);

  const hasCritical = (checks ?? []).some((c) => c.severity === "CRIT");
  const allChecked = AUDIT_ITEMS.every((i) => r[i.id]);
  const hasFail = Object.values(r).includes("FAIL");
  // CRIT di data → tidak boleh GREEN. RED kalau auditor menandai eksplisit.
  const result: "GREEN" | "YELLOW" | "RED" = forceRed ? "RED" : hasCritical || hasFail ? "YELLOW" : "GREEN";
  const needNotes = result !== "GREEN";
  const notesOk = !needNotes || notes.trim().length >= 10;

  async function submit() {
    setBusy(true); setErr(null);
    const s = (k: string) => (r[k] === "FAIL" ? "WARNING" : "OK");
    const res = await submitFinalAudit(order.id, {
      result,
      financialStatus: s("financial"),
      materialStatus: s("material"),
      quantityStatus: s("quantity"),
      productionStatus: s("production"),
      storageStatus: s("storage"),
      notes: notes.trim() || undefined,
      items: (checks ?? [])
        .filter((c) => c.severity !== "OK")
        .map((c) => ({
          category: c.area.toUpperCase(),
          severity: c.severity === "CRIT" ? ("CRITICAL" as const) : ("WARNING" as const),
          expectedValue: c.expected,
          actualValue: c.actual,
          status: "FAIL",
          note: c.detail,
        })),
    });
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h3 className="text-base font-bold text-primary flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-accent-teal" /> Final Audit · {order.orderCode}</h3>
          <button aria-label="Tutup audit order" onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
          {checks === null ? (
            <p className="text-xs text-muted py-6 text-center">Memeriksa data order…</p>
          ) : (
            <>
              <p className="text-xs text-muted mb-2">
                Sistem sudah merekonsiliasi 5 area di bawah. Nilai bisa diubah manual;
                {" "}<b>⛔ kritis di area mana pun → tidak bisa GREEN</b>.
              </p>
              {AUDIT_ITEMS.map((item) => {
                const areaChecks = (checks ?? []).filter((c) => c.area === item.id);
                return (
                  <div key={item.id} className="p-3 bg-elevated rounded-xl border border-border space-y-2">
                    <p className="text-xs font-semibold text-primary">{item.label}</p>
                    {areaChecks.map((c, i) => (
                      <div key={i} className={cn("rounded-lg border px-2 py-1.5 text-[11px]", SEV_STYLE[c.severity])}>
                        <div className="font-bold">{SEV_ICON[c.severity]} {c.detail}</div>
                        <div className="opacity-80">harusnya {c.expected} · aktual {c.actual}</div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button onClick={() => setR((p) => ({ ...p, [item.id]: "PASS" }))}
                        className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border", r[item.id] === "PASS" ? "bg-status-green text-white border-status-green" : "bg-card text-muted border-border")}>✅ PASS</button>
                      <button onClick={() => setR((p) => ({ ...p, [item.id]: "FAIL" }))}
                        className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold border", r[item.id] === "FAIL" ? "bg-status-red text-white border-status-red" : "bg-card text-muted border-border")}>❌ FAIL</button>
                    </div>
                  </div>
                );
              })}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder={needNotes ? "Catatan audit — wajib min. 10 karakter (jelaskan temuan / tindak lanjut)" : "Catatan audit (opsional)"}
                className="w-full rounded-xl bg-elevated border border-border text-sm text-primary p-3 outline-none focus:border-accent-teal resize-none" />
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <input type="checkbox" checked={forceRed} onChange={(e) => setForceRed(e.target.checked)} />
                Tandai <b className="text-status-red">RED</b> — blokir penutupan, wajib investigasi Owner
              </label>
              {allChecked && (
                <div className={cn("p-2 rounded-xl text-center text-sm font-bold border",
                  result === "GREEN" ? "bg-status-green/10 text-status-green border-status-green/30"
                  : result === "YELLOW" ? "bg-status-yellow/10 text-status-yellow-text border-status-yellow/30"
                  : "bg-status-red/10 text-status-red border-status-red/30")}>
                  {result === "GREEN" ? "🟢 GREEN — akan CLOSED"
                    : result === "YELLOW" ? "🟡 YELLOW — butuh approval Owner"
                    : "🔴 RED — order ditahan (ON_HOLD)"}
                  {hasCritical && result !== "RED" && <div className="text-[10px] font-normal mt-0.5">GREEN dikunci karena ada temuan kritis.</div>}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-border shrink-0">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary">Batal</button>
          <button disabled={!allChecked || busy || !notesOk || checks === null} onClick={submit}
            className="flex-1 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40">
            Submit Audit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [detailFor, setDetailFor] = useState<OrderRow | null>(null);
  const [payFor, setPayFor] = useState<OrderRow | null>(null);
  const [auditFor, setAuditFor] = useState<OrderRow | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "PRINTING" | "RETAIL">("");
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    getSessionUser().then((r) => {
      if (r.ok) setIsOwner(r.user.role === "owner" || r.user.roles.includes("owner"));
    });
  }, []);

  // Seed filter dari query param — deep-link dari Dashboard Owner
  // (`/admin?status=…`, `/admin?type=…`, `/admin?overdue=1`).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("status");
    const t = p.get("type");
    /* eslint-disable react-hooks/set-state-in-effect */
    if (s) setStatusFilter(s);
    if (t === "PRINTING" || t === "RETAIL") setTypeFilter(t);
    if (p.get("overdue") === "1") setOverdueOnly(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const load = useCallback(async () => {
    const res = await getOrders({ limit: 200, ...(statusFilter ? { status: statusFilter } : {}), ...(typeFilter ? { type: typeFilter } : {}), ...(search ? { search } : {}) });
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setOrders(res.data);
  }, [statusFilter, typeFilter, search]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const today = new Date().toDateString();
  const kpi = [
    { label: "Order Baru Hari Ini", value: orders.filter((o) => new Date(o.createdAt).toDateString() === today).length, filter: "", dot: "bg-status-blue" },
    { label: "Ada Sisa Tagihan", value: orders.filter((o) => o.balance > 0 && !["CANCELLED"].includes(o.status)).length, filter: "", dot: "bg-status-yellow" },
    { label: "Siap Diambil", value: orders.filter((o) => o.status === "READY_FOR_PICKUP").length, filter: "READY_FOR_PICKUP", dot: "bg-status-green" },
    { label: "Overdue", value: orders.filter((o) => o.overdue).length, filter: "", dot: "bg-status-red", urgent: true },
    { label: "Menunggu Audit", value: orders.filter((o) => o.status === "FINAL_AUDIT_PENDING").length, filter: "FINAL_AUDIT_PENDING", dot: "bg-status-yellow" },
  ];

  const readyPickup = orders.filter((o) => o.status === "READY_FOR_PICKUP");
  const awaitingAudit = orders.filter((o) => o.status === "FINAL_AUDIT_PENDING");
  const shownOrders = overdueOnly ? orders.filter((o) => o.overdue) : orders;

  return (
    <div className="space-y-6">
      <NewOrderModal open={showOrderModal} onClose={() => setShowOrderModal(false)} onCreated={() => load()} />
      {detailFor && <DetailModal orderId={detailFor.id} isOwner={isOwner} onClose={() => setDetailFor(null)} onBayar={() => { setPayFor(detailFor); setDetailFor(null); }} onChanged={load} />}
      {payFor && <PaymentModal order={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />}
      {auditFor && <FinalAuditModal order={auditFor} onClose={() => setAuditFor(null)} onDone={() => { setAuditFor(null); load(); }} />}

      <PageHeader
        title="Dashboard Admin"
        subtitle={new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <>
            <a href="/scan" aria-label="Scan QR" className="flex items-center gap-2 px-3 sm:px-4 h-10 rounded-xl bg-card border border-border text-sm text-primary hover:bg-elevated"><ScanLine className="h-4 w-4 text-accent-teal" /><span className="hidden sm:inline">Scan QR</span></a>
            <a href="/pos" aria-label="Kasir POS" className="flex items-center gap-2 px-3 sm:px-4 h-10 rounded-xl bg-card border border-border text-sm text-primary hover:bg-elevated"><ShoppingCart className="h-4 w-4 text-accent-teal" /><span className="hidden sm:inline">Kasir POS</span></a>
            <button onClick={() => setShowOrderModal(true)} className="flex items-center gap-2 px-4 sm:px-5 h-10 rounded-xl bg-accent-teal text-white text-sm font-semibold hover:brightness-110"><Plus className="h-4 w-4" /> Order Baru</button>
          </>
        }
      />

      <RoleGuide role="admin" defaultCollapsed />
      <OperationalAlerts />

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpi.map((k) => (
          <button key={k.label} onClick={() => setStatusFilter((p) => (p === k.filter ? "" : k.filter))}
            className={cn("bg-card border rounded-2xl p-4 shadow-card text-left transition-all",
              k.urgent ? "border-status-red/30 bg-status-red/5" : "border-border hover:border-accent-teal/40",
              statusFilter === k.filter && k.filter !== "" && "ring-2 ring-accent-teal/30 border-accent-teal")}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted font-medium truncate">{k.label}</span>
              <span className={cn("h-2 w-2 rounded-full shrink-0", k.dot)} />
            </div>
            <p className={cn("text-2xl md:text-3xl font-bold", k.urgent ? "text-status-red" : "text-primary")}>{k.value}</p>
            {k.urgent && k.value > 0 && <p className="mt-1 text-[10px] font-semibold text-status-red">Perlu ditindaklanjuti</p>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-status-green" />
            <h2 className="text-base font-semibold text-primary">Siap Diambil</h2>
            <span className="text-xs text-muted">({readyPickup.length})</span>
          </div>
          <div className="space-y-2">
            {readyPickup.slice(0, 5).map((o) => (
              <div key={o.id} role="button" tabIndex={0} aria-label={`Buka detail order ${o.orderCode}`} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-elevated border border-border/60 cursor-pointer" onClick={() => setDetailFor(o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailFor(o); } }}>
                <div className="min-w-0"><p className="text-sm font-medium text-primary truncate">{o.customerName}</p><p className="text-xs text-muted truncate">{o.orderCode}</p></div>
                <ArrowRight className="h-4 w-4 text-muted shrink-0" />
              </div>
            ))}
            {readyPickup.length === 0 && <p className="text-xs text-muted p-4 text-center">Belum ada order siap diambil.</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">Menunggu Final Audit</h2>
            <span className="text-xs text-muted">({awaitingAudit.length})</span>
          </div>
          <div className="space-y-2">
            {awaitingAudit.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated border border-border/60">
                <div className="min-w-0"><p className="text-xs font-medium text-primary truncate">{o.orderCode}</p><p className="text-[10px] text-muted truncate">{o.customerName}</p></div>
                <button onClick={() => setAuditFor(o)} className="text-xs text-accent-teal hover:underline shrink-0 font-semibold px-2.5 py-1 bg-card rounded-lg border border-border">Audit →</button>
              </div>
            ))}
            {awaitingAudit.length === 0 && <p className="text-xs text-muted p-2 text-center">Tidak ada order menunggu audit.</p>}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <TrendingUp className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-semibold text-primary">Daftar Order</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">{shownOrders.length}</span>
            {overdueOnly && (
              <button
                onClick={() => setOverdueOnly(false)}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-red/10 text-status-red border border-status-red/30 hover:bg-status-red/20"
              >
                Overdue saja ✕
              </button>
            )}
            {(statusFilter || typeFilter) && (
              <button onClick={() => { setStatusFilter(""); setTypeFilter(""); }} className="text-xs text-status-red hover:underline">✕ Hapus Filter</button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input aria-label="Cari nama atau kode order" placeholder="Cari nama / kode..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-48 rounded-lg bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal" />
            <select aria-label="Filter status order" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal cursor-pointer">
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="WAITING_PAYMENT">Menunggu Bayar</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PRODUCTION_STARTED">Produksi</option>
              <option value="READY_FOR_PICKUP">Siap Diambil</option>
              <option value="IN_TRANSIT">Di Counter Pengambilan</option>
              <option value="FINAL_AUDIT_PENDING">Menunggu Audit</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select aria-label="Filter tipe order" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | "PRINTING" | "RETAIL")}
              className="h-10 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal cursor-pointer">
              <option value="">Semua Tipe</option>
              <option value="PRINTING">Printing</option>
              <option value="RETAIL">Retail</option>
            </select>
          </div>
        </div>

        {/* Mobile: kartu. Desktop: tabel. */}
        <div className="md:hidden divide-y divide-border/60">
          {shownOrders.map((o) => (
            <div key={o.id} tabIndex={0} aria-label={`Buka detail order ${o.orderCode}`} className="py-3 flex items-start gap-3" onClick={() => setDetailFor(o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailFor(o); } }}>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-primary truncate">{o.customerName}</p>
                <p className="text-[11px] text-muted truncate">
                  <span className="font-mono text-accent-teal">#{o.orderCode.slice(-4)}</span> · {o.type}
                  {" · "}
                  <span className={o.balance > 0 ? "text-status-yellow-text" : "text-status-green"}>
                    {o.balance > 0 ? `sisa ${fmtRp(o.balance)}` : "Lunas"}
                  </span>
                </p>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <StatusPill status={o.status} className="leading-4" />
                  <span className={cn("text-[11px]", o.overdue ? "text-status-red font-bold" : "text-muted")}>
                    ⏱ {fmtDate(o.deadline)}{o.overdue ? ` · ${fmtOverdue(o.deadline)}` : ""}
                  </span>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setDetailFor(o)} className="text-xs font-bold text-accent-teal">Detail</button>
                {o.balance > 0 && o.type === "PRINTING" && (
                  <button onClick={() => setPayFor(o)} className="text-xs font-bold text-status-yellow-text">Bayar</button>
                )}
                {o.status === "FINAL_AUDIT_PENDING" && (
                  <button onClick={() => setAuditFor(o)} className="text-xs font-bold text-accent-teal">Audit</button>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="py-8 text-center text-muted text-sm">Tidak ada order.</p>}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50">
                {["Kode Order", "Konsumen", "Tipe", "Status", "Total", "Sisa", "Deadline", "Aksi"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownOrders.map((o) => (
                <tr key={o.id} tabIndex={0} aria-label={`Buka detail order ${o.orderCode}`} className="border-b border-border/50 hover:bg-elevated/30 transition-colors cursor-pointer" onClick={() => setDetailFor(o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailFor(o); } }}>
                  <td className="px-4 py-3 font-mono text-xs text-accent-teal whitespace-nowrap">{o.orderCode}</td>
                  <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{o.customerName}</td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{o.type}</td>
                  <td className="px-4 py-3 min-w-[13rem]"><StatusPill status={o.status} className="min-w-[12rem] justify-start leading-4 whitespace-normal" /></td>
                  <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap">{fmtRp(o.total)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn("text-xs font-mono", o.balance > 0 ? "text-status-yellow-text" : "text-status-green")}>{o.balance > 0 ? fmtRp(o.balance) : "Lunas"}</span>
                  </td>
                  <td className={cn("px-4 py-3 whitespace-nowrap text-xs", o.overdue ? "text-status-red font-bold" : "text-muted")}>
                    <span className="block">{fmtDate(o.deadline)}</span>
                    {o.overdue && <span className="block text-[10px] font-semibold">{fmtOverdue(o.deadline)}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDetailFor(o)} className="text-xs text-accent-teal hover:underline">Detail</button>
                      {o.balance > 0 && o.type === "PRINTING" && (
                        <><span className="text-border">·</span><button onClick={() => setPayFor(o)} className="text-xs text-status-yellow-text hover:underline">Bayar</button></>
                      )}
                      {o.status === "FINAL_AUDIT_PENDING" && (
                        <><span className="text-border">·</span><button onClick={() => setAuditFor(o)} className="text-xs text-accent-teal hover:underline font-semibold">Audit</button></>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted text-sm">Tidak ada order.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
