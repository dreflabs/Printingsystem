"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Check, CircleAlert, Loader2 } from "lucide-react";
import { getOperationalAlerts, acknowledgeOperationalAlert } from "@/actions/operational-alerts";
import { getSessionUser } from "@/actions/session";
import { cn } from "@/lib/utils";

type AlertRow = {
  id: string;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  acknowledgedAt: Date | null;
};

export function OperationalAlerts() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [canAck, setCanAck] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getOperationalAlerts();
    if (res.success) setAlerts(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void getSessionUser().then((res) => {
      if (res.ok) setCanAck(res.user.roles.some((role) => role === "owner" || role === "admin"));
    });
  }, [load]);

  const ack = async (id: string) => {
    setBusy(id);
    const res = await acknowledgeOperationalAlert(id);
    setBusy(null);
    if (res.success) setAlerts((prev) => prev.map((item) => item.id === id ? { ...item, status: "ACKNOWLEDGED", acknowledgedAt: new Date() } : item));
  };

  if (loading) return <div className="h-16 flex items-center justify-center text-muted"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!alerts.length) return null;

  return <section className="bg-card border border-border rounded-2xl shadow-card overflow-hidden"><div className="flex items-center gap-2 p-5 border-b border-border"><Bell className="h-5 w-5 text-status-yellow-text" /><h2 className="text-base font-bold text-primary">Alert Operasional</h2><span className="rounded-full bg-status-red/10 px-2 py-0.5 text-[10px] font-bold text-status-red">{alerts.filter((item) => item.status === "OPEN").length}</span></div><div className="divide-y divide-border/50">{alerts.map((alert) => { const critical = alert.severity === "CRITICAL"; return <div key={alert.id} className="flex flex-wrap items-center gap-3 p-4"><div className={cn("rounded-lg p-2", critical ? "bg-status-red/10 text-status-red" : "bg-status-yellow/10 text-status-yellow-text")}>{critical ? <CircleAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-primary">{alert.title}</p><p className="text-xs text-muted mt-0.5">{alert.message}</p>{alert.status === "ACKNOWLEDGED" && <p className="text-[10px] text-status-green mt-1">Sudah diakui</p>}</div>{alert.href && <Link href={alert.href} className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-[11px] font-bold text-muted hover:text-primary">Buka</Link>}{canAck && alert.status === "OPEN" && <button onClick={() => ack(alert.id)} disabled={busy === alert.id} className="inline-flex items-center gap-1 rounded-lg bg-accent-teal px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"><Check className="h-3 w-3" />{busy === alert.id ? "..." : "Akui"}</button>}</div>; })}</div></section>;
}
