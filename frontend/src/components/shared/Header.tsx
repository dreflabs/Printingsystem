"use client";

import { useState, useEffect } from "react";
import { Menu, Bell, User, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserProfileById } from "@/actions/profile";
import { signOutAction } from "@/actions/session";
import { ProfileModal } from "./ProfileModal";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  designer_sales: "Designer Sales",
  operator: "Operator",
  gudang: "Finishing & Gudang",
};

interface HeaderProps {
  userId: string | null;
  userName: string;
  role: string;
  onMenuClick: () => void;
  className?: string;
}

type DbUser = { id: string; name: string; username: string; email: string; phone: string | null; avatar_url: string | null };

export function Header({ userId, userName, role, onMenuClick, className }: HeaderProps) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);

  useEffect(() => {
    if (!userId) return;
    getUserProfileById(userId).then((u) => {
      if (u) setDbUser({ ...u, email: u.email ?? "", username: u.username ?? "" });
    });
  }, [userId]);

  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between h-16 px-4 lg:px-6",
        "bg-card/80 backdrop-blur-xl border-b border-border shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer"
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-elevated/70 border border-border text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-status-green" />
          <span className="text-primary truncate">{roleLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer"
          aria-label="Notifikasi"
        >
          <Bell className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 pl-3 border-l border-border hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-primary leading-tight">{dbUser?.name ?? userName}</p>
              <p className="text-[10px] text-accent-teal font-semibold leading-tight">{roleLabel}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-accent-teal to-accent-teal/70 shadow-md shadow-accent-teal/10">
              {dbUser?.avatar_url ? (
                <img src={dbUser.avatar_url} alt="Profil" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-white" />
              )}
            </div>
          </button>

          {showUserDropdown && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowUserDropdown(false)} />
              <div className="absolute right-0 mt-2 z-40 w-48 bg-card border border-border rounded-2xl shadow-2xl py-2">
                <button
                  onClick={() => { setShowUserDropdown(false); setShowProfileModal(true); }}
                  disabled={!dbUser}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Settings className="h-4 w-4 text-muted" /> Edit Profil
                </button>
                <div className="h-px bg-border my-1" />
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2 text-sm font-semibold text-status-red hover:bg-status-red/10 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" /> Keluar
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {showProfileModal && dbUser && (
        <ProfileModal
          userId={dbUser.id}
          initialName={dbUser.name}
          initialUsername={dbUser.username}
          initialEmail={dbUser.email}
          initialPhone={dbUser.phone}
          initialAvatar={dbUser.avatar_url}
          onClose={() => setShowProfileModal(false)}
          onSuccess={(updatedUser) => {
            setDbUser({ ...dbUser, ...updatedUser });
            setShowProfileModal(false);
          }}
        />
      )}
    </header>
  );
}
