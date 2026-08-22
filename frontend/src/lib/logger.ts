import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

function generateHash(data: string, previousHash: string | null): string {
  const hmac = crypto.createHmac("sha256", process.env.AUDIT_SECRET || "default_secret");
  hmac.update(`${data}${previousHash || ""}`);
  return hmac.digest("hex");
}

export async function logAction(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValueJson?: any,
  newValueJson?: any,
  notes?: string
) {
  try {
    // 1. Get the last log's hash to chain
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { created_at: "desc" },
    });

    const previousHash = lastLog?.hash || null;
    const oldVal = oldValueJson ? JSON.stringify(oldValueJson) : null;
    const newVal = newValueJson ? JSON.stringify(newValueJson) : null;

    // 2. Data payload to hash
    const dataPayload = `${actorId}:${action}:${entityType}:${entityId}:${oldVal}:${newVal}:${notes || ""}`;
    const newHash = generateHash(dataPayload, previousHash);

    // 3. Insert Log
    await prisma.auditLog.create({
      data: {
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_value_json: oldVal,
        new_value_json: newVal,
        notes,
        hash: newHash,
        previous_hash: previousHash,
      },
    });

    console.log(`[AUDIT] Action ${action} on ${entityType}:${entityId} logged.`);
  } catch (error) {
    console.error("[AUDIT ERROR] Failed to log action:", error);
    // Do not crash the main transaction for audit failure, just log it.
  }
}
