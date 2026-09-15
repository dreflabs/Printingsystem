import type { ComponentType } from "react";
import { Crown, ShieldCheck, PenTool, Printer, PackageCheck, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Peran = identitas, BUKAN status. Karena itu badge peran tidak memakai palet
 * `status-*` (hijau/kuning/biru/merah) yang di app ini berarti keadaan order.
 * Warna di sini hanya aksen kecil pada ikon: teal untuk peran berwenang
 * (Owner/Admin), netral untuk peran operasional. Untuk status order pakai
 * `<StatusPill>`.
 */

interface RoleMeta {
  /** label pendek — badge & tabel */
  label: string;
  /** label panjang — form / checklist */
  longLabel: string;
  icon: ComponentType<{ className?: string }>;
  /** peran berwenang (Owner/Admin) → ikon beraksen teal */
  emphasis: boolean;
}

export const ROLE_META: Record<string, RoleMeta> = {
  owner: { label: "Owner", longLabel: "Owner", icon: Crown, emphasis: true },
  admin: { label: "Admin", longLabel: "Admin / Kasir", icon: ShieldCheck, emphasis: true },
  designer_sales: {
    label: "Designer",
    longLabel: "Designer / Setting",
    icon: PenTool,
    emphasis: false,
  },
  operator: {
    label: "Operator",
    longLabel: "Operator Cetak",
    icon: Printer,
    emphasis: false,
  },
  gudang: {
    label: "Gudang",
    longLabel: "Finishing & Gudang",
    icon: PackageCheck,
    emphasis: false,
  },
};

/** Label peran — `long` untuk konteks form. Fallback: nama mentah. */
export function roleLabel(role: string, long = false): string {
  const m = ROLE_META[role];
  return m ? (long ? m.longLabel : m.label) : role;
}

export interface RoleBadgeProps {
  role: string;
  /** "primary" = peran utama (isi + ikon); "extra" = peran tambahan (outline, tanpa ikon) */
  variant?: "primary" | "extra";
  className?: string;
}

export function RoleBadge({ role, variant = "primary", className }: RoleBadgeProps) {
  const meta = ROLE_META[role];
  const Icon = meta?.icon ?? UserCog;
  const label = meta?.label ?? role;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold",
        variant === "primary"
          ? "bg-elevated text-primary"
          : "border border-border text-muted",
        className
      )}
    >
      {variant === "primary" && (
        <Icon
          className={cn(
            "h-3 w-3 shrink-0",
            meta?.emphasis ? "text-accent-teal" : "text-muted"
          )}
        />
      )}
      {label}
    </span>
  );
}
