"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { getTrialBannerStatus } from "@/actions/billing";

/** localStorage: sembunyikan banner non-urgent untuk trial_ends_at hari ini saja. */
const dismissKey = (daysLeft: number) => `pp_trial_dismiss_${daysLeft}`;

export function TrialBanner() {
  const [status, setStatus] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const r = await getTrialBannerStatus();
    if (r.success) {
      setStatus(r.data.status);
      setPlanName(r.data.planName);
      setDaysLeft(r.data.trialDaysLeft);
      if (r.data.trialDaysLeft != null) {
        try { setDismissed(localStorage.getItem(dismissKey(r.data.trialDaysLeft)) === "1"); } catch { /* ignore */ }
      }
    }
    setReady(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (!ready || status !== "TRIAL" || daysLeft == null) return null;

  const expired = daysLeft <= 0;
  const urgent = expired || daysLeft <= 3;

  // Banner mendesak (≤3 hari / sudah habis) tidak bisa ditutup — trial yang
  // hangus diam-diam bisa menghentikan workspace tanpa Owner sadar.
  if (dismissed && !urgent) return null;

  return (
    <div
      className={
        "rounded-2xl border px-4 py-3 flex items-start gap-3 " +
        (urgent
          ? "border-status-red/30 bg-status-red/10 text-status-red"
          : "border-status-yellow/30 bg-status-yellow/10 text-status-yellow-text")
      }
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">
          {expired
            ? "Masa uji coba sudah berakhir"
            : `Masa uji coba paket ${planName} berakhir ${daysLeft} hari lagi`}
        </p>
        <p className="text-xs mt-0.5 opacity-90">
          {expired
            ? "Berlangganan sekarang supaya workspace tidak dinonaktifkan."
            : "Berlangganan sekarang supaya workspace tidak terhenti saat trial habis."}
        </p>
      </div>
      <Link
        href="/owner/billing"
        className={
          "shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap " +
          (urgent ? "bg-status-red text-white hover:brightness-110" : "bg-status-yellow text-white hover:brightness-110")
        }
      >
        Upgrade Sekarang
      </Link>
      {!urgent && (
        <button
          aria-label="Tutup pengingat"
          onClick={() => {
            try { localStorage.setItem(dismissKey(daysLeft), "1"); } catch { /* ignore */ }
            setDismissed(true);
          }}
          className="shrink-0 p-1 rounded-lg hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
