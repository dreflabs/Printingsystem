import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as any)?.role;

  // Protect dashboard routes
  if (nextUrl.pathname.startsWith("/api/auth") || nextUrl.pathname === "/login") {
    return NextResponse.next();
  }

  // Bypass auth check for frontend UI mockup since DB might not be ready yet
  if (!isLoggedIn) {
    // For mockup purposes, we allow bypassing so Rere can preview the UI.
    // Drefan should remove this bypass later.
    const url = nextUrl.clone();
    // return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Basic RBAC Example (Disabled for Mockup)
  // const path = nextUrl.pathname;
  
  // // If operator tries to access /admin, block them
  // if (path.startsWith("/admin") && !["owner", "admin_sales", "supervisor"].includes(role)) {
  //   return NextResponse.redirect(new URL("/unauthorized", nextUrl));
  // }
  
  // if (path.startsWith("/designer") && !["owner", "designer_sales", "supervisor"].includes(role)) {
  //   return NextResponse.redirect(new URL("/unauthorized", nextUrl));
  // }

  // if (path.startsWith("/operator") && !["owner", "operator", "supervisor"].includes(role)) {
  //   return NextResponse.redirect(new URL("/unauthorized", nextUrl));
  // }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
