import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("=== SIMULASI ALUR ORDER ===\n");
  
  // Ambil order terbaru
  const o = await prisma.order.findFirst({
    where: { order_type: 'PRINTING' },
    orderBy: { created_at: 'desc' },
    include: {
      customer: true,
      items: { include: { product: { select: { name: true, unit: true, default_machine_id: true } } } },
      design_jobs: { include: { versions: true } },
      payments: true,
    }
  });
  if (!o) { console.log("Tidak ada order PRINTING"); return; }

  console.log("ORDER:", o.order_code, "| Status:", o.status);
  console.log("Total:", o.total, "| DP Req:", o.dp_required, "| Paid:", o.paid_amount);
  
  console.log("\n--- CEK SETIAP TAHAP ---");
  
  // Tahap 1: DP
  const dpReq = Number(o.dp_required ?? Math.round(Number(o.total) * 0.5));
  const dpMet = Number(o.paid_amount) + 1e-6 >= dpReq;
  console.log("✅ [1] DP Terpenuhi:", dpMet, `(${o.paid_amount}/${dpReq})`);
  
  // Tahap 2: Desain
  const dj = o.design_jobs[0];
  const designApproved = dj?.status === "APPROVED";
  const hasApprovedVersion = dj?.versions?.some(v => v.approval_status === "APPROVED" && v.file_path);
  console.log("✅ [2] Design Job Status:", dj?.status ?? "NONE");
  console.log("✅ [2] Design Approved:", designApproved, "| Has File:", hasApprovedVersion);
  
  // Tahap 3: Item kelengkapan
  for (const it of o.items) {
    console.log(`\n--- ITEM: ${it.product?.name ?? '(no product)'} ---`);
    console.log("  Material:", it.material_id ?? "KOSONG ❌");
    console.log("  Machine:", it.product?.default_machine_id ?? "KOSONG ❌");
    console.log("  Unit:", it.product?.unit);
    console.log("  Size:", it.size ?? "KOSONG");
    console.log("  Qty:", it.quantity, "| Price:", it.unit_price);
  }

  // Tahap 4: Simulasi alur status
  console.log("\n--- SIMULASI STATUS FLOW ---");
  console.log("Order dibuat → status: DRAFT");
  if (dpMet) {
    console.log("DP dibayar → status seharusnya: DESIGNING (desain belum ACC)");
  } else {
    console.log("DP belum dibayar → status tetap: DRAFT");
  }
  if (designApproved && dpMet) {
    console.log("Desain ACC + DP lunas → status seharusnya: CONFIRMED → auto-release ke PRODUCTION_ASSIGNED");
  } else if (designApproved && !dpMet) {
    console.log("Desain ACC tapi DP belum → status: WAITING_PAYMENT");
  }
  
  // Tahap 5: Cek production jobs
  const pjobs = await prisma.productionJob.findMany({ where: { order_id: o.id } });
  console.log("\nProduction Jobs:", pjobs.length, pjobs.map(j => j.status).join(', '));
}
main().finally(() => prisma.$disconnect());
