"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  ScanBarcode,
  ThumbsDown,
  Wrench,
  ChevronRight,
  Info,
  Zap,
} from "lucide-react";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

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
      <div className="absolute inset-0 bg-[#1C2333]/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border border-[#E6E8EF] rounded-[10px] p-6 shadow-sm space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-bold text-[#1C2333]">{title}</h3>
            <p className="text-xs text-[#5B6479] mt-1">{description}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#5B6479] hover:text-[#1C2333] hover:bg-[#F6F7FA] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-[#F6F7FA] rounded-[10px] p-4 space-y-2 border border-[#E6E8EF]">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between items-center text-xs">
              <span className="text-[#5B6479]">{d.label}</span>
              <span className="font-semibold text-[#1C2333]">{d.value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 h-10 rounded-[10px] bg-[#FCEBEB] text-[#D64545] text-xs font-bold hover:bg-[#FCEBEB]/80 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <XCircle className="h-4 w-4" /> Tolak
          </button>
          <button
            onClick={onApprove}
            className="flex-1 h-10 rounded-[10px] bg-[#1F8A5B] text-white text-xs font-bold hover:bg-[#1F8A5B]/90 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" /> Setujui
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini SVG Line Chart (Sparkline) ───────────────────────────────────────────
function OmsetSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 200;
  const H = 40;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const areaPath = `M${pts[0]} L${pts.join(" L")} L${W - pad},${H} L${pad},${H} Z`;
  const lastPt = pts[pts.length - 1].split(",");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="omset-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B8760A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#B8760A" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#omset-area-grad)" />
      <polyline points={polyline} fill="none" stroke="#B8760A" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill="#B8760A" />
    </svg>
  );
}

// ── Alert Row Component ────────────────────────────────────────────────────────
function AlertRow({
  icon: Icon,
  label,
  sub,
  tier,
  action,
  onAction,
  done,
}: {
  icon: any;
  label: string;
  sub?: string;
  tier: "red" | "orange" | "gray";
  action?: string;
  onAction?: () => void;
  done?: boolean;
}) {
  if (done) return null; // Selesai disembunyikan agar tidak menumpuk

  const config = {
    red: {
      bg: "bg-[#FCEBEB]",
      border: "border-[#D64545]/20",
      text: "text-[#D64545]",
      btn: "bg-[#D64545] text-white hover:bg-[#D64545]/90 border-transparent",
    },
    orange: {
      bg: "bg-[#FBF1E1]",
      border: "border-[#B8760A]/20",
      text: "text-[#B8760A]",
      btn: "bg-transparent text-[#B8760A] border-[#B8760A]/30 hover:bg-[#B8760A]/5 border",
    },
    gray: {
      bg: "bg-transparent",
      border: "border-transparent",
      text: "text-[#5B6479]",
      btn: "bg-[#F6F7FA] text-[#1C2333] border-[#E6E8EF] hover:bg-[#E6E8EF] border",
    },
  }[tier];

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-[10px] border transition-colors", config.bg, config.border)}>
      <div className={cn("p-1.5 rounded-[10px] flex-shrink-0 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]")}>
        <Icon className={cn("h-4 w-4", config.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-bold truncate text-[#1C2333]")}>{label}</p>
        {sub && <p className="text-[10px] text-[#5B6479] truncate mt-0.5">{sub}</p>}
      </div>
      {action && onAction && (
        <button
          onClick={onAction}
          className={cn("flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-[10px] transition-all cursor-pointer whitespace-nowrap", config.btn)}
        >
          {action}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OwnerPage() {
  const router = useRouter();
  const orders = useWorkflowStore((s) => s.orders);
  const jobs = useWorkflowStore((s) => s.jobs);
  const inventory = useWorkflowStore((s) => s.inventory);
  const logs = useWorkflowStore((s) => s.logs);
  const updateJobStatus = useWorkflowStore((s) => s.updateJobStatus);

  // KPI
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
    if (i.name.toLowerCase().includes("sisa") || i.name.toLowerCase().includes("potongan") || i.id.toLowerCase().includes("sisa")) return false;
    const isRoll = i.unit.toLowerCase().includes("roll") || i.unit.toLowerCase().includes("meter");
    return isRoll ? i.stock < 2 : i.stock < 100;
  });

  // Pipeline counts
  const pipeline = [
    { label: "Desain",     count: jobs.filter((j) => j.status === "WAITING_DESIGN"  || j.status === "DESIGN_REVIEW").length, color: "bg-[#2454FF]"     },
    { label: "Cetak",      count: jobs.filter((j) => j.status === "WAITING_PRINT"   || j.status === "PRINTING").length,       color: "bg-[#2454FF]"     },
    { label: "QC",         count: jobs.filter((j) => j.status === "WAITING_QC").length,                                       color: "bg-[#B8760A]"     },
    { label: "Finishing",  count: jobs.filter((j) => j.status === "QC_PASSED"       || j.status === "FINISHING").length,      color: "bg-[#2454FF]"     },
    { label: "Storage",    count: jobs.filter((j) => j.status === "STORED").length,                                           color: "bg-[#1F8A5B]"     },
    { label: "Siap Ambil", count: readyPickup,                                                                                 color: "bg-[#1F8A5B]", glow: true },
  ];

  // Omset sparkline 7-day mock
  const omsetSparkData = [28, 45, 38, 62, 55, 80, 72];
  const omsetDays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const omsetTrend = omsetSparkData[omsetSparkData.length - 1] > omsetSparkData[omsetSparkData.length - 2];

  const [approvalState, setApprovalState] = useState<{
    open: boolean;
    type: "discount" | "cancel" | "rework" | null;
    jobId?: string;
  }>({ open: false, type: null });
  const [discountApproved, setDiscountApproved] = useState(false);
  const [cancelApproved, setCancelApproved] = useState(false);

  // Handler interaktif simulasi
  const handleTanyaPJ = (namaPJ: string, konteks: string) => {
    alert(`Menghubungi ${namaPJ} via WhatsApp untuk konfirmasi: "${konteks}"`);
  };

  const handleLihatDetailWaste = () => {
    alert("Membuka detail JOB-012: Mesin Roland menghasilkan waste tinggi (25%) pada cetakan Art Paper.");
  };

  // Counts for urgent cases
  const urgentCount =
    (cancelApproved ? 0 : 1) +
    (overdue.length > 0 ? 1 : 0) +
    1 + // waste tinggi
    (qcFailed.length > 0 ? qcFailed.length : 0);

  return (
    <div className="space-y-5 bg-[#F6F7FA] p-6 rounded-2xl min-h-screen text-[#1C2333]">
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C2333] flex items-center gap-2">
            <Crown className="h-6 w-6 text-[#2454FF]" />
            Dashboard Owner
          </h1>
          <p className="text-sm text-[#5B6479] mt-0.5">Visibilitas penuh — Keuangan, Produksi, Approval, Audit</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EEF2FF] text-[#2454FF] border border-[#E6E8EF]">
          Akses Penuh Executive
        </span>
      </div>

      {/* ── Priority Banner (1 Ringkas Baris) ───────────────────────────────── */}
      <div className="rounded-[10px] border border-[#D64545]/20 bg-[#FCEBEB] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-4 w-4 text-[#D64545] flex-shrink-0" />
          <p className="text-xs font-bold text-[#1C2333] truncate">
            {urgentCount} kasus butuh keputusan Anda: cancel order, overdue, waste tinggi, QC eskalasi
          </p>
        </div>
        <button
          onClick={() => document.getElementById("alert-panel")?.scrollIntoView({ behavior: "smooth" })}
          className="flex-shrink-0 flex items-center gap-0.5 text-xs font-bold text-[#D64545] hover:underline cursor-pointer"
        >
          Tinjau <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── KPI Row (4 Cards) ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Order Hari Ini */}
        <div className="bg-white border border-[#E6E8EF] rounded-[10px] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-[10px] bg-[#EEF2FF]">
              <ShoppingBag className="h-5 w-5 text-[#2454FF]" />
            </div>
            <span className="text-[10px] text-[#9AA2B4] font-mono flex items-center gap-0.5">
              Realtime <ArrowUpRight className="h-3 w-3 text-[#1F8A5B]" />
            </span>
          </div>
          <p className="text-[10px] font-semibold text-[#5B6479] uppercase tracking-wider">Total Order Hari Ini</p>
          <p className="text-2xl font-bold mt-1 font-mono text-[#1C2333]">{totalOrderToday}</p>
        </div>

        {/* Siap Diambil */}
        <div className="bg-white border border-[#E6E8EF] rounded-[10px] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-[10px] bg-[#EEF2FF]">
              <Package className="h-5 w-5 text-[#2454FF]" />
            </div>
            <span className="text-[10px] text-[#9AA2B4] font-mono flex items-center gap-0.5">
              Realtime <ArrowUpRight className="h-3 w-3 text-[#1F8A5B]" />
            </span>
          </div>
          <p className="text-[10px] font-semibold text-[#5B6479] uppercase tracking-wider">Siap Diambil</p>
          <p className="text-2xl font-bold mt-1 font-mono text-[#1C2333]">{readyPickup}</p>
        </div>

        {/* Produksi Aktif */}
        <div className="bg-white border border-[#E6E8EF] rounded-[10px] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-[10px] bg-[#EEF2FF]">
              <Activity className="h-5 w-5 text-[#2454FF]" />
            </div>
            <span className="text-[10px] text-[#9AA2B4] font-mono flex items-center gap-0.5">
              Realtime <ArrowUpRight className="h-3 w-3 text-[#1F8A5B]" />
            </span>
          </div>
          <p className="text-[10px] font-semibold text-[#5B6479] uppercase tracking-wider">Produksi Aktif</p>
          <p className="text-2xl font-bold mt-1 font-mono text-[#1C2333]">{produksiAktif}</p>
        </div>

        {/* Omset Bulan Ini — Orange/Gold accent + Sparkline */}
        <div className="bg-white border border-[#EBF1EF] rounded-[10px] p-5 overflow-hidden relative">
          <div className="flex items-center justify-between mb-1">
            <div className="p-2.5 rounded-[10px] bg-[#FBF1E1]">
              <TrendingUp className="h-5 w-5 text-[#B8760A]" />
            </div>
            {omsetTrend
              ? <span className="text-[10px] font-bold text-[#1F8A5B] flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" /> Naik</span>
              : <span className="text-[10px] font-bold text-[#D64545] flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3 rotate-90" /> Turun</span>
            }
          </div>
          <p className="text-[10px] font-semibold text-[#5B6479] uppercase tracking-wider">Omset Bulan Ini</p>
          <p className="text-2xl font-bold mt-0.5 font-mono text-[#B8760A]">
            Rp {(omsetBulanIni / 1_000_000).toFixed(1)}Jt
          </p>
          <div className="mt-2 h-[40px] w-full">
            <OmsetSparkline data={omsetSparkData} />
          </div>
          <div className="flex justify-between mt-1">
            {omsetDays.map((d, i) => (
              <span key={d} className={cn(
                "text-[8px] font-semibold flex-1 text-center",
                i === omsetDays.length - 1 ? "text-[#B8760A]" : "text-[#9AA2B4]"
              )}>{d}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Panel Alert Dipecah Jadi Tier ────────────────────────────────────── */}
      <div id="alert-panel" className="bg-white border border-[#E6E8EF] rounded-[10px] p-5 space-y-6">
        <div className="flex items-center gap-2 border-b border-[#E6E8EF] pb-3">
          <Bell className="h-5 w-5 text-[#2454FF]" />
          <h2 className="text-base font-bold text-[#1C2333]">Alert & Notifikasi</h2>
        </div>

        {/* ── Tier 1: Butuh Keputusan Anda (Merah Muda, Border Merah, Solid Badge) ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#D64545] uppercase tracking-wider">Tier 1 · Butuh Keputusan Anda</span>
            <span className="bg-[#D64545] text-white text-[10px] font-black px-2 py-0.5 rounded-full">{urgentCount}</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <AlertRow
              icon={XCircle}
              label="Permintaan Cancel Order — ORD-20260820-0021"
              sub="PT Abadi Makmur · Produksi sudah berjalan · DP Rp 1.750.000"
              tier="red"
              action="Tinjau Cancel"
              onAction={() => setApprovalState({ open: true, type: "cancel" })}
              done={cancelApproved}
            />

            {overdue.length > 0 ? (
              <AlertRow
                icon={AlertTriangle}
                label={`Order OVERDUE (${overdue.length}) — ${overdue[0].id}`}
                sub={overdue.length > 1 ? `+${overdue.length - 1} order lainnya melewati deadline` : overdue[0].customerName}
                tier="red"
                action="Buka Order"
                onAction={() => router.push(`/orders/${overdue[0].id}`)}
              />
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#E7F5EE] border border-[#1F8A5B]/20 rounded-[10px] text-xs text-[#1F8A5B]">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Tidak ada order overdue</span>
              </div>
            )}

            <AlertRow
              icon={ThumbsDown}
              label="Waste Produksi > 20% — JOB-012 (Mesin Roland)"
              sub="Operator: Budi · 25% waste · Keputusan reprint / batalkan"
              tier="red"
              action="Lihat Detail"
              onAction={handleLihatDetailWaste}
            />

            {qcFailed.length > 0 ? (
              qcFailed.map((j) => (
                <AlertRow
                  key={j.id}
                  icon={RotateCcw}
                  label={`QC FAIL Eskalasi — ${j.id}`}
                  sub={`${j.product} · Gagal QC 2x berturut-turut`}
                  tier="red"
                  action="Tinjau Rework"
                  onAction={() => setApprovalState({ open: true, type: "rework", jobId: j.id })}
                />
              ))
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#E7F5EE] border border-[#1F8A5B]/20 rounded-[10px] text-xs text-[#1F8A5B]">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Tidak ada eskalasi QC FAIL</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Tier 2: Perlu Ditinjau Hari Ini (Orange Muda, Border Orange, Outline Button) ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#B8760A] uppercase tracking-wider">Tier 2 · Perlu Ditinjau Hari Ini</span>
            <span className="bg-[#FBF1E1] text-[#B8760A] text-[10px] font-black px-2 py-0.5 rounded-full border border-[#B8760A]/20">
              {((discountApproved ? 0 : 1) + (lowStock.length > 0 ? 1 : 0) + 1)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <AlertRow
              icon={BadgePercent}
              label="Permohonan Diskon 10% — ORD-20260820-0021"
              sub="PT Abadi Makmur · Rp 350.000 · Diajukan oleh Admin Rere"
              tier="orange"
              action="Tinjau Diskon"
              onAction={() => setApprovalState({ open: true, type: "discount" })}
              done={discountApproved}
            />

            {lowStock.length > 0 ? (
              <AlertRow
                icon={ShieldAlert}
                label={`Stok Menipis (${lowStock.length} bahan)`}
                sub={lowStock.map((s) => `${s.name}: ${s.stock} ${s.unit}`).join(" · ")}
                tier="orange"
                action="Buka Inventori"
                onAction={() => router.push("/inventory")}
              />
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#E7F5EE] border border-[#1F8A5B]/20 rounded-[10px] text-xs text-[#1F8A5B]">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Stok semua bahan aman</span>
              </div>
            )}

            <AlertRow
              icon={Wrench}
              label="Manual Adjustment Finishing — Baru Saja"
              sub="Pelaku: Eko (Finishing) · Memerlukan konfirmasi manager"
              tier="orange"
              action="Tanya PJ"
              onAction={() => handleTanyaPJ("Eko", "Konfirmasi manual adjustment bahan sisa di finishing")}
            />
          </div>
        </div>

        {/* ── Tier 3: Informasi Lain (Netral/Abu-abu, Tanpa Background Berwarna) ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#5B6479] uppercase tracking-wider">Tier 3 · Informasi Lain</span>
            <span className="bg-[#F6F7FA] text-[#5B6479] text-[10px] font-black px-2 py-0.5 rounded-full border border-[#E6E8EF]">3</span>
          </div>

          <div className="grid grid-cols-1 gap-2 border border-[#E6E8EF] rounded-[10px] divide-y divide-[#E6E8EF]">
            <AlertRow
              icon={MessageSquareX}
              label="Notifikasi WA Gagal (2)"
              sub="Siti Rahayu — READY_FOR_PICKUP · Ahmad Fauzi — Desain Acc"
              tier="gray"
              action="Retry"
              onAction={() => alert("Mengirim ulang notifikasi WA")}
            />
            <AlertRow
              icon={ScanBarcode}
              label="Bahan Keluar Tanpa Job ID (3 kasus)"
              sub="Kertas Art Carton 260g oleh Fajar · Tinta Cyan oleh Deni"
              tier="gray"
              action="Audit Finishing"
              onAction={() => alert("Mengalihkan ke riwayat transaksi bahan non-Job ID")}
            />
            <AlertRow
              icon={Info}
              label="Status QC — Semua aktifitas berjalan normal"
              sub="Tidak ada anomali QC di luar eskalasi yang sudah ditampilkan di atas"
              tier="gray"
            />
          </div>
        </div>
      </div>

      {/* ── Operational Area (Pipeline + Attendance) ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Pipeline Produksi Real-time */}
        <div className="lg:col-span-3 bg-white border border-[#E6E8EF] rounded-[10px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-[#2454FF]" />
            <h2 className="text-base font-bold text-[#1C2333]">Pipeline Produksi Real-time</h2>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {pipeline.map((p) => (
              <div key={p.label} className="text-center space-y-2">
                <div className={cn("h-1.5 rounded-full w-full opacity-60", p.color)} />
                <p className={cn("text-3xl font-bold text-[#1C2333]")}>{p.count}</p>
                <p className="text-[10px] text-[#5B6479] font-medium uppercase tracking-wide">{p.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Absensi Pegawai */}
        <div className="lg:col-span-1 bg-white border border-[#E6E8EF] rounded-[10px] p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-[#2454FF]" />
            <h2 className="text-base font-bold text-[#1C2333]">Absensi Pegawai</h2>
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#1F8A5B]" />
                <span className="text-sm text-[#5B6479]">Hadir Tepat Waktu</span>
              </div>
              <span className="text-lg font-bold text-[#1C2333]">12</span>
            </div>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#B8760A] mt-1.5" />
                <div>
                  <span className="text-sm text-[#5B6479] block">Terlambat</span>
                  <span className="text-[10px] text-[#B8760A] font-medium">Budi (Opr), Fajar (Gud)</span>
                </div>
              </div>
              <span className="text-lg font-bold text-[#1C2333]">2</span>
            </div>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#D64545] mt-1.5" />
                <div>
                  <span className="text-sm text-[#5B6479] block">Belum Absen</span>
                  <span className="text-[10px] text-[#D64545] font-medium">Rere (Adm)</span>
                </div>
              </div>
              <span className="text-lg font-bold text-[#1C2333]">1</span>
            </div>
          </div>
          <button className="mt-4 w-full py-2 bg-[#F6F7FA] text-xs font-semibold text-[#1C2333] rounded-[10px] hover:bg-[#E6E8EF] transition-colors border border-[#E6E8EF] cursor-pointer">
            Lihat Laporan Absensi Lengkap
          </button>
        </div>
      </div>

      {/* ── Revenue Chart + High Value Orders + Audit Log ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Tren Pendapatan Masuk Minggu Ini */}
          <div className="bg-white border border-[#E6E8EF] rounded-[10px] p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-base text-[#1C2333]">Tren Pendapatan Masuk Minggu Ini</h3>
                <p className="text-xs text-[#5B6479]">Akumulasi DP & Pelunasan per hari</p>
              </div>
              <BarChart3 className="h-6 w-6 text-[#2454FF]" />
            </div>
            <div className="h-40 flex items-end justify-between gap-3 pb-2 border-b border-[#E6E8EF]">
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
                  <span className="text-[10px] text-[#2454FF] opacity-0 group-hover:opacity-100 transition-opacity font-mono">{bar.label}</span>
                  <div
                    style={{ height: `${bar.val}%` }}
                    className="w-full bg-gradient-to-t from-[#2454FF]/40 to-[#2454FF] rounded-t-[4px] transition-all group-hover:brightness-110"
                  />
                  <span className="text-[10px] text-[#5B6479] font-medium">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Bernilai Tinggi */}
          <div className="bg-white border border-[#E6E8EF] rounded-[10px] overflow-hidden">
            <div className="p-5 border-b border-[#E6E8EF] flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#2454FF]" />
              <h3 className="font-bold text-base text-[#1C2333]">Order Bernilai Tinggi</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F6F7FA] border-b border-[#E6E8EF] text-[#5B6479] font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Kode Order</th>
                    <th className="px-4 py-3">Konsumen</th>
                    <th className="px-4 py-3">Total Tagihan</th>
                    <th className="px-4 py-3">Pembayaran</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8EF]">
                  {[...orders]
                    .sort((a, b) => Number(b.totalPrice) - Number(a.totalPrice))
                    .slice(0, 5)
                    .map((o) => (
                      <tr key={o.id} className="hover:bg-[#F6F7FA]/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[#2454FF] font-bold">{o.id}</td>
                        <td className="px-4 py-3 font-semibold text-[#1C2333]">{o.customerName}</td>
                        <td className="px-4 py-3 font-mono text-[#1C2333] font-bold">
                          Rp {Number(o.totalPrice).toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded-[4px] text-[10px] font-bold",
                            o.paymentStatus === "PAID" ? "bg-[#E7F5EE] text-[#1F8A5B]" :
                            o.paymentStatus === "DP_PAID" ? "bg-[#FBF1E1] text-[#B8760A]" :
                            "bg-[#F6F7FA] text-[#5B6479] border border-[#E6E8EF]"
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

        {/* Audit Log Terbaru */}
        <div className="bg-white border border-[#E6E8EF] rounded-[10px] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#E6E8EF] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#2454FF]" />
              <h3 className="font-bold text-sm text-[#1C2333]">Audit Log Terbaru</h3>
            </div>
            <span className="text-[10px] text-[#5B6479] font-mono bg-[#F6F7FA] px-2 py-0.5 rounded border border-[#E6E8EF]">10 aksi</span>
          </div>
          <div className="flex-1 divide-y divide-[#E6E8EF]/50 overflow-y-auto max-h-[520px]">
            {logs.map((log, i) => {
              const timeStr = new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={log.id || i} className="px-4 py-3 hover:bg-[#F6F7FA]/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-[#9AA2B4]">{timeStr}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#F6F7FA] text-[#5B6479] border border-[#E6E8EF]">{log.operator}</span>
                  </div>
                  <p className="text-xs font-semibold text-[#1C2333]">{log.title}</p>
                  <p className="text-[10px] text-[#2454FF] font-mono mt-0.5">{log.type}</p>
                  <p className="text-[10px] text-[#5B6479] truncate">{log.description}</p>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-[#E6E8EF]">
            <button className="w-full text-xs text-[#2454FF] hover:underline font-semibold cursor-pointer">
              Lihat Semua Audit Log →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

