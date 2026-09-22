"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Bell, Check, CircleAlert, Inbox, Loader2 } from "lucide-react";
import { DropdownMenu, useDropdownMenuClose } from "@/components/ui";
import { acknowledgeOperationalAlert, getOperationalAlerts, type OperationalAlertRow } from "@/actions/operational-alerts";
import { anyRoleCan } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Jeda minimum penyegaran badge saat berpindah halaman. */
const REFRESH_MS = 60_000;

/**
 * Event untuk membuka panel dari komponen lain (mis. strip kritis di dashboard),
 * supaya sinyal kritis tetap bisa diakses tanpa menduplikasi daftar alertnya.
 */
export const OPEN_NOTIFICATIONS_EVENT = "pp:open-notifications";

/** Baris alert di dalam panel. Komponen terpisah agar bisa memakai hook penutup menu. */
function NotificationRow({
  alert,
  canAck,
  busy,
  onAck,
}: {
  alert: OperationalAlertRow;
  canAck: boolean;
  busy: boolean;
  onAck: (id: string) => void;
}) {
  const closeMenu = useDropdownMenuClose();
  const critical = alert.severity === "CRITICAL";
  const acknowledged = alert.status === "ACKNOWLEDGED";

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-elevated/60">
      <span className={cn("mt-0.5 rounded-lg p-1.5", critical ? "bg-status-red/10 text-status-red" : "bg-status-yellow/10 text-status-yellow-text")}>
        {critical ? <CircleAlert className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-primary">{alert.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{alert.message}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {alert.href && (
            <Link
              href={alert.href}
              onClick={closeMenu}
              className="rounded-lg border border-border bg-elevated px-2.5 py-1 text-[11px] font-bold text-muted transition-colors hover:text-primary"
            >
              Buka
            </Link>
          )}
          {canAck && !acknowledged && (
            <button
              type="button"
              onClick={() => onAck(alert.id)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-accent-teal px-2.5 py-1 text-[11px] font-bold text-white transition-opacity disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Akui
            </button>
          )}
          {acknowledged && <span className="text-[10px] font-semibold text-status-green">Sudah diakui</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Pusat Notifikasi di header. Badge = jumlah alert OPEN (yang sudah diakui tidak
 * dihitung). Hanya dirender untuk peran yang boleh melihat alert operasional.
 */
export function NotificationBell({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  const canView = anyRoleCan(roles, "operations.alerts.view");
  const canAck = anyRoleCan(roles, "operations.alerts.acknowledge");
  const [alerts, setAlerts] = useState<OperationalAlertRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAcked, setShowAcked] = useState(false);
  const [forcedOpen, setForcedOpen] = useState(false);
  const lastLoadRef = useRef(0);

  const load = useCallback(async () => {
    lastLoadRef.current = Date.now();
    const res = await getOperationalAlerts();
    if (res.success) setAlerts(res.data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!canView) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [canView, load]);

  // Segarkan badge saat berpindah halaman (dengan jeda) supaya tidak basi.
  useEffect(() => {
    if (!canView) return;
    if (Date.now() - lastLoadRef.current < REFRESH_MS) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [pathname, canView, load]);

  // Dibuka dari komponen lain (strip kritis dashboard).
  useEffect(() => {
    if (!canView) return;
    const onOpen = () => {
      setForcedOpen(true);
      void load();
    };
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, onOpen);
  }, [canView, load]);

  const ack = async (id: string) => {
    setBusy(id);
    const res = await acknowledgeOperationalAlert(id);
    setBusy(null);
    if (res.success) {
      setAlerts((prev) => prev.map((item) => (item.id === id ? { ...item, status: "ACKNOWLEDGED", acknowledgedAt: new Date() } : item)));
    }
  };

  if (!canView) return null;

  const open = alerts.filter((alert) => alert.status === "OPEN");
  const acknowledged = alerts.filter((alert) => alert.status !== "OPEN");
  const critical = open.filter((alert) => alert.severity === "CRITICAL");
  const warnings = open.filter((alert) => alert.severity !== "CRITICAL");
  const badge = open.length;

  const section = (title: string, rows: OperationalAlertRow[]) =>
    rows.length > 0 && (
      <div>
        <p className="border-b border-border px-3 pb-1.5 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          {title} ({rows.length})
        </p>
        <div className="divide-y divide-border/50">
          {rows.map((alert) => (
            <NotificationRow key={alert.id} alert={alert} canAck={canAck} busy={busy === alert.id} onAck={ack} />
          ))}
        </div>
      </div>
    );

  return (
    <DropdownMenu
      label="Notifikasi"
      width={typeof window === "undefined" ? 380 : Math.min(380, window.innerWidth - 24)}
      className="p-0"
      triggerClassName="relative"
      open={forcedOpen}
      onOpenChange={setForcedOpen}
      trigger={
        <>
          <Bell className="h-5 w-5" />
          {badge > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
                critical.length > 0 ? "bg-status-red" : "bg-status-yellow-text"
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      }
    >
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
        <span className="text-xs font-bold text-primary">Pusat Notifikasi</span>
        {badge > 0 && <span className="text-[10px] font-semibold text-muted">{badge} belum diakui</span>}
      </div>

      {!loaded && (
        <div className="flex h-16 items-center justify-center text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {loaded && open.length === 0 && acknowledged.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <Inbox className="h-6 w-6 text-muted-light" />
          <p className="text-xs font-semibold text-primary">Tidak ada alert</p>
          <p className="text-[11px] text-muted">Stok, incident storage, dan deadline job akan muncul di sini.</p>
        </div>
      )}

      {loaded && open.length === 0 && acknowledged.length > 0 && (
        <div className="px-3 py-4 text-center text-[11px] text-muted">Semua alert sudah diakui.</div>
      )}

      {loaded && section("Kritis", critical)}
      {loaded && section("Peringatan", warnings)}

      {loaded && acknowledged.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowAcked((value) => !value)}
            className="w-full px-3 py-2 text-left text-[11px] font-semibold text-muted transition-colors hover:text-primary"
          >
            {showAcked ? "Sembunyikan" : "Tampilkan"} yang sudah diakui ({acknowledged.length})
          </button>
          {showAcked && (
            <div className="divide-y divide-border/50 opacity-70">
              {acknowledged.map((alert) => (
                <NotificationRow key={alert.id} alert={alert} canAck={canAck} busy={busy === alert.id} onAck={ack} />
              ))}
            </div>
          )}
        </div>
      )}
    </DropdownMenu>
  );
}
