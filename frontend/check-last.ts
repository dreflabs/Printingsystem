import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const o = await prisma.order.findFirst({
    where: { order_code: 'ORD-20260910-0001' },
    include: { payments: true }
  });
  console.log("Order:", o?.order_code, "| Status:", o?.status, "| Paid:", o?.paid_amount);
  console.log("Payments:", o?.payments);
}
main().finally(() => prisma.$disconnect());
