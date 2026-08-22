import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // 1. Seed Roles
  const roles = [
    "owner",
    "supervisor",
    "admin_sales",
    "designer_sales",
    "operator",
    "qc",
    "finishing",
    "warehouse"
  ];

  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
  console.log("Roles seeded successfully.");

  // 2. Seed Default Owner
  const ownerRole = await prisma.role.findUnique({
    where: { name: "owner" }
  });

  if (ownerRole) {
    const defaultPassword = await bcrypt.hash("owner123", 10);
    
    await prisma.user.upsert({
      where: { username: "owner" },
      update: {},
      create: {
        name: "Sistem Owner",
        username: "owner",
        email: "owner@printflow.local",
        password_hash: defaultPassword,
        role_id: ownerRole.id,
      },
    });
    console.log("Default owner account seeded successfully (username: owner, password: owner123).");
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
