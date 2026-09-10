import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Kanban,
  PackageSearch,
  MessageCircle,
  ChevronRight,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import { PriceCalculator } from "@/components/marketing/PriceCalculator";

const SITE_URL = process.env.APP_URL || "https://printpilot.id";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Apakah data pabrik saya aman?",
    a: "Ya. Setiap penyewa (tenant) memiliki ruang data yang diisolasi secara logis. Pengguna dari usaha lain tidak bisa melihat transaksi maupun pelanggan Anda. Kata sandi disimpan sebagai hash dan setiap aksi sensitif tercatat di jejak audit.",
  },
  {
    q: "Apakah saya butuh perangkat komputer khusus?",
    a: "Tidak. Print Pilot 100% berbasis cloud. Anda hanya butuh peramban biasa (Chrome, Safari, dll.) dan koneksi internet. Bisa dibuka di komputer lama, laptop, atau tablet.",
  },
  {
    q: "Apakah bisa diakses dari HP?",
    a: "Bisa. Tampilan Print Pilot responsif, sehingga Owner tetap dapat memantau omzet dan antrean produksi dari ponsel saat berada di luar pabrik.",
  },
  {
    q: "Bagaimana jika pesanan saya melebihi limit paket Starter?",
    a: "Jika Anda mendekati batas 200 pesanan per bulan pada paket Starter, Anda bisa pindah ke paket Pro (tanpa batas) kapan saja tanpa kehilangan data.",
  },
];

function StructuredData() {
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "PT DEMA DIGITAL ASIA",
        url: SITE_URL,
        logo: `${SITE_URL}/PRINT_PILOT_LOGO.png`,
        areaServed: "ID",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Sukabumi",
          addressRegion: "Jawa Barat",
          addressCountry: "ID",
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "Print Pilot",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Software manajemen percetakan berbasis cloud: kasir & order, kanban produksi, potong stok bahan otomatis, dan notifikasi WhatsApp.",
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
        brand: { "@type": "Brand", name: "Print Pilot" },
        offers: [
          { "@type": "Offer", name: "Starter", price: "299000", priceCurrency: "IDR", url: `${SITE_URL}/register?plan=starter` },
          { "@type": "Offer", name: "Pro", price: "599000", priceCurrency: "IDR", url: `${SITE_URL}/register?plan=pro` },
          { "@type": "Offer", name: "Enterprise", priceCurrency: "IDR", url: `${SITE_URL}/kontak` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-base flex flex-col font-sans">
      <StructuredData />
      {/* ─── NAVBAR ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-base/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/PRINT_PILOT_LOGO.png" alt="Print Pilot" width={32} height={32} priority className="h-8 w-8 object-contain" />
            <span className="font-bold text-xl text-primary tracking-tight">Print Pilot<span className="text-accent-teal">.id</span></span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted">
            <a href="#fitur" className="hover:text-primary transition-colors">Fitur</a>
            <a href="#harga" className="hover:text-primary transition-colors">Harga</a>
            <a href="#kegunaan" className="hover:text-primary transition-colors">Kegunaan</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold text-primary hover:text-accent-teal transition-colors">
              Masuk
            </Link>
            <Link href="/register" className="text-sm font-bold bg-primary text-base px-4 py-2 rounded-full hover:bg-primary/90 transition-all flex items-center gap-1.5">
              Coba Gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── HERO SECTION ────────────────────────────────────────────────────── */}
        <section className="relative pt-20 pb-24 border-b border-border">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-accent-teal mb-5 border-l-2 border-accent-teal pl-3">
                Software Manajemen Percetakan
              </p>

              <h1 className="text-5xl md:text-6xl font-extrabold text-primary tracking-tight leading-[1.08] mb-6">
                Semua pesanan cetak tercatat, terpantau, tepat waktu.
              </h1>

              <p className="text-lg text-muted max-w-xl mb-10 leading-relaxed">
                Print Pilot menggantikan buku catatan dan Excel. Catat order, pantau antrean produksi secara langsung, dan potong stok bahan otomatis dalam satu aplikasi.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link href="/register" className="h-14 px-8 rounded-full bg-primary text-base font-bold flex items-center gap-2 hover:scale-105 transition-transform">
                  Mulai dari Rp 299rb/bln <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="#fitur" className="h-14 px-8 rounded-full text-primary font-bold border border-border flex items-center hover:bg-elevated transition-colors">
                  Pelajari Fitur
                </Link>
              </div>

              <p className="mt-6 text-xs text-muted font-medium">Uji coba gratis 14 hari. Tanpa kartu kredit.</p>

              <div className="mt-12 grid grid-cols-3 gap-6 max-w-md pt-8 border-t border-border">
                {[
                  { label: "Titik Scan QR Produksi", value: "10" },
                  { label: "Role Akses Terpisah", value: "5" },
                  { label: "Hari Trial Gratis", value: "14" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-extrabold text-primary font-mono">{s.value}</p>
                    <p className="text-xs text-muted leading-snug mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive product-led demo, not a static screenshot */}
            <div className="flex justify-center lg:justify-end">
              <PriceCalculator />
            </div>
          </div>
        </section>

        {/* ─── MASALAH VS SOLUSI (SECTION 3) ─────────────────────────────────── */}
        <section className="py-24 bg-base">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-primary mb-4">Masih menggunakan cara lama?</h2>
              <p className="text-muted">Buku catatan hilang, chat WhatsApp tenggelam, dan stok bahan baku yang selalu meleset dari perhitungan.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Cara Lama */}
              <div className="p-8 rounded-2xl bg-status-red/5 border border-status-red/20 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-status-red/10 flex items-center justify-center">
                    <X className="h-5 w-5 text-status-red" />
                  </div>
                  <h3 className="text-xl font-bold text-primary">Cara Lama</h3>
                </div>
                <ul className="space-y-4 text-sm text-muted">
                  <li className="flex gap-3"><X className="h-5 w-5 text-status-red shrink-0" /> <span className="pt-0.5">Pesanan sering terselip karena dicatat manual di kertas.</span></li>
                  <li className="flex gap-3"><X className="h-5 w-5 text-status-red shrink-0" /> <span className="pt-0.5">CS tidak tahu status pesanan karena harus tanya orang produksi dulu.</span></li>
                  <li className="flex gap-3"><X className="h-5 w-5 text-status-red shrink-0" /> <span className="pt-0.5">Kehabisan bahan baku di tengah proses cetak.</span></li>
                  <li className="flex gap-3"><X className="h-5 w-5 text-status-red shrink-0" /> <span className="pt-0.5">Pelanggan marah karena deadline pesanan molor.</span></li>
                </ul>
              </div>

              {/* Dengan Print Pilot */}
              <div className="p-8 rounded-2xl bg-status-green/5 border border-status-green/20 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-status-green/10 flex items-center justify-center">
                    <Check className="h-5 w-5 text-status-green" />
                  </div>
                  <h3 className="text-xl font-bold text-primary">Dengan Print Pilot</h3>
                </div>
                <ul className="space-y-4 text-sm text-muted">
                  <li className="flex gap-3"><Check className="h-5 w-5 text-status-green shrink-0" /> <span className="pt-0.5">Semua pesanan tercatat digital secara aman di cloud.</span></li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-status-green shrink-0" /> <span className="pt-0.5">Status produksi real-time, CS bisa langsung jawab pertanyaan pelanggan.</span></li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-status-green shrink-0" /> <span className="pt-0.5">Stok terpotong otomatis dan ada peringatan jika menipis.</span></li>
                  <li className="flex gap-3"><Check className="h-5 w-5 text-status-green shrink-0" /> <span className="pt-0.5">Peringatan otomatis untuk pesanan yang mendekati deadline.</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FEATURES SECTION ────────────────────────────────────────────────── */}
        <section id="fitur" className="py-24 bg-card border-y border-border">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-primary mb-4">Semua yang Anda Butuhkan dalam Satu Aplikasi</h2>
              <p className="text-muted">Desain alur kerja Print Pilot secara spesifik dibuat untuk menjawab kerumitan operasional bisnis percetakan digital maupun offset.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: LayoutDashboard,
                  title: "Kasir & Order",
                  desc: "Buat order cetak maupun penjualan eceran, isi harga dari katalog, dan cetak lembar kerja ber-QR untuk produksi.",
                  color: "text-accent-teal",
                  bg: "bg-accent-teal/10"
                },
                {
                  icon: Kanban,
                  title: "Kanban Produksi",
                  desc: "Pantau antrean mesin dan job desainer secara visual. Tidak ada lagi pesanan yang terlewat.",
                  color: "text-status-blue",
                  bg: "bg-status-blue/10"
                },
                {
                  icon: PackageSearch,
                  title: "Manajemen Finishing",
                  desc: "Stok bahan baku terpotong otomatis setiap kali mesin mencetak. Ada alert stok menipis.",
                  color: "text-status-yellow-text",
                  bg: "bg-status-yellow/10"
                },
                {
                  icon: MessageCircle,
                  title: "Notifikasi WhatsApp",
                  desc: "Kirim nota resi elektronik dan notifikasi pesanan selesai langsung ke nomor WA pelanggan.",
                  color: "text-status-green",
                  bg: "bg-status-green/10"
                }
              ].map((f, i) => (
                <div key={i} className="p-6 rounded-2xl bg-elevated border border-border hover:border-accent-teal/50 transition-colors group">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${f.bg} ${f.color}`}>
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-primary mb-2">{f.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICING SECTION ─────────────────────────────────────────────────── */}
        <section id="harga" className="py-24 bg-base">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-primary mb-4">Pilih Paket Sesuai Skala Bisnis Anda</h2>
              <p className="text-muted">Biaya transparan, bayar bulanan, batalkan kapan saja. Jauh lebih hemat daripada membangun sistem sendiri.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Starter */}
              <div className="rounded-3xl bg-card border border-border p-8 flex flex-col">
                <h3 className="text-xl font-bold text-primary mb-2">Starter</h3>
                <p className="text-sm text-muted mb-6">Cocok untuk percetakan baru</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-primary">Rp 299rb</span>
                  <span className="text-muted">/bln</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {['Maksimal 5 Pengguna', '200 Pesanan per bulan', '1 Lokasi Finishing', 'Dukungan via Email'].map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-medium text-muted">
                      <CheckCircle2 className="h-5 w-5 text-accent-teal shrink-0" /> {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/register?plan=starter" className="w-full h-12 flex items-center justify-center rounded-xl bg-elevated border border-border text-primary font-bold hover:bg-border/50 transition-colors">
                  Pilih Starter
                </Link>
              </div>

              {/* Pro */}
              <div className="rounded-3xl bg-card border-2 border-accent-teal p-8 flex flex-col relative shadow-sm transform md:-translate-y-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full bg-accent-teal text-white text-xs font-bold tracking-wide">
                  PALING POPULER
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Pro</h3>
                <p className="text-sm text-muted mb-6">Untuk percetakan berkembang</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-primary">Rp 599rb</span>
                  <span className="text-muted">/bln</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {['Maksimal 15 Pengguna', 'Pesanan tanpa batas', 'Multi-lokasi Finishing', 'Notifikasi WhatsApp Otomatis', 'Dukungan Prioritas (WA)'].map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-medium text-primary">
                      <CheckCircle2 className="h-5 w-5 text-accent-teal shrink-0" /> {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/register?plan=pro" className="w-full h-12 flex items-center justify-center rounded-xl bg-accent-teal text-white font-bold hover:brightness-110 transition-colors">
                  Mulai dengan Pro
                </Link>
              </div>

              {/* Enterprise */}
              <div className="rounded-3xl bg-card border border-border p-8 flex flex-col">
                <h3 className="text-xl font-bold text-primary mb-2">Enterprise</h3>
                <p className="text-sm text-muted mb-6">Untuk pabrik & multi-cabang</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-primary">Custom</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {['Pengguna tanpa batas', 'Pesanan tanpa batas', 'Custom Domain (namatoko.id)', 'Integrasi API Khusus', 'Opsi On-Premise', 'SLA 99.9%'].map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-medium text-muted">
                      <CheckCircle2 className="h-5 w-5 text-accent-teal shrink-0" /> {feat}
                    </li>
                  ))}
                </ul>
                <Link href="/kontak" className="w-full h-12 flex items-center justify-center rounded-xl bg-elevated border border-border text-primary font-bold hover:bg-border/50 transition-colors">
                  Hubungi Tim Sales
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── USE CASES SECTION ───────────────────────────────────────────────── */}
        <section id="kegunaan" className="py-24 bg-elevated border-y border-border">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-primary mb-4">Dibuat mengikuti alur kerja percetakan</h2>
              <p className="text-muted">Print Pilot mengurutkan proses dari order masuk sampai barang diambil pelanggan: untuk digital printing, sablon &amp; merchandise, maupun offset.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "Kasir & CS",
                  body: "Terima order, catat DP, dan cek status pesanan mana pun tanpa harus bertanya ke bagian produksi.",
                },
                {
                  title: "Desainer & Operator",
                  body: "Antrean job desain dan job mesin tampil jelas. Scan QR untuk mulai dan menyelesaikan tiap tahap; pemakaian bahan tercatat.",
                },
                {
                  title: "Owner",
                  body: "Pantau omzet, produksi aktif, piutang, dan stok menipis dari satu layar. Bisa juga dari ponsel saat di luar pabrik.",
                },
              ].map((u, i) => (
                <div key={i} className="bg-card border border-border p-8 rounded-2xl">
                  <h3 className="text-lg font-bold text-primary mb-2">{u.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{u.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ SECTION (SECTION 7) ─────────────────────────────────────────── */}
        <section className="py-24 bg-base">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-primary mb-4">Pertanyaan yang Sering Diajukan</h2>
              <p className="text-muted">Masih ragu? Berikut jawaban atas hal-hal yang paling sering ditanyakan calon pengguna Print Pilot.</p>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, i) => (
                <details key={i} className="group rounded-2xl border border-border bg-card p-6 [&_summary::-webkit-details-marker]:hidden cursor-pointer">
                  <summary className="flex items-center justify-between gap-4 font-bold text-primary">
                    {faq.q}
                    <span className="transition group-open:-rotate-180 bg-elevated p-1 rounded-lg">
                      <ChevronDown className="h-5 w-5 text-muted" />
                    </span>
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ───────────────────────────────────────────────────────── */}
        <section className="py-24 border-t border-border bg-card">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-primary mb-6">Siap merapikan percetakan Anda?</h2>
            <p className="text-lg text-muted mb-10">Buat akun dan mulai pakai dalam waktu kurang dari 5 menit. Gratis 14 hari, tanpa kartu kredit.</p>
            <Link href="/register" className="inline-flex h-14 px-8 items-center justify-center rounded-full bg-primary text-base font-bold gap-2 hover:scale-105 transition-transform">
              Coba Gratis 14 Hari <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-base border-t border-border pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Image src="/PRINT_PILOT_LOGO.png" alt="Print Pilot" width={24} height={24} className="h-6 w-6 object-contain" />
                <span className="font-bold text-xl text-primary tracking-tight">Print Pilot<span className="text-muted">.id</span></span>
              </div>
              <p className="text-sm text-muted max-w-sm leading-relaxed">
                Software kasir &amp; produksi untuk industri percetakan digital dan offset di Indonesia.
              </p>
              <div className="pt-4 space-y-1 text-sm text-muted">
                <p>
                  Dikembangkan oleh <span className="font-semibold text-primary">PT DEMA DIGITAL ASIA</span>
                </p>
                <p>Sukabumi, Jawa Barat, Indonesia</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-primary mb-4">Produk</h4>
              <ul className="space-y-3 text-sm text-muted">
                <li><a href="#fitur" className="hover:text-accent-teal transition-colors">Fitur</a></li>
                <li><a href="#harga" className="hover:text-accent-teal transition-colors">Harga</a></li>
                <li><a href="#kegunaan" className="hover:text-accent-teal transition-colors">Kegunaan</a></li>
                <li><Link href="/register" className="hover:text-accent-teal transition-colors">Daftar</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-primary mb-4">Dukungan &amp; legal</h4>
              <ul className="space-y-3 text-sm text-muted">
                <li><Link href="/kontak" className="hover:text-accent-teal transition-colors">Kontak</Link></li>
                <li><Link href="/syarat-ketentuan" className="hover:text-accent-teal transition-colors">Syarat &amp; Ketentuan</Link></li>
                <li><Link href="/kebijakan-privasi" className="hover:text-accent-teal transition-colors">Kebijakan Privasi</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 text-center md:text-left">
            <p className="text-sm text-muted">
              © {new Date().getFullYear()} PT DEMA DIGITAL ASIA. Seluruh hak cipta dilindungi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
