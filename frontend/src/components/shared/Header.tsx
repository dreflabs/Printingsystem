"use client";

import { Menu, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin Sales",
  designer: "Designer",
  operator: "Operator",
  qc: "Quality Control",
  finishing: "Finishing",
  warehouse: "Gudang",
  supervisor: "Supervisor",
  owner: "Owner",
};

interface HeaderProps {
  userName: string;
  role: string;
  onMenuClick: () => void;
  className?: string;
}

export function Header({ userName, role, onMenuClick, className }: HeaderProps) {
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between",
        "h-16 px-4 lg:px-6",
        "bg-card/80 backdrop-blur-xl border-b border-border",
        className
      )}
    >
      {/* Left: Hamburger + Page Title Area */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer"
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Slot for breadcrumbs or title — children passed optionally */}
        <div className="hidden lg:block w-px h-5 bg-border" />
      </div>

      {/* Right: Notification + User */}
      <div className="flex items-center gap-2">
        {/* Bell */}
        <button
          className="relative p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer"
          aria-label="Notifikasi"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-status-red animate-pulse" />
        </button>

        {/* User Info */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-primary leading-tight">{userName}</p>
            <p className="text-[11px] text-muted leading-tight">{roleLabel}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-teal to-blue-500">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
}
