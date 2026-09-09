import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findUnique({
    where: { id: 'ac92b74f-f84e-48c3-a7db-fb4c83cc0ff6' }
  });
  console.log("Product:", p?.name, "| Default Machine:", p?.default_machine_id);
}
main().finally(() => prisma.$disconnect());
