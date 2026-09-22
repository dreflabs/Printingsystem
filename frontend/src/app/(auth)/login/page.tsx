import { LoginForm } from "@/components/auth/LoginForm";
import Image from "next/image";
import { CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export const metadata = {
  title: "Login | Print Pilot Percetakan",
  description: "Sistem Manajemen Percetakan Modern",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-base flex flex-col lg:flex-row font-sans">
      
      {/* LEFT SIDE - FORM */}
      <div className="w-full lg:w-1/2 min-h-screen flex items-center justify-center p-6 relative z-10">
        <LoginForm />
      </div>

      {/* RIGHT SIDE - SHOWCASE (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 min-h-screen bg-elevated/30 relative overflow-hidden items-center justify-center p-12">
        {/* Background Image/Pattern */}
        <Image
          src="/images/hero-print-shop-id.jpg"
          alt=""
          fill
          sizes="50vw"
          priority
          aria-hidden="true"
          className="object-cover object-[65%_50%] opacity-20 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-base/95 via-base/85 to-accent-teal/20" />
        
        {/* Animated Orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent-teal/30 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-teal/20 rounded-full blur-[120px] animate-pulse delay-1000" />

        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-xs font-semibold mb-6 shadow-[0_0_20px_rgba(14,165,233,0.15)]">
            <ShieldCheck className="h-4 w-4" /> Sistem Percetakan Terintegrasi
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-primary leading-tight mb-6 tracking-tight">
            Tingkatkan Efisiensi <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-teal to-status-blue">Produksi Percetakan</span>
          </h2>
          
          <p className="text-muted text-lg mb-10 leading-relaxed">
            Platform terpadu untuk mengelola pesanan cetak, inventori bahan baku, mesin, hingga sistem kasir retail dalam satu atap yang terhubung *real-time*.
          </p>

          <div className="space-y-5">
            {[
              { icon: Zap, title: "Pelacakan Produksi Real-time", desc: "Pantau status pesanan dari desain hingga gudang secara langsung." },
              { icon: ShieldCheck, title: "Audit Aktivitas Aman", desc: "Setiap aktivitas penting tercatat dan mudah ditelusuri." },
              { icon: CheckCircle2, title: "Kalkulasi Otomatis", desc: "Perhitungan bahan baku, waste, dan harga lebih terkontrol." },
            ].map((f, i) => (
              <div key={i} className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center backdrop-blur-sm">
                  <f.icon className="h-6 w-6 text-accent-teal" />
                </div>
                <div>
                  <h3 className="text-primary font-semibold mb-1">{f.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
