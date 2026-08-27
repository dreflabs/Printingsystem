"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { ImpersonationBanner } from "@/components/shared/ImpersonationBanner";
import { getSessionUser } from "@/actions/session";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string; roles: string[] } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSessionUser().then((r) => {
      if (r.ok) {
        setUser(r.user);
        // Keep localStorage in sync for legacy components still reading it.
        try {
          localStorage.setItem("userRole", r.user.role);
          localStorage.setItem("userName", r.user.name);
          localStorage.setItem("userRoles", JSON.stringify(r.user.roles));
        } catch { /* ignore */ }
      }
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  const role = (user?.role ?? "admin") as never;
  const roles = user?.roles ?? [user?.role ?? "admin"];

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      <Sidebar role={role} roles={roles} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <Header
          userId={user?.id ?? null}
          userName={user?.name ?? "Pengguna"}
          role={user?.role ?? "admin"}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
