"use client";

/**
 * DropdownMenu — menu aksi bersama (kebab / user-menu / dsb).
 *
 * Kenapa portal + posisi `fixed`: menu sering hidup di dalam container ber-
 * `overflow` (tabel, kartu) yang meng-clip panel absolute. Portal ke `document.body`
 * melepasnya dari clipping; koordinat dihitung dari `getBoundingClientRect()` tombol.
 *
 * Kenapa guard `[data-dropdown]` di listener close: handler React & listener ini
 * sama-sama nempel di `document` (App Router hydrate seluruh dokumen), jadi
 * `stopPropagation` di tombol tidak menahan listener close — klik buka menu bisa
 * langsung menutupnya lagi. Guard-nya: abaikan klik yang berasal dari trigger/panel.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Align = "start" | "end";

interface MenuPos {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  openUp: boolean;
  align: Align;
}

const MenuCtx = createContext<{ close: () => void } | null>(null);

/** Perkiraan tinggi panel untuk memutuskan buka ke atas/bawah. */
const FLIP_THRESHOLD = 320;

export interface DropdownMenuProps {
  /** Isi tombol pemicu (biasanya ikon). */
  trigger: ReactNode;
  /** Label aksesibilitas untuk tombol pemicu (wajib — tombol ikon tanpa teks). */
  label: string;
  children: ReactNode;
  /** Sisi panel yang disejajarkan dengan tombol. Default "end" (kanan). */
  align?: Align;
  /** Lebar panel px. Default 208. */
  width?: number;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function DropdownMenu({
  trigger,
  label,
  children,
  align = "end",
  width = 208,
  className,
  triggerClassName,
  disabled,
}: DropdownMenuProps) {
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  const close = useCallback(() => setPos(null), []);

  const openMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const openUp = r.bottom > window.innerHeight - FLIP_THRESHOLD;
    setPos({
      align,
      openUp,
      top: openUp ? undefined : Math.round(r.bottom + 4),
      bottom: openUp ? Math.round(window.innerHeight - r.top + 4) : undefined,
      right: align === "end" ? Math.round(window.innerWidth - r.right) : undefined,
      left: align === "start" ? Math.round(r.left) : undefined,
    });
  };

  // Listener global hanya aktif saat menu terbuka.
  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: Event) => {
      if ((e.target as Element)?.closest?.("[data-dropdown]")) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "Tab") {
        close();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([disabled])'
        );
        if (!items?.length) return;
        const arr = [...items];
        const idx = arr.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === "ArrowDown"
            ? arr[(idx + 1) % arr.length]
            : arr[(idx - 1 + arr.length) % arr.length];
        next?.focus();
      }
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, close]);

  // Fokus item pertama saat menu terbuka.
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([disabled])'
    );
    first?.focus();
  }, [open]);

  const originCls =
    (pos?.openUp ? "origin-bottom" : "origin-top") +
    (align === "end" ? "-right" : "-left");

  return (
    <span className="relative inline-flex" data-dropdown>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else openMenu();
        }}
        className={cn(
          "p-2 rounded-lg text-muted transition-colors hover:bg-elevated hover:text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/40",
          "disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
          open && "bg-elevated text-primary",
          triggerClassName
        )}
      >
        {trigger}
      </button>

      {open &&
        createPortal(
          <MenuCtx.Provider value={{ close }}>
            <div
              ref={menuRef}
              data-dropdown
              role="menu"
              aria-label={label}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                width,
                top: pos.top,
                bottom: pos.bottom,
                left: pos.left,
                right: pos.right,
                maxHeight: "calc(100vh - 16px)",
              }}
              className={cn(
                "z-[100] overflow-y-auto rounded-xl border border-border/60 bg-card py-1.5",
                "shadow-popover animate-in fade-in-0 zoom-in-95 duration-100",
                originCls,
                className
              )}
            >
              {children}
            </div>
          </MenuCtx.Provider>,
          document.body
        )}
    </span>
  );
}

export interface DropdownMenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  /** Aksi destruktif (Hapus) — satu-satunya yang diberi warna merah. */
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownMenuItem({
  children,
  onSelect,
  icon,
  danger,
  disabled,
}: DropdownMenuItemProps) {
  const ctx = useContext(MenuCtx);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        ctx?.close();
      }}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors",
        "focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
        danger
          ? "text-status-red hover:bg-status-red/10 focus-visible:bg-status-red/10"
          : "text-primary hover:bg-elevated focus-visible:bg-elevated"
      )}
    >
      {icon && (
        <span className={cn("shrink-0", !danger && "text-muted")}>{icon}</span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownMenuDivider() {
  return <div role="separator" className="my-1.5 h-px bg-border/70" />;
}

/** Judul seksi opsional di dalam menu. */
export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-light">
      {children}
    </div>
  );
}
