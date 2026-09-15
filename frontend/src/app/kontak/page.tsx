import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Kontak",
  description: "Hubungi tim Print Pilot untuk pertanyaan produk, demo, atau bantuan langganan software manajemen percetakan.",
  alternates: { canonical: "/kontak" },
};

export default function KontakPage() {
  return (
    <LegalShell title="Hubungi Kami">
      <p>
        Print Pilot dikembangkan dan dioperasikan oleh <b>PT DEMA DIGITAL ASIA</b>. Ada pertanyaan tentang
        produk, ingin demo, atau butuh bantuan langganan? Tim kami siap membantu.
      </p>

      <div>
        <h2>Perusahaan</h2>
        <p>
          PT DEMA DIGITAL ASIA
          <br />
          Sukabumi, Jawa Barat, Indonesia
        </p>
      </div>

      <div>
        <h2>Email</h2>
        {/* TODO: pastikan alamat email di bawah sudah aktif sebelum publikasi */}
        <p>
          Umum &amp; penjualan: <a href="mailto:halo@printpilot.id">halo@printpilot.id</a>
          <br />
          Dukungan pelanggan: <a href="mailto:dukungan@printpilot.id">dukungan@printpilot.id</a>
        </p>
      </div>

      <div>
        <h2>Jam layanan</h2>
        <p>Senin&ndash;Jumat, 09.00&ndash;17.00 WIB. Layanan beroperasi sepenuhnya secara daring.</p>
      </div>

      <div>
        <h2>Coba dulu tanpa bicara dengan sales</h2>
        <p>
          Anda bisa langsung mendaftar dan memakai Print Pilot gratis selama 14 hari tanpa kartu kredit.{" "}
          <Link href="/register">Buat akun</Link>.
        </p>
      </div>
    </LegalShell>
  );
}
