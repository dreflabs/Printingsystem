import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/actor";

/**
 * GET /api/audit-logs — read-only riwayat audit (anti-fraud chain).
 * Query: entity_type, entity_id, action, actor_id, limit (default 100, max 500).
 * Akses: Owner (penuh) & Admin. Role lain ditolak.
 *
 * Admin (non-Owner) TIDAK melihat entri `entity_type = "User"` — semua entri itu
 * adalah jejak manajemen pegawai/HR (EMPLOYEE_*, USER_ROLES_*, ATTENDANCE_PIN_*,
 * EMPLOYEE_BASE_SALARY_SET) yang memuat identitas, struktur peran, dan linimasa
 * reset password. Di UI, halaman "Pegawai & Akses" sendiri owner-only; tanpa
 * filter ini Admin bisa merekonstruksi seluruh roster lewat audit log.
 */
export async function GET(request: Request) {
  try {
    const tenant = await requireTenant();
    const actor = await getCurrentUser();
    // Cek berbasis SEMUA peran (multi-role), bukan hanya peran utama.
    const isPrivileged = !!actor && (actor.roles.includes("owner") || actor.roles.includes("admin"));
    if (!actor || !isPrivileged) {
      return Response.json({ error: "Tidak berwenang." }, { status: 403 });
    }
    const isOwner = actor.roles.includes("owner");

    const url = new URL(request.url);
    const q = url.searchParams;
    const limit = Math.min(Math.max(Number(q.get("limit") ?? 100), 1), 500);
    const search = q.get("search");

    const logs = await prisma.auditLog.findMany({
      where: {
        tenant_id: tenant.id,
        ...(q.get("entity_type") ? { entity_type: q.get("entity_type")! } : {}),
        ...(q.get("entity_id") ? { entity_id: q.get("entity_id")! } : {}),
        ...(q.get("action") ? { action: { contains: q.get("action")!, mode: "insensitive" } } : {}),
        ...(q.get("actor_id") ? { actor_id: q.get("actor_id")! } : {}),
        ...(search
          ? { OR: [
              { action: { contains: search, mode: "insensitive" } },
              { entity_id: { contains: search, mode: "insensitive" } },
              { entity_type: { contains: search, mode: "insensitive" } },
            ] }
          : {}),
        // Redaksi jejak HR untuk non-Owner. AND terpisah supaya tidak bentrok
        // dengan filter `entity_type` dari query.
        ...(isOwner ? {} : { AND: [{ entity_type: { not: "User" } }] }),
      },
      orderBy: { created_at: "desc" },
      take: limit,
      include: { actor: { select: { name: true, username: true, role: { select: { name: true } } } } },
    });

    // Perkaya entitas dengan kode yang dikenali manusia (order_code / job_code)
    // supaya UI tidak menampilkan UUID. Satu query per jenis entitas.
    const orderIds = [...new Set(logs.filter((l) => l.entity_type === "Order").map((l) => l.entity_id))];
    const jobIds = [...new Set(logs.filter((l) => l.entity_type === "ProductionJob").map((l) => l.entity_id))];
    const [orders, jobs] = await Promise.all([
      orderIds.length ? prisma.order.findMany({ where: { tenant_id: tenant.id, id: { in: orderIds } }, select: { id: true, order_code: true } }) : [],
      jobIds.length ? prisma.productionJob.findMany({ where: { tenant_id: tenant.id, id: { in: jobIds } }, select: { id: true, job_code: true } }) : [],
    ]);
    const codeById = new Map<string, string>([
      ...orders.map((o) => [o.id, o.order_code] as const),
      ...jobs.map((j) => [j.id, j.job_code] as const),
    ]);

    return Response.json({
      count: logs.length,
      logs: logs.map((l) => ({
        id: l.id,
        actor: l.actor?.name ?? l.actor_id,
        actorRole: l.actor?.role?.name ?? null,
        action: l.action,
        entityType: l.entity_type,
        entityId: l.entity_id,
        /** Kode entitas yang bisa dibaca (mis. ORD-20260922-0002) bila tersedia. */
        entityCode: codeById.get(l.entity_id) ?? null,
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
