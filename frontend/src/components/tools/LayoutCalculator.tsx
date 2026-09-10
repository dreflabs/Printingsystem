"use client";

import { useMemo, useState } from "react";
import { RotateCw, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { computeLayout, layoutSummary, SHEET_PRESETS } from "@/lib/layout-calc";

interface Props {
  initialPieceW?: number | string;
  initialPieceH?: number | string;
  initialQty?: number | string;
  /** Dipanggil dengan ringkasan 1 baris saat user klik "Salin ringkasan". */
  onApply?: (summary: string) => void;
  className?: string;
}

const num = (s: string) => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fieldCls =
  "w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal";
const labelCls = "text-[11px] font-bold text-muted mb-1 block";

export function LayoutCalculator({
  initialPieceW = "",
  initialPieceH = "",
  initialQty = "",
  onApply,
  className,
}: Props) {
  const [pieceW, setPieceW] = useState(String(initialPieceW ?? ""));
  const [pieceH, setPieceH] = useState(String(initialPieceH ?? ""));
  const [sheetIdx, setSheetIdx] = useState(2); // SRA3
  const [customW, setCustomW] = useState("32");
  const [customH, setCustomH] = useState("45");
  const [bleed, setBleed] = useState("0.3");
  const [gutter, setGutter] = useState("0.2");
  const [margin, setMargin] = useState("0.5");
  const [allowRotate, setAllowRotate] = useState(true);
  const [qty, setQty] = useState(String(initialQty ?? ""));
  const [copied, setCopied] = useState(false);
  const [showAdv, setShowAdv] = useState(false);

  const custom = sheetIdx === -1;
  const sheetW = custom ? num(customW) : SHEET_PRESETS[sheetIdx].w;
  const sheetH = custom ? num(customH) : SHEET_PRESETS[sheetIdx].h;
  const sheetLabel = custom ? `Custom (${sheetW} × ${sheetH})` : SHEET_PRESETS[sheetIdx].label;

  const res = useMemo(
    () =>
      computeLayout({
        pieceW: num(pieceW),
        pieceH: num(pieceH),
        sheetW,
        sheetH,
        bleed: num(bleed),
        gutter: num(gutter),
        margin: num(margin),
        allowRotate,
        quantity: num(qty),
      }),
    [pieceW, pieceH, sheetW, sheetH, bleed, gutter, margin, allowRotate, qty]
  );

  const summary = layoutSummary(res, { pieceW: num(pieceW), pieceH: num(pieceH), sheetLabel });

  async function handleCopy() {
    const ok = await copyText(summary);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    onApply?.(summary);
  }

  const strategyLabel: Record<string, string> = {
    grid: "grid normal",
    "grid-rotated": "semua diputar 90°",
    "mixed-right": "campur — strip kanan",
    "mixed-bottom": "campur — strip bawah",
    none: "—",
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Input potong */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Lebar potong (cm)</label>
          <input className={fieldCls} inputMode="decimal" value={pieceW} onChange={(e) => setPieceW(e.target.value)} placeholder="9" />
        </div>
        <div>
          <label className={labelCls}>Tinggi potong (cm)</label>
          <input className={fieldCls} inputMode="decimal" value={pieceH} onChange={(e) => setPieceH(e.target.value)} placeholder="5.5" />
        </div>
        <div>
          <label className={labelCls}>Jumlah pesan (pcs)</label>
          <input className={fieldCls} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="500" />
        </div>
      </div>

      {/* Lembar */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Ukuran lembar</label>
          <select className={fieldCls} value={sheetIdx} onChange={(e) => setSheetIdx(Number(e.target.value))}>
            {SHEET_PRESETS.map((s, i) => (
              <option key={s.label} value={i}>{s.label}</option>
            ))}
            <option value={-1}>Custom…</option>
          </select>
        </div>
        {custom && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Lebar (cm)</label>
              <input className={fieldCls} inputMode="decimal" value={customW} onChange={(e) => setCustomW(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Tinggi (cm)</label>
              <input className={fieldCls} inputMode="decimal" value={customH} onChange={(e) => setCustomH(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold text-muted">
        <input type="checkbox" checked={allowRotate} onChange={(e) => setAllowRotate(e.target.checked)} />
        <RotateCw className="h-3.5 w-3.5" /> Boleh memutar potong 90°
      </label>

      {/* Lanjutan */}
      <button
        type="button"
        onClick={() => setShowAdv((v) => !v)}
        className="text-[11px] font-bold text-accent-teal hover:underline"
      >
        {showAdv ? "− Sembunyikan" : "+ Bleed / gutter / margin"}
      </button>
      {showAdv && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Bleed / sisi (cm)</label>
            <input className={fieldCls} inputMode="decimal" value={bleed} onChange={(e) => setBleed(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Jarak antar (cm)</label>
            <input className={fieldCls} inputMode="decimal" value={gutter} onChange={(e) => setGutter(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Margin lembar (cm)</label>
            <input className={fieldCls} inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
          </div>
        </div>
      )}

      {/* Hasil */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-base p-4 sm:grid-cols-[auto_1fr]">
        <LayoutPreview res={res} sheetW={sheetW} sheetH={sheetH} />
        <div className="space-y-2">
          {res.fits ? (
            <>
              <p className="text-3xl font-black text-primary">
                {res.perSheet}<span className="ml-1 text-sm font-bold text-muted">potong / lembar</span>
              </p>
              <p className="text-xs text-muted">Strategi: {strategyLabel[res.strategy]} · efisiensi {Math.round(res.utilization * 100)}%</p>
              {res.sheetsNeeded != null && (
                <div className="rounded-lg bg-accent-teal/10 px-3 py-2 text-sm font-bold text-accent-teal">
                  Butuh {res.sheetsNeeded} lembar
                  {res.overrunQty ? <span className="font-medium"> · hasil {res.producedQty} pcs (lebih {res.overrunQty})</span> : null}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-status-red">
              Potong {num(pieceW) || "?"}×{num(pieceH) || "?"} cm tidak muat di lembar {sheetW}×{sheetH} cm.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        disabled={!res.fits}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-bold transition-colors disabled:opacity-40",
          copied ? "border-status-green/40 bg-status-green/10 text-status-green" : "border-border text-muted hover:text-primary"
        )}
      >
        {copied ? <><Check className="h-4 w-4" /> Tersalin</> : <><Copy className="h-4 w-4" /> Salin ringkasan</>}
      </button>
    </div>
  );
}

function LayoutPreview({ res, sheetW, sheetH }: { res: ReturnType<typeof computeLayout>; sheetW: number; sheetH: number }) {
  if (!sheetW || !sheetH) return null;
  const maxPx = 200;
  const scale = maxPx / Math.max(sheetW, sheetH);
  const W = sheetW * scale;
  const H = sheetH * scale;
  const showNums = res.rects.length <= 60;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 rounded-md border border-border bg-elevated">
      {res.rects.map((r, i) => {
        const x = r.x * scale;
        const y = r.y * scale;
        const w = r.w * scale;
        const h = r.h * scale;
        const big = w > 14 && h > 12;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={Math.max(0, w - 1)}
              height={Math.max(0, h - 1)}
              rx={1.5}
              fill={r.rotated ? "rgba(217,119,6,0.18)" : "rgba(4,146,178,0.16)"}
              stroke={r.rotated ? "#D97706" : "#0492B2"}
              strokeWidth={0.75}
            />
            {showNums && big && (
              <text
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.min(9, h / 2)}
                fill={r.rotated ? "#B45309" : "#0492B2"}
                fontWeight={700}
              >
                {i + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
