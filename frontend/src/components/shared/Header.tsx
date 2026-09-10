"use client";

import { useState, useEffect } from "react";
import { Menu, Bell, User, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuDivider } from "@/components/ui";
import { getUserProfileById, getMyWorkspace } from "@/actions/profile";
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [workspace, setWorkspace] = useState<{ slug: string; name: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    getUserProfileById(userId).then((u) => {
      if (u) setDbUser({ ...u, email: u.email ?? "", username: u.username ?? "" });
    });
    getMyWorkspace().then((w) => setWorkspace(w));
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

        <div className="pl-3 border-l border-border">
          <DropdownMenu
            label="Menu akun"
            triggerClassName="flex items-center gap-2 rounded-xl p-0 bg-transparent hover:bg-transparent hover:opacity-80"
            trigger={
              <>
                <span className="text-right hidden sm:block">
                  <span className="block text-xs font-bold text-primary leading-tight">{dbUser?.name ?? userName}</span>
                  <span className="block text-[10px] text-accent-teal font-semibold leading-tight">{roleLabel}</span>
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-accent-teal to-accent-teal/70 shadow-md shadow-accent-teal/10">
                  {dbUser?.avatar_url ? (
                    <img src={dbUser.avatar_url} alt="Profil" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </span>
              </>
            }
          >
            <DropdownMenuItem
              icon={<Settings className="h-4 w-4" />}
              disabled={!dbUser}
              onSelect={() => setShowProfileModal(true)}
            >
              Edit Profil
            </DropdownMenuItem>
            <DropdownMenuDivider />
            <DropdownMenuItem
              danger
              icon={<LogOut className="h-4 w-4" />}
              onSelect={() => { void signOutAction(); }}
            >
              Keluar
            </DropdownMenuItem>
          </DropdownMenu>
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
          workspaceSlug={workspace?.slug ?? null}
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
