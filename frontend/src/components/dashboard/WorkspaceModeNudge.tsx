"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, ArrowRight, Undo2, RefreshCw } from "lucide-react";
import {
  getWorkspaceModeSuggestion, setWorkspaceMode, setOwnerOperationalRoles,
} from "@/actions/solo";
import { WORKSPACE_MODE_LABEL, type WorkspaceMode } from "@/lib/workspace-mode";

type Suggestion = {
  current: WorkspaceMode;
  suggested: WorkspaceMode;
  staffCount: number;
  ownerOps: string[];
  sheddableRoles: string[];
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin / Kasir",
  designer_sales: "Designer / Setting",
  operator: "Operator Cetak",
  gudang: "Finishing & Gudang",
};

/** localStorage: sembunyikan saran untuk pasangan (current→suggested) tertentu. */
const dismissKey = (s: Suggestion) => `pp_wsmode_dismiss_${s.current}_${s.suggested}`;

export function WorkspaceModeNudge() {
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [shed, setShed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [applied, setApplied] = useState<null | { prevMode: WorkspaceMode; prevOps: string[] }>(null);

  const load = useCallback(async () => {
    const r = await getWorkspaceModeSuggestion();
    if (r.success && r.data) {
      setSug(r.data as Suggestion);
      setShed(new Set((r.data as Suggestion).sheddableRoles));
      try {
        setDismissed(localStorage.getItem(dismissKey(r.data as Suggestion)) === "1");
      } catch { /* ignore */ }
    } else {
      setSug(null);
    }
    setReady(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (!ready || !sug || (dismissed && !applied)) return null;

  const goingToTeam = sug.suggested !== "SOLO";
  const canShed = goingToTeam && sug.sheddableRoles.length > 0;

  async function apply() {
    if (!sug) return;
    setBusy(true);
    setErr(null);
    const prevOps = [...sug.ownerOps];
    const prevMode = sug.current;

    const m = await setWorkspaceMode(sug.suggested);
    if (!m.success) { setErr(m.error ?? "Gagal mengganti tampilan."); setBusy(false); return; }

    if (canShed && shed.size > 0) {
      const keep = sug.ownerOps.filter((r) => !shed.has(r));
      const rr = await setOwnerOperationalRoles(keep);
      if (!rr.success) { setErr(rr.error ?? "Tampilan diganti, tapi gagal melepas peran."); setBusy(false); return; }
    }
    setApplied({ prevMode, prevOps });
    setBusy(false);
  }

  async function undo() {
    if (!applied) return;
    setBusy(true);
    setErr(null);
    await setOwnerOperationalRoles(applied.prevOps);
    await setWorkspaceMode(applied.prevMode);
    setBusy(false);
    setApplied(null);
    load();
  }

  function dismiss() {
    if (!sug) return;
    try { localStorage.setItem(dismissKey(sug), "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  function toggleShed(role: string) {
    setShed((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  // ── Sesudah diterapkan: konfirmasi + Batalkan + Muat ulang ──
  if (applied) {
    return (
      <div className="bg-card border border-status-green/30 rounded-2xl p-4">
        <p className="text-sm font-bold text-primary">
          Tampilan dialihkan ke {WORKSPACE_MODE_LABEL[sug.suggested]}.
        </p>
        <p className="text-xs text-muted mt-0.5">
          Muat ulang halaman untuk melihat menu baru. Izin tidak berubah.
        </p>
        {err && <p className="text-xs text-status-red mt-1">{err}</p>}
        <div className="flex gap-2 mt-2.5">
          <button
            onClick={() => window.location.reload()}
            className="h-8 px-3 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
          </button>
          <button
            onClick={undo}
            disabled={busy}
            className="h-8 px-3 rounded-lg text-xs font-bold text-muted hover:text-primary inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" /> {busy ? "Membatalkan…" : "Batalkan"}
          </button>
        </div>
      </div>
    );
  }

  // ── Saran ──
  return (
    <div className="bg-card border border-accent-teal/30 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex p-1.5 rounded-lg bg-accent-teal/10 shrink-0">
          <Users className="h-4 w-4 text-accent-teal" />
        </span>
        <div className="flex-1 min-w-0">
          {goingToTeam ? (
            <>
              <p className="text-sm font-bold text-primary">Tim Anda bertambah</p>
              <p className="text-xs text-muted mt-0.5">
                Ada {sug.staffCount} pegawai aktif. Alihkan tampilan ke{" "}
                <b>{WORKSPACE_MODE_LABEL[sug.suggested]}</b> — menu &amp; beranda menyesuaikan.
                Izin tidak berubah.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-primary">Sekarang Anda jalan sendiri</p>
              <p className="text-xs text-muted mt-0.5">
                Tidak ada pegawai aktif. Kembalikan tampilan ke <b>Mode Solo</b> yang lebih ringkas?
              </p>
            </>
          )}

          {canShed && (
            <div className="mt-2.5 rounded-lg border border-border bg-elevated/50 p-2.5">
              <p className="text-[11px] font-bold text-primary mb-1.5">
                Lepas peran ini dari akun Anda? (sudah ada pegawainya)
              </p>
              <div className="space-y-1">
                {sug.sheddableRoles.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shed.has(r)}
                      onChange={() => toggleShed(r)}
                    />
                    {ROLE_LABEL[r] ?? r}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted mt-1.5">
                Bisa diambil lagi kapan saja di Pegawai &amp; Akses.
              </p>
            </div>
          )}

          {err && <p className="text-xs text-status-red mt-1.5">{err}</p>}

          <div className="flex gap-2 mt-2.5">
            <button
              onClick={apply}
              disabled={busy}
              className="h-8 px-3 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {busy ? "Menerapkan…" : "Terapkan"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={dismiss}
              disabled={busy}
              className="h-8 px-3 rounded-lg text-xs font-bold text-muted hover:text-primary disabled:opacity-40"
            >
              Nanti saja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
