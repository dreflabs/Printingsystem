/**
 * Helper murni untuk absensi in-app (02-WORKFLOW/18-ABSENSI-IN-APP.md).
 * Tidak menyentuh DB / request — aman diimpor dari mana pun.
 */

export type GeoMode = "OFF" | "FLAG" | "ENFORCE";

export interface AttendanceSettingLike {
  work_start: string; // "HH:mm"
  late_after: string;
  work_end: string;
  workdays: string; // "1,2,3,4,5,6" (1=Sen … 7=Min)
  earliest_clock_in_min: number;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_m: number;
  geofence_mode: GeoMode | string;
  ip_allowlist: string;
  ip_mode: GeoMode | string;
  selfie_required: boolean;
}

/** "HH:mm" → menit sejak 00:00. Kembalikan null kalau format salah. */
export function hhmmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** menit sejak 00:00 waktu lokal server untuk sebuah Date. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** 1=Senin … 7=Minggu (JS getDay: 0=Minggu). */
export function isoWeekday(d: Date): number {
  const g = d.getDay();
  return g === 0 ? 7 : g;
}

export function isWorkday(d: Date, workdays: string): boolean {
  const set = workdays
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => x >= 1 && x <= 7);
  if (set.length === 0) return true;
  return set.includes(isoWeekday(d));
}

/**
 * Status jam masuk terhadap batas telat.
 * `now` dan `lateAfter` dibandingkan pada menit-of-day yang sama (hari yang sama).
 */
export function lateInfo(now: Date, lateAfter: string): { status: "ON_TIME" | "LATE"; lateMinutes: number } {
  const limit = hhmmToMinutes(lateAfter);
  if (limit == null) return { status: "ON_TIME", lateMinutes: 0 };
  const mod = minutesOfDay(now);
  return mod > limit ? { status: "LATE", lateMinutes: mod - limit } : { status: "ON_TIME", lateMinutes: 0 };
}

/** Status jam pulang terhadap work_end. */
export function checkOutInfo(now: Date, workEnd: string): "ON_TIME" | "EARLY" {
  const limit = hhmmToMinutes(workEnd);
  if (limit == null) return "ON_TIME";
  return minutesOfDay(now) < limit ? "EARLY" : "ON_TIME";
}

/** Jarak haversine dalam meter. */
export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface GeoCheck {
  outside: boolean; // true = di luar radius (accuracy sudah diperhitungkan)
  distanceM: number | null; // null kalau tak bisa dihitung
}

export function evaluateGeofence(
  s: AttendanceSettingLike,
  lat?: number | null,
  lng?: number | null,
  accuracyM?: number | null
): GeoCheck {
  if (s.geofence_mode === "OFF" || s.geofence_lat == null || s.geofence_lng == null) {
    return { outside: false, distanceM: null };
  }
  if (lat == null || lng == null) {
    // tak ada koordinat → tak bisa verifikasi; anggap "di luar" hanya untuk ENFORCE
    return { outside: s.geofence_mode === "ENFORCE", distanceM: null };
  }
  const dist = haversineMeters(s.geofence_lat, s.geofence_lng, lat, lng);
  const buffer = Math.min(Math.max(accuracyM ?? 0, 0), 200); // batasi buffer akurasi 200 m
  return { outside: dist - buffer > s.geofence_radius_m, distanceM: Math.round(dist) };
}

/** Cocokkan IP ke daftar (IP literal atau CIDR IPv4). Kosong = tak ada aturan. */
export function ipAllowed(ip: string | null, allowlist: string): boolean {
  const list = allowlist
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (list.length === 0) return true;
  if (!ip) return false;
  const target = ipv4ToInt(ip);
  if (target == null) return false;
  for (const entry of list) {
    if (entry.includes("/")) {
      const [base, bitsRaw] = entry.split("/");
      const baseInt = ipv4ToInt(base);
      const bits = Number(bitsRaw);
      if (baseInt == null || !(bits >= 0 && bits <= 32)) continue;
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      if ((target & mask) >>> 0 === (baseInt & mask) >>> 0) return true;
    } else if (ipv4ToInt(entry) === target) {
      return true;
    }
  }
  return false;
}

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** Ambil IP klien dari header request (di belakang proxy Coolify). */
export function clientIpFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || null;
  return h.get("x-real-ip") || null;
}

/** Ringkas User-Agent jadi label pendek untuk device_label. */
export function shortDeviceLabel(ua: string | null): string | null {
  if (!ua) return null;
  const s = ua.slice(0, 300);
  const os =
    /Android/i.test(s) ? "Android" :
    /iPhone|iPad|iOS/i.test(s) ? "iOS" :
    /Windows/i.test(s) ? "Windows" :
    /Mac OS X|Macintosh/i.test(s) ? "macOS" :
    /Linux/i.test(s) ? "Linux" : "Perangkat";
  const br =
    /Edg\//i.test(s) ? "Edge" :
    /Chrome\//i.test(s) ? "Chrome" :
    /Firefox\//i.test(s) ? "Firefox" :
    /Safari\//i.test(s) ? "Safari" : "";
  return br ? `${os} · ${br}` : os;
}

/** Validasi & normalisasi dataURL selfie → { mime, buffer }. Batas ukuran 200 KB. */
export function decodeSelfieDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length === 0 || buffer.length > 200 * 1024) return null;
  return { mime: m[1], buffer };
}
