import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Rute publik (tak butuh login)
const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/platform/login"];

// Halaman auth: user yang sudah login tidak perlu melihatnya lagi.
// "/" disertakan agar user yang baru login (callbackUrl default) tidak nyangkut di homepage.
const AUTH_PAGES = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/platform/login"];

// Prefix rute → role yang boleh mengakses
const ROUTE_ACCESS: { prefix: string; roles: string[] }[] = [
  { prefix: "/owner", roles: ["owner"] },
  { prefix: "/admin", roles: ["owner", "admin"] },
  { prefix: "/pos", roles: ["owner", "admin"] },
  { prefix: "/designer", roles: ["owner", "admin", "designer_sales"] },
  { prefix: "/operator", roles: ["owner", "admin", "operator"] },
  { prefix: "/finishing", roles: ["owner", "admin", "gudang", "operator"] },
  { prefix: "/scan", roles: ["owner", "admin", "operator", "gudang"] },
  { prefix: "/audit-logs", roles: ["owner", "admin"] },
];

// Priority order: highest-access role wins for default redirect
const ROLE_PRIORITY = ["owner", "admin", "designer_sales", "operator", "gudang"];

const HOME_BY_ROLE: Record<string, string> = {
  owner: "/owner",
  admin: "/admin",
  designer_sales: "/designer",
  operator: "/operator",
  gudang: "/finishing",
};

/**
 * Determines the best home dashboard for a user with potentially multiple roles.
 * Picks the highest-priority role from their roles array.
 */
function getHomeForRoles(roles: string[]): string {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return HOME_BY_ROLE[role] ?? "/";
  }
  return "/";
}

// Selama frontend masih preview tanpa DB: set AUTH_BYPASS=1 di .env.
// Hapus flag (atau set 0) untuk mengaktifkan RBAC penuh.
const AUTH_BYPASS = process.env.AUTH_BYPASS === "1";

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const hostname = (req.headers.get("host") || "").replace("www.", "");

  const isLocal = hostname.includes("localhost");
  const rootDomain = isLocal ? "localhost:3000" : "printpilot.id";
  const tenantSlug = hostname !== rootDomain ? hostname.replace(`.${rootDomain}`, "") : null;

  const requestHeaders = new Headers(req.headers);
  if (tenantSlug) requestHeaders.set("x-tenant-slug", tenantSlug);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  const isLoggedIn = !!req.auth;
  const isPlatform = (req.auth?.user as { platform?: boolean } | undefined)?.platform === true;

  // Sudah login tapi membuka halaman auth → arahkan ke dashboard yang sesuai.
  if (isLoggedIn && AUTH_PAGES.includes(path)) {
    if (isPlatform) return NextResponse.redirect(new URL("/platform", nextUrl));
    const roles: string[] = (req.auth?.user as { roles?: string[]; role?: string } | undefined)?.roles
      ?? ((req.auth?.user as { role?: string } | undefined)?.role ? [(req.auth!.user as { role?: string }).role!] : []);
    return NextResponse.redirect(new URL(getHomeForRoles(roles), nextUrl));
  }

  // /api/jobs/* punya auth sendiri (Bearer JOBS_SECRET) — dipanggil cron eksternal, bukan sesi.
  if (
    path.startsWith("/api/auth") ||
    path.startsWith("/api/jobs") ||
    path.startsWith("/print") ||
    PUBLIC_PATHS.includes(path)
  ) {
    return pass();
  }

  // ── Platform (Super Admin) area — never bypassed ──
  if (path.startsWith("/platform")) {
    if (!isLoggedIn) {
      const url = new URL("/platform/login", nextUrl);
      url.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(url);
    }
    if (!isPlatform) return NextResponse.redirect(new URL("/login", nextUrl));
    return pass();
  }

  if (AUTH_BYPASS) return pass();

  // Support both old single-role and new multi-role tokens
  const primaryRole = (req.auth?.user as { role?: string } | undefined)?.role;
  const userRoles: string[] = (req.auth?.user as { roles?: string[] } | undefined)?.roles
    ?? (primaryRole ? [primaryRole] : []);

  if (!isLoggedIn) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // Platform user on tenant routes: allowed only while impersonating; otherwise send home.
  if (isPlatform && !req.cookies.get("pp_impersonate")) {
    return NextResponse.redirect(new URL("/platform", nextUrl));
  }

  // Multi-role RBAC: allow if ANY of the user's roles is in the allowed list
  const rule = ROUTE_ACCESS.find((r) => path === r.prefix || path.startsWith(r.prefix + "/"));
  if (rule && userRoles.length > 0 && !userRoles.some((r) => rule.roles.includes(r))) {
    return NextResponse.redirect(new URL(getHomeForRoles(userRoles), nextUrl));
  }

  return pass();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
