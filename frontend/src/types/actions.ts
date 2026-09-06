/**
 * Kontrak standar untuk semua Server Action (Drefan → Rere).
 *
 * Setiap action WAJIB mengembalikan bentuk ini supaya frontend bisa
 * menangani sukses/gagal secara seragam:
 *
 *   const res = await createPrintingOrder(form);
 *   if (!res.success) return toast.error(res.error);
 *   router.push(`/admin/orders/${res.data.id}`);
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

/** Helper pembungkus di sisi server. */
export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { success: false, error, fieldErrors };
}
