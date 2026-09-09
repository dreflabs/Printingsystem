import { PrismaClient } from '@prisma/client';
import { checkProductionReadiness } from './src/lib/production-readiness';
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: { order_type: 'PRINTING' },
    orderBy: { created_at: 'desc' },
    take: 5,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      items: { include: { product: { select: { name: true, default_machine_id: true } } } },
      design_jobs: { select: { status: true } },
    }
  });

  for (const o of orders) {
    console.log(`\nOrder: ${o.order_code} (Status: ${o.status})`);
    const dpMet = Number(o.paid_amount) >= Number(o.dp_required ?? Math.round(Number(o.total) * 0.5));
    const designApproved = o.design_jobs.some(d => d.status === "APPROVED");
    console.log(`- DP Terpenuhi: ${dpMet}`);
    console.log(`- Desain ACC: ${designApproved}`);
    
    for (const it of o.items) {
      if (it.product) {
        console.log(`- Produk: ${it.product.name} | Mesin Default: ${it.product.default_machine_id || 'KOSONG (TIDAK ADA MESIN)'}`);
      } else {
        console.log(`- Item manual tanpa produk katalog`);
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
