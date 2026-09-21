import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  hhmmToMinutes,
  tenantDayDate,
  lateInfoForTenant,
  checkOutInfoForTenant,
  isWorkdayForTenant,
  evaluateGeofence,
  ipAllowed,
  decodeSelfieDataUrl,
  clientIpFromHeaders,
} from "../src/lib/attendance";
import { performClockIn, performClockOut, PunchError } from "../src/lib/attendance-punch";

// ── Helper murni (tanpa DB) ─────────────────────────────────────────────────

test("hhmmToMinutes mem-parse HH:mm dan menolak format salah", () => {
  assert.equal(hhmmToMinutes("09:15"), 555);
  assert.equal(hhmmToMinutes("00:00"), 0);
  assert.equal(hhmmToMinutes("17:00"), 1020);
  assert.equal(hhmmToMinutes("9:5"), null);
  assert.equal(hhmmToMinutes("abc"), null);
});

test("tenantDayDate memakai timezone tenant, bukan zona server", () => {
  // 2026-09-21 00:30 WIB = 2026-09-20 17:30 UTC → hari kerja tenant tetap 21.
  const at = new Date("2026-09-20T17:30:00Z");
  assert.equal(tenantDayDate(at, "Asia/Jakarta").toISOString().slice(0, 10), "2026-09-21");
  // Zona lain: 2026-09-21 01:00 WIT = 2026-09-20 16:00 UTC → tetap 21 di WIT.
  assert.equal(tenantDayDate(new Date("2026-09-20T16:00:00Z"), "Asia/Jayapura").toISOString().slice(0, 10), "2026-09-21");
  // UTC: 2026-09-20 17:30 UTC → 20.
  assert.equal(tenantDayDate(at, "UTC").toISOString().slice(0, 10), "2026-09-20");
});

test("status terlambat & pulang cepat mengikuti jam tenant", () => {
  const late = lateInfoForTenant(new Date("2026-09-21T02:30:00Z"), "09:15", "Asia/Jakarta"); // 09:30 WIB
  assert.equal(late.status, "LATE");
  assert.equal(late.lateMinutes, 15);

  const onTime = lateInfoForTenant(new Date("2026-09-21T02:05:00Z"), "09:15", "Asia/Jakarta"); // 09:05 WIB
  assert.equal(onTime.status, "ON_TIME");
  assert.equal(onTime.lateMinutes, 0);

  assert.equal(checkOutInfoForTenant(new Date("2026-09-21T09:00:00Z"), "17:00", "Asia/Jakarta"), "EARLY"); // 16:00 WIB
  assert.equal(checkOutInfoForTenant(new Date("2026-09-21T10:00:00Z"), "17:00", "Asia/Jakarta"), "ON_TIME"); // 17:00 WIB
});

test("hari kerja mengikuti daftar workdays tenant", () => {
  const senin = new Date("2026-09-21T03:00:00Z"); // Senin
  const minggu = new Date("2026-09-20T03:00:00Z"); // Minggu
  assert.equal(isWorkdayForTenant(senin, "1,2,3,4,5,6", "Asia/Jakarta"), true);
  assert.equal(isWorkdayForTenant(minggu, "1,2,3,4,5,6", "Asia/Jakarta"), false);
  assert.equal(isWorkdayForTenant(minggu, "1,2,3,4,5,6,7", "Asia/Jakarta"), true);
});

test("geofence: OFF/FLAG/ENFORCE + buffer akurasi dibatasi", () => {
  const base = {
    work_start: "09:00",
    late_after: "09:15",
    work_end: "17:00",
    workdays: "1,2,3,4,5,6",
    earliest_clock_in_min: 120,
    geofence_lat: -6.2,
    geofence_lng: 106.8,
    geofence_radius_m: 150,
    geofence_mode: "FLAG",
    ip_allowlist: "",
    ip_mode: "OFF",
    selfie_required: true,
  };
  // Di luar radius → outside true (mode FLAG hanya menandai)
  assert.equal(evaluateGeofence(base, -6.25, 106.85, 10).outside, true);
  // Di dalam radius → outside false
  assert.equal(evaluateGeofence(base, -6.2, 106.8, 10).outside, false);
  // Tanpa koordinat: FLAG tidak menandai, ENFORCE menolak
  assert.equal(evaluateGeofence(base, null, null, null).outside, false);
  assert.equal(evaluateGeofence({ ...base, geofence_mode: "ENFORCE" }, null, null, null).outside, true);
  // Mode OFF mengabaikan geofence
  assert.equal(evaluateGeofence({ ...base, geofence_mode: "OFF" }, -6.3, 106.9, 5).outside, false);
  // Akurasi besar tidak menutupi jarak jauh (buffer maksimum 200 m)
  const far = evaluateGeofence({ ...base, geofence_mode: "ENFORCE" }, -6.3, 106.9, 5000);
  assert.equal(far.outside, true);
});

test("allowlist IP mendukung IP tunggal dan CIDR", () => {
  assert.equal(ipAllowed("10.0.0.5", "10.0.0.5, 192.168.1.0/24"), true);
  assert.equal(ipAllowed("192.168.1.77", "10.0.0.5, 192.168.1.0/24"), true);
  assert.equal(ipAllowed("192.168.2.10", "10.0.0.5, 192.168.1.0/24"), false);
  assert.equal(ipAllowed(null, "10.0.0.5"), false);
  // Daftar kosong = tidak ada aturan → dianggap lolos
  assert.equal(ipAllowed("8.8.8.8", ""), true);
});

test("selfie: hanya data URL webp/jpeg/png ≤200 KB", () => {
  const ok = `data:image/webp;base64,${Buffer.from("abc").toString("base64")}`;
  assert.equal(decodeSelfieDataUrl(ok)?.mime, "image/webp");
  assert.equal(decodeSelfieDataUrl("data:text/plain;base64,YWJj"), null);
  assert.equal(decodeSelfieDataUrl("bukan-data-url"), null);
  const big = `data:image/webp;base64,${Buffer.alloc(201 * 1024).toString("base64")}`;
  assert.equal(decodeSelfieDataUrl(big), null);
});

test("IP diambil dari header forwarded pertama", () => {
  const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
  assert.equal(clientIpFromHeaders(h), "203.0.113.9");
  assert.equal(clientIpFromHeaders(new Headers()), null);
});

// ── Inti punch (DB) ─────────────────────────────────────────────────────────

test("punch: absen masuk/pulang, anti dobel, istirahat menggantung, geofence ENFORCE, selfie wajib", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  let tenantId: string | undefined;
  let userId: string | undefined;

  const selfie = `data:image/webp;base64,${Buffer.from("selfie").toString("base64")}`;

  try {
    const role = await db.role.upsert({ where: { name: "operator" }, update: {}, create: { name: "operator" } });
    const tenant = await db.tenant.create({
      data: { slug: `att-${tag}`, name: "Absensi Uji", plan: "PRO", status: "ACTIVE" },
    });
    tenantId = tenant.id;
    const user = await db.user.create({
      data: {
        tenant_id: tenant.id,
        name: "Pegawai Uji",
        username: `peg-${tag}`,
        email: `peg-${tag}@contoh.test`,
        password_hash: "x",
        role_id: role.id,
        active: true,
        attendance_eligible: true,
      },
    });
    userId = user.id;

    const setting = await db.tenantAttendanceSetting.create({
      data: {
        tenant_id: tenant.id,
        work_start: "00:00",
        late_after: "23:59",
        work_end: "23:59",
        workdays: "1,2,3,4,5,6,7",
        earliest_clock_in_min: 24 * 60,
        selfie_required: true,
        geofence_mode: "OFF",
        ip_mode: "OFF",
      },
    });

    const ctx = () => ({
      tenantId: tenant.id,
      user: { id: user.id, name: user.name },
      setting,
      method: "IN_APP" as const,
      ip: "10.0.0.9",
      deviceLabel: "Uji",
      input: { selfie },
    });

    // Selfie wajib → tanpa selfie ditolak
    await assert.rejects(
      performClockIn({ ...ctx(), input: {} }),
      (e: unknown) => e instanceof PunchError && /Selfie wajib/.test(e.message),
    );

    // Absen masuk sukses
    const inRes = await performClockIn(ctx());
    assert.equal(inRes.status, "ON_TIME");
    assert.equal(inRes.recordId.length > 0, true);

    // Dobel absen masuk ditolak
    await assert.rejects(performClockIn(ctx()), (e: unknown) => e instanceof PunchError && /sudah absen masuk/.test(e.message));

    // Istirahat menggantung → absen pulang ditolak
    const rec = await db.attendanceRecord.findUniqueOrThrow({ where: { id: inRes.recordId } });
    await db.attendanceRecord.update({ where: { id: rec.id }, data: { break_start: new Date() } });
    await assert.rejects(
      performClockOut(ctx()),
      (e: unknown) => e instanceof PunchError && /Selesaikan istirahat/.test(e.message),
    );
    await db.attendanceRecord.update({ where: { id: rec.id }, data: { break_end: new Date(), break_status: "NORMAL" } });

    // Absen pulang sukses lalu dobel ditolak
    const outRes = await performClockOut(ctx());
    assert.ok(["ON_TIME", "EARLY"].includes(outRes.status));
    await assert.rejects(performClockOut(ctx()), (e: unknown) => e instanceof PunchError && /sudah absen pulang/.test(e.message));

    // Selfie tersimpan untuk kedua punch
    const selfies = await db.attendanceSelfie.count({ where: { record_id: rec.id } });
    assert.equal(selfies, 2);

    // Geofence ENFORCE menolak di luar radius (user lain, hari berbeda tidak ada — pakai hari yang sama gagal karena sudah absen)
    const user2 = await db.user.create({
      data: {
        tenant_id: tenant.id,
        name: "Pegawai Uji 2",
        username: `peg2-${tag}`,
        email: `peg2-${tag}@contoh.test`,
        password_hash: "x",
        role_id: role.id,
        active: true,
        attendance_eligible: true,
      },
    });
    const strict = await db.tenantAttendanceSetting.update({
      where: { tenant_id: tenant.id },
      data: { geofence_mode: "ENFORCE", geofence_lat: -6.2, geofence_lng: 106.8, geofence_radius_m: 150 },
    });
    await assert.rejects(
      performClockIn({
        ...ctx(),
        user: { id: user2.id, name: user2.name },
        setting: strict,
        input: { selfie, lat: -6.9, lng: 107.6, accuracyM: 10 },
      }),
      (e: unknown) => e instanceof PunchError && /di luar area kantor/.test(e.message),
    );
  } finally {
    if (tenantId) {
      await db.auditLog.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await db.tenantAuditLog.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await db.attendanceSelfie.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await db.attendanceRecord.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await db.tenantAttendanceSetting.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await db.user.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
      await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    await db.$disconnect();
    assert.ok(userId);
  }
});
