/**
 * Pesan error yang aman ditampilkan ke end-user.
 *
 * Action melempar `new Error("Order tidak ditemukan")` untuk pesan yang MEMANG
 * ingin dilihat user — itu diteruskan apa adanya. Tapi error tak terduga
 * (Prisma, TypeError, dsb) bocor detail internal (nama tabel, kolom, `tenant_id`
 * mentah, stack) → diganti pesan generik. Detail asli tetap di-`console.error`
 * di pemanggil untuk debugging server-side.
 */

const LEAK_MARKERS = [
  "prisma.",
  "PrismaClient",
  "invocation:",
  "Invalid `",
  "Unknown field",
  "Unknown arg",
  "Argument `",
  "Available options",
  "\n  at ",
  "node_modules",
  "SELECT ",
  "INSERT ",
  "relation ",
  "column ",
];

const LEAK_ERROR_NAMES = new Set([
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientValidationError",
  "PrismaClientInitializationError",
  "PrismaClientRustPanicError",
  "TypeError",
  "ReferenceError",
  "SyntaxError",
  "RangeError",
]);

export const GENERIC_ERROR = "Terjadi kesalahan. Coba muat ulang halaman.";

/**
 * @param e error yang ditangkap
 * @param fallback pesan pengganti bila `e` dianggap membocorkan internal
 */
export function safeError(e: unknown, fallback: string = GENERIC_ERROR): string {
  if (e instanceof Error) {
    const msg = (e.message ?? "").trim();
    const leaky =
      !msg ||
      msg.length > 180 ||
      msg.includes("\n") ||
      LEAK_ERROR_NAMES.has(e.name) ||
      LEAK_MARKERS.some((m) => msg.includes(m));
    if (!leaky) return msg;
  }
  return fallback;
}
