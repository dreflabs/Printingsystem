"use client";

import { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { getImpersonationState, stopImpersonation } from "@/actions/platform";

export function ImpersonationBanner() {
  const [slug, setSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getImpersonationState().then((r) => {
      if (r.success && r.data.impersonating) setSlug(r.data.slug);
    });
  }, []);

  if (!slug) return null;

  return (
    <div className="bg-status-red text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-3">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span>Mode Super Admin — sedang mengakses tenant <span className="font-mono">{slug}</span></span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await stopImpersonation();
          window.location.href = "/platform";
        }}
        className="ml-2 rounded-md bg-card/20 hover:bg-card/30 px-2 py-0.5 disabled:opacity-50"
      >
        Keluar dari tenant
      </button>
    </div>
  );
}
