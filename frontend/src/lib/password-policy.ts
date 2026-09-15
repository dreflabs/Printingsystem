/** Satu kebijakan password untuk registrasi, reset, dan force-change tenant. */
export const TENANT_PASSWORD_MIN_LENGTH = 12;
export const TENANT_PASSWORD_MAX_BYTES = 72;

export function validateTenantPassword(password: string): string | null {
  if (!password || password.length < TENANT_PASSWORD_MIN_LENGTH) {
    return `Kata sandi minimal ${TENANT_PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (new TextEncoder().encode(password).length > TENANT_PASSWORD_MAX_BYTES) {
    return `Kata sandi maksimal ${TENANT_PASSWORD_MAX_BYTES} byte.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Kata sandi harus mengandung huruf dan angka.";
  }
  return null;
}
