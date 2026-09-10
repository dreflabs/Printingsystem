import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = process.env.APP_URL || "https://printpilot.id";
const SITE_NAME = "Print Pilot";
const DESCRIPTION =
  "Software manajemen percetakan berbasis cloud: kasir & order, kanban produksi, potong stok bahan otomatis, dan notifikasi WhatsApp. Uji coba gratis 14 hari.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Print Pilot — Software Manajemen Percetakan & Kasir Produksi",
    template: "%s | Print Pilot",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "software percetakan",
    "aplikasi percetakan",
    "sistem manajemen percetakan",
    "aplikasi kasir percetakan",
    "manajemen order cetak",
    "software digital printing",
    "aplikasi produksi percetakan",
    "kanban produksi percetakan",
    "manajemen bahan baku percetakan",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Print Pilot — Software Manajemen Percetakan & Kasir Produksi",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Print Pilot — Software Manajemen Percetakan & Kasir Produksi",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "business software",
};

export const viewport: Viewport = {
  themeColor: "#0492B2",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${inter.variable} h-full antialiased dark`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
