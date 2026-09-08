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
        Ada pertanyaan tentang produk, ingin demo, atau butuh bantuan langganan? Tim kami siap membantu.
      </p>

      <div>
        <h2>Email</h2>
        {/* TODO: ganti dengan alamat email dukungan yang aktif */}
        <p>
          Umum &amp; penjualan: <a href="mailto:halo@printpilot.id">halo@printpilot.id</a>
          <br />
          Dukungan pelanggan: <a href="mailto:dukungan@printpilot.id">dukungan@printpilot.id</a>
        </p>
      </div>

      <div>
        <h2>WhatsApp</h2>
        {/* TODO: ganti dengan nomor WhatsApp bisnis yang aktif */}
        <p>
          Chat tim penjualan &amp; dukungan pada jam kerja (Sen–Jum, 09.00–17.00 WIB).
          Nomor WhatsApp resmi akan dicantumkan di sini.
        </p>
      </div>

      <div>
        <h2>Lokasi</h2>
        <p>Jakarta, Indonesia — layanan beroperasi sepenuhnya secara daring.</p>
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
