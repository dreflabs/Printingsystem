"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { ImpersonationBanner } from "@/components/shared/ImpersonationBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState({
    name: "Loading...",
    role: "admin" as any,
    roles: ["admin"] as string[],
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const role = localStorage.getItem("userRole") ?? "admin";
    const name = localStorage.getItem("userName") ?? "Rere Admin";

    // Multi-role: read roles array stored as JSON, fallback to single role
    let roles: string[] = [role];
    try {
      const stored = localStorage.getItem("userRoles");
      if (stored) roles = JSON.parse(stored);
    } catch {
      roles = [role];
    }

    setUser({ name, role, roles });
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      {/* Sidebar */}
      <Sidebar
        role={user.role}
        roles={user.roles}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <Header
          userName={user.name}
          role={user.role}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
