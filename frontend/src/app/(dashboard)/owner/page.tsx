"use client";

import { useState } from "react";
import {
  Crown,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  RotateCcw,
  BadgePercent,
  CheckCircle2,
  XCircle,
  BarChart3,
  ArrowUpRight,
  Bell,
  MessageSquareX,
  ShieldAlert,
  Activity,
  ClipboardList,
  X,
  Users,
  Search,
  ScanBarcode,
  ThumbsDown,
  Wrench
} from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

// ── Audit Log mock entries are now in the store ─────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-accent-teal/10 text-accent-teal",
  designer_sales: "bg-status-blue/10 text-status-blue",
  operator: "bg-status-blue/10 text-status-blue",
  finishing: "bg-status-green/10 text-status-green",
  owner: "bg-accent-teal/10 text-accent-teal",
};

// ── Approval Modal ────────────────────────────────────────────────────────────
function ApprovalModal({
  title,
  description,
  details,
  onApprove,
  onReject,
  onClose,
}: {
  title: string;
  description: string;
  details: { label: string; value: string }[];
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.6)] space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-bold text-primary">{title}</h3>
            <p className="text-xs text-muted mt-1">{description}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary hover:bg-elevated cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-elevated/60 rounded-xl p-4 space-y-2 border border-border">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between items-center text-xs">
              <span className="text-muted">{d.label}</span>
              <span className="font-semibold text-primary">{d.value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 h-10 rounded-xl bg-status-red/10 text-status-red text-xs font-bold hover:bg-status-red/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <XCircle className="h-4 w-4" /> Tolak
          </button>
          <button
            onClick={onApprove}
            className="flex-1 h-10 rounded-xl bg-status-green text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" /> Setujui
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OwnerPage() {
  const orders = useWorkflowStore((s) => s.orders);
  const jobs = useWorkflowStore((s) => s.jobs);
  const inventory = useWorkflowStore((s) => s.inventory);
  const logs = useWorkflowStore((s) => s.logs);
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);

  // KPI — sesuai dokumen DASHBOARD.md
  const today = new Date().toDateString();
  const totalOrderToday = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;
  const readyPickup = orders.filter((o) => o.status === "READY_FOR_PICKUP").length;
  const produksiAktif = jobs.filter((j) => j.status === "PRINTING" || j.status === "FINISHING").length;
  const omsetBulanIni = orders
    .filter((o) => new Date(o.createdAt).getMonth() === new Date().getMonth())
    .reduce((sum, o) => sum + Number(o.dpAmount || 0), 0);

  // Alert data
  const qcFailed = jobs.filter((j) => j.status === "QC_FAILED");
  const overdue = orders.filter((o) => o.overdue);
  const lowStock = inventory.filter((i) => {
    // Abaikan bahan sisa/potongan
    if (i.name.toLowerCase().includes("sisa") || i.name.toLowerCase().includes("potongan") || i.id.toLowerCase().includes("sisa")) return false;
    // Batas aman: Roll/Meter < 2, Lembaran < 100
    const isRoll = i.unit.toLowerCase().includes("roll") || i.unit.toLowerCase().includes("meter");
    return isRoll ? i.stock < 2 : i.stock < 100;
  });

  // Pipeline counts
  const pipeline = [
    { label: "Desain", count: jobs.filter((j) => j.status === "WAITING_DESIGN" || j.status === "DESIGN_REVIEW").length, color: "bg-status-blue" },
    { label: "Cetak", count: jobs.filter((j) => j.status === "WAITING_PRINT" || j.status === "PRINTING").length, color: "bg-accent-teal" },
    { label: "QC", count: jobs.filter((j) => j.status === "WAITING_QC").length, color: "bg-status-yellow" },
    { label: "Finishing", count: jobs.filter((j) => j.status === "QC_PASSED" || j.status === "FINISHING").length, color: "bg-accent-teal" },
    { label: "Storage", count: jobs.filter((j) => j.status === "STORED").length, color: "bg-status-green" },
    { label: "Siap Ambil", count: readyPickup, color: "bg-status-green", glow: true },
  ];

  const kpis = [
    { label: "Total Order Hari Ini", value: totalOrderToday.toString(), color: "text-accent-teal", icon: ShoppingBag, bg: "bg-accent-teal/10" },
    { label: "Siap Diambil", value: readyPickup.toString(), color: "text-status-green", icon: Package, bg: "bg-status-green/10" },
    { label: "Produksi Aktif", value: produksiAktif.toString(), color: "text-status-blue", icon: Activity, bg: "bg-status-blue/10" },
    { label: "Omset Bulan Ini", value: `Rp ${(omsetBulanIni / 1_000_000).toFixed(1)}Jt`, color: "text-status-yellow", icon: TrendingUp, bg: "bg-status-yellow/10" },
  ];

  const [approvalState, setApprovalState] = useState<{
    open: boolean;
    type: "discount" | "cancel" | "rework" | null;
    jobId?: string;
  }>({ open: false, type: null });
  const [discountApproved, setDiscountApproved] = useState(false);
  const [cancelApproved, setCancelApproved] = useState(false);

  return (
    <div className="space-y-6">
      {/* Approval Modal */}
      {approvalState.open && approvalState.type === "discount" && (
        <ApprovalModal
          title="Approval Diskon — ORD-20260820-0021"
          description="Admin mengajukan diskon untuk PT Abadi Makmur (Pelanggan VIP)"
          details={[
            { label: "Nominal Diskon", value: "Rp 350.000 (10%)" },
            { label: "Alasan", value: "Pelanggan Setia — repeat order > 5x" },
            { label: "Diajukan oleh", value: "Admin Rere" },
          ]}
          onApprove={() => { setDiscountApproved(true); setApprovalState({ open: false, type: null }); }}
          onReject={() => setApprovalState({ open: false, type: null })}
          onClose={() => setApprovalState({ open: false, type: null })}
        />
      )}
      {approvalState.open && approvalState.type === "cancel" && (
        <ApprovalModal
          title="Approval Cancel Order — ORD-20260820-0021"
          description="Permintaan cancel order setelah produksi berjalan. Hanya Owner yang berwenang menyetujui."
          details={[
            { label: "Order", value: "ORD-20260820-0021 — PT Abadi Makmur" },
            { label: "Status Produksi", value: "PRODUCTION_STARTED" },
            { label: "DP Masuk", value: "Rp 1.750.000" },
          ]}
          onApprove={() => { setCancelApproved(true); setApprovalState({ open: false, type: null }); }}
          onReject={() => setApprovalState({ open: false, type: null })}
          onClose={() => setApprovalState({ open: false, type: null })}
        />
      )}
      {approvalState.open && approvalState.type === "rework" && approvalState.jobId && (
        <ApprovalModal
          title="Eskalasi Rework 2x QC FAIL"
          description="Job ini telah gagal QC 2 kali berturut-turut. Keputusan ada di tangan Owner."
          details={[
            { label: "Job", value: approvalState.jobId },
            { label: "Rework ke-", value: "3 (Perlu Izin Owner)" },
            { label: "Rekomendasi QC", value: "Reprint / Batalkan" },
          ]}
          onApprove={() => { updateJobStatus(approvalState.jobId!, "WAITING_PRINT"); setApprovalState({ open: false, type: null }); }}
          onReject={() => { updateJobStatus(approvalState.jobId!, "QC_FAILED"); setApprovalState({ open: false, type: null }); }}
          onClose={() => setApprovalState({ open: false, type: null })}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Crown className="h-6 w-6 text-accent-teal" />
            Dashboard Owner
          </h1>
          <p className="text-sm text-muted mt-0.5">Visibilitas penuh — Keuangan, Produksi, Approval, Audit</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">
          Akses Penuh Executive
        </span>
      </div>

      {/* KPI Cards — sesuai dokumen */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={cn("p-2.5 rounded-xl", k.bg)}>
                <k.icon className={cn("h-5 w-5", k.color)} />
              </div>
              <span className="text-[10px] text-muted font-mono flex items-center gap-0.5">
                Realtime <ArrowUpRight className="h-3 w-3 text-status-green" />
              </span>
            </div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">{k.label}</p>
            <p className={cn("text-2xl lg:text-3xl font-bold mt-1 font-mono", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alert Kritis Panel */}
      <div className="bg-card/70 backdrop-blur-xl border border-status-red/20 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-5 w-5 text-status-red" />
          <h2 className="text-base font-bold text-primary">Alert Kritis</h2>
          <span className="h-2 w-2 rounded-full bg-status-red animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

          {/* QC FAIL eskalasi */}
          {qcFailed.length > 0 ? (
            qcFailed.map((j) => (
              <div key={j.id} className="p-3 bg-status-red/5 border border-status-red/30 rounded-xl text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-status-red flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> QC FAIL Eskalasi</span>
                  <StatusPill status="QC_FAILED" />
                </div>
                <p className="text-muted">{j.id} · {j.product}</p>
                <button
                  onClick={() => setApprovalState({ open: true, type: "rework", jobId: j.id })}
                  className="w-full py-1.5 rounded-lg bg-status-red/10 text-status-red font-bold hover:bg-status-red/20 transition-all cursor-pointer"
                >
                  Tinjau & Putuskan
                </button>
              </div>
            ))
          ) : (
            <div className="p-3 bg-elevated/40 border border-border rounded-xl text-xs text-muted border-dashed flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted/50" /> Tidak ada eskalasi QC FAIL
            </div>
          )}

          {/* Cancel Order Request */}
          {!cancelApproved ? (
            <div className="p-3 bg-status-yellow/5 border border-status-yellow/30 rounded-xl text-xs space-y-2">
              <span className="font-bold text-status-yellow flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" /> Permintaan Cancel Order</span>
              <p className="text-muted">ORD-20260820-0021 · PT Abadi Makmur</p>
              <p className="text-[10px] text-muted">Produksi sudah berjalan. Butuh izin Owner.</p>
              <button
                onClick={() => setApprovalState({ open: true, type: "cancel" })}
                className="w-full py-1.5 rounded-lg bg-status-yellow/10 text-status-yellow font-bold hover:bg-status-yellow/20 transition-all cursor-pointer"
              >
                Tinjau Cancel
              </button>
            </div>
          ) : (
            <div className="p-3 bg-status-green/10 border border-status-green/30 rounded-xl text-xs text-status-green font-bold border-dashed flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Cancel Order Disetujui
            </div>
          )}

          {/* Discount Request */}
          {!discountApproved ? (
            <div className="p-3 bg-status-yellow/5 border border-status-yellow/30 rounded-xl text-xs space-y-2">
              <span className="font-bold text-status-yellow flex items-center gap-1.5"><BadgePercent className="h-3.5 w-3.5" /> Permohonan Diskon</span>
              <p className="text-muted">ORD-20260820-0021 · PT Abadi Makmur</p>
              <p className="text-[10px] text-muted">Diskon 10% — Rp 350.000</p>
              <button
                onClick={() => setApprovalState({ open: true, type: "discount" })}
                className="w-full py-1.5 rounded-lg bg-status-yellow/10 text-status-yellow font-bold hover:bg-status-yellow/20 transition-all cursor-pointer"
              >
                Tinjau Diskon
              </button>
            </div>
          ) : (
            <div className="p-3 bg-status-green/10 border border-status-green/30 rounded-xl text-xs text-status-green font-bold border-dashed flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Diskon Disetujui
            </div>
          )}

          {/* Overdue Orders */}
          {overdue.length > 0 ? (
            <div className="p-3 bg-status-red/5 border border-status-red/30 rounded-xl text-xs space-y-1">
              <span className="font-bold text-status-red flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Order OVERDUE ({overdue.length})</span>
              {overdue.slice(0, 2).map((o) => (
                <p key={o.id} className="text-muted truncate">· {o.id} — {o.customerName}</p>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-elevated/40 border border-border rounded-xl text-xs text-muted border-dashed flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted/50" /> Tidak ada order overdue
            </div>
          )}

          {/* WA Gagal */}
          <div className="p-3 bg-status-red/5 border border-status-red/30 rounded-xl text-xs space-y-1">
            <span className="font-bold text-status-red flex items-center gap-1.5"><MessageSquareX className="h-3.5 w-3.5" /> Notifikasi WA Gagal (2)</span>
            <p className="text-muted">· Siti Rahayu — READY_FOR_PICKUP</p>
            <p className="text-muted">· Ahmad Fauzi — Desain Acc</p>
          </div>

          {/* Stok Menipis */}
          {lowStock.length > 0 && (
            <div className="p-3 bg-status-yellow/5 border border-status-yellow/30 rounded-xl text-xs space-y-1">
              <span className="font-bold text-status-yellow flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Stok Menipis ({lowStock.length})</span>
              {lowStock.map((s) => (
                <p key={s.id} className="text-muted">· {s.name}: <span className="text-status-red font-bold">{s.stock} {s.unit}</span></p>
              ))}
            </div>
          )}

          {/* Anomaly: Bahan Tanpa Job ID */}
          <div className="p-3 bg-status-red/5 border border-status-red/30 rounded-xl text-xs space-y-2">
            <div className="flex justify-between items-start">
              <span className="font-bold text-status-red flex items-center gap-1.5"><ScanBarcode className="h-3.5 w-3.5" /> Bahan Keluar Tanpa Job ID</span>
              <span className="bg-status-red text-white px-1.5 py-0.5 rounded text-[10px] font-bold">3 Kasus</span>
            </div>
            <p className="text-muted truncate">· Kertas Art Carton 260g (15 lbr) oleh <span className="font-semibold text-primary">Fajar</span></p>
            <p className="text-muted truncate">· Tinta Cyan (500ml) oleh <span className="font-semibold text-primary">Deni</span></p>
            <button className="w-full py-1.5 rounded-lg bg-status-red/10 text-status-red font-bold hover:bg-status-red/20 transition-all cursor-pointer">
              Tinjau Audit Finishing
            </button>
          </div>

          {/* Anomaly: Waste Tinggi */}
          <div className="p-3 bg-status-red/5 border border-status-red/30 rounded-xl text-xs space-y-2">
            <div className="flex justify-between items-start">
              <span className="font-bold text-status-red flex items-center gap-1.5"><ThumbsDown className="h-3.5 w-3.5" /> Waste Produksi &gt; 20%</span>
              <span className="bg-status-red text-white px-1.5 py-0.5 rounded text-[10px] font-bold">1 Kasus</span>
            </div>
            <p className="text-muted truncate">· JOB-012 (Mesin Roland): <span className="text-status-red font-bold">25% Waste</span></p>
            <p className="text-[10px] text-muted">Operator: Budi</p>
            <button className="w-full py-1.5 rounded-lg bg-status-red/10 text-status-red font-bold hover:bg-status-red/20 transition-all cursor-pointer">
              Lihat Detail Job
            </button>
          </div>

          {/* Anomaly: Manual Adjustment */}
          <div className="p-3 bg-status-yellow/5 border border-status-yellow/30 rounded-xl text-xs space-y-2">
            <div className="flex justify-between items-start">
              <span className="font-bold text-status-yellow flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Manual Adjustment (Finishing)</span>
              <span className="text-status-yellow text-[10px] font-bold">Baru saja</span>
            </div>
            <p className="text-[10px] text-muted">Pelaku: Eko (Finishing)</p>
            <button className="w-full py-1.5 rounded-lg bg-status-yellow/10 text-status-yellow font-bold hover:bg-status-yellow/20 transition-all cursor-pointer">
              Tanya Penanggung Jawab
            </button>
          </div>
        </div>
      </div>

      {/* Operational Area (Pipeline + Attendance) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Pipeline Produksi (Kanban Mini) */}
        <div className="lg:col-span-3 bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-bold text-primary">Pipeline Produksi Real-time</h2>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {pipeline.map((p, i) => (
              <div key={p.label} className="text-center space-y-2">
                <div className={cn("h-1.5 rounded-full w-full opacity-60", p.color)} />
                <p className={cn("text-3xl font-bold", p.glow ? "text-status-green" : "text-primary")}>{p.count}</p>
                <p className="text-[10px] text-muted font-medium uppercase tracking-wide">{p.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ringkasan Absensi Hari Ini */}
        <div className="lg:col-span-1 bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-bold text-primary">Absensi Pegawai</h2>
          </div>
          
          <div className="flex-1 space-y-4">
            {/* Hadir */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-green" />
                <span className="text-sm text-muted">Hadir Tepat Waktu</span>
              </div>
              <span className="text-lg font-bold text-primary">12</span>
            </div>

            {/* Terlambat */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-yellow mt-1.5" />
                <div>
                  <span className="text-sm text-muted block">Terlambat</span>
                  <span className="text-[10px] text-status-yellow font-medium">Budi (Opr), Fajar (Gud)</span>
                </div>
              </div>
              <span className="text-lg font-bold text-primary">2</span>
            </div>

            {/* Belum Absen */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-red mt-1.5" />
                <div>
                  <span className="text-sm text-muted block">Belum Absen</span>
                  <span className="text-[10px] text-status-red font-medium">Rere (Adm)</span>
                </div>
              </div>
              <span className="text-lg font-bold text-primary">1</span>
            </div>
          </div>
          
          <button className="mt-4 w-full py-2 bg-elevated text-xs font-semibold text-primary rounded-xl hover:bg-base transition-colors border border-border cursor-pointer">
            Lihat Laporan Absensi Lengkap
          </button>
        </div>
      </div>

      {/* Revenue Chart + High Value Orders + Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart + Order Tabel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Chart */}
          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-base text-primary">Tren Pendapatan Masuk Minggu Ini</h3>
                <p className="text-xs text-muted">Akumulasi DP & Pelunasan per hari</p>
              </div>
              <BarChart3 className="h-6 w-6 text-accent-teal" />
            </div>
            <div className="h-40 flex items-end justify-between gap-3 pb-2 border-b border-border">
              {[
                { day: "Sen", val: 40, label: "Rp 1.2M" },
                { day: "Sel", val: 65, label: "Rp 2.4M" },
                { day: "Rab", val: 55, label: "Rp 1.8M" },
                { day: "Kam", val: 80, label: "Rp 3.1M" },
                { day: "Jum", val: 95, label: "Rp 4.2M" },
                { day: "Sab", val: 70, label: "Rp 2.7M" },
                { day: "Min", val: 30, label: "Rp 900K" },
              ].map((bar) => (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[10px] text-accent-teal opacity-0 group-hover:opacity-100 transition-opacity font-mono">{bar.label}</span>
                  <div
                    style={{ height: `${bar.val}%` }}
                    className="w-full bg-gradient-to-t from-accent-teal/40 to-accent-teal rounded-t-lg transition-all group-hover:brightness-125"
                  />
                  <span className="text-[10px] text-muted font-medium">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* High Value Orders */}
          <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-accent-teal" />
              <h3 className="font-bold text-base text-primary">Order Bernilai Tinggi</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-elevated border-b border-border text-muted font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Kode Order</th>
                    <th className="px-4 py-3">Konsumen</th>
                    <th className="px-4 py-3">Total Tagihan</th>
                    <th className="px-4 py-3">Pembayaran</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...orders]
                    .sort((a, b) => Number(b.totalPrice) - Number(a.totalPrice))
                    .slice(0, 5)
                    .map((o) => (
                      <tr key={o.id} className="hover:bg-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-accent-teal font-bold">{o.id}</td>
                        <td className="px-4 py-3 font-semibold text-primary">{o.customerName}</td>
                        <td className="px-4 py-3 font-mono text-primary font-bold">
                          Rp {Number(o.totalPrice).toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold",
                            o.paymentStatus === "PAID" ? "bg-status-green/10 text-status-green" :
                            o.paymentStatus === "DP_PAID" ? "bg-status-yellow/10 text-status-yellow" :
                            "bg-muted/10 text-muted"
                          )}>
                            {o.paymentStatus === "PAID" ? "Lunas" : o.paymentStatus === "DP_PAID" ? "DP" : "Belum Bayar"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={o.status as any} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-accent-teal" />
              <h3 className="font-bold text-sm text-primary">Audit Log Terbaru</h3>
            </div>
            <span className="text-[10px] text-muted font-mono bg-elevated px-2 py-0.5 rounded border border-border">10 aksi</span>
          </div>
          <div className="flex-1 divide-y divide-border/50 overflow-y-auto max-h-[520px]">
            {logs.map((log, i) => {
              // Map ActivityLog to the display format
              const timeStr = new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              return (
              <div key={log.id || i} className="px-4 py-3 hover:bg-elevated/30 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted">{timeStr}</span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", "bg-elevated text-muted")}>
                    {log.operator}
                  </span>
                </div>
                <p className="text-xs font-semibold text-primary">{log.title}</p>
                <p className="text-[10px] text-accent-teal font-mono mt-0.5">{log.type}</p>
                <p className="text-[10px] text-muted truncate">{log.description}</p>
              </div>
            )})}
          </div>
          <div className="p-3 border-t border-border">
            <button className="w-full text-xs text-accent-teal hover:underline font-semibold cursor-pointer">
              Lihat Semua Audit Log →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
