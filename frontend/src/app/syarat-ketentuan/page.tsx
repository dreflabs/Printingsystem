import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description: "Ketentuan penggunaan layanan Print Pilot: akun, langganan, pembayaran, dan tanggung jawab.",
  alternates: { canonical: "/syarat-ketentuan" },
};

const UPDATED = "8 September 2026";

export default function SyaratKetentuanPage() {
  return (
    <LegalShell title="Syarat & Ketentuan" updated={UPDATED}>
      {/* TODO: sesuaikan nama badan usaha pengelola & yurisdiksi sebelum publikasi resmi. */}
      <p>
        Dengan membuat akun atau menggunakan Print Pilot (&ldquo;Layanan&rdquo;), Anda setuju terikat pada ketentuan berikut.
        Bila Anda tidak setuju, mohon tidak menggunakan Layanan.
      </p>

      <div>
        <h2>1. Layanan</h2>
        <p>
          Print Pilot adalah aplikasi berbasis langganan untuk mengelola operasional percetakan: kasir &amp; order,
          produksi, bahan baku, penyimpanan, dan pelaporan. Fitur dapat berkembang atau berubah dari waktu ke waktu.
        </p>
      </div>

      <div>
        <h2>2. Akun</h2>
        <ul>
          <li>Anda bertanggung jawab menjaga kerahasiaan kredensial dan atas seluruh aktivitas pada akun Anda.</li>
          <li>Data yang Anda masukkan harus akurat dan Anda berhak menggunakannya.</li>
          <li>Pemilik akun (Owner) bertanggung jawab mengatur peran akses pegawainya.</li>
        </ul>
      </div>

      <div>
        <h2>3. Uji coba, langganan &amp; pembayaran</h2>
        <ul>
          <li>Uji coba gratis berlaku 14 hari, tanpa kartu kredit.</li>
          <li>Setelah masa uji coba, Layanan berbayar sesuai paket yang dipilih dan ditagih per bulan di muka.</li>
          <li>Anda dapat berhenti berlangganan kapan saja; Layanan tetap aktif hingga akhir periode yang sudah dibayar.</li>
          <li>Biaya yang sudah dibayar tidak dikembalikan kecuali diwajibkan hukum yang berlaku.</li>
          <li>Harga dapat berubah dengan pemberitahuan sebelumnya melalui aplikasi atau email.</li>
        </ul>
      </div>

      <div>
        <h2>4. Penggunaan yang dilarang</h2>
        <ul>
          <li>Menggunakan Layanan untuk kegiatan melanggar hukum atau melanggar hak pihak lain.</li>
          <li>Mencoba mengakses data penyewa lain, mengganggu, atau merekayasa balik sistem.</li>
          <li>Menyalahgunakan pengiriman notifikasi untuk spam.</li>
        </ul>
      </div>

      <div>
        <h2>5. Data Anda</h2>
        <p>
          Data operasional yang Anda masukkan tetap milik Anda. Pemrosesannya tunduk pada{" "}
          <a href="/kebijakan-privasi">Kebijakan Privasi</a>. Anda dapat mengekspor data tertentu selama akun aktif.
        </p>
      </div>

      <div>
        <h2>6. Ketersediaan &amp; batasan tanggung jawab</h2>
        <p>
          Kami berupaya menjaga Layanan tetap tersedia dan andal, namun Layanan disediakan &ldquo;sebagaimana adanya&rdquo;.
          Sepanjang diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan,
          atau kehilangan data akibat penggunaan atau ketidaktersediaan Layanan. Anda tetap bertanggung jawab
          memverifikasi angka penting (harga, stok, pembayaran) sesuai proses internal Anda.
        </p>
      </div>

      <div>
        <h2>7. Penghentian</h2>
        <p>
          Kami dapat menangguhkan atau menghentikan akun yang melanggar ketentuan ini. Anda dapat menghentikan akun
          kapan saja. Setelah penghentian, data dapat dihapus permanen setelah masa tenggang.
        </p>
      </div>

      <div>
        <h2>8. Perubahan ketentuan</h2>
        <p>Ketentuan ini dapat diperbarui. Perubahan material akan diinformasikan melalui aplikasi atau email, dan berlaku sejak tanggal yang dicantumkan.</p>
      </div>

      <div>
        <h2>9. Hukum yang berlaku</h2>
        <p>Ketentuan ini diatur oleh hukum Republik Indonesia.</p>
      </div>

      <div>
        <h2>10. Kontak</h2>
        <p>
          Pertanyaan tentang ketentuan ini: <a href="mailto:halo@printpilot.id">halo@printpilot.id</a>.
        </p>
      </div>
    </LegalShell>
  );
}
