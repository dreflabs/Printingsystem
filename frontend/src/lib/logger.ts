import * as crypto from "crypto";
import { prisma } from "./prisma";

function auditSecret(): string {
  const s = process.env.AUDIT_SECRET;
  if (!s || s === "default_secret") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUDIT_SECRET wajib diset di produksi — rantai audit tidak boleh pakai kunci default.");
    }
    return s || "default_secret";
  }
  return s;
}

function generateHash(data: string, previousHash: string | null): string {
  const hmac = crypto.createHmac("sha256", auditSecret());
  hmac.update(`${data}${previousHash || ""}`);
  return hmac.digest("hex");
}

/** Field separator yang di-escape supaya payload hash tidak ambigu. */
function field(v: string | null): string {
  return (v ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/**
 * Catat aksi ke `audit_logs` sebagai mata rantai hash (anti-tamper).
 *
 * Ditulis dalam transaksi Serializable + retry: dua aksi bersamaan tidak boleh
 * membaca `previous_hash` yang sama lalu bercabang. Kegagalan audit tetap tidak
 * meng-crash aksi utama (aksi utama sudah commit sebelum ini dipanggil) — tapi
 * kegagalan dicatat ke stderr agar terlihat di monitoring.
 */
export async function logAction(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValueJson?: unknown,
  newValueJson?: unknown,
  notes?: string
) {
  try {
    const user = await prisma.user.findUnique({ where: { id: actorId }, select: { tenant_id: true } });
    if (!user) {
      console.warn(`[AUDIT] User ${actorId} tidak ditemukan — log dilewati.`);
      return;
    }

    const oldVal = oldValueJson ? JSON.stringify(oldValueJson) : null;
    const newVal = newValueJson ? JSON.stringify(newValueJson) : null;
    const dataPayload = [
      field(actorId),
      field(action),
      field(entityType),
      field(entityId),
      field(oldVal),
      field(newVal),
      field(notes ?? null),
    ].join("|");

    await prisma.$transaction(async (tx) => {
      // Advisory lock per-tenant: penulisan audit yang bersamaan mengantre
      // (bukan abort-retry) sehingga rantai hash tidak pernah bercabang / hilang.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"audit:" + user.tenant_id}))`;

      const lastLog = await tx.auditLog.findFirst({
        where: { tenant_id: user.tenant_id },
        orderBy: { created_at: "desc" },
        select: { hash: true },
      });
      const previousHash = lastLog?.hash ?? null;
      await tx.auditLog.create({
        data: {
          tenant_id: user.tenant_id,
          actor_id: actorId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          old_value_json: oldVal,
          new_value_json: newVal,
          notes,
          hash: generateHash(dataPayload, previousHash),
          previous_hash: previousHash,
        },
      });
    });
  } catch (error) {
    console.error("[AUDIT ERROR] Gagal mencatat aksi:", error);
  }
}
