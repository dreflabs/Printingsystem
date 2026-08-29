"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, RefreshCw, AlertTriangle, Clock, Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui";
import { getSessionUser } from "@/actions/session";
import {
  previewAttendanceImport,
  commitAttendanceImport,
  listAttendanceImports,
  getAttendanceReport,
  addAttendanceOwnerNote,
  type AttendanceColumnMapping,
} from "@/actions/attendance";

type Preview = Extract<Awaited<ReturnType<typeof previewAttendanceImport>>, { success: true }>["data"];
type Report = Extract<Awaited<ReturnType<typeof getAttendanceReport>>, { success: true }>["data"];
type Imports = Extract<Awaited<ReturnType<typeof listAttendanceImports>>, { success: true }>["data"];

type MapField = keyof AttendanceColumnMapping;

const FIELD_LABELS: Record<MapField, string> = {
  name: "Nama pegawai *",
  date: "Tanggal *",
  checkIn: "Jam masuk",
  checkOut: "Jam pulang",
  dateTime: "Waktu (scan-log)",
  direction: "Arah (masuk/pulang)",
};

function currentMonthRange() {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (d: string | Date | null) =>
  d ? new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—";

export default function AttendancePage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<string>("");
  const canImport = role === "owner" || role === "admin";
  const isOwner = role === "owner";

  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [format, setFormat] = useState<"daily" | "scanlog">("daily");
  const [mapping, setMapping] = useState<Partial<AttendanceColumnMapping>>({});
  const [importing, setImporting] = useState(false);

  const [range, setRange] = useState(currentMonthRange());
  const [importId, setImportId] = useState<string>("");
  const [imports, setImports] = useState<Imports>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editNote, setEditNote] = useState<{ id: string; value: string } | null>(null);

  useEffect(() => {
    getSessionUser().then((r) => r.ok && setRole(r.user.role));
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [rep, imp] = await Promise.all([
      getAttendanceReport({ from: range.from, to: range.to, importId: importId || undefined }),
      listAttendanceImports(),
    ]);
    if (rep.success) setReport(rep.data);
    else setError(rep.error);
    if (imp.success) setImports(imp.data);
    setLoading(false);
  }, [range.from, range.to, importId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadReport(); }, [loadReport]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ type: "error", title: "File terlalu besar", message: "Maksimal 5MB." }); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = String(ev.target?.result ?? "");
      setCsvText(text);
      const res = await previewAttendanceImport(text);
      if (res.success) {
        setPreview(res.data);
        setFormat(res.data.guessedFormat);
        setMapping(res.data.guessedMapping);
      } else {
        toast({ type: "error", title: "Gagal baca file", message: res.error });
        setPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const setMap = (field: MapField, value: string) =>
    setMapping((m) => ({ ...m, [field]: value === "" ? undefined : Number(value) }));

  const runImport = async () => {
    if (mapping.name == null || mapping.date == null) {
      toast({ type: "error", title: "Lengkapi pemetaan", message: "Kolom Nama dan Tanggal wajib." });
      return;
    }
    setImporting(true);
    const res = await commitAttendanceImport({
      fileName,
      csvText,
      format,
      mapping: mapping as AttendanceColumnMapping,
    });
    setImporting(false);
    if (!res.success) { toast({ type: "error", title: "Impor gagal", message: res.error }); return; }
    const d = res.data;
    toast({
      type: d.unmatched > 0 ? "warning" : "success",
      title: `Impor selesai — ${d.rowCount} baris`,
      message: `${d.lateCount} terlambat · ${d.matched} cocok user${d.unmatched > 0 ? ` · ${d.unmatched} nama tak cocok` : ""}${d.skipped ? ` · ${d.skipped} dilewati` : ""}`,
    });
    setPreview(null);
    setCsvText("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
    loadReport();
  };

  const saveNote = async () => {
    if (!editNote) return;
    const res = await addAttendanceOwnerNote(editNote.id, editNote.value);
    if (res.success) {
      toast({ type: "success", title: "Catatan disimpan" });
      setEditNote(null);
      loadReport();
    } else toast({ type: "error", title: "Gagal", message: res.error });
  };

  const columnOptions = preview?.headers.map((h, i) => ({ label: `${i + 1}. ${h || "(kosong)"}`, value: String(i) })) ?? [];
  const activeFields: MapField[] =
    format === "daily" ? ["name", "date", "checkIn", "checkOut"] : ["name", "date", "dateTime", "direction"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Absensi Pegawai</h1>
        <p className="text-sm text-muted mt-0.5">
          Impor CSV mesin fingerprint &amp; laporan kehadiran. Batas masuk{" "}
          <span className="font-mono font-bold">{report?.lateThreshold ?? "09:15"}</span> WIB.
        </p>
      </div>

      {/* ── IMPORT ─────────────────────────────────────────────── */}
      {canImport && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-card space-y-4">
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-accent-teal" /> Impor CSV Fingerprint
          </h2>

          <label className="flex items-center gap-3 cursor-pointer w-fit">
            <span className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 transition-all">
              <Upload className="h-4 w-4" /> Pilih file CSV
            </span>
            <span className="text-xs text-muted">{fileName || "belum ada file"}</span>
            <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv" onChange={onFile} className="hidden" />
          </label>

          {preview && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="text-muted">{preview.totalRows} baris data</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-medium">Format:</span>
                  {(["daily", "scanlog"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "h-8 px-3 rounded-lg border text-xs font-bold transition-all",
                        format === f ? "bg-accent-teal text-white border-accent-teal" : "bg-elevated border-border text-muted hover:text-primary"
                      )}
                    >
                      {f === "daily" ? "Harian (1 baris/hari)" : "Scan-log (1 baris/scan)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* mapping */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {activeFields.map((field) => (
                  <label key={field} className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted font-medium">{FIELD_LABELS[field]}</span>
                    <select
                      value={mapping[field] != null ? String(mapping[field]) : ""}
                      onChange={(e) => setMap(field, e.target.value)}
                      className="h-9 rounded-lg bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal"
                    >
                      <option value="">— tidak ada —</option>
                      {columnOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              {/* sample */}
              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-elevated/50 border-b border-border text-muted font-semibold">
                    <tr>{preview.headers.map((h, i) => <th key={i} className="px-2 py-2 whitespace-nowrap">{i + 1}. {h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {preview.sampleRows.map((r, ri) => (
                      <tr key={ri}>{r.map((c, ci) => <td key={ci} className="px-2 py-1.5 whitespace-nowrap text-muted">{c}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={runImport}
                disabled={importing || mapping.name == null || mapping.date == null}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-status-green text-white text-sm font-bold hover:brightness-110 disabled:opacity-40 transition-all"
              >
                {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Impor Sekarang
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FILTER ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted font-medium">Dari</span>
          <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="h-9 rounded-lg bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted font-medium">Sampai</span>
          <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="h-9 rounded-lg bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted font-medium">Batch impor</span>
          <select value={importId} onChange={(e) => setImportId(e.target.value)}
            className="h-9 rounded-lg bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal">
            <option value="">Semua</option>
            {imports.map((i) => (
              <option key={i.id} value={i.id}>
                {fmtDate(i.importDate)} · {i.rowCount} baris · {i.lateCount} telat
              </option>
            ))}
          </select>
        </label>
        <button onClick={loadReport} className="h-9 w-9 flex items-center justify-center rounded-lg bg-elevated border border-border text-muted hover:text-primary hover:border-accent-teal transition-all">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      {report && (
        <>
          {/* Ringkasan per pegawai */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent-teal" />
              <h3 className="text-base font-bold text-primary">Ringkasan Kinerja per Pegawai</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Pegawai</th><th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Hadir</th><th className="px-4 py-3">Terlambat</th>
                    <th className="px-4 py-3">Rata Masuk</th><th className="px-4 py-3">Istirahat Berlebih</th>
                    <th className="px-4 py-3">Job</th><th className="px-4 py-3">Output</th><th className="px-4 py-3">Waste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {report.summary.map((s, i) => (
                    <tr key={i} className="hover:bg-elevated/30">
                      <td className="px-4 py-3 font-medium text-primary">{s.name}</td>
                      <td className="px-4 py-3 text-xs text-muted">{s.role ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{s.daysPresent} hari</td>
                      <td className={cn("px-4 py-3 font-bold", s.lateDays > 0 ? "text-status-red" : "text-status-green")}>{s.lateDays}</td>
                      <td className="px-4 py-3 font-mono text-muted">{s.avgCheckIn}</td>
                      <td className={cn("px-4 py-3", s.breakExceeded > 0 ? "text-status-yellow-text font-bold" : "text-muted")}>{s.breakExceeded}</td>
                      <td className="px-4 py-3 text-muted">{s.jobCount}</td>
                      <td className="px-4 py-3 text-muted">{s.totalOutput}</td>
                      <td className="px-4 py-3 text-muted">{s.totalWaste}</td>
                    </tr>
                  ))}
                  {report.summary.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-muted">Belum ada data absensi pada rentang ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail harian */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-accent-teal" />
              <h3 className="text-base font-bold text-primary">Absensi Detail</h3>
              <span className="text-xs text-muted">({report.records.length} baris)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Pegawai</th>
                    <th className="px-4 py-3">Masuk</th><th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pulang</th><th className="px-4 py-3">Istirahat</th>
                    <th className="px-4 py-3">Catatan Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {report.records.map((r) => (
                    <tr key={r.recordId} className="hover:bg-elevated/30">
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-primary">{r.employeeName}</span>
                        {!r.matched && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-status-yellow/10 text-status-yellow-text border border-status-yellow/30 font-bold">
                            tak cocok user
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">{fmtTime(r.checkIn)}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] rounded border font-bold uppercase",
                          r.checkInStatus === "LATE"
                            ? "bg-status-red/10 text-status-red border-status-red/30"
                            : "bg-status-green/10 text-status-green border-status-green/30"
                        )}>
                          {r.checkInStatus === "LATE" ? `Terlambat ${r.lateMinutes}m` : "Tepat Waktu"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">{fmtTime(r.checkOut)}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {r.breakStart ? `${fmtTime(r.breakStart)}–${fmtTime(r.breakEnd)} (${r.breakDurationMin}m)` : "—"}
                        {r.breakStatus === "EXCEEDED" && <span className="ml-1 text-status-yellow-text font-bold">berlebih</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {editNote?.id === r.recordId ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={editNote.value}
                              onChange={(e) => setEditNote({ id: r.recordId, value: e.target.value })}
                              className="h-8 w-40 rounded-md bg-elevated border border-border px-2 text-primary outline-none focus:border-accent-teal"
                            />
                            <button onClick={saveNote} className="p-1.5 rounded-md bg-accent-teal/15 text-accent-teal hover:bg-accent-teal/25"><Check className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setEditNote(null)} className="p-1.5 rounded-md bg-elevated text-muted hover:text-primary"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">{r.ownerNote || "—"}</span>
                            {isOwner && (
                              <button
                                onClick={() => setEditNote({ id: r.recordId, value: r.ownerNote ?? "" })}
                                className="p-1 rounded text-muted hover:text-accent-teal"
                                title="Tambah/ubah catatan"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {report.records.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Tidak ada baris.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted/70 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Data absensi bersifat append-only — Owner hanya bisa menambah catatan, tidak mengubah jam/label.
          </p>
        </>
      )}
    </div>
  );
}
