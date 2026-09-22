import { prisma } from "@/lib/prisma";

const PAYMENT_SETTINGS_KEY = "payment.methods";

export interface PaymentSettings {
  /** Integrasi payment gateway (mis. Midtrans) aktif. */
  gatewayEnabled: boolean;
  /** Transfer bank manual aktif. */
  manualEnabled: boolean;
  /** Provider gateway terpilih; kosong = belum dipilih. */
  gatewayProvider: string;
  /** Instruksi tambahan yang tampil di halaman invoice tenant. */
  manualInstructions: string;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  gatewayEnabled: false,
  manualEnabled: true,
  gatewayProvider: "",
  manualInstructions:
    "Transfer sesuai nominal tagihan ke salah satu rekening di bawah ini, lalu unggah bukti pembayaran agar tim kami verifikasi.",
};

export const GATEWAY_PROVIDERS = [
  { key: "midtrans", label: "Midtrans", envKey: "MIDTRANS_SERVER_KEY" },
] as const;

/**
 * Integrasi payment gateway sengaja DIPENDING (keputusan 2026-09-21).
 * Sementara ini hanya pembayaran manual (transfer bank) yang dipakai.
 * Ubah ke `false` setelah Snap + webhook selesai dibangun dan diuji.
 */
export const GATEWAY_INTEGRATION_PENDING = true;

/**
 * Provider gateway dianggap siap hanya kalau integrasinya tidak dipending dan
 * kredensialnya ada di environment.
 */
export function isGatewayConfigured(provider: string): boolean {
  if (GATEWAY_INTEGRATION_PENDING) return false;
  const def = GATEWAY_PROVIDERS.find((p) => p.key === provider);
  if (!def) return false;
  return !!process.env[def.envKey];
}

/** Gateway hanya boleh dinyalakan kalau integrasinya sudah siap. */
export function canEnableGateway(provider: string): boolean {
  return !GATEWAY_INTEGRATION_PENDING && isGatewayConfigured(provider);
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const row = await prisma.platformSetting.findUnique({ where: { key: PAYMENT_SETTINGS_KEY } });
  if (!row) return { ...DEFAULT_PAYMENT_SETTINGS };
  try {
    const parsed = JSON.parse(row.value_json) as Partial<PaymentSettings>;
    return {
      gatewayEnabled: !!parsed.gatewayEnabled,
      manualEnabled: parsed.manualEnabled !== false,
      gatewayProvider: typeof parsed.gatewayProvider === "string" ? parsed.gatewayProvider : "",
      manualInstructions:
        typeof parsed.manualInstructions === "string" && parsed.manualInstructions.trim()
          ? parsed.manualInstructions
          : DEFAULT_PAYMENT_SETTINGS.manualInstructions,
    };
  } catch {
    return { ...DEFAULT_PAYMENT_SETTINGS };
  }
}

export async function savePaymentSettings(input: PaymentSettings): Promise<PaymentSettings> {
  const normalized: PaymentSettings = {
    gatewayEnabled: !!input.gatewayEnabled,
    manualEnabled: input.manualEnabled !== false,
    gatewayProvider: (input.gatewayProvider ?? "").trim(),
    manualInstructions: (input.manualInstructions ?? "").trim() || DEFAULT_PAYMENT_SETTINGS.manualInstructions,
  };
  await prisma.platformSetting.upsert({
    where: { key: PAYMENT_SETTINGS_KEY },
    create: { key: PAYMENT_SETTINGS_KEY, value_json: JSON.stringify(normalized) },
    update: { value_json: JSON.stringify(normalized) },
  });
  return normalized;
}

/** Rekening aktif untuk ditampilkan ke tenant, urut sesuai sort_order. */
export async function getActiveBankAccounts() {
  const rows = await prisma.bankAccount.findMany({
    where: { active: true },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
  });
  return rows.map((b) => ({
    id: b.id,
    bankName: b.bank_name,
    accountNumber: b.account_number,
    accountHolder: b.account_holder,
    label: b.label,
    notes: b.notes,
  }));
}

/** Metode pembayaran yang benar-benar bisa dipakai tenant saat ini. */
export async function getAvailablePaymentMethods() {
  const settings = await getPaymentSettings();
  const gatewayReady = settings.gatewayEnabled && isGatewayConfigured(settings.gatewayProvider);
  const manualReady = settings.manualEnabled;
  return { settings, gatewayReady, manualReady };
}
