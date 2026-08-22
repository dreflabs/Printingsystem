import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const hostname = req.headers.get("host") || "";
  
  // Deteksi Subdomain (contoh: toko.printpilot.id atau toko.localhost:3000)
  // Abaikan WWW
  const cleanHostname = hostname.replace("www.", "");
  
  // Tentukan apakah ini root domain (printpilot.id atau localhost:3000)
  const isLocal = cleanHostname.includes("localhost");
  const rootDomain = isLocal ? "localhost:3000" : "printpilot.id";
  
  let tenantSlug = null;
  if (cleanHostname !== rootDomain) {
    tenantSlug = cleanHostname.replace(`.${rootDomain}`, "");
  }

  // Buat request headers baru untuk menyisipkan x-tenant-slug
  const requestHeaders = new Headers(req.headers);
  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
  }

  // Rewrite /marketing jika diakses dari root domain (printpilot.id)
  // Untuk sementara, jika root domain, kita biarkan saja (karena landing page akan dibuat nanti di page.tsx utama)
  // Jika tenantSlug ada, kita pastikan aplikasi tahu slug-nya dari header.

  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as any)?.role;

  // Protect dashboard routes
  if (nextUrl.pathname.startsWith("/api/auth") || nextUrl.pathname === "/login") {
    return NextResponse.next({
      request: { headers: requestHeaders }
    });
  }

  // Bypass auth check for frontend UI mockup since DB might not be ready yet
  if (!isLoggedIn) {
    // For mockup purposes, we allow bypassing so Rere can preview the UI.
    // Drefan should remove this bypass later.
    const url = nextUrl.clone();
    // return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
