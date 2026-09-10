"use client";

import { useState, useEffect, useCallback } from "react";
import { Archive, AlertTriangle } from "lucide-react";
import { listRetiredTenants } from "@/actions/platform";

type Retired = {
  id: string;
  originalSlug: string;
  name: string;
  plan: string;
  ownerName: string | null;
  churnedAt: Date | string | null;
  purgedAt: Date | string;
  counts: Record<string, number> | null;
};

const dt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function PlatformRetiredPage() {
  const [rows, setRows] = useState<Retired[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await listRetiredTenants();
    setLoading(false);
    if (r.success) { setRows(r.data); setError(null); }
    else setError(r.error);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary">Tenant Terhapus</h1>
        <p className="text-sm text-muted mt-0.5">
          Nisan (<span className="font-mono">RetiredTenant</span>) tenant yang datanya sudah di-purge permanen —
          untuk arsip &amp; pajak. Baris ini tahan-hapus dan tidak bisa memulihkan data.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Archive className="h-4 w-4 text-accent-teal" />
          <h2 className="text-sm font-semibold text-primary">{rows.length} nisan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Toko</th>
                <th className="px-4 py-2.5">Subdomain asli</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Paket</th>
                <th className="px-4 py-2.5">Data saat dihapus</th>
                <th className="px-4 py-2.5">Churned</th>
                <th className="px-4 py-2.5">Dihapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-elevated/30 align-top">
                  <td className="px-4 py-2.5 font-medium text-primary">{r.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-accent-teal">{r.originalSlug}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{r.ownerName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{r.plan}</td>
                  <td className="px-4 py-2.5 text-xs text-muted font-mono">
                    {r.counts
                      ? Object.entries(r.counts).map(([k, v]) => `${k}:${v}`).join(" · ")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{dt(r.churnedAt)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{dt(r.purgedAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted text-sm">Belum ada tenant yang dihapus permanen.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
