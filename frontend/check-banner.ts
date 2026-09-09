import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findFirst({
    where: { name: 'BANNER OUTDOOR' }
  });
  console.log("Product:", p?.name, "| Default Machine:", p?.default_machine_id);
}
main().finally(() => prisma.$disconnect());
