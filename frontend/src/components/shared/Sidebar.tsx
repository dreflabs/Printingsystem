"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Palette,
  Settings2,
  Package,
  BarChart2,
  ShoppingCart,
  ScanLine,
  X,
  Printer,
  ChevronRight,
  Tag,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole =
  | "admin"
  | "designer"
  | "operator"
  | "gudang"
  | "owner"
  | "pos";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
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
    label: "Dashboard",
    href: "/designer",
    icon: <Palette className="h-5 w-5" />,
    roles: ["designer"],
  },
  {
    label: "Dashboard",
    href: "/operator",
    icon: <Settings2 className="h-5 w-5" />,
    roles: ["operator"],
  },
  {
    label: "Finishing",
    href: "/gudang",
    icon: <Package className="h-5 w-5" />,
    roles: ["gudang"],
  },
  {
    label: "Produksi & Laporan",
    href: "/admin/production",
    icon: <BarChart2 className="h-5 w-5" />,
    roles: ["admin", "owner"],
  },
  {
    label: "Scan QR",
    href: "/scan",
    icon: <ScanLine className="h-5 w-5" />,
    roles: ["admin", "operator", "gudang"],
  },
  {
    label: "Pegawai & Akses",
    href: "/owner/users",
    icon: <Users className="h-5 w-5" />,
    roles: ["owner"],
  },
];

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

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
              <span className="text-base font-bold text-primary tracking-tight">
                Print Pilot
              </span>
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
                <span
                  className={cn(
                    "transition-colors",
                    isActive ? "text-accent-teal" : "text-muted group-hover:text-primary"
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="h-4 w-4 text-accent-teal" />}
              </Link>
            );
          })}
        </nav>

        {/* Role Badge at Bottom */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-elevated border border-border">
            <div className="flex items-center gap-2 flex-1">
              <div className="h-2 w-2 rounded-full bg-status-green animate-pulse shrink-0" />
              <select 
                value={role}
                onChange={(e) => {
                  localStorage.setItem("userRole", e.target.value);
                  localStorage.setItem("userName", `Akun ${e.target.value}`);
                  window.location.href = `/${e.target.value === "gudang" ? "gudang" : e.target.value}`;
                }}
                className="bg-transparent text-xs text-primary font-bold capitalize outline-none cursor-pointer w-full appearance-none"
              >
                <option value="admin">👨‍💼 Admin Depan</option>
                <option value="designer">🎨 Designer</option>
                <option value="operator">⚙️ Operator Cetak</option>
                <option value="gudang">📦 Finishing (Gudang)</option>
                <option value="owner">👑 Owner</option>
              </select>
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem("userName");
                localStorage.removeItem("userRole");
                window.location.href = "/login";
              }}
              title="Logout / Ganti User"
              className="p-1.5 text-muted hover:text-status-red hover:bg-status-red/10 rounded-lg transition-colors cursor-pointer ml-2 shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
