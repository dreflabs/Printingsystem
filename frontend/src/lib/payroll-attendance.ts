/**
 * Ringkasan kehadiran untuk payroll — dipisah agar bisa diuji tanpa DB.
 *
 * Dua kesalahan yang pernah terjadi dan dijaga di sini:
 *  1. Hari kehadiran dihitung dari kolom `date` (timestamp) lalu dipotong
 *     dengan UTC (`toISOString`) — untuk tenant di zona WITA/WIT absen pagi
 *     jatuh ke tanggal sebelumnya. Sekarang memakai kolom kanonik
 *     `attendance_day` (selalu tengah malam UTC dari hari tenant).
 *  2. Absen di hari libur ikut dihitung sebagai kehadiran sehingga bisa
 *     menutupi satu ketidakhadiran di hari kerja. Sekarang record `off_day`
 *     tidak dihitung sebagai kehadiran maupun keterlambatan.
 */
export interface AttendanceLike {
  attendance_day: Date;
  check_in: Date | null;
  late_minutes: number | null;
  off_day: boolean;
}

export interface AttendanceSummary {
  /** jumlah hari kerja unik yang benar-benar dihadiri */
  presentDays: number;
  /** total menit terlambat (hanya hari kerja) */
  lateMinutes: number;
}

export function summarizeAttendance(records: AttendanceLike[]): AttendanceSummary {
  const presentDates = new Set(
    records
      .filter((r) => r.check_in && !r.off_day)
      .map((r) => r.attendance_day.toISOString().slice(0, 10)),
  );
  const lateMinutes = records
    .filter((r) => !r.off_day)
    .reduce((sum, r) => sum + (r.late_minutes ?? 0), 0);
  return { presentDays: presentDates.size, lateMinutes };
}
