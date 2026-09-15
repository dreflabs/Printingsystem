import { PrismaClient } from "@prisma/client";

// Singleton Prisma client — hindari koneksi menumpuk saat hot-reload di dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
