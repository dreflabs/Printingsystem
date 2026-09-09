import { PrismaClient } from '@prisma/client';
import { checkProductionReadiness } from './src/lib/production-readiness';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findFirst({
    where: { order_type: 'PRINTING' },
    orderBy: { created_at: 'desc' },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      items: { include: { product: { select: { unit: true, default_machine_id: true } } } },
      design_jobs: { select: { status: true } },
    },
  });

  if (!order) {
    console.log("No orders found");
    return;
  }

  console.log("=========================================");
  console.log("Latest Order:", order.order_code);
  console.log("Status:", order.status);
  console.log("Created At:", order.created_at);

  const designApproved = order.design_jobs.some((d) => d.status === "APPROVED");
  const approvedVersion = designApproved
    ? await prisma.designVersion.findFirst({
        where: { design_job: { order_id: order.id }, approval_status: "APPROVED" },
        select: { file_path: true, file_name: true },
        orderBy: { version_no: "desc" },
      })
    : null;

  const total = Number(order.total);
  const dpRequired = Number(order.dp_required ?? Math.round(total * 0.5));

  const items = order.items
    .filter((it) => !it.retail_product_id)
    .map((it) => ({
      label: it.description || "",
      productId: it.product_id,
      productUnit: it.product?.unit ?? null,
      defaultMachineId: it.product?.default_machine_id ?? null,
      quantity: it.quantity,
      size: it.size,
      materialId: it.material_id,
      unitPrice: Number(it.unit_price),
      totalPrice: Number(it.total_price),
    }));

  const gate = checkProductionReadiness({
    status: order.status,
    orderType: order.order_type,
    customerId: order.customer_id,
    customerName: order.customer?.name ?? null,
    customerContact: order.customer?.phone || order.customer?.email || null,
    deadline: order.deadline,
    discount: Number(order.discount),
    discountApprovedBy: order.discount_approved_by,
    paidAmount: Number(order.paid_amount),
    dpRequired,
    designApproved,
    designFilePresent: Boolean(approvedVersion?.file_path || approvedVersion?.file_name),
    items,
  });

  console.log("DP Req:", dpRequired, "| Paid:", order.paid_amount);
  console.log("Deadline:", order.deadline);
  console.log("Design Approved:", designApproved);
  console.log("Items:");
  console.dir(items, { depth: null });
  console.log("Readiness Missing:", gate.missing);

  // Check ActionLogs for this order
  const logs = await prisma.actionLog.findMany({
    where: { entity_id: order.id },
    orderBy: { created_at: 'asc' },
  });
  console.log("\nAction Logs for this order:");
  for (const log of logs) {
    console.log(`- ${log.created_at.toISOString()} | ${log.action} | ${log.details}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
