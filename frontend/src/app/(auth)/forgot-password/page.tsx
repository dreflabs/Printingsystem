"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, KeyRound, Mail, ShieldCheck, CheckCircle2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requestPasswordReset } from "@/actions/password-reset";

/** Jika dibuka dari subdomain workspace (mis. narativa.printpilot.id), ambil slug-nya. */
function workspaceFromHost(): string {
  if (typeof window === "undefined") return "";
  try {
    const host = window.location.hostname;
    const m =
      host.match(/^([a-z0-9]{3,30})\.printpilot\.id$/) ||
      host.match(/^([a-z0-9]{3,30})\.localhost$/);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState(workspaceFromHost);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const res = await requestPasswordReset(email, workspace.trim().toLowerCase());
    setIsLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setIsSubmitted(true);
  };
  return (
    <div className="min-h-screen bg-base flex flex-col font-sans">
      {/* Header Minimalis */}
      <header className="absolute top-0 left-0 w-full h-20 flex items-center px-8 z-50">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/PRINT_PILOT_LOGO.png" alt="Print Pilot Logo" className="h-8 w-8 object-contain" />
          <span className="font-bold text-xl text-primary tracking-tight">Print Pilot<span className="text-accent-teal">.id</span></span>
        </Link>
      </header>

      <div className="flex flex-col lg:flex-row flex-1">
        {/* LEFT SIDE - FORM */}
        <div className="w-full lg:w-1/2 min-h-[calc(100vh-80px)] mt-20 lg:mt-0 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[420px] bg-card p-8 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-border">
          <div className="mb-8">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors mb-6">
              <ArrowLeft className="h-4 w-4" /> Kembali ke Login
            </Link>
            
            <div className="w-12 h-12 rounded-xl bg-accent-teal/10 flex items-center justify-center mb-6">
              <KeyRound className="h-6 w-6 text-accent-teal" />
            </div>
            
            <h1 className="text-2xl font-bold text-primary mb-2">Lupa Password?</h1>
            <p className="text-muted text-sm leading-relaxed">
              Masukkan workspace dan email yang terdaftar sebagai Owner. Kami akan mengirimkan tautan untuk mereset password Anda. 
              <br/><br/>
              <span className="font-semibold text-status-yellow-text">Catatan:</span> Pegawai harus meminta Owner untuk mereset password mereka.
            </p>
          </div>

          {isSubmitted ? (
            <div className="bg-status-green/10 border border-status-green/20 rounded-xl p-5 text-center mt-6 animate-in zoom-in duration-300">
              <CheckCircle2 className="h-8 w-8 text-status-green mx-auto mb-3" />
              <h3 className="font-bold text-primary mb-1">Email Terkirim!</h3>
              <p className="text-sm text-muted">
                Jika email Anda terdaftar dalam sistem, tautan reset password telah dikirim ke kotak masuk Anda.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2.5 text-xs font-semibold text-status-red">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-primary">Workspace</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    spellCheck={false}
                    value={workspace}
                    onChange={(e) => setWorkspace(e.target.value)}
                    placeholder="subdomain workspace, mis. narativa"
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-base outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  Bagian sebelum <span className="font-mono">.printpilot.id</span> pada alamat workspace Anda.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-primary">Email Owner</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@perusahaan.com"
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-base outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all"
                  />
                </div>
              </div>

              <Button type="submit" isLoading={isLoading} className="w-full h-12 rounded-xl text-base mt-2">
                Kirim Link Reset
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* RIGHT SIDE - SHOWCASE */}
      <div className="hidden lg:flex w-1/2 min-h-[calc(100vh-80px)] mt-20 lg:mt-0 bg-elevated/30 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1562664377-709f2c337eb2?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-br from-base via-base/90 to-accent-teal/20" />
        
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-teal/10 border border-accent-teal/20 text-accent-teal text-xs font-semibold mb-6 shadow-[0_0_20px_rgba(14,165,233,0.15)]">
            <ShieldCheck className="h-4 w-4" /> Secure Reset Flow
          </div>
          
          <h2 className="text-4xl font-bold text-primary leading-tight mb-6 tracking-tight">
            Keamanan Data Anda <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-teal to-status-blue">Prioritas Utama</span>
          </h2>
          
          <p className="text-muted text-lg leading-relaxed">
            Sistem pemulihan mandiri hanya diizinkan untuk akun Owner demi mencegah akses tidak sah pada data penjualan perusahaan.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
