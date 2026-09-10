/**
 * Salin teks ke clipboard dengan fallback.
 *
 * `navigator.clipboard` hanya ada di secure context (HTTPS atau
 * http://localhost). Kalau app diakses lewat IP LAN / hostname non-localhost
 * di atas HTTP polos, `navigator.clipboard` = undefined dan pemanggilan
 * `.writeText(...).then(...)` melempar TypeError — tombol "Salin" jadi diam.
 *
 * Urutan: Async Clipboard API → `document.execCommand("copy")` (textarea
 * sementara) → gagal. Mengembalikan `true` kalau berhasil supaya pemanggil
 * bisa menampilkan status.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* lanjut ke fallback */
    }
  }

  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
