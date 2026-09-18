"use client";

import { AlertCircle, RotateCw } from "lucide-react";

/**
 * Banner error seragam untuk halaman dashboard. Pesan `message` sudah harus
 * ramah-user (server action memakai `safeError`); jangan pernah menaruh
 * `e.message` mentah di sini.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-status-red/40 px-2.5 py-1 text-xs font-bold hover:bg-status-red/15"
        >
          <RotateCw className="h-3.5 w-3.5" /> Coba lagi
        </button>
      )}
    </div>
  );
}
