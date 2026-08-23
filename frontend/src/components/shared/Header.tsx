"use client";

import { useState, useEffect } from "react";
import { Menu, Bell, User, RefreshCw, ChevronDown, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUserProfile } from "@/actions/profile";
import { ProfileModal } from "./ProfileModal";

const ROLE_OPTIONS = [
  { role: "admin", label: "Admin", user: "Rere (Admin)", path: "/admin" },
  { role: "designer_sales", label: "Designer Sales", user: "Ayu (Designer)", path: "/designer" },
  { role: "operator", label: "Operator Cetak", user: "Budi (Operator)", path: "/operator" },
  { role: "gudang", label: "Finishing", user: "Fajar (Finishing)", path: "/gudang" },
  { role: "owner", label: "Owner", user: "Pak Hendra (Owner)", path: "/owner" },
];

interface HeaderProps {
  userName: string;
  role: string;
  onMenuClick: () => void;
  className?: string;
}

export function Header({ userName, role, onMenuClick, className }: HeaderProps) {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [dbUser, setDbUser] = useState<{id: string, name: string, username: string, email: string, phone: string | null, avatar_url: string | null} | null>(null);

  useEffect(() => {
    // Fetch real user from DB based on role
    const loadUser = async () => {
      const user = await getCurrentUserProfile(role);
      if (user) {
        setDbUser({
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          avatar_url: user.avatar_url
        });
      }
    };
    loadUser();
  }, [role]);

  const currentRoleObj = ROLE_OPTIONS.find((r) => r.role === role) || {
    role,
    label: role,
    user: userName,
    path: "/admin",
  };

  const handleSwitchRole = (r: typeof ROLE_OPTIONS[0]) => {
    localStorage.setItem("userRole", r.role);
    localStorage.setItem("userName", r.user);
    setShowRoleDropdown(false);
    window.location.href = r.path;
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between",
        "h-16 px-4 lg:px-6",
        "bg-card/80 backdrop-blur-xl border-b border-border shadow-sm",
        className
      )}
    >
      {/* Left: Hamburger + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer"
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Demo Quick Switcher Badge */}
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-elevated/70 border border-border hover:border-accent-teal/40 text-xs font-semibold transition-all cursor-pointer"
          >
            <span className="h-2 w-2 rounded-full bg-accent-teal animate-pulse" />
            <span className="text-primary truncate">{currentRoleObj.label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </button>

          {/* Role Dropdown */}
          {showRoleDropdown && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowRoleDropdown(false)}
              />
              <div className="absolute left-0 mt-2 z-40 w-56 bg-card border border-border rounded-2xl shadow-2xl p-2 space-y-1">
                <div className="px-3 py-1.5 border-b border-border mb-1">
                  <p className="text-[10px] uppercase font-bold text-muted tracking-wider">Switch Demo Role</p>
                </div>
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => handleSwitchRole(r)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer",
                      r.role === role
                        ? "bg-accent-teal/10 text-accent-teal font-bold"
                        : "text-muted hover:text-primary hover:bg-elevated"
                    )}
                  >
                    <span>{r.label}</span>
                    {r.role === role && <span className="h-1.5 w-1.5 rounded-full bg-accent-teal" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Notification + User */}
      <div className="flex items-center gap-3">
        {/* Bell */}
        <button
          className="relative p-2 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors cursor-pointer"
          aria-label="Notifikasi"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-status-red animate-pulse" />
        </button>

        {/* User Info */}
        <div className="relative">
          <button 
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 pl-3 border-l border-border hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-primary leading-tight">{dbUser ? dbUser.name : userName}</p>
              <p className="text-[10px] text-accent-teal font-semibold leading-tight">{currentRoleObj.label}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-accent-teal to-blue-600 shadow-md shadow-accent-teal/10">
              {dbUser?.avatar_url ? (
                <img src={dbUser.avatar_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-white" />
              )}
            </div>
          </button>

          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowUserDropdown(false)}
              />
              <div className="absolute right-0 mt-2 z-40 w-48 bg-card border border-border rounded-2xl shadow-2xl py-2">
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    setShowProfileModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-primary hover:bg-elevated flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-muted" />
                  Edit Profil
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => window.location.href = "/login"}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-status-red hover:bg-status-red/10 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar / Logout
                </button>
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
            setDbUser(updatedUser);
            localStorage.setItem("userName", updatedUser.name); // Update dummy switcher display too
            setShowProfileModal(false);
          }}
        />
      )}
    </header>
  );
}
