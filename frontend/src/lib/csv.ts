// Minimal CSV helpers for client-side report export.

type Cell = string | number | null | undefined;

function cell(v: Cell): string {
  const s = v == null ? "" : String(v);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows -> CSV text (CRLF line endings, RFC 4180 quoting). */
export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** Trigger a browser download of `csv` as `filename`. Prepends a BOM so Excel reads UTF-8. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** `prefix-YYYY-MM-DD.csv` using the local date. */
export function stampedName(prefix: string): string {
  const d = new Date();
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${local}.csv`;
}

/**
 * Parse CSV/TSV text into headers + rows. Auto-detects `,` `;` or tab delimiter
 * from the first line. Handles RFC-4180 quoting (`"..."`, `""` escape), CRLF/LF,
 * and skips fully-blank lines. Leading BOM is stripped.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.slice(0, clean.search(/\r?\n/) === -1 ? undefined : clean.search(/\r?\n/));
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  const delim = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",") as string;

  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delim) { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); records.push(row); field = ""; row = []; continue; }
    field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); records.push(row); }

  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((r) => {
    const out = r.map((v) => v.trim());
    while (out.length < headers.length) out.push("");
    return out;
  });
  return { headers, rows };
}
