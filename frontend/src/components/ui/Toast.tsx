"use client";

import * as React from "react";
import { X, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (opts: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((opts: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, ...opts }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const typeConfig: Record<ToastType, { icon: React.ReactNode; color: string; border: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 shrink-0" />,
    color: "text-status-green",
    border: "border-l-4 border-status-green",
  },
  error: {
    icon: <XCircle className="h-5 w-5 shrink-0" />,
    color: "text-status-red",
    border: "border-l-4 border-status-red",
  },
  warning: {
    icon: <AlertCircle className="h-5 w-5 shrink-0" />,
    color: "text-status-yellow",
    border: "border-l-4 border-status-yellow",
  },
  info: {
    icon: <Info className="h-5 w-5 shrink-0" />,
    color: "text-accent-teal",
    border: "border-l-4 border-accent-teal",
  },
};

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => {
        const cfg = typeConfig[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 w-80 rounded-xl",
              "bg-card/90 backdrop-blur-xl border border-border p-4",
              "shadow-[0_4px_24px_rgba(0,0,0,0.4)]",
              "animate-in slide-in-from-right-4 duration-300",
              cfg.border
            )}
          >
            <span className={cfg.color}>{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">{t.title}</p>
              {t.message && <p className="text-xs text-muted mt-0.5">{t.message}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted hover:text-primary transition-colors cursor-pointer shrink-0"
              aria-label="Tutup notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
