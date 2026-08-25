import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import CredentialsProvider from "next-auth/providers/credentials";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Global Prisma instance to avoid hot-reloading issues
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { username: credentials.username as string },
          include: { role: true },
        });

        if (!user || !user.active) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );

        if (!isPasswordValid) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failed_login_count: { increment: 1 } },
          });
          return null;
        }

        // Reset failed logins
        await prisma.user.update({
          where: { id: user.id },
          data: { failed_login_count: 0, last_login_at: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          role: user.role.name,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
});
