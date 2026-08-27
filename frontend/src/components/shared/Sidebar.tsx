"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Palette,
  Settings2,
  Package,
  BarChart2,
  ShoppingCart,
  ScanLine,
  X,
  ChevronRight,
  Tag,
  LogOut,
  Users,
  ChevronDown,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/actions/session";

// All possible roles in the system
type UserRole = "admin" | "designer_sales" | "operator" | "gudang" | "owner";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/owner",
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ["owner"],
  },
  {
    label: "Produksi & Laporan",
    href: "/admin/production",
    icon: <BarChart2 className="h-5 w-5" />,
    roles: ["admin", "owner"],
  },
  {
    label: "Pegawai & Akses",
    href: "/owner/users",
    icon: <Users className="h-5 w-5" />,
    roles: ["owner"],
  },
  {
    label: "Dashboard",
    href: "/admin",
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ["admin"],
  },
  {
    label: "Laporan",
    href: "/admin/reports",
    icon: <BarChart2 className="h-5 w-5" />,
    roles: ["admin"],
  },
  {
    label: "POS / Kasir",
    href: "/pos",
    icon: <ShoppingCart className="h-5 w-5" />,
    roles: ["admin"],
  },
  {
    label: "Katalog & Harga",
    href: "/admin/products",
    icon: <Tag className="h-5 w-5" />,
    roles: ["admin"],
  },
  {
    label: "Database Pelanggan",
    href: "/admin/customers",
    icon: <Users className="h-5 w-5" />,
    roles: ["admin"],
  },
  {
    label: "Dashboard",
    href: "/designer",
    icon: <Palette className="h-5 w-5" />,
    roles: ["designer_sales"],
  },
  {
    label: "Dashboard",
    href: "/operator",
    icon: <Settings2 className="h-5 w-5" />,
    roles: ["operator"],
  },
  {
    label: "Finishing & QC",
    href: "/finishing",
    icon: <Package className="h-5 w-5" />,
    roles: ["gudang"],
  },
  {
    label: "Scan QR",
    href: "/scan",
    icon: <ScanLine className="h-5 w-5" />,
    roles: ["admin", "operator", "gudang", "owner"],
  },
];

// Role switcher config: what dashboards each role maps to
const ROLE_SWITCHER_CONFIG: { role: UserRole; label: string; href: string; color: string }[] = [
  { role: "owner",          label: "Owner",            href: "/owner",    color: "text-accent-teal" },
  { role: "admin",          label: "Admin",            href: "/admin",    color: "text-accent-teal" },
  { role: "designer_sales", label: "Designer/Setting", href: "/designer", color: "text-status-yellow-text" },
  { role: "operator",       label: "Operator Cetak",   href: "/operator", color: "text-status-blue" },
  { role: "gudang",         label: "Finishing & Gudang", href: "/finishing", color: "text-status-green" },
];

interface SidebarProps {
  role: UserRole;
  roles?: string[]; // All roles this user has (multi-role support)
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, roles = [role], isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = React.useState(false);

  // Items visible to this user based on ALL their roles
  const userRoleSet = new Set(roles as UserRole[]);
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => userRoleSet.has(r))
  );

  // De-duplicate by href (owner sees all, so some hrefs might appear twice)
  const uniqueItems = visibleItems.filter(
    (item, idx, arr) => arr.findIndex((i) => i.href === item.href) === idx
  );

  // Role switcher entries: only show roles this user actually has
  const switcherRoles = ROLE_SWITCHER_CONFIG.filter((r) => userRoleSet.has(r.role));
  const hasMultipleRoles = switcherRoles.length > 1;

  const currentRoleLabel =
    ROLE_SWITCHER_CONFIG.find((r) => {
      // Match current dashboard section
      if (pathname.startsWith("/owner")) return r.role === "owner";
      if (pathname.startsWith("/admin")) return r.role === "admin";
      if (pathname.startsWith("/designer")) return r.role === "designer_sales";
      if (pathname.startsWith("/operator")) return r.role === "operator";
      if (pathname.startsWith("/finishing")) return r.role === "gudang";
      return false;
    })?.label ?? role;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-base/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-60 flex flex-col",
          "bg-card/95 border-r border-border backdrop-blur-xl",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:translate-x-0 lg:flex"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden shrink-0">
              <img src="/PRINT_PILOT_LOGO.png" alt="Print Pilot" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="text-base font-bold text-primary tracking-tight">Print Pilot</span>
              <p className="text-[10px] text-muted -mt-0.5">Manajemen Percetakan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-muted hover:text-primary transition-colors"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role Switcher — only show when user has multiple roles */}
        {hasMultipleRoles && (
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated border border-border hover:border-accent-teal/40 transition-all text-left group"
            >
              <Layers className="h-4 w-4 text-accent-teal shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted leading-none mb-0.5">Mode Aktif</p>
                <p className="text-xs font-bold text-primary truncate">{currentRoleLabel}</p>
              </div>
              <ChevronDown
                className={cn("h-3.5 w-3.5 text-muted transition-transform", switcherOpen && "rotate-180")}
              />
            </button>

            {/* Dropdown */}
            {switcherOpen && (
              <div className="mt-1.5 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                <p className="text-[10px] text-muted font-bold px-3 pt-2.5 pb-1.5 uppercase tracking-wider border-b border-border">
                  Pindah Dashboard
                </p>
                {switcherRoles.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => {
                      router.push(r.href);
                      setSwitcherOpen(false);
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-elevated transition-colors text-left"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    <span className={cn("text-xs font-semibold", r.color)}>{r.label}</span>
                    <span className="text-[10px] text-muted ml-auto font-mono">{r.href}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {uniqueItems.map((item) => {
            const isExactRoot = ["/admin", "/owner", "/designer", "/operator", "/finishing"].includes(item.href);
            const isActive = isExactRoot
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "bg-accent-teal/15 text-accent-teal border border-accent-teal/30"
                    : "text-muted hover:text-primary hover:bg-elevated"
                )}
              >
                <span className={cn("transition-colors", isActive ? "text-accent-teal" : "text-muted group-hover:text-primary")}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="h-4 w-4 text-accent-teal" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Role badge + Logout */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-elevated">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-2 w-2 rounded-full bg-status-green animate-pulse shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-muted truncate block capitalize">
                  {hasMultipleRoles ? `${roles.length} Role Aktif` : role.replace("_", " ")}
                </span>
                {hasMultipleRoles && (
                  <span className="text-[10px] text-accent-teal font-semibold">Solo Mode ✓</span>
                )}
              </div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Keluar"
                className="p-1.5 text-muted hover:text-status-red hover:bg-status-red/10 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
