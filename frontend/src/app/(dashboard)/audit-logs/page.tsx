"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Search, RefreshCw } from "lucide-react";

type Log = {
  id: string;
  actor: string;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  notes: string | null;
  createdAt: string;
};

const fmt = (d: string) => new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "300" });
      if (search) params.set("search", search);
      if (entityType) params.set("entity_type", entityType);
      const res = await fetch(`/api/audit-logs?${params}`);
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Gagal memuat."); return; }
      setLogs(j.logs ?? []);
    } catch {
      setError("Gagal memuat audit log.");
    } finally {
      setLoading(false);
    }
  }, [search, entityType]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-accent-teal" /> Audit Log
          </h1>
          <p className="text-sm text-muted mt-0.5">Riwayat lengkap semua aksi (rantai hash anti-fraud)</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 h-9 px-3 rounded-lg bg-card border border-border text-sm text-primary hover:border-accent-teal/40">
          <RefreshCw className="h-4 w-4" /> Muat ulang
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari aksi / entity id / tipe..."
            className="w-full h-9 rounded-lg bg-elevated border border-border text-sm text-primary pl-9 pr-3 outline-none focus:border-accent-teal"
          />
        </div>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="h-9 rounded-lg bg-elevated border border-border text-sm text-muted px-3 outline-none focus:border-accent-teal"
        >
          <option value="">Semua Entitas</option>
          <option value="Order">Order</option>
          <option value="ProductionJob">ProductionJob</option>
          <option value="Material">Material</option>
          <option value="NotificationEvent">NotificationEvent</option>
          <option value="Correction">Correction</option>
        </select>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border text-xs text-muted font-semibold uppercase tracking-wide">
          {loading ? "Memuat..." : `${logs.length} aksi`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-elevated/50 border-b border-border text-muted font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Entitas</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-elevated/30 align-top">
                  <td className="px-4 py-3 font-mono text-muted whitespace-nowrap">{fmt(l.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-primary">{l.actor}</span>
                    {l.actorRole && <span className="text-muted"> · {l.actorRole}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-accent-teal whitespace-nowrap">{l.action}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{l.entityType}:<span className="font-mono">{l.entityId.slice(0, 18)}</span></td>
                  <td className="px-4 py-3 text-muted max-w-[360px] break-words">
                    {l.notes || l.newValue || l.oldValue || "—"}
                  </td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Tidak ada aksi terekam.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
