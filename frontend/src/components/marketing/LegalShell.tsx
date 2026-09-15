import Link from "next/link";
import Image from "next/image";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-base flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-base/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/PRINT_PILOT_LOGO.png" alt="Print Pilot" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-bold text-lg text-primary tracking-tight">
              Print Pilot<span className="text-accent-teal">.id</span>
            </span>
          </Link>
          <Link href="/" className="text-sm font-bold text-muted hover:text-primary transition-colors">
            ← Beranda
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-primary mb-2">{title}</h1>
        {updated && <p className="text-xs text-muted mb-10">Terakhir diperbarui: {updated}</p>}
        <div className="space-y-8 text-sm text-muted leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mb-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-accent-teal [&_a]:font-semibold hover:[&_a]:underline">
          {children}
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row justify-between gap-3 text-xs text-muted">
          <p>© {new Date().getFullYear()} PT DEMA DIGITAL ASIA. Seluruh hak cipta dilindungi.</p>
          <nav className="flex gap-4">
            <Link href="/kebijakan-privasi" className="hover:text-primary">Kebijakan Privasi</Link>
            <Link href="/syarat-ketentuan" className="hover:text-primary">Syarat &amp; Ketentuan</Link>
            <Link href="/kontak" className="hover:text-primary">Kontak</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
