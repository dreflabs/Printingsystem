"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { ImpersonationBanner } from "@/components/shared/ImpersonationBanner";
import { DASHBOARD_ROLE_PATHS } from "@/lib/nav-config";
import { getSessionUser, type WorkspaceMode } from "@/actions/session";

/** Jeda minimum penyegaran data sesi saat berpindah halaman. */
const SESSION_REFRESH_MS = 30_000;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<
    { id: string; name: string; role: string; roles: string[]; workspaceMode: WorkspaceMode; features?: string[] } | null
  >(null);
  const [ready, setReady] = useState(false);
  const lastFetchRef = useRef(0);
  const hasFetchedRef = useRef(false);

  // Ambil ulang sesi saat berpindah halaman (dengan jeda) supaya perubahan
  // peran/workspace_mode terasa tanpa reload penuh — dulu hanya sekali saat
  // mount, jadi sidebar bisa menampilkan peran yang sudah dicabut.
  useEffect(() => {
    const now = Date.now();
    // Jeda hanya berlaku SETELAH pengambilan pertama berhasil. Kalau tidak,
    // StrictMode (dev) yang menjalankan effect dua kali akan men-skip
    // percobaan kedua sementara hasil pertama sudah dibatalkan cleanup →
    // layar tertahan di "Memuat dashboard…".
    if (hasFetchedRef.current && now - lastFetchRef.current < SESSION_REFRESH_MS) return;
    lastFetchRef.current = now;
    let alive = true;
    getSessionUser()
      .then((r) => {
        if (!alive) return;
        hasFetchedRef.current = true;
        if (r.ok) setUser(r.user);
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

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
  const primaryDashboard = DASHBOARD_ROLE_PATHS.find((r) => r.role === (user?.role ?? "admin"));

  // Owner (dan role lain yang diizinkan middleware) boleh membuka dashboard
  // peran lain untuk pengawasan. Beri penanda jelas supaya tidak terkesan
  // "berpindah sendiri" ke peran yang sudah tidak dipegang.
  const pathRole = DASHBOARD_ROLE_PATHS.find(
    (r) => pathname === r.path || pathname.startsWith(r.path + "/"),
  );
  const supervisionMode = Boolean(pathRole && user && !roles.includes(pathRole.role));

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
          roles={roles}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {supervisionMode && pathRole && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-status-yellow/30 bg-status-yellow/10 px-4 py-2 text-xs text-status-yellow-text lg:px-6">
            <span className="font-bold">Mode pengawasan</span>
            <span>
              Anda membuka dashboard {pathRole.label} tanpa memegang peran itu — menu di samping tetap menu{" "}
              {primaryDashboard?.label ?? "peran utama"} Anda.
            </span>
            <Link href={primaryDashboard?.path ?? "/beranda"} className="font-bold underline underline-offset-2">
              Kembali ke dashboard {primaryDashboard?.label ?? "utama"}
            </Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
