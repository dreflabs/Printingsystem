import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import CredentialsProvider from "next-auth/providers/credentials";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { rateLimit, resetRateLimit } from "./rate-limit";

// Global Prisma instance to avoid hot-reloading issues
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Ambang percobaan login gagal sebelum akun dikunci sementara.
const LOCKOUT_THRESHOLD = 5;

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
        const identifier = credentials.username as string;
        const pw = credentials.password as string;

        // Rem brute-force: maks. 10 percobaan / 15 menit per identifier.
        const rlKey = `login:${identifier.toLowerCase().trim()}`;
        if (!rateLimit(rlKey, 10, 15 * 60_000).ok) return null;

        // ── Platform login (Super Admin) — identified by email, stored in super_admins ──
        if (identifier.includes("@")) {
          const sa = await prisma.superAdmin.findFirst({ where: { email: identifier } });
          if (!sa || !sa.active) return null;

          // Kunci akun sementara setelah percobaan gagal berturut-turut.
          if (sa.locked_until && sa.locked_until > new Date()) return null;

          const isPasswordValid = await bcrypt.compare(pw, sa.password_hash);
          if (!isPasswordValid) {
            const nextCount = sa.failed_login_count + 1;
            const lockMinutes = nextCount >= LOCKOUT_THRESHOLD ? Math.min(60, (nextCount - LOCKOUT_THRESHOLD + 1) * 15) : 0;
            await prisma.superAdmin.update({
              where: { id: sa.id },
              data: {
                failed_login_count: nextCount,
                locked_until: lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60_000) : sa.locked_until,
              },
            });
            return null;
          }

          resetRateLimit(rlKey);
          await prisma.superAdmin.update({
            where: { id: sa.id },
            data: { failed_login_count: 0, locked_until: null, last_login_at: new Date() },
          });
          return {
            id: sa.id,
            name: sa.name,
            role: "SUPER_ADMIN",
            roles: ["SUPER_ADMIN"],
            platform: true,
            subLevel: sa.role, // SUPER_ADMIN / SUPPORT / FINANCE
          };
        }

        const user = await prisma.user.findFirst({
          where: { username: identifier },
          include: {
            role: true,
            extra_roles: { include: { role: true } },
            tenant: { select: { status: true } },
          },
        });

        if (!user || !user.active) return null;

        // Tenant di-suspend / churned → semua user-nya tidak bisa login.
        if (user.tenant.status === "SUSPENDED" || user.tenant.status === "CHURNED") return null;

        // Kunci akun sementara setelah percobaan gagal berturut-turut.
        if (user.locked_until && user.locked_until > new Date()) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );

        if (!isPasswordValid) {
          const nextCount = user.failed_login_count + 1;
          // ≥5 gagal → kunci; durasi naik bertahap (15, 30, … maks 60 menit).
          const lockMinutes = nextCount >= LOCKOUT_THRESHOLD ? Math.min(60, (nextCount - LOCKOUT_THRESHOLD + 1) * 15) : 0;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failed_login_count: nextCount,
              locked_until: lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60_000) : user.locked_until,
            },
          });
          return null;
        }

        // Login sukses → reset counter & kunci.
        resetRateLimit(rlKey);
        await prisma.user.update({
          where: { id: user.id },
          data: { failed_login_count: 0, locked_until: null, last_login_at: new Date() },
        });

        // Build roles array: primary role + any extra roles
        const primaryRole = user.role.name;
        const extraRoleNames = user.extra_roles.map((ur) => ur.role.name);
        const allRoles = Array.from(new Set([primaryRole, ...extraRoleNames]));

        return {
          id: user.id,
          name: user.name,
          role: primaryRole,   // primary role (backward compat)
          roles: allRoles,     // all roles (new multi-role support)
          pwChangedAt: user.password_changed_at ? user.password_changed_at.getTime() : 0,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
});
