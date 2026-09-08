"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  ScrollText,
  Archive,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Receipt,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SuperAdminSubLevel } from "@/lib/platform";

type Actor = { name: string; subLevel: SuperAdminSubLevel };

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Sub-level yang boleh melihat item ini. Kosong = semua. */
  subLevels?: SuperAdminSubLevel[];
  /** Cocokkan hanya bila path persis (root section). */
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { label: "Dashboard", href: "/platform", icon: <LayoutDashboard className="h-[18px] w-[18px]" />, exact: true },
      { label: "Tenant", href: "/platform/tenants", icon: <Building2 className="h-[18px] w-[18px]" /> },
      { label: "Analitik", href: "/platform/analytics", icon: <TrendingUp className="h-[18px] w-[18px]" />, subLevels: ["SUPER_ADMIN", "FINANCE"] },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { label: "Billing & Invoice", href: "/platform/billing", icon: <Receipt className="h-[18px] w-[18px]" />, subLevels: ["SUPER_ADMIN", "FINANCE"] },
      { label: "Paket Langganan", href: "/platform/plans", icon: <CreditCard className="h-[18px] w-[18px]" />, subLevels: ["SUPER_ADMIN", "FINANCE"] },
    ],
  },
  {
    label: "Sistem",
    items: [
      { label: "Akun Admin", href: "/platform/admins", icon: <Users className="h-[18px] w-[18px]" />, subLevels: ["SUPER_ADMIN"] },
      { label: "Aktivitas", href: "/platform/activity", icon: <ScrollText className="h-[18px] w-[18px]" /> },
      { label: "Tenant Terhapus", href: "/platform/retired", icon: <Archive className="h-[18px] w-[18px]" />, subLevels: ["SUPER_ADMIN"] },
    ],
  },
];

const SUBLEVEL_LABEL: Record<SuperAdminSubLevel, string> = {
  SUPER_ADMIN: "Akses penuh",
  SUPPORT: "Support — lihat & bantu",
  FINANCE: "Finance",
};

export function PlatformShell({
  actor,
  signOutAction,
  children,
}: {
  actor: Actor;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.subLevels || i.subLevels.includes(actor.subLevel)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-base text-primary">
      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-base/70 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-60 flex flex-col",
          "bg-card/95 border-r border-border backdrop-blur-xl",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:translate-x-0 lg:flex",
        )}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <Link href="/platform" onClick={() => setOpen(false)} className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5 text-accent-teal shrink-0" />
            <span className="tracking-tight">
              Print Pilot <span className="text-muted font-normal">/ Platform</span>
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted hover:text-primary"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted/70">
                {g.label}
              </p>
              <div className="space-y-1">
                {g.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group",
                        isActive
                          ? "bg-accent-teal/15 text-accent-teal border border-accent-teal/30"
                          : "text-muted hover:text-primary hover:bg-elevated border border-transparent",
                      )}
                    >
                      <span className={isActive ? "text-accent-teal" : "text-muted group-hover:text-primary"}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight className="h-4 w-4 text-accent-teal" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated">
            <div className="h-2 w-2 rounded-full bg-status-green animate-pulse shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-primary truncate">{actor.name}</p>
              <p className="text-[10px] text-muted truncate">{SUBLEVEL_LABEL[actor.subLevel]}</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Keluar"
                className="p-1.5 text-muted hover:text-status-red hover:bg-status-red/10 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Konten */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — mobile: hamburger + judul; desktop: hanya badge sub-level */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-border bg-card shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden -ml-1 p-2 text-muted hover:text-primary"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="lg:hidden font-bold text-sm">
            Print Pilot <span className="text-muted font-normal">/ Platform</span>
          </span>
          <div className="hidden lg:block" />
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30">
            {actor.subLevel}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
