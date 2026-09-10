import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Tag,
  Users,
  BarChart2,
  Store,
  BookOpen,
  ScanLine,
  Palette,
  Package,
} from "lucide-react";

export type UserRole = "admin" | "designer_sales" | "operator" | "gudang" | "owner";

export interface NavChild {
  label: string;
  href: string;
  roles: UserRole[];
}

export type NavEntry =
  | { type: "link"; label: string; href: string; icon: LucideIcon; roles: UserRole[] }
  | { type: "group"; label: string; icon: LucideIcon; roles: UserRole[]; children: NavChild[] };

/**
 * Navigasi operasional bergrup (kategori → sub-item), dipakai untuk Admin dan
 * Owner mode TIM. Grup hanya tampil kalau ada ≥1 anak yang cocok peran user;
 * grup dengan 1 anak dirender sebagai link biasa (tanpa accordion). Peran anak
 * dijaga ketat agar cakupan tiap peran sama seperti sebelum grouping.
 *
 * Saat modul baru ditambah (mis. Kas & Bank, Utang Supplier, Cuti & Izin,
 * Stok Opname), cukup tambahkan `children` di grup yang relevan — struktur
 * accordion muncul otomatis.
 */
export const GROUPED_NAV: NavEntry[] = [
  // Dashboard per peran (satu yang aktif sesuai peran user)
  { type: "link", label: "Dashboard", href: "/owner", icon: LayoutDashboard, roles: ["owner"] },
  { type: "link", label: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["admin"] },
  { type: "link", label: "Dashboard Desainer", href: "/designer", icon: Palette, roles: ["designer_sales"] },
  { type: "link", label: "Dashboard Operator", href: "/operator", icon: Factory, roles: ["operator"] },
  { type: "link", label: "Finishing & QC", href: "/finishing", icon: Package, roles: ["gudang"] },

  {
    type: "group",
    label: "Transaksi",
    icon: ShoppingCart,
    roles: ["admin", "owner"],
    children: [
      { label: "Kasir / POS", href: "/pos", roles: ["admin"] },
      // TODO(modul): Pengeluaran, Top Up Deposit, Closing Kasir
    ],
  },
  {
    type: "group",
    label: "Produksi",
    icon: Factory,
    roles: ["admin", "owner", "operator", "gudang"],
    children: [
      { label: "Pantau Produksi", href: "/admin/production", roles: ["admin", "owner"] },
      { label: "Scan QR", href: "/scan", roles: ["admin", "owner", "operator", "gudang"] },
    ],
  },
  {
    type: "group",
    label: "Katalog & Harga",
    icon: Tag,
    roles: ["admin"],
    children: [
      { label: "Produk & Mesin", href: "/admin/products", roles: ["admin"] },
      { label: "Database Pelanggan", href: "/admin/customers", roles: ["admin"] },
    ],
  },
  {
    type: "group",
    label: "Pegawai",
    icon: Users,
    roles: ["owner", "admin"],
    children: [
      { label: "Akun & Akses", href: "/owner/users", roles: ["owner"] },
      { label: "Absensi Pegawai", href: "/admin/attendance", roles: ["owner", "admin"] },
      { label: "Pengaturan Absensi", href: "/owner/attendance-settings", roles: ["owner"] },
      { label: "Gaji Pegawai", href: "/admin/payroll", roles: ["owner", "admin"] },
      // TODO(modul): Cuti & Izin, Lembur, Kasbon
    ],
  },
  {
    type: "group",
    label: "Laporan",
    icon: BarChart2,
    roles: ["owner", "admin"],
    children: [
      { label: "Laporan Operasional", href: "/admin/reports", roles: ["admin"] },
      { label: "Laporan Bulanan", href: "/owner/reports", roles: ["owner"] },
    ],
  },
  {
    type: "group",
    label: "Pengaturan Toko",
    icon: Store,
    roles: ["owner"],
    children: [
      { label: "Identitas & Kebijakan", href: "/owner/toko", roles: ["owner"] },
      { label: "Audit Log", href: "/audit-logs", roles: ["owner"] },
    ],
  },

  {
    type: "link",
    label: "Bantuan",
    href: "/bantuan",
    icon: BookOpen,
    roles: ["admin", "designer_sales", "operator", "gudang", "owner"],
  },
];

/** Navigasi rata mode SOLO (percetakan 1 orang) — tak perlu grup. */
export const SOLO_NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Beranda", href: "/beranda", icon: LayoutDashboard },
  { label: "Order", href: "/admin", icon: ShoppingCart },
  { label: "Produksi", href: "/admin/production", icon: Factory },
  { label: "Kasir", href: "/pos", icon: ShoppingCart },
  { label: "Katalog & Harga", href: "/admin/products", icon: Tag },
  { label: "Scan QR", href: "/scan", icon: ScanLine },
  { label: "Pegawai & Akses", href: "/owner/users", icon: Users },
  { label: "Bantuan", href: "/bantuan", icon: BookOpen },
];

export interface ResolvedLink {
  kind: "link";
  label: string;
  href: string;
  icon: LucideIcon;
}
export interface ResolvedGroup {
  kind: "group";
  label: string;
  icon: LucideIcon;
  children: { label: string; href: string }[];
}
export type ResolvedNav = ResolvedLink | ResolvedGroup;

/**
 * Saring GROUPED_NAV untuk sekumpulan peran:
 * - link: tampil kalau perannya cocok
 * - group: buang anak yang tak cocok; 0 anak → grup hilang; 1 anak → jadi link;
 *   ≥2 anak → tetap grup (accordion)
 */
export function resolveNav(roles: UserRole[]): ResolvedNav[] {
  const set = new Set(roles);
  const out: ResolvedNav[] = [];
  const seenHref = new Set<string>();

  for (const entry of GROUPED_NAV) {
    if (entry.type === "link") {
      if (!entry.roles.some((r) => set.has(r))) continue;
      if (seenHref.has(entry.href)) continue;
      seenHref.add(entry.href);
      out.push({ kind: "link", label: entry.label, href: entry.href, icon: entry.icon });
      continue;
    }
    if (!entry.roles.some((r) => set.has(r))) continue;
    const children = entry.children
      .filter((c) => c.roles.some((r) => set.has(r)) && !seenHref.has(c.href))
      .map((c) => ({ label: c.label, href: c.href }));
    if (children.length === 0) continue;
    children.forEach((c) => seenHref.add(c.href));
    if (children.length === 1) {
      out.push({ kind: "link", label: children[0].label, href: children[0].href, icon: entry.icon });
    } else {
      out.push({ kind: "group", label: entry.label, icon: entry.icon, children });
    }
  }
  return out;
}
