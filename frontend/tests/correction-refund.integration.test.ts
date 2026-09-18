import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { applyRefundCorrection } from "../src/actions/audit";

// Explicit opt-in, rollback-only — same convention as material-catalog.integration.test.ts.
// `applyRefundCorrection` is the money-moving core of createCorrection/approveCorrection
// (frontend/src/actions/audit.ts). It's exported specifically so it can be exercised here
// without going through the wrapping "use server" actions, which depend on next/headers
// session context that only resolves inside a real Next.js request.
test("applyRefundCorrection moves money exactly like cancel.ts's refund path", { skip: process.env.PRINT_PILOT_DB_TEST !== "1" }, async () => {
  const db = new PrismaClient();
  const rollback = new Error("ROLLBACK_FIXTURES");
  let checked = false;
  try {
    const user = await db.user.findFirst({ select: { id: true, tenant_id: true } });
    assert.ok(user, "Needs one local tenant user for fixture foreign keys");
    await assert.rejects(
      db.$transaction(async (tx) => {
        const tid = user.tenant_id;
        const tag = randomUUID();
        const order = await tx.order.create({
          data: { tenant_id: tid, order_code: tag, order_type: "PRINTING", created_by: user.id, status: "PRODUCTION_STARTED", subtotal: 200000, total: 200000, paid_amount: 100000, balance: 100000 },
        });

        await applyRefundCorrection(tx, tid, order.id, 40000, "CASH", user.id, "test refund");

        const afterFirst = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        assert.equal(Number(afterFirst.paid_amount), 60000);
        assert.equal(Number(afterFirst.balance), 140000);
        const payment = await tx.payment.findFirstOrThrow({ where: { order_id: order.id }, orderBy: { paid_at: "desc" } });
        assert.equal(Number(payment.amount), -40000);
        assert.equal(payment.method, "CASH");
        assert.equal(payment.status, "CONFIRMED");
        const log = await tx.auditLog.findFirst({ where: { tenant_id: tid, entity_id: order.id, action: "CORRECTION_REFUND_APPLIED" } });
        assert.ok(log, "refund must produce an atomic audit event, not a silent balance change");

        // Requesting more than what's left as paid must clamp, never go negative or over-refund.
        await applyRefundCorrection(tx, tid, order.id, 999_999, "TRANSFER", user.id, "over-refund attempt");
        const afterSecond = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        assert.equal(Number(afterSecond.paid_amount), 0, "clamped refund must not drive paid_amount negative");
        assert.equal(Number(afterSecond.balance), 200000);

        checked = true;
        throw rollback;
      }),
      rollback
    );
    assert.ok(checked, "assertions must run inside the transaction before rollback");
  } finally {
    await db.$disconnect();
  }
});
