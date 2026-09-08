import { cn } from "@/lib/utils";

type OrderStatus =
  | "DRAFT"
  | "DESIGNING"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "WAITING_PAYMENT"
  | "CONFIRMED"
  | "PRODUCTION_QUEUED"
  | "PRODUCTION_ASSIGNED"
  | "PRODUCTION_STARTED"
  | "PRODUCTION_PAUSED"
  | "PRODUCTION_COMPLETE"
  | "QC_PENDING"
  | "QC_PASSED"
  | "QC_FAILED"
  | "QC_REWORK_PENDING"
  | "FINISHING_STARTED"
  | "FINISHING_COMPLETE"
  | "STORED"
  | "READY_FOR_PICKUP"
  | "IN_TRANSIT"
  | "PICKED_UP"
  | "FINAL_AUDIT_PENDING"
  | "FINAL_AUDIT_COMPLETE"
  | "OVERDUE"
  | "ON_HOLD"
  | "CANCELLED"
  | "INCIDENT"
  | "CLOSED";

interface StatusConfig {
  label: string;
  color: string;
  dotColor: string;
  pulse?: boolean;
}

const STATUS_MAP: Record<OrderStatus, StatusConfig> = {
  DRAFT: { label: "Draft", color: "bg-muted/15 text-muted border-muted/30", dotColor: "bg-muted" },
  DESIGNING: { label: "Desain", color: "bg-status-blue/15 text-status-blue border-status-blue/30", dotColor: "bg-status-blue", pulse: true },
  WAITING_APPROVAL: { label: "Menunggu Acc", color: "bg-status-yellow/15 text-status-yellow-text border-status-yellow/30", dotColor: "bg-status-yellow" },
  APPROVED: { label: "Disetujui", color: "bg-status-green/15 text-status-green border-status-green/30", dotColor: "bg-status-green" },
  WAITING_PAYMENT: { label: "Menunggu DP", color: "bg-status-yellow/15 text-status-yellow-text border-status-yellow/30", dotColor: "bg-status-yellow", pulse: true },
  CONFIRMED: { label: "Konfirmasi", color: "bg-status-green/15 text-status-green border-status-green/30", dotColor: "bg-status-green" },
  PRODUCTION_QUEUED: { label: "Antri Produksi", color: "bg-status-yellow/15 text-status-yellow-text border-status-yellow/30", dotColor: "bg-status-yellow" },
  PRODUCTION_ASSIGNED: { label: "Ditugaskan", color: "bg-status-blue/15 text-status-blue border-status-blue/30", dotColor: "bg-status-blue" },
  PRODUCTION_STARTED: { label: "Produksi", color: "bg-status-blue/15 text-status-blue border-status-blue/30", dotColor: "bg-status-blue", pulse: true },
  PRODUCTION_PAUSED: { label: "Produksi Dijeda", color: "bg-status-yellow/15 text-status-yellow-text border-status-yellow/30", dotColor: "bg-status-yellow" },
  PRODUCTION_COMPLETE: { label: "Produksi Selesai", color: "bg-status-blue/15 text-status-blue border-status-blue/30", dotColor: "bg-status-blue" },
  QC_PENDING: { label: "QC", color: "bg-status-yellow/15 text-status-yellow-text border-status-yellow/30", dotColor: "bg-status-yellow" },
  QC_PASSED: { label: "QC Lulus", color: "bg-status-green/15 text-status-green border-status-green/30", dotColor: "bg-status-green" },
  QC_FAILED: { label: "QC Gagal", color: "bg-status-red/15 text-status-red border-status-red/30", dotColor: "bg-status-red", pulse: true },
  QC_REWORK_PENDING: { label: "Menunggu Rework", color: "bg-status-yellow/15 text-status-yellow-text border-status-yellow/30", dotColor: "bg-status-yellow" },
  FINISHING_STARTED: { label: "Finishing", color: "bg-accent-teal/15 text-accent-teal border-accent-teal/30", dotColor: "bg-accent-teal", pulse: true },
  FINISHING_COMPLETE: { label: "Finishing Selesai", color: "bg-accent-teal/15 text-accent-teal border-accent-teal/30", dotColor: "bg-accent-teal" },
  STORED: { label: "Tersimpan di Rak", color: "bg-status-blue/15 text-status-blue border-status-blue/30", dotColor: "bg-status-blue" },
  READY_FOR_PICKUP: { label: "Siap Diambil", color: "bg-status-green/15 text-status-green border-status-green/30", dotColor: "bg-status-green", pulse: true },
  IN_TRANSIT: { label: "Diantar ke Counter", color: "bg-status-blue/15 text-status-blue border-status-blue/30", dotColor: "bg-status-blue", pulse: true },
  PICKED_UP: { label: "Sudah Diambil", color: "bg-status-green/20 text-status-green border-status-green/40", dotColor: "bg-status-green" },
  FINAL_AUDIT_PENDING: { label: "Menunggu Audit Akhir", color: "bg-status-yellow/15 text-status-yellow-text border-status-yellow/30", dotColor: "bg-status-yellow" },
  FINAL_AUDIT_COMPLETE: { label: "Audit Akhir Selesai", color: "bg-status-green/15 text-status-green border-status-green/30", dotColor: "bg-status-green" },
  OVERDUE: { label: "Terlambat", color: "bg-status-red/15 text-status-red border-status-red/30", dotColor: "bg-status-red", pulse: true },
  ON_HOLD: { label: "Ditahan", color: "bg-status-yellow/15 text-status-yellow-text border-status-yellow/30", dotColor: "bg-status-yellow" },
  CANCELLED: { label: "Dibatalkan", color: "bg-muted/15 text-muted border-muted/30", dotColor: "bg-muted" },
  INCIDENT: { label: "Insiden", color: "bg-status-red/20 text-status-red border-status-red/40", dotColor: "bg-status-red", pulse: true },
  CLOSED: { label: "Ditutup", color: "bg-accent-teal/15 text-accent-teal border-accent-teal/30", dotColor: "bg-accent-teal" },
};

interface StatusPillProps {
  // OrderStatus for autocomplete; any string still renders (runtime fallback below)
  status: OrderStatus | (string & {});
  className?: string;
  showEmoji?: boolean;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const config = (STATUS_MAP as Record<string, StatusConfig>)[status] ?? {
    label: status,
    color: "bg-muted/15 text-muted border-muted/30",
    dotColor: "bg-muted",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all backdrop-blur-md",
        config.color,
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          config.dotColor,
          config.pulse && "animate-pulse"
        )}
      />
      {config.label}
    </span>
  );
}
