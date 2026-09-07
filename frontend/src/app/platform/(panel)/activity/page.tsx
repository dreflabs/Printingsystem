"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollText, AlertTriangle, Filter } from "lucide-react";
import { listPlatformAuditLog } from "@/actions/platform";

type Entry = {
  id: string;
  actorName: string;
  actorSubLevel: string | null;
  action: string;
  targetType: string | null;
  targetLabel: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: Date | string;
};

const dt = (d: Date | string) =>
  new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

const ACTIONS = [
  "",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGIN_LOCKED",
  "IMPERSONATE_START",
  "IMPERSONATE_END",
  "TENANT_SUSPENDED",
  "TENANT_ACTIVATED",
  "TENANT_PLAN_CHANGED",
  "TENANT_CHURNED",
  "TENANT_PURGED",
  "SUPER_ADMIN_CREATED",
  "SUPER_ADMIN_DEACTIVATED",
  "SUPER_ADMIN_ACTIVATED",
  "SUPER_ADMIN_SUBLEVEL_CHANGED",
  "SUPER_ADMIN_PASSWORD_RESET",
  "SUPER_ADMIN_UNLOCKED",
  "MFA_ENABLED",
  "MFA_RESET",
  "MFA_BACKUP_CODE_USED",
];

const DANGER = new Set(["LOGIN_FAILED", "LOGIN_LOCKED", "TENANT_PURGED", "MFA_RESET", "SUPER_ADMIN_DEACTIVATED"]);

export default function PlatformActivityPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filterAction: string, fromCursor: string | null) => {
    setLoading(true);
    const r = await listPlatformAuditLog({
      action: filterAction || undefined,
      cursor: fromCursor ?? undefined,
      limit: 50,
    });
    setLoading(false);
    if (!r.success) {
      setError(r.error);
      return;
    }
    setError(null);
    setEntries((prev) => (fromCursor ? [...prev, ...r.data.entries] : r.data.entries));
    setCursor(r.data.nextCursor);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(action, null); }, [action, load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary">Jejak Aktivitas Platform</h1>
        <p className="text-sm text-muted mt-0.5">
          Semua aksi Super Admin — login, impersonate, kelola tenant &amp; akun, MFA. Tahan-hapus:
          tetap terbaca setelah tenant di-purge.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted" />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg bg-elevated border border-border text-primary text-sm px-2 py-1.5 outline-none focus:border-accent-teal"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a || "Semua aksi"}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-accent-teal" />
          <h2 className="text-sm font-semibold text-primary">{entries.length} entri</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Waktu</th>
                <th className="px-4 py-2.5">Pelaku</th>
                <th className="px-4 py-2.5">Aksi</th>
                <th className="px-4 py-2.5">Target</th>
                <th className="px-4 py-2.5">Detail</th>
                <th className="px-4 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-elevated/30 align-top">
                  <td className="px-4 py-2.5 text-muted text-xs whitespace-nowrap">{dt(e.createdAt)}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="text-primary">{e.actorName}</span>
                    {e.actorSubLevel && <span className="text-muted"> · {e.actorSubLevel}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        DANGER.has(e.action)
                          ? "bg-status-red/10 text-status-red border-status-red/30"
                          : "bg-elevated text-muted border-border"
                      }`}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {e.targetLabel ? (
                      <>
                        <span className="font-mono text-primary">{e.targetLabel}</span>
                        {e.targetType && <span> ({e.targetType})</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-muted/80 max-w-xs break-words font-mono">
                    {e.detail ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted font-mono">{e.ip ?? "—"}</td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">
                    Belum ada entri.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {cursor && (
          <div className="p-3 border-t border-border text-center">
            <button
              onClick={() => load(action, cursor)}
              disabled={loading}
              className="text-xs font-bold text-accent-teal hover:underline disabled:opacity-40"
            >
              {loading ? "Memuat…" : "Muat lebih banyak"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
