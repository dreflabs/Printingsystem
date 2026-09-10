import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  const tenant = await prisma.tenant.findFirst();
  console.log("Tenant:", tenant?.id, tenant?.slug);

  const dbRole = await prisma.role.findUnique({
    where: { name: "owner" }
  });
  console.log("Role:", dbRole?.id, dbRole?.name);

  if (tenant && dbRole) {
    const user = await prisma.user.findFirst({
      where: { 
        tenant_id: tenant.id,
        role_id: dbRole.id,
      }
    });
    console.log("User:", user?.id, user?.name, user?.username);
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
