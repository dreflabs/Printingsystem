"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { ImpersonationBanner } from "@/components/shared/ImpersonationBanner";
import { getSessionUser, type WorkspaceMode } from "@/actions/session";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<
    { id: string; name: string; role: string; roles: string[]; workspaceMode: WorkspaceMode; features?: string[] } | null
  >(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSessionUser().then((r) => {
      if (r.ok) setUser(r.user);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base text-muted" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-sm font-medium">
          <span className="h-4 w-4 rounded-full border-2 border-accent-teal border-t-transparent animate-spin" />
          Memuat dashboard…
        </div>
      </div>
    );
  }

  const role = (user?.role ?? "admin") as never;
  const roles = user?.roles ?? [user?.role ?? "admin"];

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      <Sidebar
        role={role}
        roles={roles}
        workspaceMode={user?.workspaceMode ?? "TEAM_FULL"}
        features={user?.features ?? undefined}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

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
