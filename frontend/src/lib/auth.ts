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

// Bentuk slug workspace yang sah (samakan dengan aturan di registerTenant).
const SLUG_RE = /^[a-z0-9]{3,30}$/;

/**
 * Tentukan workspace (tenant) mana yang dipakai untuk resolusi login.
 * Prioritas:
 *  1. Field "workspace" yang dikirim form login secara eksplisit.
 *  2. Header x-tenant-slug yang diinjeksi middleware saat diakses dari subdomain.
 * Nilai yang tidak berbentuk slug valid diabaikan.
 */
function resolveWorkspaceSlug(
  credentials: Partial<Record<"workspace", unknown>>,
  req: Request | undefined
): string | null {
  const fromForm = String(credentials.workspace ?? "").toLowerCase().trim();
  if (SLUG_RE.test(fromForm)) return fromForm;

  const fromHeader = (req?.headers.get("x-tenant-slug") ?? "").toLowerCase().trim();
  if (SLUG_RE.test(fromHeader)) return fromHeader;

  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        workspace: { label: "Workspace", type: "text", placeholder: "subdomain" },
        username: { label: "Username", type: "text", placeholder: "username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;
        const identifier = (credentials.username as string).trim();
        const pw = credentials.password as string;

        // Rem brute-force: maks. 10 percobaan / 15 menit per identifier.
        const rlKey = `login:${identifier.toLowerCase()}`;
        if (!rateLimit(rlKey, 10, 15 * 60_000).ok) return null;

        // ── Platform login (Super Admin) — identified by email, stored in super_admins ──
        // Hanya berlaku bila email tsb memang terdaftar sebagai Super Admin.
        // Jika bukan, jangan berhenti di sini — lanjut ke login user tenant (owner
        // yang login pakai email).
        if (identifier.includes("@")) {
          const sa = await prisma.superAdmin.findFirst({ where: { email: identifier } });
          if (sa) {
            if (!sa.active) return null;

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
        }

        // ── Login user tenant — WAJIB diketahui workspace-nya ──
        // username hanya unik per-tenant (@@unique([tenant_id, username])), jadi
        // pencarian global akan salah orang. Workspace diambil dari field form
        // login atau dari subdomain (header x-tenant-slug).
        const workspace = resolveWorkspaceSlug(credentials, req);
        if (!workspace) return null;

        const tenant = await prisma.tenant.findUnique({
          where: { slug: workspace },
          select: { id: true, status: true },
        });
        if (!tenant) return null;

        // Tenant di-suspend / churned → semua user-nya tidak bisa login.
        if (tenant.status === "SUSPENDED" || tenant.status === "CHURNED") return null;

        // Cari di dalam tenant tsb — cocokkan username ATAU email.
        const user = await prisma.user.findFirst({
          where: {
            tenant_id: tenant.id,
            OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
          },
          include: {
            role: true,
            extra_roles: { include: { role: true } },
          },
        });

        if (!user || !user.active) return null;

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
