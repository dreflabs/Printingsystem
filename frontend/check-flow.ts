import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: { order_type: 'PRINTING' },
    orderBy: { created_at: 'desc' },
    take: 5,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      items: { include: { product: { select: { name: true, unit: true, default_machine_id: true } } } },
      design_jobs: { include: { versions: { select: { file_path: true, approval_status: true } } } },
      payments: { select: { amount: true, status: true } },
    }
  });

  for (const o of orders) {
    console.log("\n============================================");
    console.log(`Order: ${o.order_code} | Status: ${o.status}`);
    console.log(`Customer: ${o.customer?.name} | Phone: ${o.customer?.phone} | Email: ${o.customer?.email}`);
    console.log(`Paid: ${o.paid_amount} / DP Req: ${o.dp_required} | DP MET: ${Number(o.paid_amount) >= Number(o.dp_required ?? Math.round(Number(o.total) * 0.5))}`);
    
    const dj = o.design_jobs[0];
    console.log(`Design Job: status=${dj?.status ?? 'NONE'}`);
    if (dj?.versions?.length) {
      for (const v of dj.versions) {
        console.log(`  Version: ${v.approval_status} | file_path: ${v.file_path ? '✓' : 'KOSONG'}`);
      }
    } else {
      console.log(`  No versions uploaded`);
    }

    for (const it of o.items) {
      console.log(`Item: ${it.product?.name ?? '(no product)'} | unit=${it.product?.unit} | machine=${it.product?.default_machine_id ?? 'KOSONG'} | material=${it.material_id ?? 'KOSONG'}`);
    }

    // Check if customer has contact
    const hasContact = !!(o.customer?.phone || o.customer?.email);
    console.log(`Customer Contact: ${hasContact ? '✓' : 'KOSONG'}`);
  }
}
main().finally(() => prisma.$disconnect());
