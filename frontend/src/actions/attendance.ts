"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { requireUser } from "@/lib/actor";
import { logAction } from "@/lib/logger";
import { parseCsv } from "@/lib/csv";
import { sendWhatsApp } from "@/lib/wa";
import { ok, fail } from "@/types";

// Batas jam masuk 09:15 WIB (ABSENSI-FINGERPRINT.md). Lewat ini = TERLAMBAT.
const LATE_H = 9;
const LATE_M = 15;
const LATE_MIN_OF_DAY = LATE_H * 60 + LATE_M;
const BREAK_MAX_MIN = 60;

const isAdmin = (r: string) => r === "admin" || r === "owner";

export type AttendanceColumnMapping = {
  /** kolom nama pegawai (wajib) */
  name: number;
  /** kolom tanggal (wajib) */
  date: number;
  /** format "daily": satu baris per pegawai/hari */
  checkIn?: number;
  checkOut?: number;
  /** format "scanlog": satu baris per scan; digabung per nama+tanggal */
  dateTime?: number;
  direction?: number;
};

// ── header alias untuk tebakan mapping ──────────────────────────────
const ALIASES: Record<keyof AttendanceColumnMapping, string[]> = {
  name: ["nama", "name", "employee", "pegawai", "karyawan", "nama pegawai", "nama karyawan"],
  date: ["tanggal", "date", "tgl", "hari"],
  checkIn: ["jam masuk", "masuk", "check in", "check-in", "checkin", "clock in", "time in", "in", "scan masuk"],
  checkOut: ["jam pulang", "pulang", "jam keluar", "keluar", "check out", "check-out", "checkout", "clock out", "time out", "out", "scan pulang"],
  dateTime: ["waktu", "datetime", "timestamp", "waktu scan", "scan time", "tanggal jam", "date time"],
  direction: ["status", "tipe", "type", "arah", "direction", "io", "in/out", "verifikasi"],
};

function guessMapping(headers: string[]): Partial<AttendanceColumnMapping> {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const find = (keys: string[]) => {
    for (const k of keys) {
      const i = norm.findIndex((h) => h === k);
      if (i >= 0) return i;
    }
    for (const k of keys) {
      const i = norm.findIndex((h) => h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };
  const out: Partial<AttendanceColumnMapping> = {};
  (Object.keys(ALIASES) as (keyof AttendanceColumnMapping)[]).forEach((field) => {
    const i = find(ALIASES[field]);
    if (i >= 0) out[field] = i;
  });
  return out;
}

// ── parsing tanggal / jam yang toleran ─────────────────────────────
function parseDateOnly(s: string): Date | null {
  const v = s.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // YYYY-MM-DD
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/); // DD-MM-YYYY (ID) — asumsi hari dulu
  if (m) {
    let year = +m[3];
    if (year < 100) year += 2000;
    const a = +m[1];
    const b = +m[2];
    // kalau angka pertama > 12 pasti hari; selain itu tetap treat sebagai DD/MM
    return new Date(year, b - 1, a);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseTimeParts(s: string): { h: number; m: number } | null {
  const v = s.trim();
  if (!v) return null;
  // ambil bagian jam dari "HH:mm[:ss]" walau ada tanggal di depannya
  const m = v.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const h = +m[1];
  const mm = +m[2];
  if (h > 23 || mm > 59) return null;
  return { h, m: mm };
}

/** Gabung tanggal (local midnight) + jam → Date. */
function atTime(day: Date, t: { h: number; m: number }): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m, 0);
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");
}

const DIR_IN = ["in", "masuk", "c/in", "checkin", "check-in", "clock in", "i", "0"];
const DIR_OUT = ["out", "pulang", "keluar", "c/out", "checkout", "check-out", "clock out", "o", "1"];

// ── PREVIEW ────────────────────────────────────────────────────────
export async function previewAttendanceImport(csvText: string) {
  try {
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh mengimpor absensi.");
    const { headers, rows } = parseCsv(csvText);
    if (headers.length === 0) return fail("File CSV kosong atau tidak terbaca.");

    const guessed = guessMapping(headers);
    const format: "daily" | "scanlog" =
      guessed.checkIn != null || guessed.checkOut != null ? "daily" : guessed.dateTime != null ? "scanlog" : "daily";

    return ok({
      headers,
      totalRows: rows.length,
      sampleRows: rows.slice(0, 8),
      guessedMapping: guessed,
      guessedFormat: format,
    });
  } catch (e) {
    console.error("previewAttendanceImport:", e);
    return fail(e instanceof Error ? e.message : "Gagal membaca file.");
  }
}

type DailyDraft = {
  name: string;
  day: Date;
  checkIn: Date | null;
  checkOut: Date | null;
};

// ── COMMIT ─────────────────────────────────────────────────────────
export async function commitAttendanceImport(input: {
  fileName: string;
  csvText: string;
  format: "daily" | "scanlog";
  mapping: AttendanceColumnMapping;
}) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh mengimpor absensi.");

    const { mapping: map, format } = input;
    if (map.name == null || map.date == null) return fail("Kolom Nama dan Tanggal wajib dipetakan.");
    if (format === "daily" && map.checkIn == null && map.checkOut == null)
      return fail("Format harian: petakan minimal kolom Jam Masuk atau Jam Pulang.");
    if (format === "scanlog" && map.dateTime == null)
      return fail("Format scan-log: petakan kolom Waktu.");

    const { rows } = parseCsv(input.csvText);
    if (rows.length === 0) return fail("Tidak ada baris data untuk diimpor.");

    const drafts = new Map<string, DailyDraft>();
    let skipped = 0;

    for (const r of rows) {
      const name = (r[map.name] ?? "").trim();
      if (!name) { skipped++; continue; }

      if (format === "daily") {
        const day = parseDateOnly(r[map.date] ?? "");
        if (!day) { skipped++; continue; }
        const key = `${normName(name)}|${day.toISOString().slice(0, 10)}`;
        const d: DailyDraft = drafts.get(key) ?? { name, day, checkIn: null, checkOut: null };
        if (map.checkIn != null) {
          const t = parseTimeParts(r[map.checkIn] ?? "");
          if (t) d.checkIn = atTime(day, t);
        }
        if (map.checkOut != null) {
          const t = parseTimeParts(r[map.checkOut] ?? "");
          if (t) d.checkOut = atTime(day, t);
        }
        drafts.set(key, d);
      } else {
        // scanlog: butuh tanggal + jam dari kolom dateTime (atau date + dateTime terpisah)
        const rawDT = (r[map.dateTime!] ?? "").trim();
        const day = parseDateOnly(rawDT) ?? parseDateOnly(r[map.date] ?? "");
        const t = parseTimeParts(rawDT);
        if (!day || !t) { skipped++; continue; }
        const stamp = atTime(day, t);
        const key = `${normName(name)}|${day.toISOString().slice(0, 10)}`;
        const d: DailyDraft = drafts.get(key) ?? { name, day, checkIn: null, checkOut: null };

        const dir = map.direction != null ? (r[map.direction] ?? "").trim().toLowerCase() : "";
        const isIn = DIR_IN.some((x) => dir === x || dir.includes(x));
        const isOut = DIR_OUT.some((x) => dir === x || dir.includes(x));

        if (isIn) d.checkIn = d.checkIn && d.checkIn < stamp ? d.checkIn : stamp;
        else if (isOut) d.checkOut = d.checkOut && d.checkOut > stamp ? d.checkOut : stamp;
        else {
          // tanpa arah: paling awal = masuk, paling akhir = pulang
          if (!d.checkIn || stamp < d.checkIn) d.checkIn = stamp;
          if (!d.checkOut || stamp > d.checkOut) d.checkOut = stamp;
        }
        drafts.set(key, d);
      }
    }

    const list = [...drafts.values()];
    if (list.length === 0) return fail(`Tidak ada baris valid (${skipped} baris dilewati — cek pemetaan kolom & format tanggal).`);

    // Cocokkan nama → user
    const users = await prisma.user.findMany({
      where: { tenant_id: tenant.id },
      select: { id: true, name: true, username: true },
    });
    const byName = new Map<string, string>();
    users.forEach((u) => {
      byName.set(normName(u.name), u.id);
      if (u.username) byName.set(normName(u.username), u.id);
    });

    let lateCount = 0;
    const lateEntries: { name: string; jam: string }[] = [];
    const unmatched = new Set<string>();
    const days = list.map((d) => d.day.getTime());
    const periodStart = new Date(Math.min(...days));
    const periodEnd = new Date(Math.max(...days));

    const recordData = list.map((d) => {
      const userId = byName.get(normName(d.name)) ?? null;
      if (!userId) unmatched.add(d.name);

      let status = "ON_TIME";
      let lateMin = 0;
      if (d.checkIn) {
        const mod = d.checkIn.getHours() * 60 + d.checkIn.getMinutes();
        if (mod > LATE_MIN_OF_DAY) {
          status = "LATE";
          lateMin = mod - LATE_MIN_OF_DAY;
          lateCount++;
          lateEntries.push({
            name: d.name,
            jam: `${String(d.checkIn.getHours()).padStart(2, "0")}:${String(d.checkIn.getMinutes()).padStart(2, "0")}`,
          });
        }
      } else {
        status = "ON_TIME"; // tak ada jam masuk → jangan tandai terlambat
      }

      return {
        tenant_id: tenant.id,
        user_id: userId,
        employee_name: d.name,
        date: d.day,
        check_in: d.checkIn,
        check_out: d.checkOut,
        check_in_status: status,
        late_minutes: lateMin,
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      const imp = await tx.attendanceImport.create({
        data: {
          tenant_id: tenant.id,
          imported_by: actor.id,
          file_path: `upload/attendance/${Date.now()}-${input.fileName.replace(/[^\w.-]/g, "_")}`,
          period_start: periodStart,
          period_end: periodEnd,
          row_count: recordData.length,
          late_count: lateCount,
        },
      });
      await tx.attendanceRecord.createMany({
        data: recordData.map((r) => ({ ...r, import_id: imp.id })),
      });
      return imp;
    });

    await logAction(actor.id, "ATTENDANCE_IMPORT", "AttendanceImport", result.id, null, {
      rows: recordData.length,
      late: lateCount,
      unmatched: unmatched.size,
      period: `${periodStart.toISOString().slice(0, 10)}..${periodEnd.toISOString().slice(0, 10)}`,
    });
    revalidatePath("/admin/attendance");

    // Notifikasi WA ke Owner: ringkasan import + daftar pegawai terlambat
    // (ABSENSI-FINGERPRINT.md). Fire-and-forget — kegagalan WA tidak membatalkan import.
    void notifyOwnersLateImport(tenant.id, {
      periodStart,
      periodEnd,
      present: recordData.filter((r) => r.check_in).length,
      lateCount,
      lateEntries,
    });

    return ok({
      importId: result.id,
      rowCount: recordData.length,
      lateCount,
      matched: recordData.length - unmatched.size,
      unmatched: unmatched.size,
      unmatchedNames: [...unmatched].slice(0, 20),
      skipped,
    });
  } catch (e) {
    console.error("commitAttendanceImport:", e);
    return fail(e instanceof Error ? e.message : "Gagal mengimpor absensi.");
  }
}

async function notifyOwnersLateImport(
  tenantId: string,
  info: { periodStart: Date; periodEnd: Date; present: number; lateCount: number; lateEntries: { name: string; jam: string }[] }
) {
  try {
    const owners = await prisma.user.findMany({
      where: { tenant_id: tenantId, active: true, role: { name: "owner" }, phone: { not: null } },
      select: { phone: true },
    });
    if (owners.length === 0) return;

    const sameDay = info.periodStart.toDateString() === info.periodEnd.toDateString();
    const periode = sameDay
      ? info.periodStart.toLocaleDateString("id-ID")
      : `${info.periodStart.toLocaleDateString("id-ID")} – ${info.periodEnd.toLocaleDateString("id-ID")}`;

    const lines = [
      `Data absensi ${periode} berhasil diimpor. ${info.present} pegawai hadir, ${info.lateCount} terlambat.`,
    ];
    if (info.lateEntries.length > 0) {
      lines.push("", "Terlambat masuk:");
      for (const e of info.lateEntries.slice(0, 30)) lines.push(`• ${e.name} — jam masuk ${e.jam}`);
    }
    const body = lines.join("\n");
    for (const o of owners) {
      if (o.phone) await sendWhatsApp({ to: o.phone, body });
    }
  } catch (e) {
    console.error("notifyOwnersLateImport:", e);
  }
}

// ── LIST IMPORTS ───────────────────────────────────────────────────
export async function listAttendanceImports() {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh melihat riwayat impor.");

    const imports = await prisma.attendanceImport.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { import_date: "desc" },
      take: 30,
      include: { importer: { select: { name: true } } },
    });
    return ok(
      imports.map((i) => ({
        id: i.id,
        importedBy: i.importer.name,
        importDate: i.import_date,
        periodStart: i.period_start,
        periodEnd: i.period_end,
        rowCount: i.row_count,
        lateCount: i.late_count,
      }))
    );
  } catch (e) {
    console.error("listAttendanceImports:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat riwayat impor.");
  }
}

// ── LAPORAN ────────────────────────────────────────────────────────
export async function getAttendanceReport(params?: { from?: string; to?: string; importId?: string }) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (!isAdmin(actor.role)) return fail("Hanya Owner/Admin yang boleh melihat laporan absensi.");

    const where: Record<string, unknown> = { tenant_id: tenant.id };
    if (params?.importId) where.import_id = params.importId;
    if (params?.from || params?.to) {
      const range: Record<string, Date> = {};
      if (params.from) range.gte = new Date(params.from);
      if (params.to) {
        const t = new Date(params.to);
        t.setHours(23, 59, 59, 999);
        range.lte = t;
      }
      where.date = range;
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ date: "desc" }, { employee_name: "asc" }],
      include: { user: { select: { id: true, name: true, role: { select: { name: true } } } } },
    });

    // Statistik job per operator (untuk kolom kinerja di laporan pegawai)
    const userIds = [...new Set(records.map((r) => r.user_id).filter((x): x is string => !!x))];
    const jobStats =
      userIds.length > 0
        ? await prisma.productionJob.groupBy({
            by: ["operator_id"],
            where: { tenant_id: tenant.id, operator_id: { in: userIds } },
            _count: { _all: true },
            _sum: { actual_qty: true, waste_qty: true },
          })
        : [];
    const jobByUser = new Map(jobStats.map((j) => [j.operator_id, j]));

    // Ringkasan per pegawai
    const sum = new Map<
      string,
      { name: string; role: string | null; userId: string | null; days: number; late: number; checkInMods: number[]; breakExceeded: number }
    >();
    for (const r of records) {
      const key = r.user_id ?? `name:${normName(r.employee_name)}`;
      const s =
        sum.get(key) ??
        { name: r.user?.name ?? r.employee_name, role: r.user?.role?.name ?? null, userId: r.user_id, days: 0, late: 0, checkInMods: [], breakExceeded: 0 };
      s.days++;
      if (r.check_in_status === "LATE") s.late++;
      if (r.check_in) s.checkInMods.push(r.check_in.getHours() * 60 + r.check_in.getMinutes());
      if (r.break_status === "EXCEEDED") s.breakExceeded++;
      sum.set(key, s);
    }

    const fmtMod = (mod: number) => {
      const total = Math.round(mod);
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    };

    const summary = [...sum.values()]
      .map((s) => {
        const js = s.userId ? jobByUser.get(s.userId) : undefined;
        return {
          name: s.name,
          role: s.role,
          daysPresent: s.days,
          lateDays: s.late,
          avgCheckIn: s.checkInMods.length ? fmtMod(s.checkInMods.reduce((a, b) => a + b, 0) / s.checkInMods.length) : "—",
          breakExceeded: s.breakExceeded,
          jobCount: js?._count._all ?? 0,
          totalOutput: js?._sum.actual_qty ?? 0,
          totalWaste: js?._sum.waste_qty ?? 0,
        };
      })
      .sort((a, b) => b.lateDays - a.lateDays || a.name.localeCompare(b.name));

    return ok({
      lateThreshold: `${String(LATE_H).padStart(2, "0")}:${String(LATE_M).padStart(2, "0")}`,
      breakMaxMin: BREAK_MAX_MIN,
      records: records.map((r) => ({
        recordId: r.id,
        userId: r.user_id,
        employeeName: r.user?.name ?? r.employee_name,
        matched: !!r.user_id,
        role: r.user?.role?.name ?? null,
        date: r.date,
        checkIn: r.check_in,
        checkOut: r.check_out,
        checkInStatus: r.check_in_status,
        lateMinutes: r.late_minutes,
        breakStart: r.break_start,
        breakEnd: r.break_end,
        breakDurationMin: r.break_duration_min,
        breakStatus: r.break_status,
        ownerNote: r.owner_note,
      })),
      summary,
    });
  } catch (e) {
    console.error("getAttendanceReport:", e);
    return fail(e instanceof Error ? e.message : "Gagal memuat laporan absensi.");
  }
}

// ── CATATAN OWNER (append-only, tidak mengubah data absensi) ───────
export async function addAttendanceOwnerNote(recordId: string, note: string) {
  try {
    const tenant = await requireTenant();
    const actor = await requireUser();
    if (actor.role !== "owner") return fail("Hanya Owner yang boleh menambah catatan absensi.");

    const rec = await prisma.attendanceRecord.findFirst({ where: { id: recordId, tenant_id: tenant.id } });
    if (!rec) return fail("Data absensi tidak ditemukan.");

    const updated = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { owner_note: note.trim() || null },
    });
    await logAction(actor.id, "ATTENDANCE_OWNER_NOTE", "AttendanceRecord", recordId, { owner_note: rec.owner_note }, { owner_note: updated.owner_note });
    revalidatePath("/admin/attendance");
    return ok({ ownerNote: updated.owner_note });
  } catch (e) {
    console.error("addAttendanceOwnerNote:", e);
    return fail(e instanceof Error ? e.message : "Gagal menyimpan catatan.");
  }
}
