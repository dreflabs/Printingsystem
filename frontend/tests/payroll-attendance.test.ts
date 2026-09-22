import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAttendance } from "../src/lib/payroll-attendance";

/**
 * Regresi dua bug payroll yang ditemukan pada audit absensi:
 *  1. Pengelompokan hari memakai kolom `date` + potongan UTC → di zona
 *     WITA/WIT absen pagi jatuh ke tanggal sebelumnya (satu hari gaji hilang).
 *  2. Absen di hari libur ikut menambah kehadiran → menutupi satu hari bolos.
 *
 * `attendance_day` selalu tengah malam UTC dari tanggal tenant, jadi
 * pengelompokan yang benar tidak boleh bergantung pada jam check-in.
 */

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string) => new Date(iso);

test("absen pagi WITA tetap dihitung pada hari tenant-nya", () => {
  // 1 Sep 07:30 WITA = 31 Agu 23:30 UTC — potongan UTC akan salah satu hari.
  const summary = summarizeAttendance([
    { attendance_day: day("2026-09-01"), check_in: at("2026-08-31T23:30:00Z"), late_minutes: 0, off_day: false },
  ]);
  assert.equal(summary.presentDays, 1, "satu hari kehadiran, bukan nol (jatuh ke Agustus)");
});

test("beberapa absen di hari yang sama dihitung satu hari", () => {
  const summary = summarizeAttendance([
    { attendance_day: day("2026-09-02"), check_in: at("2026-09-02T00:05:00Z"), late_minutes: 0, off_day: false },
    { attendance_day: day("2026-09-02"), check_in: at("2026-09-02T09:00:00Z"), late_minutes: 0, off_day: false },
  ]);
  assert.equal(summary.presentDays, 1);
});

test("absen di hari libur tidak menambah kehadiran", () => {
  const workdays = ["2026-09-01", "2026-09-02", "2026-09-03"].map(day);
  const summary = summarizeAttendance([
    { attendance_day: workdays[0], check_in: at("2026-09-01T02:00:00Z"), late_minutes: 0, off_day: false },
    { attendance_day: workdays[1], check_in: at("2026-09-02T02:00:00Z"), late_minutes: 0, off_day: false },
    // bolos 3 Sep, tetapi masuk di hari Minggu 6 Sep
    { attendance_day: day("2026-09-06"), check_in: at("2026-09-06T03:00:00Z"), late_minutes: 0, off_day: true },
  ]);
  assert.equal(summary.presentDays, 2, "hari libur tidak menutupi hari bolos");
});

test("keterlambatan di hari libur tidak ikut dipotong", () => {
  const summary = summarizeAttendance([
    { attendance_day: day("2026-09-06"), check_in: at("2026-09-06T04:00:00Z"), late_minutes: 90, off_day: true },
    { attendance_day: day("2026-09-07"), check_in: at("2026-09-07T02:20:00Z"), late_minutes: 5, off_day: false },
  ]);
  assert.equal(summary.lateMinutes, 5, "hanya keterlambatan hari kerja");
});

test("record tanpa check_in tidak dihitung hadir", () => {
  const summary = summarizeAttendance([
    { attendance_day: day("2026-09-08"), check_in: null, late_minutes: 0, off_day: false },
  ]);
  assert.equal(summary.presentDays, 0);
});
