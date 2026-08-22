import { LoginForm } from "@/components/auth/LoginForm";
import { CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export const metadata = {
  title: "Login | PrintFlow Percetakan",
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
      <div className="hidden lg:flex w-1/2 min-h-screen bg-slate-900 relative overflow-hidden items-center justify-center p-12">
        {/* Background Image/Pattern */}
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1562664377-709f2c337eb2?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-br from-base via-base/90 to-accent-teal/20" />
        
        {/* Animated Orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent-teal/30 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-purple/20 rounded-full blur-[120px] animate-pulse delay-1000" />

        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-xs font-semibold mb-6 shadow-[0_0_20px_rgba(14,165,233,0.15)]">
            <ShieldCheck className="h-4 w-4" /> Secure Enterprise System
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 tracking-tight">
            Tingkatkan Efisiensi <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-teal to-blue-400">Produksi Percetakan</span>
          </h2>
          
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Platform terpadu untuk mengelola pesanan cetak, inventori bahan baku, mesin, hingga sistem kasir retail dalam satu atap yang terhubung *real-time*.
          </p>

          <div className="space-y-5">
            {[
              { icon: Zap, title: "Real-time Tracking", desc: "Pantau status pesanan dari desain hingga gudang detik ini juga." },
              { icon: ShieldCheck, title: "Anti-Fraud System", desc: "Dilengkapi pencatatan Audit Log yang aman (Tamper-proof)." },
              { icon: CheckCircle2, title: "Otomatisasi Kalkulasi", desc: "Perhitungan waste bahan baku dan harga otomatis." },
            ].map((f, i) => (
              <div key={i} className="flex gap-4">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                  <f.icon className="h-6 w-6 text-accent-teal" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
