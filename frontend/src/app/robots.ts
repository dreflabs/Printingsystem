import type { MetadataRoute } from "next";

const SITE_URL = process.env.APP_URL || "https://printpilot.id";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Area aplikasi & auth tidak perlu diindeks.
      disallow: [
        "/owner",
        "/admin",
        "/designer",
        "/operator",
        "/finishing",
        "/pos",
        "/scan",
        "/audit-logs",
        "/bantuan",
        "/ganti-sandi",
        "/platform",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/print",
        "/api",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
