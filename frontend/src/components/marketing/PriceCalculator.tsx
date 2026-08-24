"use client";

import { useMemo, useState } from "react";
import { Calculator, Zap } from "lucide-react";

const SIZES = [
  { label: "Kartu Nama (9x5cm)", base: 400 },
  { label: "Flyer A5", base: 1200 },
  { label: "Poster A3", base: 7500 },
  { label: "Banner Flexi (per m²)", base: 22000 },
];

const MATERIALS = [
  { label: "Standar", mult: 1 },
  { label: "Premium Glossy", mult: 1.4 },
  { label: "Laminasi Doff", mult: 1.65 },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export function PriceCalculator() {
  const [sizeIdx, setSizeIdx] = useState(0);
  const [materialIdx, setMaterialIdx] = useState(0);
  const [qty, setQty] = useState(100);

  const total = useMemo(() => {
    const size = SIZES[sizeIdx];
    const material = MATERIALS[materialIdx];
    return Math.round(size.base * material.mult * Math.max(1, qty));
  }, [sizeIdx, materialIdx, qty]);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-lg bg-accent-teal/10 flex items-center justify-center">
          <Calculator className="h-4 w-4 text-accent-teal" />
        </div>
        <p className="text-sm font-bold text-primary">Coba Hitung Estimasi Harga</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted mb-1.5 block">Jenis Cetakan</label>
          <select
            value={sizeIdx}
            onChange={(e) => setSizeIdx(Number(e.target.value))}
            className="w-full h-11 rounded-xl bg-elevated border border-border text-primary text-sm px-3 outline-none focus:border-accent-teal transition-colors"
          >
            {SIZES.map((s, i) => (
              <option key={s.label} value={i}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted mb-1.5 block">Bahan / Finishing</label>
          <select
            value={materialIdx}
            onChange={(e) => setMaterialIdx(Number(e.target.value))}
            className="w-full h-11 rounded-xl bg-elevated border border-border text-primary text-sm px-3 outline-none focus:border-accent-teal transition-colors"
          >
            {MATERIALS.map((m, i) => (
              <option key={m.label} value={i}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted mb-1.5 block">Jumlah</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full h-11 rounded-xl bg-elevated border border-border text-primary text-sm px-3 outline-none focus:border-accent-teal transition-colors font-mono"
          />
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-border flex items-end justify-between">
        <div>
          <p className="text-xs text-muted font-medium mb-1">Estimasi Total</p>
          <p className="text-2xl font-extrabold font-mono text-primary">{fmt(total)}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-teal">
          <Zap className="h-3.5 w-3.5" /> Live
        </span>
      </div>

      <p className="mt-4 text-[11px] text-muted leading-relaxed">
        Ini simulasi ringan. Harga final dihitung otomatis oleh sistem POS Print Pilot saat order dibuat — sesuai ukuran, bahan, dan finishing sebenarnya.
      </p>
    </div>
  );
}
