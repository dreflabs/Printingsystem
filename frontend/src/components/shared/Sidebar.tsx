"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, ChevronRight, ChevronDown, LogOut, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/actions/session";
import { WORKSPACE_MODE_LABEL, type WorkspaceMode } from "@/lib/workspace-mode";
import { SOLO_NAV, resolveNav, type UserRole, type ResolvedNav } from "@/lib/nav-config";

// Role switcher config: what dashboards each role maps to
const ROLE_SWITCHER_CONFIG: { role: UserRole; label: string; href: string; color: string }[] = [
  { role: "owner",          label: "Owner",            href: "/owner",    color: "text-accent-teal" },
  { role: "admin",          label: "Admin",            href: "/admin",    color: "text-accent-teal" },
  { role: "designer_sales", label: "Designer/Setting", href: "/designer", color: "text-status-yellow-text" },
  { role: "operator",       label: "Operator Cetak",   href: "/operator", color: "text-status-blue" },
  { role: "gudang",         label: "Finishing & Gudang", href: "/finishing", color: "text-status-green" },
];

const EXPANDED_KEY = "pp_nav_expanded";

interface SidebarProps {
  role: UserRole;
  roles?: string[]; // All roles this user has (multi-role support)
  workspaceMode?: WorkspaceMode;
  isOpen: boolean;
  onClose: () => void;
}

function hrefActive(pathname: string, href: string): boolean {
  const isExactRoot = ["/admin", "/owner", "/designer", "/operator", "/finishing"].includes(href);
  return isExactRoot ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ role, roles = [role], workspaceMode = "TEAM_FULL", isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = React.useState(false);

  const userRoleSet = new Set(roles as UserRole[]);
  const soloView = workspaceMode === "SOLO" && userRoleSet.has("owner");
  const teamOwnerView =
    (workspaceMode === "TEAM_SMALL" || workspaceMode === "TEAM_FULL") && userRoleSet.has("owner");
  const roleKey = [...roles].sort().join(",");

  // Navigasi ditentukan workspace_mode + peran:
  //  - SOLO + Owner        → SOLO_NAV (rata, alur 1 orang)
  //  - TIM  + Owner        → GROUPED_NAV disaring ke peran "owner" (pengawasan)
  //  - selain itu (pegawai) → GROUPED_NAV disaring ke peran user
  const navItems: ResolvedNav[] = React.useMemo(() => {
    if (soloView) {
      return SOLO_NAV.map((n) => ({ kind: "link" as const, label: n.label, href: n.href, icon: n.icon }));
    }
    const scope: UserRole[] = teamOwnerView ? ["owner"] : (roleKey.split(",").filter(Boolean) as UserRole[]);
    return resolveNav(scope);
  }, [soloView, teamOwnerView, roleKey]);

  // Preferensi buka/tutup grup yang di-set manual viewer (localStorage). Grup yang
  // memuat halaman aktif tetap terbuka otomatis kecuali viewer menutupnya sendiri.
  // Sidebar hanya dirender di klien (layout return null sampai sesi siap), jadi
  // aman membaca localStorage di initializer.
  const [manual, setManual] = React.useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(EXPANDED_KEY) || "{}"); } catch { return {}; }
  });

  const isGroupOpen = (label: string, hasActiveChild: boolean) =>
    label in manual ? manual[label] : hasActiveChild;

  const toggleGroup = (label: string, hasActiveChild: boolean) => {
    setManual((prev) => {
      const current = label in prev ? prev[label] : hasActiveChild;
      const next = { ...prev, [label]: !current };
      try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const switcherRoles = ROLE_SWITCHER_CONFIG.filter((r) => userRoleSet.has(r.role));
  const hasMultipleRoles = !soloView && switcherRoles.length > 1;

  const currentRoleLabel =
    ROLE_SWITCHER_CONFIG.find((r) => {
      if (pathname.startsWith("/owner")) return r.role === "owner";
      if (pathname.startsWith("/admin")) return r.role === "admin";
      if (pathname.startsWith("/designer")) return r.role === "designer_sales";
      if (pathname.startsWith("/operator")) return r.role === "operator";
      if (pathname.startsWith("/finishing")) return r.role === "gudang";
      return false;
    })?.label ?? role;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-base/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

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
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", switcherOpen && "rotate-180")} />
            </button>

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
          {navItems.map((item) => {
            if (item.kind === "link") {
              const Icon = item.icon;
              const active = hrefActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                    active
                      ? "bg-accent-teal/15 text-accent-teal border border-accent-teal/30"
                      : "text-muted hover:text-primary hover:bg-elevated"
                  )}
                >
                  <span className={cn("transition-colors", active ? "text-accent-teal" : "text-muted group-hover:text-primary")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="h-4 w-4 text-accent-teal" />}
                </Link>
              );
            }

            // group
            const Icon = item.icon;
            const hasActiveChild = item.children.some((c) => hrefActive(pathname, c.href));
            const isOpenGroup = isGroupOpen(item.label, hasActiveChild);
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label, hasActiveChild)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                    hasActiveChild && !isOpenGroup
                      ? "text-accent-teal"
                      : "text-muted hover:text-primary hover:bg-elevated"
                  )}
                  aria-expanded={isOpenGroup}
                >
                  <span className={cn("transition-colors", hasActiveChild ? "text-accent-teal" : "text-muted group-hover:text-primary")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpenGroup && "rotate-180")} />
                </button>
                {isOpenGroup && (
                  <div className="mt-1 ml-4 pl-3 border-l border-border space-y-1">
                    {item.children.map((c) => {
                      const active = hrefActive(pathname, c.href);
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all",
                            active
                              ? "bg-accent-teal/15 text-accent-teal"
                              : "text-muted hover:text-primary hover:bg-elevated"
                          )}
                        >
                          <span className="flex-1">{c.label}</span>
                          {active && <ChevronRight className="h-3.5 w-3.5 text-accent-teal" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
                  {soloView
                    ? "Mode Solo"
                    : teamOwnerView
                      ? WORKSPACE_MODE_LABEL[workspaceMode]
                      : hasMultipleRoles
                        ? `${roles.length} Role Aktif`
                        : role.replace("_", " ")}
                </span>
                {soloView && (
                  <span className="text-[10px] text-accent-teal font-semibold">1 orang · semua peran</span>
                )}
                {teamOwnerView && switcherRoles.length > 1 && (
                  <span className="text-[10px] text-muted">+ akses {switcherRoles.length - 1} divisi</span>
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
