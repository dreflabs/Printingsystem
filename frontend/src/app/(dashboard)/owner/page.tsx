"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Crown, DollarSign, TrendingUp, ShoppingBag, Package, AlertTriangle, RotateCcw,
  BadgePercent, CheckCircle2, XCircle, BarChart3, Bell, ShieldAlert, Activity,
  ClipboardList, X, ClipboardCheck,
} from "lucide-react";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getOwnerQueues, getOrders } from "@/actions/queries";
import { getDailyRevenue } from "@/actions/reports";
import { decideDiscount } from "@/actions/orders";
import { approveFinalAudit } from "@/actions/audit";
import { decideRework } from "@/actions/production";

type Queues = {
  pendingDiscounts: { orderId: string; orderCode: string; customerName: string; discount: number; total: number; reason: string | null }[];
  reworkPending: { jobCode: string; orderCode: string; reason: string | null }[];
  auditsPending: { orderId: string; orderCode: string; customerName: string }[];
  lowStock: { name: string; current: number; min: number; unit: string }[];
  overdueCount: number;
  incidentCount: number;
};
type OrderRow = { id: string; orderCode: string; customerName: string; status: string; total: number; balance: number };
type AuditLog = { id: string; actor: string; action: string; entityType: string; entityId: string; createdAt: string };

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

function ApprovalModal({
  title, description, details, approveLabel = "Setujui", rejectLabel = "Tolak",
  onApprove, onReject, onClose, busy,
}: {
  title: string; description: string; details: { label: string; value: string }[];
  approveLabel?: string; rejectLabel?: string;
  onApprove: () => void; onReject: () => void; onClose: () => void; busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1C2333]/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border border-[#E6E8EF] rounded-[10px] p-6 shadow-sm space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-bold text-[#1C2333]">{title}</h3>
            <p className="text-xs text-[#5B6479] mt-1">{description}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#5B6479] hover:text-[#1C2333] hover:bg-[#F6F7FA]"><X className="h-5 w-5" /></button>
        </div>
        <div className="bg-[#F6F7FA] rounded-[10px] p-4 space-y-2 border border-[#E6E8EF]">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between items-center text-xs">
              <span className="text-[#5B6479]">{d.label}</span>
              <span className="font-semibold text-[#1C2333] text-right max-w-[60%]">{d.value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button disabled={busy} onClick={onReject} className="flex-1 h-10 rounded-[10px] bg-[#FCEBEB] text-[#D64545] text-xs font-bold hover:bg-[#FCEBEB]/80 disabled:opacity-50 flex items-center justify-center gap-1.5">
            <XCircle className="h-4 w-4" /> {rejectLabel}
          </button>
          <button disabled={busy} onClick={onApprove} className="flex-1 h-10 rounded-[10px] bg-[#1F8A5B] text-white text-xs font-bold hover:bg-[#1F8A5B]/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {approveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ icon: Icon, label, sub, tier, action, onAction }: {
  icon: React.ComponentType<{ className?: string }>; label: string; sub?: string;
  tier: "red" | "orange" | "gray"; action?: string; onAction?: () => void;
}) {
  const c = {
    red: { bg: "bg-[#FCEBEB]", border: "border-[#D64545]/20", text: "text-[#D64545]", btn: "bg-[#D64545] text-white hover:bg-[#D64545]/90" },
    orange: { bg: "bg-[#FBF1E1]", border: "border-[#B8760A]/20", text: "text-[#B8760A]", btn: "bg-transparent text-[#B8760A] border border-[#B8760A]/30 hover:bg-[#B8760A]/5" },
    gray: { bg: "bg-transparent", border: "border-transparent", text: "text-[#5B6479]", btn: "bg-[#F6F7FA] text-[#1C2333] border border-[#E6E8EF] hover:bg-[#E6E8EF]" },
  }[tier];
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-[10px] border", c.bg, c.border)}>
      <div className="p-1.5 rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"><Icon className={cn("h-4 w-4", c.text)} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[#1C2333] truncate">{label}</p>
        {sub && <p className="text-[10px] text-[#5B6479] truncate mt-0.5">{sub}</p>}
      </div>
      {action && onAction && (
        <button onClick={onAction} className={cn("flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-[10px] whitespace-nowrap", c.btn)}>{action}</button>
      )}
    </div>
  );
}

const OkGreen = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-[#E7F5EE] border border-[#1F8A5B]/20 rounded-[10px] text-xs text-[#1F8A5B]">
    <CheckCircle2 className="h-4 w-4 flex-shrink-0" /><span>{text}</span>
  </div>
);

type Modal =
  | { kind: "discount"; row: Queues["pendingDiscounts"][number] }
  | { kind: "rework"; row: Queues["reworkPending"][number] }
  | { kind: "audit"; row: Queues["auditsPending"][number] }
  | null;

export default function OwnerPage() {
  const [q, setQ] = useState<Queues | null>(null);
  const [highValue, setHighValue] = useState<OrderRow[]>([]);
  const [revenue, setRevenue] = useState<{ combinedRevenue: number; newPrintingOrders: number } | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [qr, or, rv] = await Promise.all([getOwnerQueues(), getOrders({ type: "PRINTING", limit: 100 }), getDailyRevenue()]);
    if (!qr.success) { setError(qr.error); return; }
    setError(null);
    setQ(qr.data);
    if (or.success) setHighValue([...or.data].sort((a, b) => b.total - a.total).slice(0, 6));
    if (rv.success) setRevenue(rv.data);
    try {
      const res = await fetch("/api/audit-logs?limit=12");
      const j = await res.json();
      if (Array.isArray(j.logs)) setLogs(j.logs);
    } catch { /* audit log optional */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) { setError(res.error ?? "Aksi gagal."); return; }
    setModal(null);
    await load();
  }

  const tier1 = (q?.reworkPending.length ?? 0) + (q?.overdueCount ? 1 : 0) + (q?.incidentCount ? 1 : 0);
  const tier2 = (q?.pendingDiscounts.length ?? 0) + (q?.auditsPending.length ?? 0) + (q?.lowStock.length ? 1 : 0);

  return (
    <div className="space-y-5 bg-[#F6F7FA] p-6 rounded-2xl min-h-screen text-[#1C2333]">
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
          description={`Order ${modal.row.orderCode} · job gagal QC`}
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="h-6 w-6 text-[#2454FF]" /> Dashboard Owner</h1>
          <p className="text-sm text-[#5B6479] mt-0.5">Keuangan · Produksi · Approval · Audit</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EEF2FF] text-[#2454FF] border border-[#E6E8EF]">Akses Penuh</span>
      </div>

      {error && <div className="rounded-[10px] border border-[#D64545]/20 bg-[#FCEBEB] px-4 py-3 text-xs font-bold text-[#D64545]">{error}</div>}

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: ShoppingBag, label: "Order Printing Hari Ini", value: revenue?.newPrintingOrders ?? "—" },
          { icon: Package, label: "Antrian Keputusan", value: tier1 + tier2 },
          { icon: Activity, label: "Bahan Menipis", value: q?.lowStock.length ?? "—" },
          { icon: TrendingUp, label: "Pendapatan Hari Ini", value: revenue ? rupiah(revenue.combinedRevenue) : "—", gold: true },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-[#E6E8EF] rounded-[10px] p-5">
            <div className={cn("p-2.5 rounded-[10px] w-fit mb-3", k.gold ? "bg-[#FBF1E1]" : "bg-[#EEF2FF]")}>
              <k.icon className={cn("h-5 w-5", k.gold ? "text-[#B8760A]" : "text-[#2454FF]")} />
            </div>
            <p className="text-[10px] font-semibold text-[#5B6479] uppercase tracking-wider">{k.label}</p>
            <p className={cn("text-2xl font-bold mt-1 font-mono", k.gold ? "text-[#B8760A]" : "text-[#1C2333]")}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <div className="bg-white border border-[#E6E8EF] rounded-[10px] p-5 space-y-6">
        <div className="flex items-center gap-2 border-b border-[#E6E8EF] pb-3">
          <Bell className="h-5 w-5 text-[#2454FF]" />
          <h2 className="text-base font-bold">Alert & Antrian Keputusan</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#D64545] uppercase tracking-wider">Tier 1 · Butuh Keputusan Anda</span>
            <span className="bg-[#D64545] text-white text-[10px] font-black px-2 py-0.5 rounded-full">{tier1}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {q?.reworkPending.map((r) => (
              <AlertRow key={r.jobCode} icon={RotateCcw} label={`Rework Pending — ${r.jobCode}`} sub={`${r.orderCode} · ${r.reason ?? "QC FAIL"}`}
                tier="red" action="Putuskan" onAction={() => setModal({ kind: "rework", row: r })} />
            ))}
            {q && q.reworkPending.length === 0 && <OkGreen text="Tidak ada rework menunggu keputusan" />}
            {q && q.overdueCount > 0
              ? <AlertRow icon={AlertTriangle} label={`Order OVERDUE (${q.overdueCount})`} sub="Order melewati deadline — cek daftar order" tier="red" />
              : <OkGreen text="Tidak ada order overdue" />}
            {q && q.incidentCount > 0 && <AlertRow icon={ShieldAlert} label={`Insiden Storage (${q.incidentCount})`} sub="Barang tidak ditemukan di lokasi tercatat" tier="red" />}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#B8760A] uppercase tracking-wider">Tier 2 · Perlu Ditinjau</span>
            <span className="bg-[#FBF1E1] text-[#B8760A] text-[10px] font-black px-2 py-0.5 rounded-full border border-[#B8760A]/20">{tier2}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {q?.pendingDiscounts.map((d) => (
              <AlertRow key={d.orderId} icon={BadgePercent} label={`Permohonan Diskon — ${d.orderCode}`} sub={`${d.customerName} · ${rupiah(d.discount)} · ${d.reason ?? ""}`}
                tier="orange" action="Tinjau Diskon" onAction={() => setModal({ kind: "discount", row: d })} />
            ))}
            {q?.auditsPending.map((a) => (
              <AlertRow key={a.orderId} icon={ClipboardCheck} label={`Final Audit YELLOW — ${a.orderCode}`} sub={`${a.customerName} · menunggu persetujuan Owner`}
                tier="orange" action="Tinjau Audit" onAction={() => setModal({ kind: "audit", row: a })} />
            ))}
            {q && q.lowStock.length > 0
              ? <AlertRow icon={ShieldAlert} label={`Stok Menipis (${q.lowStock.length} bahan)`} sub={q.lowStock.map((s) => `${s.name}: ${s.current} ${s.unit}`).join(" · ")} tier="orange" />
              : <OkGreen text="Stok semua bahan aman" />}
            {q && q.pendingDiscounts.length === 0 && q.auditsPending.length === 0 && <OkGreen text="Tidak ada diskon / audit menunggu" />}
          </div>
        </div>
      </div>

      {/* High value orders + audit log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#E6E8EF] rounded-[10px] overflow-hidden">
          <div className="p-5 border-b border-[#E6E8EF] flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#2454FF]" />
            <h3 className="font-bold text-base">Order Bernilai Tinggi</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F6F7FA] border-b border-[#E6E8EF] text-[#5B6479] font-semibold uppercase tracking-wide">
                <tr><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Konsumen</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Sisa</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EF]">
                {highValue.map((o) => (
                  <tr key={o.id} className="hover:bg-[#F6F7FA]/50">
                    <td className="px-4 py-3 font-mono text-[#2454FF] font-bold">{o.orderCode}</td>
                    <td className="px-4 py-3 font-semibold">{o.customerName}</td>
                    <td className="px-4 py-3 font-mono font-bold">{rupiah(o.total)}</td>
                    <td className={cn("px-4 py-3 font-mono", o.balance > 0 ? "text-[#B8760A]" : "text-[#1F8A5B]")}>{o.balance > 0 ? rupiah(o.balance) : "Lunas"}</td>
                    <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                  </tr>
                ))}
                {highValue.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-[#5B6479]">Belum ada order printing.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EF] rounded-[10px] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#E6E8EF] flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#2454FF]" />
            <h3 className="font-bold text-sm">Audit Log Terbaru</h3>
          </div>
          <div className="flex-1 divide-y divide-[#E6E8EF]/50 overflow-y-auto max-h-[520px]">
            {logs.map((l) => (
              <div key={l.id} className="px-4 py-3 hover:bg-[#F6F7FA]/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-[#9AA2B4]">{new Date(l.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#F6F7FA] text-[#5B6479] border border-[#E6E8EF]">{l.actor}</span>
                </div>
                <p className="text-xs font-semibold text-[#2454FF] font-mono">{l.action}</p>
                <p className="text-[10px] text-[#5B6479] truncate">{l.entityType}:{l.entityId}</p>
              </div>
            ))}
            {logs.length === 0 && <p className="p-6 text-center text-xs text-[#5B6479]">Belum ada aktivitas terekam.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#E6E8EF] rounded-[10px] p-5 flex items-center gap-2 text-xs text-[#5B6479]">
        <BarChart3 className="h-4 w-4 text-[#2454FF]" />
        Laporan pendapatan harian, piutang, dan kinerja operator ada di menu <strong className="text-[#1C2333]">Laporan</strong>.
      </div>
    </div>
  );
}
