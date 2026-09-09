"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ListChecks, ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNextSteps } from "@/actions/solo";

type Item = {
  orderId: string;
  orderCode: string;
  customerName: string;
  status: string;
  deadline: string | Date | null;
  step: { label: string; hint: string; href: string };
};

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—";

const STORAGE_KEY = "pp_solo_nextsteps";

export function SoloNextSteps() {
  const [items, setItems] = useState<Item[]>([]);
  const [solo, setSolo] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const r = await getNextSteps();
    if (r.success) {
      setItems(r.data.items);
      setSolo(r.data.solo);
    }
    setReady(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(STORAGE_KEY) === "0";
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!collapsed);
  }, []);

  if (!ready) return null;

  // ── Daftar "Langkah berikutnya" (Owner multi-peran) ───────────────────────
  if (!solo || items.length === 0) return null;

  const isOpen = open ?? true;
  function toggle() {
    const next = !isOpen;
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const shown = items.slice(0, 8);

  return (
    <div className="bg-card border border-accent-teal/30 rounded-2xl overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-elevated/40 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="inline-flex p-1.5 rounded-lg bg-accent-teal/10">
          <ListChecks className="h-4 w-4 text-accent-teal" />
        </span>
        <span className="flex-1">
          <span className="text-sm font-bold text-primary">Langkah berikutnya</span>
          <span className="ml-2 text-[11px] font-bold text-accent-teal">{items.length} order aktif</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {shown.map((it) => (
            <li key={it.orderId} className="px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary">{it.orderCode}</span>
                  <span className="text-xs text-muted truncate">· {it.customerName}</span>
                  <span className="text-[11px] text-muted whitespace-nowrap">· jatuh tempo {fmtDate(it.deadline)}</span>
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
          ))}
          {items.length > shown.length && (
            <li className="px-4 py-2 text-center">
              <Link href="/admin" className="text-xs font-bold text-accent-teal hover:underline">
                {items.length - shown.length} order lainnya di Dashboard Admin
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
