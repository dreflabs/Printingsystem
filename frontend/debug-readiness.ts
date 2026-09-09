import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: { 
      order_type: 'PRINTING',
    },
    orderBy: { created_at: 'desc' },
    take: 10,
    include: {
      items: true,
      design_jobs: { select: { status: true } },
    },
  });

  for (const order of orders) {
    const designApproved = order.design_jobs.some((d) => d.status === "APPROVED");
    console.log(order.order_code, "| Status:", order.status, "| DP Met:", Number(order.paid_amount) >= Number(order.dp_required ?? Math.round(Number(order.total) * 0.5)), "| Design Approved:", designApproved);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
