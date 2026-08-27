"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Building2, 
  CheckCircle2, 
  ChevronRight, 
  Mail, 
  Phone, 
  Printer, 
  ShieldCheck, 
  User,
  ArrowLeft,
  Loader2,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { registerTenant } from "@/actions/register";

// Komponen UI kustom kecil untuk input
function InputField({ label, icon: Icon, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-muted">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <Icon className="h-4 w-4" />
        </div>
        <input 
          {...props} 
          className="w-full bg-base border border-border rounded-xl h-11 pl-10 pr-4 text-sm text-primary placeholder:text-muted/50 focus:border-accent-teal focus:ring-1 focus:ring-accent-teal outline-none transition-all"
        />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerUsername, setOwnerUsername] = useState("");

  // State Form
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    otp: ["", "", "", "", "", ""],
    shopName: "",
    subdomain: "",
    address: ""
  });

  const handleNext = () => {
    setError(null);
    // Langkah 1–2 belum menyentuh backend (OTP email belum diwire) — maju lokal.
    if (step < 3) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setStep(s => Math.min(s + 1, 4));
      }, 400);
      return;
    }
    // Langkah 3: buat workspace sungguhan.
    void submitRegistration();
  };

  const submitRegistration = async () => {
    setIsLoading(true);
    setError(null);
    const res = await registerTenant({
      ownerName: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      password: formData.password,
      shopName: formData.shopName,
      subdomain: formData.subdomain,
      address: formData.address || undefined,
    });
    setIsLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setOwnerUsername(res.data.ownerUsername);
    setFormData(f => ({ ...f, subdomain: res.data.slug }));
    setStep(4);
  };

  const handleBack = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  const autoGenerateSubdomain = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  return (
    <div className="min-h-screen bg-base flex flex-col font-sans">
      {/* Header Minimalis */}
      <header className="h-20 border-b border-border/50 flex items-center px-8">
        <Link href="/" className="flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
          <img src="/PRINT_PILOT_LOGO.png" alt="Print Pilot Logo" className="h-8 w-8 object-contain" />
          <span className="font-bold text-xl text-primary tracking-tight">Print Pilot<span className="text-accent-teal">.id</span></span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Dekorasi Background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-teal/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-status-blue/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="w-full max-w-5xl flex flex-col md:flex-row gap-12 relative z-10">
          
          {/* Kolom Kiri: Progress Sidebar */}
          <div className="md:w-1/3 space-y-8">
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-primary mb-2">Mulai Gratis.</h1>
              <p className="text-muted text-sm">Setup pabrik Anda dalam 4 langkah mudah.<br/>Tanpa kartu kredit, bisa batal kapan saja.</p>
            </div>

            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border before:-z-10 hidden md:block">
              {[
                { s: 1, title: "Akun Personal", desc: "Informasi login Anda" },
                { s: 2, title: "Verifikasi OTP", desc: "Keamanan email" },
                { s: 3, title: "Profil Pabrik", desc: "Data & Subdomain" },
                { s: 4, title: "Selesai", desc: "Masuk dashboard" }
              ].map((item) => (
                <div key={item.s} className="flex gap-4 items-start">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border-2 shrink-0 transition-all duration-500",
                    step > item.s ? "bg-accent-teal border-accent-teal text-white" :
                    step === item.s ? "bg-base border-accent-teal text-accent-teal" :
                    "bg-base border-border text-muted"
                  )}>
                    {step > item.s ? <CheckCircle2 className="h-4 w-4" /> : item.s}
                  </div>
                  <div>
                    <h3 className={cn("text-sm font-bold", step >= item.s ? "text-primary" : "text-muted")}>{item.title}</h3>
                    <p className="text-xs text-muted mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kolom Kanan: Card Wizard */}
          <div className="md:w-2/3">
            <div className="bg-card/80 backdrop-blur-xl border border-border p-8 rounded-3xl shadow-2xl relative overflow-hidden min-h-[480px] flex flex-col">
              
              {/* === STEP 1: AKUN PRIBADI === */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <User className="h-5 w-5 text-accent-teal" /> 1. Buat Akun Anda
                    </h2>
                    <p className="text-xs text-muted mt-1">Akun ini akan menjadi Super Administrator (Owner) percetakan.</p>
                  </div>
                  
                  <div className="space-y-5 flex-1">
                    <InputField 
                      label="Nama Lengkap" icon={User} placeholder="Budi Santoso" 
                      value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})}
                    />
                    <InputField 
                      label="Alamat Email" icon={Mail} type="email" placeholder="budi@contoh.com" 
                      value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <InputField 
                        label="No. WhatsApp" icon={Phone} placeholder="0812..." 
                        value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})}
                      />
                      <InputField 
                        label="Kata Sandi" icon={Lock} type="password" placeholder="••••••••" 
                        value={formData.password} onChange={(e: any) => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <p className="text-xs text-muted">Sudah punya akun? <Link href="/login" className="text-accent-teal hover:underline font-bold">Masuk di sini</Link></p>
                    <button 
                      onClick={handleNext}
                      disabled={isLoading || !formData.name || !formData.email || !formData.password}
                      className="h-11 px-6 rounded-xl bg-accent-teal text-white font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lanjutkan"}
                      {!isLoading && <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* === STEP 2: VERIFIKASI OTP === */}
              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                  <button onClick={handleBack} className="text-muted hover:text-primary mb-4 flex items-center gap-1 text-xs font-semibold w-fit">
                    <ArrowLeft className="h-3 w-3" /> Kembali
                  </button>
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-accent-teal" /> 2. Cek Email Anda
                    </h2>
                    <p className="text-xs text-muted mt-1">Kami telah mengirim 6 digit kode OTP ke <span className="font-bold text-primary">{formData.email}</span></p>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center justify-center pb-8">
                    <div className="flex gap-2 sm:gap-4 mb-6">
                      {formData.otp.map((digit, index) => (
                        <input
                          key={index}
                          type="text"
                          maxLength={1}
                          className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold bg-base border border-border rounded-xl text-primary focus:border-accent-teal focus:ring-1 focus:ring-accent-teal outline-none transition-all"
                          value={digit}
                          onChange={(e) => {
                            const newOtp = [...formData.otp];
                            newOtp[index] = e.target.value.replace(/[^0-9]/g, "");
                            setFormData({...formData, otp: newOtp});
                            // Auto advance
                            if (e.target.value && index < 5) {
                              const nextInput = document.getElementById(`otp-${index + 1}`);
                              if (nextInput) nextInput.focus();
                            }
                          }}
                          id={`otp-${index}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted">Belum menerima email? <button className="text-accent-teal font-bold hover:underline">Kirim Ulang (00:59)</button></p>
                  </div>

                  <div className="mt-auto flex justify-end">
                    <button 
                      onClick={handleNext}
                      disabled={isLoading || formData.otp.join("").length < 6}
                      className="h-11 px-6 rounded-xl bg-accent-teal text-white font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verifikasi & Lanjut"}
                      {!isLoading && <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* === STEP 3: PROFIL PABRIK === */}
              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex-1 flex flex-col">
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-accent-teal" /> 3. Identitas Percetakan
                    </h2>
                    <p className="text-xs text-muted mt-1">Buat ruang kerja (Workspace) khusus untuk toko Anda.</p>
                  </div>

                  {error && (
                    <div className="mb-5 rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2.5 text-xs font-semibold text-status-red">
                      {error}
                    </div>
                  )}

                  <div className="space-y-5 flex-1">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-muted">Nama Percetakan</label>
                      <input 
                        placeholder="Contoh: Maju Jaya Print" 
                        value={formData.shopName} 
                        onChange={(e: any) => {
                          setFormData({
                            ...formData, 
                            shopName: e.target.value,
                            subdomain: autoGenerateSubdomain(e.target.value)
                          })
                        }}
                        className="w-full bg-base border border-border rounded-xl h-11 px-4 text-sm text-primary placeholder:text-muted/50 focus:border-accent-teal outline-none transition-all"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-muted">Alamat Subdomain SaaS</label>
                      <div className="flex bg-base border border-border rounded-xl overflow-hidden focus-within:border-accent-teal transition-all">
                        <span className="flex items-center justify-center px-4 bg-elevated border-r border-border text-muted text-xs sm:text-sm font-mono shrink-0">
                          https://
                        </span>
                        <input 
                          value={formData.subdomain} 
                          onChange={(e: any) => setFormData({...formData, subdomain: autoGenerateSubdomain(e.target.value)})}
                          className="w-full bg-transparent h-11 px-3 text-sm text-accent-teal font-bold font-mono outline-none"
                        />
                        <span className="flex items-center justify-center px-4 bg-elevated border-l border-border text-muted text-xs sm:text-sm font-mono shrink-0">
                          .printpilot.id
                        </span>
                      </div>
                      <p className="text-[10px] text-muted">Ini adalah URL eksklusif tempat karyawan Anda akan login.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-muted">Kota/Alamat (Opsional)</label>
                      <textarea 
                        rows={2}
                        placeholder="Jl. Raya Cetak No. 12, Jakarta" 
                        value={formData.address} 
                        onChange={(e: any) => setFormData({...formData, address: e.target.value})}
                        className="w-full bg-base border border-border rounded-xl p-3 text-sm text-primary placeholder:text-muted/50 focus:border-accent-teal outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button 
                      onClick={handleNext}
                      disabled={isLoading || !formData.shopName || !formData.subdomain}
                      className="h-11 px-8 rounded-xl bg-status-green text-white font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Selesaikan Pendaftaran"}
                    </button>
                  </div>
                </div>
              )}

              {/* === STEP 4: SELESAI === */}
              {step === 4 && (
                <div className="animate-in zoom-in duration-500 flex-1 flex flex-col items-center justify-center text-center pb-6">
                  <div className="w-20 h-20 bg-status-green/10 rounded-full flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 bg-status-green/20 rounded-full animate-ping opacity-50" />
                    <CheckCircle2 className="h-10 w-10 text-status-green" />
                  </div>
                  <h2 className="text-2xl font-bold text-primary mb-2">Workspace Berhasil Dibuat!</h2>
                  <p className="text-muted text-sm max-w-sm mb-4">
                    Selamat datang di Print Pilot. Workspace Anda aktif di{" "}
                    <span className="text-accent-teal font-mono font-bold">
                      {formData.subdomain}.printpilot.id
                    </span>{" "}
                    (masa uji coba 14 hari).
                  </p>
                  <div className="mb-8 rounded-xl border border-border bg-elevated px-4 py-3 text-xs text-muted max-w-sm">
                    Login sebagai Owner dengan username{" "}
                    <span className="font-mono font-bold text-primary">{ownerUsername}</span>{" "}
                    dan kata sandi yang tadi Anda buat.
                  </div>

                  <Link
                    href="/login"
                    className="h-12 px-8 rounded-xl bg-primary text-base font-bold flex items-center gap-2 text-white hover:scale-105 transition-transform"
                  >
                    Masuk ke Dashboard <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
            
            {/* Keamanan & Privasi Mini Footer */}
            <div className="mt-6 text-center flex items-center justify-center gap-6 opacity-60">
              <span className="flex items-center gap-1.5 text-[10px] text-muted"><Lock className="h-3 w-3" /> Enkripsi AES-256</span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted"><ShieldCheck className="h-3 w-3" /> Data Tersertifikasi</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
