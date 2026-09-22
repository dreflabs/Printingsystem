"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { getOperationalAlerts } from "@/actions/operational-alerts";
import { OPEN_NOTIFICATIONS_EVENT } from "@/components/shared/NotificationBell";

/**
 * Strip kritis di dashboard: satu baris ringkas, bukan daftar alert.
 *
 * Alert operasional tinggal di satu tempat — Pusat Notifikasi (ikon lonceng di
 * header). Strip ini hanya penanda bahwa ada yang kritis, plus pintasan membuka
 * panelnya, supaya sinyal kritis tidak sepenuhnya tersembunyi di balik satu klik
 * dan tidak terasa sebagai notifikasi ganda.
 */
export function OperationalAlertStrip() {
  const [criticalCount, setCriticalCount] = useState(0);

  const load = useCallback(async () => {
    const res = await getOperationalAlerts();
    if (res.success) {
      setCriticalCount(res.data.filter((alert) => alert.status === "OPEN" && alert.severity === "CRITICAL").length);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (criticalCount === 0) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_NOTIFICATIONS_EVENT))}
      className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-status-red/30 bg-status-red/5 px-4 py-2.5 text-left transition-colors hover:border-status-red/50"
    >
      <CircleAlert className="h-4 w-4 shrink-0 text-status-red" />
      <span className="text-xs font-bold text-status-red">{criticalCount} alert kritis</span>
      <span className="text-[11px] text-muted">butuh perhatian — buka Pusat Notifikasi untuk detail &amp; akui</span>
      <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted" />
    </button>
  );
}
