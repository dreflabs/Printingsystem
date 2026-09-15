"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ListChecks, ArrowRight, AlertTriangle, PenTool, Wallet, Printer,
  PackageCheck, HandCoins, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNextSteps, type WorkGroup } from "@/actions/solo";

type Item = {
  orderId: string;
  orderCode: string;
  customerName: string;
  status: string;
  deadline: string | Date | null;
  group: WorkGroup;
  step: { label: string; hint: string; href: string };
};

/** Urutan + tampilan tiap kelompok. Kunci harus sama dengan WorkGroup di solo.ts. */
const WORK_GROUPS: { key: WorkGroup; label: string; icon: typeof ListChecks }[] = [
  { key: "keputusan", label: "Butuh keputusan Anda", icon: AlertTriangle },
  { key: "desain", label: "Desain", icon: PenTool },
  { key: "bayar", label: "Tunggu pembayaran", icon: Wallet },
  { key: "produksi", label: "Produksi", icon: Printer },
  { key: "qc_finishing", label: "QC & Finishing", icon: PackageCheck },
  { key: "serah", label: "Simpan & serahkan", icon: HandCoins },
];

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—";

const isOverdue = (d: string | Date | null) => !!d && new Date(d).getTime() < Date.now();

export function WorkQueue() {
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await getNextSteps();
    if (r.success) {
      setItems(r.data.items as Item[]);
      setErr(null);
    } else {
      setErr(r.error ?? "Gagal memuat antrean.");
    }
    setReady(true);
    setRefreshing(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<WorkGroup, Item[]>();
    for (const it of items) {
      const arr = map.get(it.group) ?? [];
      arr.push(it);
      map.set(it.group, arr);
    }
    return map;
  }, [items]);

  const overdueCount = useMemo(() => items.filter((i) => isOverdue(i.deadline)).length, [items]);

  if (!ready) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-sm text-muted">
        Memuat antrean kerja…
      </div>
    );
  }

  return (
    <div className="bg-card border border-accent-teal/30 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
        <span className="inline-flex p-1.5 rounded-lg bg-accent-teal/10">
          <ListChecks className="h-4 w-4 text-accent-teal" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary">Antrean Kerja</p>
          <p className="text-[11px] text-muted">
            {items.length} order aktif
            {overdueCount > 0 && (
              <span className="text-status-red font-semibold"> · {overdueCount} lewat tempo</span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setRefreshing(true); load(); }}
          className="p-2 rounded-lg text-muted hover:text-accent-teal hover:bg-accent-teal/10 transition-colors"
          title="Muat ulang"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </button>
      </div>

      {err && (
        <p className="px-4 py-3 text-xs text-status-red bg-status-red/10 border-b border-status-red/20">{err}</p>
      )}

      {!err && items.length === 0 && (
        <div className="px-4 py-10 text-center">
          <PackageCheck className="h-10 w-10 mx-auto mb-2 text-muted opacity-30" />
          <p className="text-sm text-primary font-semibold">Semua order beres 🎉</p>
          <p className="text-xs text-muted mt-0.5">Tidak ada yang menunggu tindakan sekarang.</p>
        </div>
      )}

      {WORK_GROUPS.map(({ key, label, icon: Icon }) => {
        const rows = grouped.get(key);
        if (!rows || rows.length === 0) return null;
        const danger = key === "keputusan";
        return (
          <section key={key} className="border-b border-border/60 last:border-b-0">
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider",
                danger ? "text-status-red bg-status-red/5" : "text-muted bg-elevated/40"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-black",
                  danger ? "bg-status-red text-white" : "bg-border/60 text-primary"
                )}
              >
                {rows.length}
              </span>
            </div>
            <ul className="divide-y divide-border/50">
              {rows.map((it) => {
                const overdue = isOverdue(it.deadline);
                return (
                  <li key={it.orderId} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-xs text-primary">{it.orderCode}</span>
                        <span className="text-xs text-muted truncate">· {it.customerName}</span>
                        <span
                          className={cn(
                            "text-[11px] whitespace-nowrap",
                            overdue ? "text-status-red font-semibold" : "text-muted"
                          )}
                        >
                          · {overdue ? "lewat tempo " : "tempo "}{fmtDate(it.deadline)}
                        </span>
                      </div>
                      <p className="text-sm text-primary mt-0.5">{it.step.label}</p>
                      <p className="text-[11px] text-muted">{it.step.hint}</p>
                    </div>
                    <Link
                      href={it.step.href}
                      className="inline-flex items-center gap-1 shrink-0 h-8 px-3 rounded-lg bg-accent-teal/10 text-accent-teal text-xs font-bold hover:bg-accent-teal/20"
                    >
                      Buka <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
