import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/actor";

/**
 * GET /api/audit-logs — read-only riwayat audit (anti-fraud chain).
 * Query: entity_type, entity_id, action, actor_id, limit (default 100, max 500).
 * Akses: Owner (penuh) & Admin. Role lain ditolak.
 */
export async function GET(request: Request) {
  try {
    const tenant = await requireTenant();
    const actor = await getCurrentUser();
    if (!actor || (actor.role !== "owner" && actor.role !== "admin")) {
      return Response.json({ error: "Tidak berwenang." }, { status: 403 });
    }

    const url = new URL(request.url);
    const q = url.searchParams;
    const limit = Math.min(Math.max(Number(q.get("limit") ?? 100), 1), 500);

    const logs = await prisma.auditLog.findMany({
      where: {
        tenant_id: tenant.id,
        ...(q.get("entity_type") ? { entity_type: q.get("entity_type")! } : {}),
        ...(q.get("entity_id") ? { entity_id: q.get("entity_id")! } : {}),
        ...(q.get("action") ? { action: q.get("action")! } : {}),
        ...(q.get("actor_id") ? { actor_id: q.get("actor_id")! } : {}),
      },
      orderBy: { created_at: "desc" },
      take: limit,
      include: { actor: { select: { name: true, username: true } } },
    });

    return Response.json({
      count: logs.length,
      logs: logs.map((l) => ({
        id: l.id,
        actor: l.actor?.name ?? l.actor_id,
        action: l.action,
        entityType: l.entity_type,
        entityId: l.entity_id,
        oldValue: l.old_value_json,
        newValue: l.new_value_json,
        notes: l.notes,
        hash: l.hash,
        previousHash: l.previous_hash,
        createdAt: l.created_at,
      })),
    });
  } catch (e) {
    console.error("GET /api/audit-logs:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Gagal memuat audit logs." }, { status: 500 });
  }
}
