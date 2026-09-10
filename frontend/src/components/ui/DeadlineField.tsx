"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Field deadline yang cocok dengan cara kerja percetakan: pikir per HARI +
 * "pagi / siang / sore", bukan spinner menit.
 *
 * - Preset cepat (Hari ini … +1 minggu) → set tanggal 1 klik.
 * - Tanggal: <input type="date"> (min = hari ini).
 * - Waktu: bucket bermakna (Pagi 10:00 / Siang 13:00 / Sore 16:00 /
 *   Sebelum tutup / Jam tertentu…).
 * - `value` & `onChange` memakai format `YYYY-MM-DDTHH:mm` (sama seperti
 *   <input type="datetime-local"> — drop-in untuk kode lama).
 */

export interface DeadlineFieldProps {
  label?: string;
  /** `YYYY-MM-DDTHH:mm` atau "" */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  /** true → item-level: boleh dikosongkan (ikut deadline order) */
  optional?: boolean;
  /** jam tutup toko "HH:mm" untuk bucket "Sebelum tutup" (default 18:00) */
  workEndTime?: string;
  className?: string;
}

const PAD = (n: number) => String(n).padStart(2, "0");

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

/** Deadline default: besok, jam tutup toko. */
export function defaultDeadline(workEndTime = "18:00"): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${toLocalDate(d)}T${workEndTime}`;
}

function splitValue(v: string): { date: string; time: string } {
  if (!v || v.length < 10) return { date: "", time: "" };
  return { date: v.slice(0, 10), time: v.length >= 16 ? v.slice(11, 16) : "" };
}

const PRESETS: { label: string; addDays: number }[] = [
  { label: "Hari ini", addDays: 0 },
  { label: "Besok", addDays: 1 },
  { label: "+2 hari", addDays: 2 },
  { label: "+3 hari", addDays: 3 },
  { label: "+1 minggu", addDays: 7 },
];

const FIXED_BUCKETS: { key: string; label: string; time: string }[] = [
  { key: "pagi", label: "Pagi (10:00)", time: "10:00" },
  { key: "siang", label: "Siang (13:00)", time: "13:00" },
  { key: "sore", label: "Sore (16:00)", time: "16:00" },
];

export function DeadlineField({
  label,
  value,
  onChange,
  error,
  hint,
  optional,
  workEndTime = "18:00",
  className,
}: DeadlineFieldProps) {
  const { date, time } = splitValue(value);
  const today = toLocalDate(new Date());
  const [forceCustom, setForceCustom] = React.useState(false);

  const buckets = React.useMemo(
    () => [...FIXED_BUCKETS, { key: "tutup", label: `Sebelum tutup (${workEndTime})`, time: workEndTime }],
    [workEndTime]
  );

  const bucketForTime = buckets.find((b) => b.time === time)?.key ?? null;
  const isCustom = forceCustom || (!!time && !bucketForTime);
  const selectValue = isCustom ? "custom" : bucketForTime ?? "tutup";
  const matchedBucket = selectValue;
  const effectiveTime = time || workEndTime;

  const emit = (nextDate: string, nextTime: string) => {
    if (!nextDate) return onChange("");
    onChange(`${nextDate}T${nextTime || workEndTime}`);
  };

  const applyPreset = (addDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + addDays);
    emit(toLocalDate(d), effectiveTime);
  };

  const activePreset = PRESETS.find((p) => {
    const d = new Date();
    d.setDate(d.getDate() + p.addDays);
    return toLocalDate(d) === date;
  });

  const preview = (() => {
    if (!date) return null;
    const d = new Date(`${date}T${effectiveTime}`);
    if (Number.isNaN(d.getTime())) return null;
    const tgl = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
    const bucketLabel =
      matchedBucket === "custom"
        ? `jam ${effectiveTime}`
        : matchedBucket === "tutup"
          ? "sebelum tutup"
          : matchedBucket; // pagi / siang / sore
    return `≈ ${tgl} · ${bucketLabel}`;
  })();

  const ctl =
    "h-12 rounded-xl bg-elevated border border-border text-primary text-sm px-4 transition-all outline-none " +
    "focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20 " +
    (error ? "border-status-red focus:border-status-red focus:ring-status-red/20" : "");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <label className="text-sm font-medium text-muted">{label}</label>}

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.addDays)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
              activePreset?.label === p.label
                ? "border-accent-teal bg-accent-teal/15 text-accent-teal"
                : "border-border bg-elevated text-muted hover:text-primary hover:border-accent-teal/40"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => emit(e.target.value, effectiveTime)}
          className={cn(ctl, "w-full")}
        />
        <select
          value={selectValue}
          onChange={(e) => {
            const key = e.target.value;
            if (key === "custom") {
              setForceCustom(true);
              emit(date || today, time || "17:00");
            } else {
              setForceCustom(false);
              const b = buckets.find((x) => x.key === key);
              emit(date || today, b?.time ?? workEndTime);
            }
          }}
          className={cn(ctl, "w-full appearance-none cursor-pointer")}
        >
          {buckets.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
          <option value="custom">Jam tertentu…</option>
        </select>
      </div>

      {matchedBucket === "custom" && (
        <input
          type="time"
          value={time}
          onChange={(e) => emit(date || today, e.target.value)}
          className={cn(ctl, "w-full sm:w-40")}
        />
      )}

      {preview && <p className="text-xs font-medium text-accent-teal">{preview}</p>}
      {optional && !error && (
        <p className="text-xs text-muted">Kosongkan (hapus tanggal) untuk ikut deadline order.</p>
      )}
      {error && <p className="text-xs text-status-red">{error}</p>}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
