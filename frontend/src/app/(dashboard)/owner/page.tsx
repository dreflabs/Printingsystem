"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Crown, TrendingUp, ShoppingBag, Package, AlertTriangle, RotateCcw, BadgePercent,
  CheckCircle2, XCircle, Bell, ShieldAlert, Activity, ClipboardList, X, ClipboardCheck,
  MessageSquareX, Ban, Users, Wrench, ArrowRight,
} from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getOwnerDashboard } from "@/actions/queries";
import { decideDiscount } from "@/actions/orders";
import { approveFinalAudit } from "@/actions/audit";
import { decideRework, reassignProductionJob } from "@/actions/production";
import { decideOrderCancellation } from "@/actions/cancel";
import { retryNotification } from "@/actions/notifications";

type Dash = Extract<Awaited<ReturnType<typeof getOwnerDashboard>>, { success: true }>["data"];
type AuditLog = { id: string; actor: string; actorRole: string | null; action: string; entityType: string; entityId: string; createdAt: string };

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—");

function ApprovalModal({
  title, description, details, approveLabel = "Setujui", rejectLabel = "Tolak", extra,
  onApprove, onReject, onClose, busy, canApprove = true,
}: {
  title: string; description: string; details: { label: string; value: string }[];
  approveLabel?: string; rejectLabel?: string; extra?: React.ReactNode;
  onApprove: () => void; onReject: () => void; onClose: () => void; busy: boolean; canApprove?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-modal space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-bold text-primary">{title}</h3>
            <p className="text-xs text-muted mt-1">{description}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated"><X className="h-5 w-5" /></button>
        </div>
        <div className="bg-elevated rounded-xl p-4 space-y-2 border border-border">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between items-center text-xs">
              <span className="text-muted">{d.label}</span>
              <span className="font-semibold text-primary text-right max-w-[60%]">{d.value}</span>
            </div>
          ))}
        </div>
        {extra}
        <div className="flex gap-3">
          <button disabled={busy} onClick={onReject} className="flex-1 h-10 rounded-xl bg-status-red/10 text-status-red text-xs font-bold hover:bg-status-red/20 disabled:opacity-50 flex items-center justify-center gap-1.5">
            <XCircle className="h-4 w-4" /> {rejectLabel}
          </button>
          <button disabled={busy || !canApprove} onClick={onApprove} className="flex-1 h-10 rounded-xl bg-status-green text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {approveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ icon: Icon, label, sub, tier, action, onAction, href }: {
  icon: React.ComponentType<{ className?: string }>; label: string; sub?: string;
  tier: "red" | "orange"; action?: string; onAction?: () => void; href?: string;
}) {
  const c = tier === "red"
    ? { bg: "bg-status-red/10", border: "border-status-red/20", text: "text-status-red", btn: "bg-status-red text-white hover:brightness-110" }
    : { bg: "bg-status-yellow/10", border: "border-status-yellow/20", text: "text-status-yellow-text", btn: "bg-transparent text-status-yellow-text border border-status-yellow/30 hover:bg-status-yellow/5" };
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border", c.bg, c.border)}>
      <div className="p-1.5 rounded-lg bg-card shadow-card"><Icon className={cn("h-4 w-4", c.text)} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-primary truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted truncate mt-0.5">{sub}</p>}
      </div>
      {action && href && (
        <Link href={href} className={cn("flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap", c.btn)}>{action}</Link>
      )}
      {action && onAction && (
        <button onClick={onAction} className={cn("flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap", c.btn)}>{action}</button>
      )}
    </div>
  );
}

const OkGreen = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-status-green/10 border border-status-green/20 rounded-xl text-xs text-status-green">
    <CheckCircle2 className="h-4 w-4 flex-shrink-0" /><span>{text}</span>
  </div>
);

type Modal =
  | { kind: "discount"; row: Dash["pendingDiscounts"][number] }
  | { kind: "rework"; row: Dash["reworkPending"][number] }
  | { kind: "audit"; row: Dash["auditsPending"][number] }
  | { kind: "cancel"; row: Dash["cancelRequests"][number] }
  | { kind: "reassign"; row: Dash["reassignPending"][number] }
  | null;

export default function OwnerPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [reassign, setReassign] = useState({ machineId: "", operatorId: "", reason: "" });

  const load = useCallback(async () => {
    const res = await getOwnerDashboard();
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setD(res.data);
    try {
      const r = await fetch("/api/audit-logs?limit=10");
      const j = await r.json();
      if (Array.isArray(j.logs)) setLogs(j.logs);
    } catch { /* optional */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Aksi gagal."); return; }
    setModal(null);
    setReassign({ machineId: "", operatorId: "", reason: "" });
    await load();
  }

  const criticalCount = d
    ? d.reworkPending.length + d.cancelRequests.length + d.reassignPending.length +
      (d.overdue.length ? 1 : 0) + (d.waFailed.length ? 1 : 0) +
      (d.anomalies.highWaste.length || d.anomalies.orphanMovements ? 1 : 0)
    : 0;
  const reviewCount = d ? d.pendingDiscounts.length + d.auditsPending.length + (d.lowStock.length ? 1 : 0) : 0;

  const kpi = [
    { icon: ShoppingBag, label: "Total Order Hari Ini", value: d?.kpi.ordersToday ?? "—" },
    { icon: Package, label: "Siap Diambil", value: d?.kpi.readyPickup ?? "—" },
    { icon: Activity, label: "Produksi Aktif", value: d?.kpi.produksiAktif ?? "—" },
    { icon: TrendingUp, label: "Omset Bulan Ini", value: d ? rupiah(d.kpi.omsetBulanIni) : "—", gold: true },
  ];

  const pipelineStages = d
    ? [
        { label: "Produksi", n: d.pipeline.produksi },
        { label: "QC", n: d.pipeline.qc },
        { label: "Finishing", n: d.pipeline.finishing },
        { label: "Storage", n: d.pipeline.storage },
        { label: "Tersimpan", n: d.pipeline.stored },
        { label: "Siap Ambil", n: d.pipeline.siapAmbil },
      ]
    : [];

  return (
    <div className="space-y-5 bg-elevated p-6 rounded-2xl min-h-screen text-primary">
      {modal?.kind === "discount" && (
        <ApprovalModal
          title={`Approval Diskon — ${modal.row.orderCode}`}
          description={`${modal.row.customerName} mengajukan diskon`}
          details={[
            { label: "Nominal Diskon", value: rupiah(modal.row.discount) },
            { label: "Total Order", value: rupiah(modal.row.total) },
            { label: "Alasan", value: modal.row.reason ?? "-" },
          ]}
          busy={busy}
          onApprove={() => run(() => decideDiscount(modal.row.orderId, { approve: true }))}
          onReject={() => run(() => decideDiscount(modal.row.orderId, { approve: false }))}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "rework" && (
        <ApprovalModal
          title={`Keputusan Rework — ${modal.row.jobCode}`}
          description={`Order ${modal.row.orderCode} · gagal QC (rework ke-${(modal.row.reworkCount ?? 0) + 1})`}
          details={[
            { label: "Job", value: modal.row.jobCode },
            { label: "Alasan QC FAIL", value: modal.row.reason ?? "-" },
          ]}
          approveLabel="Approve (Child Job)"
          rejectLabel="Reject (Reprint)"
          busy={busy}
          onApprove={() => run(() => decideRework(modal.row.jobCode, { decision: "APPROVED", reason: "Owner approve rework via dashboard" }))}
          onReject={() => run(() => decideRework(modal.row.jobCode, { decision: "REJECTED", reason: "Owner reject rework via dashboard" }))}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "audit" && (
        <ApprovalModal
          title={`Final Audit YELLOW — ${modal.row.orderCode}`}
          description={`${modal.row.customerName} · audit menunggu persetujuan Owner`}
          details={[{ label: "Order", value: modal.row.orderCode }]}
          approveLabel="Setujui & CLOSE"
          rejectLabel="Tolak (ON_HOLD)"
          busy={busy}
          onApprove={() => run(() => approveFinalAudit(modal.row.orderId, { approve: true }))}
          onReject={() => run(() => approveFinalAudit(modal.row.orderId, { approve: false }))}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "cancel" && (
        <ApprovalModal
          title={`Permintaan Cancel — ${modal.row.orderCode}`}
          description={`${modal.row.customerName} · produksi berjalan (${modal.row.orderStatus})`}
          details={[
            { label: "Alasan diajukan Admin", value: modal.row.reason ?? "-" },
            { label: "DP masuk", value: rupiah(modal.row.paidAmount) },
            { label: "Kebijakan", value: "DP HANGUS jika disetujui" },
          ]}
          approveLabel="Setujui Cancel"
          rejectLabel="Tolak"
          busy={busy}
          onApprove={() => run(() => decideOrderCancellation(modal.row.orderId, { approve: true }))}
          onReject={() => run(() => decideOrderCancellation(modal.row.orderId, { approve: false }))}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "reassign" && d && (
        <ApprovalModal
          title={`Reassign Job — ${modal.row.jobCode}`}
          description={`Sudah ${modal.row.count}× reassign dalam 24 jam — butuh keputusan Owner.`}
          details={[{ label: "Job", value: modal.row.jobCode }]}
          approveLabel="Reassign"
          rejectLabel="Batal"
          busy={busy}
          canApprove={!!reassign.machineId && !!reassign.operatorId && !!reassign.reason.trim()}
          extra={
            <div className="space-y-2">
              <select value={reassign.machineId} onChange={(e) => setReassign({ ...reassign, machineId: e.target.value })}
                className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal">
                <option value="">Pilih mesin baru…</option>
                {d.reassignOptions.machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={reassign.operatorId} onChange={(e) => setReassign({ ...reassign, operatorId: e.target.value })}
                className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal">
                <option value="">Pilih operator baru…</option>
                {d.reassignOptions.operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <input value={reassign.reason} onChange={(e) => setReassign({ ...reassign, reason: e.target.value })}
                placeholder="Alasan reassignment (wajib)…"
                className="w-full h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-3 outline-none focus:border-accent-teal" />
            </div>
          }
          onApprove={() => run(() => reassignProductionJob(modal.row.jobCode, { machineId: reassign.machineId, operatorId: reassign.operatorId, reason: reassign.reason }))}
          onReject={() => setModal(null)}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="h-6 w-6 text-accent-teal" /> Dashboard Owner</h1>
          <p className="text-sm text-muted mt-0.5">Visibilitas penuh — Keuangan · Produksi · Approval · Audit</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent-teal/10 text-accent-teal border border-border">Akses Penuh</span>
      </div>

      {error && <div className="rounded-xl border border-status-red/20 bg-status-red/10 px-4 py-3 text-xs font-bold text-status-red">{error}</div>}

      {/* KPI (spec: 4 card) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpi.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-5">
            <div className={cn("p-2.5 rounded-xl w-fit mb-3", k.gold ? "bg-status-yellow/10" : "bg-accent-teal/10")}>
              <k.icon className={cn("h-5 w-5", k.gold ? "text-status-yellow-text" : "text-accent-teal")} />
            </div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{k.label}</p>
            <p className={cn("text-2xl font-bold mt-1 font-mono", k.gold ? "text-status-yellow-text" : "text-primary")}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alert panel */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Bell className="h-5 w-5 text-accent-teal" />
          <h2 className="text-base font-bold text-primary">Alert Kritis & Antrian Approval</h2>
        </div>

        {/* Tier 1 — butuh keputusan */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-status-red uppercase tracking-wider">Butuh Keputusan Anda</span>
            <span className="bg-status-red text-white text-[10px] font-black px-2 py-0.5 rounded-full">{criticalCount}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {d?.reworkPending.map((r) => (
              <AlertRow key={r.jobCode} icon={RotateCcw} label={`QC FAIL — ${r.jobCode}`} sub={`${r.orderCode} · ${r.reason ?? "menunggu keputusan rework"}`}
                tier="red" action="Putuskan" onAction={() => setModal({ kind: "rework", row: r })} />
            ))}
            {d?.cancelRequests.map((c) => (
              <AlertRow key={c.orderId} icon={Ban} label={`Permintaan Cancel — ${c.orderCode}`} sub={`${c.customerName} · ${c.reason ?? ""}`}
                tier="red" action="Tinjau" onAction={() => setModal({ kind: "cancel", row: c })} />
            ))}
            {d?.reassignPending.map((r) => (
              <AlertRow key={r.jobCode} icon={Wrench} label={`Reassignment Limit — ${r.jobCode}`} sub={`Sudah ${r.count}× reassign dalam 24 jam`}
                tier="red" action="Putuskan" onAction={() => setModal({ kind: "reassign", row: r })} />
            ))}
            {d && d.overdue.length > 0 && (
              <AlertRow icon={AlertTriangle} label={`Order OVERDUE (${d.overdue.length})`}
                sub={d.overdue.slice(0, 3).map((o) => `${o.orderCode} — ${o.customerName} (${fmtDate(o.deadline)})`).join(" · ")}
                tier="red" action="Lihat" href="/admin?status=OVERDUE" />
            )}
            {d && d.waFailed.length > 0 && (
              <AlertRow icon={MessageSquareX} label={`Notifikasi WA Gagal (${d.waFailed.length})`}
                sub={d.waFailed.slice(0, 3).map((n) => `${n.orderCode} — ${n.customerName}`).join(" · ")}
                tier="red" action="Kelola" href="/admin" />
            )}
            {d && (d.anomalies.highWaste.length > 0 || d.anomalies.orphanMovements > 0) && (
              <AlertRow icon={ShieldAlert}
                label={`Anomali & Kecurangan`}
                sub={[
                  d.anomalies.highWaste.length ? `${d.anomalies.highWaste.length} job waste >20% (${d.anomalies.highWaste.slice(0, 2).map((w) => `${w.jobCode} ${Math.round(w.ratio * 100)}%`).join(", ")})` : "",
                  d.anomalies.orphanMovements ? `${d.anomalies.orphanMovements} pemakaian bahan tanpa Job ID` : "",
                ].filter(Boolean).join(" · ")}
                tier="red" action="Audit" href="/audit-logs" />
            )}
            {criticalCount === 0 && <OkGreen text="Tidak ada yang butuh keputusan Anda saat ini" />}
          </div>
        </div>

        {/* Tier 2 — perlu ditinjau */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-status-yellow-text uppercase tracking-wider">Perlu Ditinjau</span>
            <span className="bg-status-yellow/10 text-status-yellow-text text-[10px] font-black px-2 py-0.5 rounded-full border border-status-yellow/20">{reviewCount}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {d?.pendingDiscounts.map((x) => (
              <AlertRow key={x.orderId} icon={BadgePercent} label={`Permohonan Diskon — ${x.orderCode}`} sub={`${x.customerName} · ${rupiah(x.discount)} · ${x.reason ?? ""}`}
                tier="orange" action="Tinjau Diskon" onAction={() => setModal({ kind: "discount", row: x })} />
            ))}
            {d?.auditsPending.map((a) => (
              <AlertRow key={a.orderId} icon={ClipboardCheck} label={`Final Audit YELLOW — ${a.orderCode}`} sub={`${a.customerName} · menunggu persetujuan`}
                tier="orange" action="Tinjau Audit" onAction={() => setModal({ kind: "audit", row: a })} />
            ))}
            {d && d.lowStock.length > 0 && (
              <AlertRow icon={ShieldAlert} label={`Stok Menipis (${d.lowStock.length} bahan)`}
                sub={d.lowStock.map((s) => `${s.name}: ${s.current} ${s.unit}`).join(" · ")} tier="orange" />
            )}
            {reviewCount === 0 && <OkGreen text="Tidak ada diskon / audit / stok yang perlu ditinjau" />}
          </div>
        </div>
      </div>

      {/* Operasional: pipeline + absensi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-accent-teal" />
            <h3 className="font-bold text-base text-primary">Pipeline Produksi</h3>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {pipelineStages.map((s) => (
              <div key={s.label} className="text-center">
                <div className="h-1.5 rounded-full bg-accent-teal/50 mb-2" />
                <p className="text-3xl font-bold text-primary">{s.n}</p>
                <p className="text-[10px] text-muted font-medium uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
            {pipelineStages.length === 0 && <p className="col-span-6 text-center text-xs text-muted py-4">Memuat…</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-accent-teal" />
            <h3 className="font-bold text-base text-primary">Absensi Hari Ini</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-green" /> Hadir</span><span className="font-bold">{d?.attendance.present ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-yellow" /> Terlambat</span><span className="font-bold">{d?.attendance.late ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-red" /> Belum Absen</span><span className="font-bold">{d?.attendance.notCheckedIn ?? "—"}</span></div>
          </div>
          <p className="text-[10px] text-muted mt-3">Detail di menu Laporan Pegawai.</p>
        </div>
      </div>

      {/* Audit log widget */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-accent-teal" />
            <h3 className="font-bold text-sm">Audit Log — 10 Aksi Terbaru</h3>
          </div>
          <Link href="/audit-logs" className="text-xs text-accent-teal font-semibold hover:underline flex items-center gap-1">
            Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-border/60 max-h-[420px] overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="px-4 py-3 hover:bg-elevated/30 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-accent-teal font-mono">{l.action}</p>
                <p className="text-[10px] text-muted truncate">{l.entityType}:{l.entityId.slice(0, 20)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-primary font-medium">{l.actor}{l.actorRole ? ` · ${l.actorRole}` : ""}</p>
                <p className="text-[10px] font-mono text-muted">{new Date(l.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
          {logs.length === 0 && <p className="p-6 text-center text-xs text-muted">Belum ada aktivitas terekam.</p>}
        </div>
      </div>
    </div>
  );
}
