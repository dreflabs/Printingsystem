"use client";

/**
 * InfoTip — ikon "i" + tooltip penjelasan singkat.
 *
 * Tampil saat hover ATAU keyboard-focus (aksesibilitas). Tutup saat pointer
 * keluar / blur / Esc / scroll / resize. Panel di-portal ke <body> + posisi
 * `fixed` supaya tidak ke-clip di dalam modal, dengan flip ke atas bila mepet
 * dasar layar. Untuk penjelasan panjang / "kenapa alur ini ada", pakai
 * RoleGuide / dokumen, bukan InfoTip.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InfoTipProps {
  text: ReactNode;
  /** Label aksesibilitas tombol pemicu. Default "Info". */
  label?: string;
  className?: string;
}

const TIP_W = 260;

export function InfoTip({ text, label = "Info", className }: InfoTipProps) {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipId = useId();
  const open = pos !== null;

  const close = useCallback(() => setPos(null), []);

  const show = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - TIP_W - 8));
    const openUp = r.bottom + 140 > window.innerHeight;
    setPos({
      left,
      top: openUp ? undefined : Math.round(r.bottom + 6),
      bottom: openUp ? Math.round(window.innerHeight - r.top + 6) : undefined,
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, close]);

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={close}
        onFocus={show}
        onBlur={close}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) close();
          else show();
        }}
        className="inline-flex align-middle text-muted transition-colors hover:text-accent-teal focus-visible:text-accent-teal focus-visible:outline-none"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: TIP_W }}
            className="z-[110] rounded-lg border border-border/60 bg-card px-3 py-2 text-xs leading-snug text-primary shadow-popover"
          >
            {text}
          </div>,
          document.body
        )}
    </span>
  );
}
