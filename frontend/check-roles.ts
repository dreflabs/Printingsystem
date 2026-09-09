import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  console.log("=== SEMUA ROLES ===");
  for (const r of roles) {
    console.log(`- ${r.name} | ${r.display_name}`);
  }

  const machines = await prisma.machine.findMany({ orderBy: { name: 'asc' } });
  console.log("\n=== MESIN TERDAFTAR ===");
  for (const m of machines) {
    console.log(`- ${m.machine_code} | ${m.name} | Category: ${m.category} | Status: ${m.status}`);
  }

  const operators = await prisma.user.findMany({
    where: { role: { name: 'operator' } },
    include: { role: true },
    orderBy: { name: 'asc' }
  });
  console.log("\n=== OPERATOR TERDAFTAR ===");
  for (const o of operators) {
    console.log(`- ${o.name} | Role: ${o.role.name}`);
  }
}
main().finally(() => prisma.$disconnect());
