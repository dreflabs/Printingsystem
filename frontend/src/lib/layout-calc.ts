/**
 * Kalkulator layout / nesting (Fase 1 "Smart Layout").
 *
 * Menghitung berapa potong (piece) muat dalam satu lembar bahan, memakai empat
 * strategi dan memilih yang paling banyak:
 *   1. grid normal      — semua potong orientasi asli
 *   2. grid diputar      — semua potong diputar 90°
 *   3. mixed kanan       — blok grid normal + strip sisa di kanan (potong diputar)
 *   4. mixed bawah       — blok grid normal + strip sisa di bawah (potong diputar)
 *
 * Murni (tanpa DB / IO). Semua ukuran dalam satuan yang sama (cm di UI).
 * Rotasi = tukar sisi W/H, bukan sudut sembarang.
 */

export interface LayoutParams {
  pieceW: number;
  pieceH: number;
  sheetW: number;
  sheetH: number;
  /** kelebihan cetak per sisi potong (ikut menambah footprint) */
  bleed?: number;
  /** jarak antar potong */
  gutter?: number;
  /** tepi lembar yang tak bisa dicetak (per sisi) */
  margin?: number;
  /** boleh memutar potong 90°. default true */
  allowRotate?: boolean;
  /** jumlah pesanan — untuk menghitung lembar yang dibutuhkan */
  quantity?: number;
}

export interface PlacedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface LayoutResult {
  fits: boolean;
  perSheet: number;
  strategy: "grid" | "grid-rotated" | "mixed-right" | "mixed-bottom" | "none";
  /** kotak footprint (sudah termasuk bleed) di ruang lembar, untuk visual */
  rects: PlacedRect[];
  usableW: number;
  usableH: number;
  /** 0..1 — luas potong (tanpa bleed) dibanding area cetak lembar */
  utilization: number;
  sheetsNeeded: number | null;
  producedQty: number | null;
  overrunQty: number | null;
}

const EPS = 1e-6;

/** Berapa item sepanjang `avail` bila tiap item `len` dan antar item ada `gutter`. */
function fitCount(avail: number, len: number, gutter: number): number {
  if (len <= EPS || avail <= EPS) return 0;
  return Math.max(0, Math.floor((avail + gutter + EPS) / (len + gutter)));
}

interface Grid {
  cols: number;
  rows: number;
  n: number;
  spanW: number;
  spanH: number;
}

function grid(availW: number, availH: number, w: number, h: number, gutter: number): Grid {
  const cols = fitCount(availW, w, gutter);
  const rows = fitCount(availH, h, gutter);
  return {
    cols,
    rows,
    n: cols * rows,
    spanW: cols > 0 ? cols * w + (cols - 1) * gutter : 0,
    spanH: rows > 0 ? rows * h + (rows - 1) * gutter : 0,
  };
}

function gridRects(g: Grid, w: number, h: number, gutter: number, ox: number, oy: number, rotated: boolean): PlacedRect[] {
  const out: PlacedRect[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      out.push({ x: ox + c * (w + gutter), y: oy + r * (h + gutter), w, h, rotated });
    }
  }
  return out;
}

/** Strip: coba orientasi normal & diputar, ambil yang lebih banyak. */
function bestStrip(
  availW: number,
  availH: number,
  fw: number,
  fh: number,
  gutter: number,
  ox: number,
  oy: number
): { n: number; rects: PlacedRect[] } {
  const normal = grid(availW, availH, fw, fh, gutter);
  const rot = grid(availW, availH, fh, fw, gutter);
  if (rot.n > normal.n) {
    return { n: rot.n, rects: gridRects(rot, fh, fw, gutter, ox, oy, true) };
  }
  return { n: normal.n, rects: gridRects(normal, fw, fh, gutter, ox, oy, false) };
}

export function computeLayout(p: LayoutParams): LayoutResult {
  const bleed = Math.max(0, p.bleed ?? 0);
  const gutter = Math.max(0, p.gutter ?? 0);
  const margin = Math.max(0, p.margin ?? 0);
  const allowRotate = p.allowRotate ?? true;

  const usableW = Math.max(0, p.sheetW - 2 * margin);
  const usableH = Math.max(0, p.sheetH - 2 * margin);

  const fw = p.pieceW + 2 * bleed;
  const fh = p.pieceH + 2 * bleed;

  const empty: LayoutResult = {
    fits: false,
    perSheet: 0,
    strategy: "none",
    rects: [],
    usableW,
    usableH,
    utilization: 0,
    sheetsNeeded: null,
    producedQty: null,
    overrunQty: null,
  };

  if (p.pieceW <= EPS || p.pieceH <= EPS || usableW <= EPS || usableH <= EPS) return empty;

  type Cand = { n: number; strategy: LayoutResult["strategy"]; rects: PlacedRect[] };
  const cands: Cand[] = [];

  // 1. grid normal
  const g1 = grid(usableW, usableH, fw, fh, gutter);
  if (g1.n > 0) cands.push({ n: g1.n, strategy: "grid", rects: gridRects(g1, fw, fh, gutter, margin, margin, false) });

  // 2. grid diputar
  if (allowRotate) {
    const g2 = grid(usableW, usableH, fh, fw, gutter);
    if (g2.n > 0) cands.push({ n: g2.n, strategy: "grid-rotated", rects: gridRects(g2, fh, fw, gutter, margin, margin, true) });
  }

  // 3. mixed kanan: blok normal + strip di kanan
  if (allowRotate && g1.n > 0) {
    const remW = usableW - g1.spanW - gutter;
    if (remW > EPS) {
      const strip = bestStrip(remW, usableH, fw, fh, gutter, margin + g1.spanW + gutter, margin);
      if (strip.n > 0) {
        cands.push({
          n: g1.n + strip.n,
          strategy: "mixed-right",
          rects: [...gridRects(g1, fw, fh, gutter, margin, margin, false), ...strip.rects],
        });
      }
    }
  }

  // 4. mixed bawah: blok normal + strip di bawah
  if (allowRotate && g1.n > 0) {
    const remH = usableH - g1.spanH - gutter;
    if (remH > EPS) {
      const strip = bestStrip(usableW, remH, fw, fh, gutter, margin, margin + g1.spanH + gutter);
      if (strip.n > 0) {
        cands.push({
          n: g1.n + strip.n,
          strategy: "mixed-bottom",
          rects: [...gridRects(g1, fw, fh, gutter, margin, margin, false), ...strip.rects],
        });
      }
    }
  }

  if (cands.length === 0) return empty;

  const best = cands.reduce((a, b) => (b.n > a.n ? b : a));
  const pieceArea = p.pieceW * p.pieceH;
  const utilization = Math.min(1, (best.n * pieceArea) / (usableW * usableH));

  const qty = p.quantity && p.quantity > 0 ? Math.floor(p.quantity) : null;
  const sheetsNeeded = qty != null && best.n > 0 ? Math.ceil(qty / best.n) : null;
  const producedQty = sheetsNeeded != null ? sheetsNeeded * best.n : null;
  const overrunQty = producedQty != null && qty != null ? producedQty - qty : null;

  return {
    fits: true,
    perSheet: best.n,
    strategy: best.strategy,
    rects: best.rects,
    usableW,
    usableH,
    utilization,
    sheetsNeeded,
    producedQty,
    overrunQty,
  };
}

/** Preset ukuran lembar umum (cm). */
export const SHEET_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "A4 (21 × 29,7)", w: 21, h: 29.7 },
  { label: "A3 (29,7 × 42)", w: 29.7, h: 42 },
  { label: "SRA3 (32 × 45)", w: 32, h: 45 },
  { label: 'A3+ / 13×19" (33 × 48,3)', w: 33, h: 48.3 },
  { label: "A3+ BIMA (31 × 47)", w: 31, h: 47 },
  { label: "A2 (42 × 59,4)", w: 42, h: 59.4 },
  { label: "Plano / 65 × 100", w: 65, h: 100 },
  { label: "Plano / 79 × 109", w: 79, h: 109 },
];

/** Ringkasan satu baris untuk ditempel ke catatan order. */
export function layoutSummary(
  r: LayoutResult,
  ctx: { pieceW: number; pieceH: number; sheetLabel: string }
): string {
  if (!r.fits) return `Layout: potong ${ctx.pieceW}×${ctx.pieceH} cm tidak muat di ${ctx.sheetLabel}.`;
  const eff = Math.round(r.utilization * 100);
  const base = `Layout: ${r.perSheet}-up di ${ctx.sheetLabel} (efisiensi ${eff}%)`;
  if (r.sheetsNeeded == null) return base + ".";
  return `${base} — butuh ${r.sheetsNeeded} lembar${r.overrunQty ? `, lebih ${r.overrunQty} pcs` : ""}.`;
}
