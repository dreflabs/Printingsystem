import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Bagaimana Print Pilot mengumpulkan, menggunakan, menyimpan, dan melindungi data Anda.",
  alternates: { canonical: "/kebijakan-privasi" },
};

const UPDATED = "8 September 2026";

export default function KebijakanPrivasiPage() {
  return (
    <LegalShell title="Kebijakan Privasi" updated={UPDATED}>
      <p>
        Kebijakan ini menjelaskan bagaimana <b>PT DEMA DIGITAL ASIA</b> (&ldquo;Perusahaan&rdquo;, &ldquo;kami&rdquo;),
        yang mengembangkan dan mengoperasikan layanan Print Pilot (&ldquo;Layanan&rdquo;), mengumpulkan, menggunakan,
        menyimpan, dan melindungi data Anda. Dengan menggunakan Layanan, Anda menyetujui praktik yang diuraikan di sini.
      </p>

      <div>
        <h2>1. Data yang kami kumpulkan</h2>
        <ul>
          <li><b>Data akun:</b> nama, email, nomor telepon, nama usaha, dan kata sandi (disimpan dalam bentuk hash).</li>
          <li><b>Data operasional yang Anda masukkan:</b> pelanggan, pesanan, produk, harga, stok bahan, data pegawai, absensi, dan transaksi pembayaran.</li>
          <li><b>Data teknis:</b> alamat IP, jenis peramban, dan log aktivitas untuk keamanan dan audit.</li>
          <li><b>Cookie:</b> cookie sesi untuk menjaga Anda tetap masuk. Kami tidak memakai cookie iklan pihak ketiga.</li>
        </ul>
      </div>

      <div>
        <h2>2. Cara kami menggunakan data</h2>
        <ul>
          <li>Menyediakan dan mengoperasikan Layanan sesuai peran akses Anda.</li>
          <li>Mengamankan akun (deteksi percobaan masuk mencurigakan, penguncian sementara, jejak audit).</li>
          <li>Mengirim notifikasi terkait pesanan melalui WhatsApp/email bila fitur tersebut Anda aktifkan.</li>
          <li>Menagih langganan dan mengelola masa uji coba.</li>
          <li>Meningkatkan keandalan dan performa Layanan.</li>
        </ul>
        <p>Kami tidak menjual data Anda dan tidak menggunakannya untuk iklan.</p>
      </div>

      <div>
        <h2>3. Isolasi antar penyewa (tenant)</h2>
        <p>
          Setiap usaha yang berlangganan memiliki ruang data yang terisolasi secara logis. Pengguna dari satu usaha
          tidak dapat melihat pelanggan, pesanan, atau transaksi usaha lain.
        </p>
      </div>

      <div>
        <h2>4. Berbagi dengan pihak ketiga</h2>
        <p>Kami hanya membagikan data seperlunya kepada penyedia layanan yang mendukung operasi kami, misalnya:</p>
        <ul>
          <li>Penyedia infrastruktur/hosting tempat data disimpan.</li>
          <li>Penyedia pengiriman pesan (WhatsApp/email) untuk notifikasi yang Anda aktifkan.</li>
          <li>Penyedia penyimpanan berkas untuk file desain yang Anda unggah.</li>
        </ul>
        <p>Kami juga dapat mengungkap data bila diwajibkan oleh hukum yang berlaku.</p>
      </div>

      <div>
        <h2>5. Penyimpanan &amp; keamanan</h2>
        <ul>
          <li>Kata sandi disimpan sebagai hash (bcrypt), tidak pernah dalam bentuk teks biasa.</li>
          <li>Akses ke data dibatasi berdasarkan peran, dan aksi sensitif dicatat pada jejak audit.</li>
          <li>Data dipertahankan selama akun aktif. Setelah berhenti berlangganan, data dapat dihapus permanen setelah masa tenggang.</li>
        </ul>
      </div>

      <div>
        <h2>6. Hak Anda</h2>
        <p>Anda dapat mengakses, memperbarui, atau meminta penghapusan data Anda dengan menghubungi kami. Sebagian data mungkin tetap disimpan bila diperlukan untuk kewajiban hukum atau pencatatan keuangan.</p>
      </div>

      <div>
        <h2>7. Perubahan kebijakan</h2>
        <p>Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan material akan kami informasikan melalui aplikasi atau email.</p>
      </div>

      <div>
        <h2>8. Kontak</h2>
        <p>
          PT DEMA DIGITAL ASIA &mdash; Sukabumi, Jawa Barat, Indonesia.
          <br />
          Pertanyaan tentang privasi: <a href="mailto:privasi@printpilot.id">privasi@printpilot.id</a>.
        </p>
      </div>
    </LegalShell>
  );
}
