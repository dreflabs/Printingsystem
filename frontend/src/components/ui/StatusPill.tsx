import { cn } from "@/lib/utils";

type OrderStatus =
  | "DRAFT"
  | "DESIGNING"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "WAITING_PAYMENT"
  | "CONFIRMED"
  | "PRODUCTION_STARTED"
  | "QC_PENDING"
  | "QC_PASSED"
  | "QC_FAILED"
  | "QC_REWORK_PENDING"
  | "FINISHING_STARTED"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "OVERDUE"
  | "ON_HOLD"
  | "CANCELLED"
  | "INCIDENT"
  | "CLOSED";

interface StatusConfig {
  label: string;
  emoji: string;
  color: string;
}

const STATUS_MAP: Record<OrderStatus, StatusConfig> = {
  DRAFT: { label: "Draft", emoji: "📝", color: "bg-muted/20 text-muted border-muted/30" },
  DESIGNING: { label: "Desain", emoji: "🎨", color: "bg-status-blue/20 text-status-blue border-status-blue/30" },
  WAITING_APPROVAL: { label: "Menunggu Acc", emoji: "⏳", color: "bg-status-yellow/20 text-status-yellow border-status-yellow/30" },
  APPROVED: { label: "Disetujui", emoji: "✅", color: "bg-status-green/20 text-status-green border-status-green/30" },
  WAITING_PAYMENT: { label: "Menunggu DP", emoji: "💳", color: "bg-status-orange/20 text-status-orange border-status-orange/30" },
  CONFIRMED: { label: "Konfirmasi", emoji: "✅", color: "bg-status-green/20 text-status-green border-status-green/30" },
  PRODUCTION_STARTED: { label: "Produksi", emoji: "🔵", color: "bg-status-blue/20 text-status-blue border-status-blue/30" },
  QC_PENDING: { label: "QC", emoji: "🔍", color: "bg-status-yellow/20 text-status-yellow border-status-yellow/30" },
  QC_PASSED: { label: "QC Lulus", emoji: "✅", color: "bg-status-green/20 text-status-green border-status-green/30" },
  QC_FAILED: { label: "QC Gagal", emoji: "❌", color: "bg-status-red/20 text-status-red border-status-red/30" },
  QC_REWORK_PENDING: { label: "Menunggu Rework", emoji: "🔄", color: "bg-status-orange/20 text-status-orange border-status-orange/30" },
  FINISHING_STARTED: { label: "Finishing", emoji: "🔧", color: "bg-accent-purple/20 text-accent-purple border-accent-purple/30" },
  READY_FOR_PICKUP: { label: "Siap Diambil", emoji: "📦", color: "bg-status-green/20 text-status-green border-status-green/30" },
  PICKED_UP: { label: "Selesai", emoji: "✅", color: "bg-status-green/20 text-status-green border-status-green/30" },
  OVERDUE: { label: "Terlambat", emoji: "🔴", color: "bg-status-red/20 text-status-red border-status-red/30" },
  ON_HOLD: { label: "Ditahan", emoji: "⏸️", color: "bg-status-yellow/20 text-status-yellow border-status-yellow/30" },
  CANCELLED: { label: "Dibatalkan", emoji: "✖️", color: "bg-muted/20 text-muted border-muted/30" },
  INCIDENT: { label: "Insiden", emoji: "⚠️", color: "bg-status-red/20 text-status-red border-status-red/30" },
  CLOSED: { label: "Ditutup", emoji: "🔒", color: "bg-accent-purple/20 text-accent-purple border-accent-purple/30" },
};

interface StatusPillProps {
  status: OrderStatus;
  className?: string;
  showEmoji?: boolean;
}

export function StatusPill({ status, className, showEmoji = true }: StatusPillProps) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    emoji: "⬜",
    color: "bg-muted/20 text-muted border-muted/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
        config.color,
        className
      )}
    >
      {showEmoji && <span>{config.emoji}</span>}
      {config.label}
    </span>
  );
}
