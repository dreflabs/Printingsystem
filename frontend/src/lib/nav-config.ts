import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Clock3,
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
  CreditCard,
} from "lucide-react";

export type UserRole = "admin" | "designer_sales" | "operator" | "gudang" | "owner";

export interface NavChild {
  label: string;
  href: string;
  roles: UserRole[];
  /** Kunci entitlement yang dibutuhkan agar item tampil (lihat lib/entitlements.ts). */
  feature?: string;
}

export type NavEntry =
  | { type: "link"; label: string; href: string; icon: LucideIcon; roles: UserRole[]; feature?: string }
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
  { type: "link", label: "Absensi Saya", href: "/admin#absensi", icon: Clock3, roles: ["admin"], feature: "hrm" },
  { type: "link", label: "Absensi Saya", href: "/designer#absensi", icon: Clock3, roles: ["designer_sales"], feature: "hrm" },
  { type: "link", label: "Dashboard Operator", href: "/operator", icon: Factory, roles: ["operator"] },
  { type: "link", label: "Absensi Saya", href: "/operator#absensi", icon: Clock3, roles: ["operator"], feature: "hrm" },
  { type: "link", label: "Finishing & QC", href: "/finishing", icon: Package, roles: ["gudang"], feature: "storage" },
  { type: "link", label: "Material & Stok", href: "/finishing#material", icon: Package, roles: ["gudang"], feature: "inventory" },
  { type: "link", label: "Absensi Saya", href: "/finishing#absensi", icon: Clock3, roles: ["gudang"], feature: "hrm" },

  {
    type: "group",
    label: "Transaksi",
    icon: ShoppingCart,
    roles: ["admin", "owner"],
    children: [
      { label: "Kasir / POS", href: "/pos", roles: ["admin"], feature: "pos" },
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
      // Pintasan ke modul gudang (QC, storage, material) untuk Owner/Admin —
      // sebelumnya hanya bisa dijangkau dengan berpindah ke tampilan role Gudang.
      { label: "Gudang & Finishing", href: "/finishing", roles: ["admin", "owner"], feature: "storage" },
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
      { label: "Absensi Pegawai", href: "/admin/attendance", roles: ["owner", "admin"], feature: "hrm" },
      { label: "Pengaturan Absensi", href: "/owner/attendance-settings", roles: ["owner"], feature: "hrm" },
      { label: "Gaji Pegawai", href: "/admin/payroll", roles: ["owner", "admin"], feature: "hrm" },
      // TODO(modul): Cuti & Izin, Lembur, Kasbon
    ],
  },
  {
    type: "group",
    label: "Laporan",
    icon: BarChart2,
    roles: ["owner", "admin"],
    children: [
      { label: "Laporan Operasional", href: "/admin/reports", roles: ["admin"], feature: "reports" },
      { label: "Laporan Bulanan", href: "/owner/reports", roles: ["owner"], feature: "reports_finance" },
    ],
  },
  {
    type: "group",
    label: "Pengaturan Toko",
    icon: Store,
    roles: ["owner"],
    children: [
      { label: "Identitas & Kebijakan", href: "/owner/toko", roles: ["owner"] },
      { label: "Paket & Tagihan", href: "/owner/billing", roles: ["owner"] },
      { label: "Audit Log", href: "/audit-logs", roles: ["owner"], feature: "audit_trail" },
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

/**
 * Navigasi rata mode SOLO (percetakan 1 orang) — tak perlu grup, tetapi tetap
 * LENGKAP: semua halaman yang dibutuhkan operator tunggal harus bisa dijangkau.
 * `feature` opsional dipakai untuk menyembunyikan item yang tidak ada di paket
 * (sama seperti penyaringan navigasi tim).
 */
export const SOLO_NAV: { label: string; href: string; icon: LucideIcon; feature?: string }[] = [
  { label: "Beranda", href: "/beranda", icon: LayoutDashboard },
  { label: "Order", href: "/admin", icon: ShoppingCart },
  { label: "Produksi", href: "/admin/production", icon: Factory },
  { label: "Scan QR", href: "/scan", icon: ScanLine },
  { label: "Kasir", href: "/pos", icon: ShoppingCart, feature: "pos" },
  { label: "Gudang & Finishing", href: "/finishing", icon: Package, feature: "storage" },
  { label: "Katalog & Harga", href: "/admin/products", icon: Tag },
  { label: "Pelanggan", href: "/admin/customers", icon: Users },
  { label: "Laporan", href: "/admin/reports", icon: BarChart2, feature: "reports" },
  { label: "Pegawai & Akses", href: "/owner/users", icon: Users },
  { label: "Absensi & Gaji", href: "/admin/payroll", icon: Clock3, feature: "hrm" },
  { label: "Audit Log", href: "/audit-logs", icon: BookOpen, feature: "audit_trail" },
  { label: "Pengaturan Toko", href: "/owner/toko", icon: Store },
  { label: "Paket & Tagihan", href: "/owner/billing", icon: CreditCard },
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
 * Dashboard utama tiap peran. Dipakai role switcher (label + href) sekaligus
 * untuk menentukan "mode aktif" dari pathname yang sedang dibuka.
 */
export const DASHBOARD_ROLE_PATHS: { role: UserRole; path: string; label: string }[] = [
  { role: "owner", path: "/owner", label: "Owner" },
  { role: "admin", path: "/admin", label: "Admin" },
  { role: "designer_sales", path: "/designer", label: "Designer/Setting" },
  { role: "operator", path: "/operator", label: "Operator Cetak" },
  { role: "gudang", path: "/finishing", label: "Finishing & Gudang" },
];

/**
 * Peran yang sedang dilihat berdasarkan pathname — TETAPI hanya bila akun
 * memang memegang peran itu; kalau tidak, jatuh ke peran utama.
 *
 * Owner (dan peran yang diizinkan middleware lain) boleh membuka dashboard
 * peran lain untuk pengawasan. Tanpa penjagaan ini sidebar ikut "menyamar"
 * sebagai peran tersebut dan menampilkan menunya, seolah akun masih memegang
 * peran yang sudah dicabut.
 */
export function resolveActiveRole(
  pathname: string,
  roles: readonly string[],
  primaryRole: UserRole,
): UserRole {
  const match = DASHBOARD_ROLE_PATHS.find(
    (p) => pathname === p.path || pathname.startsWith(p.path + "/"),
  );
  return match && roles.includes(match.role) ? match.role : primaryRole;
}

/**
 * Saring GROUPED_NAV untuk sekumpulan peran:
 * - link: tampil kalau perannya cocok dan entitlement-nya ada
 * - group: buang anak yang tak cocok; 0 anak → grup hilang; 1 anak → jadi link;
 *   ≥2 anak → tetap grup (accordion)
 *
 * `features` opsional: kalau tidak diberikan (mis. gagal dimuat), semua item
 * yang cocok peran tetap tampil supaya navigasi tidak pernah kosong.
 */
export function resolveNav(roles: UserRole[], features?: ReadonlySet<string>): ResolvedNav[] {
  const set = new Set(roles);
  const hasFeature = (feature?: string) => !feature || !features || features.has(feature);
  const out: ResolvedNav[] = [];
  const seenHref = new Set<string>();

  for (const entry of GROUPED_NAV) {
    if (entry.type === "link") {
      if (!entry.roles.some((r) => set.has(r))) continue;
      if (!hasFeature(entry.feature)) continue;
      if (seenHref.has(entry.href)) continue;
      seenHref.add(entry.href);
      out.push({ kind: "link", label: entry.label, href: entry.href, icon: entry.icon });
      continue;
    }
    if (!entry.roles.some((r) => set.has(r))) continue;
    const children = entry.children
      .filter((c) => c.roles.some((r) => set.has(r)) && hasFeature(c.feature) && !seenHref.has(c.href))
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
