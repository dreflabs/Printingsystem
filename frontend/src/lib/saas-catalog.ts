/**
 * Sumber kebenaran katalog SaaS untuk beta dan self-serve signup.
 *
 * Tiga paket self-serve (Starter/Pro/Business) mengikuti struktur pasar
 * kompetitor. Enterprise tetap melalui Sales sehingga tidak masuk ke form
 * registrasi maupun halaman harga self-serve.
 *
 * Tidak ada free trial (dihapus 2026-09-21): tenant baru berstatus UNPAID
 * sampai invoice pertamanya dibayar dan diverifikasi.
 */
export const PAYMENT_DUE_DAYS = 3;

/**
 * Fitur yang aktif di SEMUA paket self-serve. Ditampilkan sebagai satu baris
 * "Termasuk di semua paket" di halaman harga supaya nilai Starter tidak
 * terlihat lebih kecil daripada kenyataan.
 */
export const ALL_PLAN_INCLUDES = [
  "Kanban produksi real-time",
  "Dashboard terpisah per peran",
  "Nota online & riwayat pelanggan",
  "Database pelanggan + harga makloon",
  "Notifikasi WhatsApp pelanggan",
  "Peringatan deadline, stok & job macet",
] as const;

export const SAAS_PLANS = {
  starter: {
    name: "Starter",
    slug: "starter",
    tagline: "Cocok untuk copy center & percetakan baru",
    price_monthly: 199000,
    max_users: 3,
    max_orders_per_month: 200,
    // "qc", "storage", "audit_trail", "hrm", "inventory", "layout", dan
    // "purchase_orders" sengaja TIDAK diberikan ke Starter (lihat
    // 13-SAAS/SAAS-MODEL.md). Naik ke Pro/Business untuk membukanya.
    features: ["dashboard", "kanban", "pos", "reports"],
    highlights: [
      "Maksimal 3 Pengguna",
      "200 Pesanan per bulan",
      "Kasir POS & Order Cetak",
      "Laporan Operasional Harian",
      "Dukungan via Email",
    ],
    roadmap: [],
    tenantPlan: "STARTER",
  },
  pro: {
    name: "Pro",
    slug: "pro",
    tagline: "Untuk percetakan berkembang",
    price_monthly: 399000,
    max_users: 5,
    max_orders_per_month: null,
    features: [
      "dashboard",
      "kanban",
      "pos",
      "reports",
      "qc",
      "storage",
      "audit_trail",
      "hrm",
      "inventory",
      "layout",
      "reports_finance",
      "whatsapp_unlimited",
    ],
    highlights: [
      "Maksimal 5 Pengguna",
      "Pesanan tanpa batas",
      "QC & Rework + QR Tracking",
      "Manajemen Gudang, Pickup & Stok Bahan",
      "Inventory Material + Waste & Costing",
      "Laporan Keuangan Lengkap",
      "Audit Trail & Anti-Fraud",
      "Absensi & Gaji Pegawai",
      "Smart Layout Calculator",
    ],
    roadmap: ["Notifikasi WhatsApp Unlimited (API)"],
    tenantPlan: "PRO",
  },
  business: {
    name: "Business",
    slug: "business",
    tagline: "Untuk percetakan multi-tim & grosir",
    price_monthly: 799000,
    max_users: 10,
    max_orders_per_month: null,
    features: [
      "dashboard",
      "kanban",
      "pos",
      "reports",
      "qc",
      "storage",
      "audit_trail",
      "hrm",
      "inventory",
      "layout",
      "reports_finance",
      "whatsapp_unlimited",
      "purchase_orders",
      // "api" sengaja BELUM diberikan: integrasinya masih roadmap ("Segera
      // hadir" di kartu paket). Tambahkan kembali di sini saat endpoint publik
      // dan API key benar-benar tersedia.
    ],
    highlights: [
      "Maksimal 10 Pengguna",
      "Semua fitur Pro",
      "Purchase Order & Supplier",
      "Dukungan Prioritas (WA)",
    ],
    roadmap: ["Integrasi API", "Kuota WhatsApp lebih besar"],
    tenantPlan: "BUSINESS",
  },
} as const;

export type SelfServePlanKey = keyof typeof SAAS_PLANS;

export const SELF_SERVE_PLAN_KEYS = Object.keys(SAAS_PLANS) as SelfServePlanKey[];

/**
 * Add-on kursi (user) tambahan. Harga sengaja disetara dengan selisih
 * Business - Pro (Rp400 rb untuk 5 kursi = Rp80 rb/kursi) supaya menambah
 * kursi tidak lebih murah daripada naik paket — mencegah kanibalisasi upgrade.
 */
export const ADDON_SEAT_PRICE_MONTHLY = 80000;
export const MAX_ADDON_SEATS = 50;

/**
 * Pilihan durasi berlangganan. Hanya 12 bulan yang diberi diskon, sesuai
 * janji di 13-SAAS/SAAS-MODEL.md: "bayar 10 bulan, gratis 2 bulan".
 */
export const SUBSCRIPTION_TERMS = [
  { months: 1, paidMonths: 1, label: "Bulanan", badge: "", description: "Fleksibel, tanpa komitmen jangka panjang." },
  { months: 3, paidMonths: 3, label: "3 Bulan", badge: "", description: "Cukup untuk menguji kestabilan sistem." },
  { months: 6, paidMonths: 6, label: "6 Bulan", badge: "REKOMENDASI", description: "Pas untuk bisnis yang sudah berjalan stabil." },
  { months: 12, paidMonths: 10, label: "12 Bulan", badge: "PALING HEMAT", description: "Bayar 10 bulan, gratis 2 bulan (hemat ~17%)." },
] as const;

export type TermMonths = (typeof SUBSCRIPTION_TERMS)[number]["months"];

/**
 * Layanan tambahan (jasa). `listPrice` adalah harga normal; selama masa promo
 * layanan ini diberikan gratis sehingga ditampilkan dicoret.
 */
export const SERVICE_OPTIONS = [
  {
    key: "training_online",
    name: "Instalasi & Training Online",
    listPrice: 1500000,
    description: "Setup database awal + 3 sesi online, 2 jam per sesi.",
    promoFree: true,
  },
  {
    key: "training_onsite",
    name: "Instalasi & Training Onsite",
    listPrice: 3500000,
    description: "Kunjungan langsung + 2 hari pendampingan. Belum termasuk transport & akomodasi.",
    promoFree: true,
  },
] as const;

export type ServiceKey = (typeof SERVICE_OPTIONS)[number]["key"];

/** Promo: seluruh layanan tambahan gratis selama masa promo Print Pilot. */
export const SERVICE_PROMO_ACTIVE = true;

/**
 * Parameter komersial yang bisa diubah Super Admin tanpa deploy.
 * Angka default di bawah dipakai sebagai fallback bila pengaturan di DB kosong.
 */
export interface PricingTermConfig {
  months: TermMonths;
  paidMonths: number;
}

export interface PricingServiceConfig {
  key: ServiceKey;
  listPrice: number;
  promoFree: boolean;
}

export interface PricingConfig {
  seatPriceMonthly: number;
  maxSeats: number;
  paymentDueDays: number;
  terms: PricingTermConfig[];
  services: PricingServiceConfig[];
  servicePromoActive: boolean;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  seatPriceMonthly: ADDON_SEAT_PRICE_MONTHLY,
  maxSeats: MAX_ADDON_SEATS,
  paymentDueDays: PAYMENT_DUE_DAYS,
  terms: SUBSCRIPTION_TERMS.map((t) => ({ months: t.months, paidMonths: t.paidMonths })),
  services: SERVICE_OPTIONS.map((s) => ({ key: s.key, listPrice: s.listPrice, promoFree: s.promoFree })),
  servicePromoActive: SERVICE_PROMO_ACTIVE,
};

export interface OrderLine {
  kind: "PLAN" | "ADDON_SEATS" | "SERVICE";
  label: string;
  detail?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  free?: boolean;
}

export interface OrderEstimate {
  months: number;
  paidMonths: number;
  addonSeats: number;
  services: ServiceKey[];
  lines: OrderLine[];
  planSubtotal: number;
  addonSubtotal: number;
  serviceListTotal: number;
  serviceSubtotal: number;
  total: number;
}

export function resolveTerm(months: unknown, terms: PricingTermConfig[] = DEFAULT_PRICING_CONFIG.terms): TermMonths {
  const n = Number(months);
  return (terms.find((t) => t.months === n)?.months ?? 1) as TermMonths;
}

export function resolveAddonSeats(value: unknown, maxSeats: number = MAX_ADDON_SEATS): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, maxSeats);
}

export function resolveServices(value: unknown, services: PricingServiceConfig[] = DEFAULT_PRICING_CONFIG.services): ServiceKey[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(services.map((s) => s.key));
  return value.filter((v): v is ServiceKey => typeof v === "string" && allowed.has(v));
}

/**
 * Hitung rincian pesanan. `pricing` membawa parameter komersial yang bisa
 * diubah Super Admin; `planPriceMonthly` menimpa harga paket katalog dengan
 * harga baris `SubscriptionPlan` (sumber kebenaran penagihan).
 */
export function computeOrderEstimate(input: {
  plan: SelfServePlanKey;
  months?: unknown;
  addonSeats?: unknown;
  services?: unknown;
  pricing?: PricingConfig;
  planPriceMonthly?: number | null;
}): OrderEstimate {
  const planDef = SAAS_PLANS[input.plan];
  const cfg = input.pricing ?? DEFAULT_PRICING_CONFIG;
  const months = resolveTerm(input.months, cfg.terms);
  const term = cfg.terms.find((t) => t.months === months) ?? cfg.terms[0] ?? { months: 1, paidMonths: 1 };
  const addonSeats = resolveAddonSeats(input.addonSeats, cfg.maxSeats);
  const services = resolveServices(input.services, cfg.services);
  const seatPrice = Math.max(0, Number(cfg.seatPriceMonthly) || 0);
  const planPrice = Math.max(0, Number(input.planPriceMonthly ?? planDef.price_monthly) || 0);

  const planSubtotal = planPrice * term.paidMonths;
  const addonSubtotal = addonSeats * seatPrice * term.paidMonths;
  const serviceCfg = new Map(cfg.services.map((s) => [s.key, s]));
  const selectedServices = SERVICE_OPTIONS.filter((s) => services.includes(s.key));
  const servicePricing = selectedServices.map((s) => {
    const listPrice = Math.max(0, serviceCfg.get(s.key)?.listPrice ?? s.listPrice);
    // Flag `promoFree` per layanan hanya berlaku saat promo global aktif.
    const free = cfg.servicePromoActive && (serviceCfg.get(s.key)?.promoFree ?? s.promoFree);
    return { service: s, listPrice, free };
  });
  const serviceListTotal = servicePricing.reduce((sum, x) => sum + x.listPrice, 0);
  const serviceSubtotal = servicePricing.reduce((sum, x) => sum + (x.free ? 0 : x.listPrice), 0);

  const lines: OrderLine[] = [
    {
      kind: "PLAN",
      label: `Paket ${planDef.name}`,
      detail: term.paidMonths < term.months
        ? `${term.months} bulan — bayar ${term.paidMonths} bulan`
        : `${term.months} bulan`,
      quantity: 1,
      unitPrice: planSubtotal,
      amount: planSubtotal,
    },
  ];

  if (addonSeats > 0) {
    lines.push({
      kind: "ADDON_SEATS",
      label: "Kursi user tambahan",
      detail: `${addonSeats} user x Rp${seatPrice.toLocaleString("id-ID")}/bulan x ${term.paidMonths} bulan`,
      quantity: addonSeats,
      unitPrice: seatPrice * term.paidMonths,
      amount: addonSubtotal,
    });
  }

  for (const { service: s, listPrice, free } of servicePricing) {
    lines.push({
      kind: "SERVICE",
      label: s.name,
      detail: free ? "Gratis selama masa promo" : s.description,
      quantity: 1,
      unitPrice: listPrice,
      amount: free ? 0 : listPrice,
      free,
    });
  }

  return {
    months,
    paidMonths: term.paidMonths,
    addonSeats,
    services,
    lines,
    planSubtotal,
    addonSubtotal,
    serviceListTotal,
    serviceSubtotal,
    total: planSubtotal + addonSubtotal + serviceSubtotal,
  };
}

export function isSelfServePlanKey(value: unknown): value is SelfServePlanKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SAAS_PLANS, value);
}

export function resolveSelfServePlan(value: unknown): SelfServePlanKey {
  return isSelfServePlanKey(value) ? value : "starter";
}

export function planFeaturesJson(plan: SelfServePlanKey): string {
  return JSON.stringify(SAAS_PLANS[plan].features);
}
