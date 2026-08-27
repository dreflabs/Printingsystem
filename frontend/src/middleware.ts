import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

// Rute publik (tak butuh login)
const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password"];

// Prefix rute → role yang boleh mengakses
const ROUTE_ACCESS: { prefix: string; roles: string[] }[] = [
  { prefix: "/owner", roles: ["owner"] },
  { prefix: "/admin", roles: ["owner", "admin"] },
  { prefix: "/pos", roles: ["owner", "admin"] },
  { prefix: "/designer", roles: ["owner", "admin", "designer_sales"] },
  { prefix: "/operator", roles: ["owner", "admin", "operator"] },
  { prefix: "/finishing", roles: ["owner", "admin", "gudang", "operator"] },
  { prefix: "/scan", roles: ["owner", "admin", "operator", "gudang"] },
];

const HOME_BY_ROLE: Record<string, string> = {
  owner: "/owner",
  admin: "/admin",
  designer_sales: "/designer",
  operator: "/operator",
  gudang: "/finishing",
};

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

  if (path.startsWith("/api/auth") || path.startsWith("/print") || PUBLIC_PATHS.includes(path)) {
    return pass();
  }
  if (AUTH_BYPASS) return pass();

  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  if (!isLoggedIn) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  const rule = ROUTE_ACCESS.find((r) => path === r.prefix || path.startsWith(r.prefix + "/"));
  if (rule && role && !rule.roles.includes(role)) {
    return NextResponse.redirect(new URL(HOME_BY_ROLE[role] ?? "/", nextUrl));
  }

  return pass();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
