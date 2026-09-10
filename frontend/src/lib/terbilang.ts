/**
 * Angka → kata (Bahasa Indonesia). Untuk kwitansi.
 *   terbilang(96000)   → "sembilan puluh enam ribu"
 *   terbilang(1500000) → "satu juta lima ratus ribu"
 * Menangani 0..999_999_999_999_999. Nilai negatif → diawali "minus".
 * Angka non-bulat dibulatkan (domain PRINT PILOT = rupiah utuh).
 */
const SATUAN = [
  "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
  "sepuluh", "sebelas",
];

function tigaDigit(n: number): string {
  if (n === 0) return "";
  let s = "";
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  if (ratus === 1) s += "seratus";
  else if (ratus > 1) s += `${SATUAN[ratus]} ratus`;
  if (sisa > 0) {
    if (s) s += " ";
    if (sisa < 12) {
      s += SATUAN[sisa];
    } else if (sisa < 20) {
      s += `${SATUAN[sisa - 10]} belas`;
    } else {
      const puluh = Math.floor(sisa / 10);
      const satu = sisa % 10;
      s += `${SATUAN[puluh]} puluh`;
      if (satu > 0) s += ` ${SATUAN[satu]}`;
    }
  }
  return s;
}

const TINGKAT = ["", "ribu", "juta", "miliar", "triliun"];

export function terbilang(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "nol";

  const neg = value < 0;
  const parts: string[] = [];
  let tingkat = 0;
  while (n > 0) {
    const grp = n % 1000;
    if (grp > 0) {
      let frag: string;
      if (tingkat === 1 && grp === 1) {
        frag = "seribu";
      } else {
        frag = `${tigaDigit(grp)}${TINGKAT[tingkat] ? " " + TINGKAT[tingkat] : ""}`;
      }
      parts.unshift(frag);
    }
    n = Math.floor(n / 1000);
    tingkat++;
  }
  const words = parts.join(" ").replace(/\s+/g, " ").trim();
  return neg ? `minus ${words}` : words;
}

/** "sembilan puluh enam ribu rupiah" (huruf pertama kapital). */
export function terbilangRupiah(value: number): string {
  const w = `${terbilang(value)} rupiah`;
  return w.charAt(0).toUpperCase() + w.slice(1);
}
