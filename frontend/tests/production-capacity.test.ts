import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Explicit opt-in against a real local Postgres. Fixtures are deleted in a
// finally block (unlike the rollback-only pattern in the other integration
// test) because this exercises two REAL concurrent transactions — they can't
// share one outer transaction to roll back together.
//
// This mirrors the exact lock pattern added to `startProduction`
// (frontend/src/actions/production.ts) rather than calling the "use server"
// action itself: that action reads `next/headers`/session via
// requireTenant()/requireUser(), which only resolve inside a real Next.js
// request scope, so it can't be invoked directly from a node:test script.
// What's under test here is the DB-level claim: does `SELECT ... FOR UPDATE`
// on the Machine row actually serialize two concurrent capacity checks on
// Postgres, for this schema. That was the open question after the audit —
// the Next.js wiring around it is unchanged and covered by existing tests.
test("machine capacity cap rejects the second of two concurrent claims", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const tag = randomUUID();
  let machineId: string | undefined;
  let orderId: string | undefined;
  let jobIds: string[] = [];
  try {
    const user = await db.user.findFirst({ select: { id: true, tenant_id: true } });
    assert.ok(user, "Needs one local tenant user for fixture foreign keys");
    const tid = user.tenant_id;

    const machine = await db.machine.create({
      data: { tenant_id: tid, machine_code: tag, name: "Capacity test", category: "TEST", status: "ACTIVE", max_active_jobs: 1 },
    });
    machineId = machine.id;

    const order = await db.order.create({
      data: { tenant_id: tid, order_code: tag, order_type: "PRINTING", created_by: user.id, status: "PRODUCTION_ASSIGNED", subtotal: 0, total: 0, balance: 0 },
    });
    orderId = order.id;

    const [jobA, jobB] = await Promise.all(
      ["A", "B"].map((suffix) =>
        db.productionJob.create({
          data: { tenant_id: tid, order_id: order.id, job_code: `${tag}-${suffix}`, machine_id: machine.id, status: "PRODUCTION_QUEUED", planned_qty: 1 },
        })
      )
    );
    jobIds = [jobA.id, jobB.id];

    // Same check-then-claim shape as the fixed block in startProduction:
    // lock the Machine row, count active jobs, throw over cap, else claim.
    const claim = (jobId: string) =>
      db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Machine" WHERE id = ${machine.id} AND tenant_id = ${tid} FOR UPDATE`;
        const activeCount = await tx.productionJob.count({
          where: { tenant_id: tid, machine_id: machine.id, status: { in: ["PRODUCTION_STARTED", "PRODUCTION_PAUSED"] } },
        });
        if (activeCount >= 1) throw new Error("CAPACITY_FULL");
        // Simulate the transaction doing real work before committing, widening
        // the race window an unlocked version of this check would fall into.
        await new Promise((r) => setTimeout(r, 50));
        await tx.productionJob.update({ where: { id: jobId }, data: { status: "PRODUCTION_STARTED" } });
      });

    const results = await Promise.allSettled([claim(jobA.id), claim(jobB.id)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exactly one claim should succeed under a cap of 1");
    assert.equal(rejected.length, 1, "the other claim should be rejected, not silently double-claim");
    assert.match((rejected[0] as PromiseRejectedResult).reason.message, /CAPACITY_FULL/);

    const finalActive = await db.productionJob.count({
      where: { tenant_id: tid, machine_id: machine.id, status: { in: ["PRODUCTION_STARTED", "PRODUCTION_PAUSED"] } },
    });
    assert.equal(finalActive, 1, "cap of 1 must never be exceeded even under concurrent claims");
  } finally {
    if (jobIds.length) await db.productionJob.deleteMany({ where: { id: { in: jobIds } } });
    if (orderId) await db.order.delete({ where: { id: orderId } }).catch(() => {});
    if (machineId) await db.machine.delete({ where: { id: machineId } }).catch(() => {});
    await db.$disconnect();
  }
});
