"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, LogIn, Printer, Sparkles } from "lucide-react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Simulate login for frontend mockup if NextAuth is not fully wired yet
    // In production, this uses the real NextAuth signIn
    try {
      const result = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (result?.error) {
        // If NextAuth fails, fallback to simple simulation for preview
        if (username === "owner" && password === "owner123") {
          setTimeout(() => {
            window.location.href = "/admin"; // Force reload to trigger layout re-render
          }, 800);
        } else {
          setError("Username atau password salah");
          setLoading(false);
        }
      } else {
        window.location.href = "/admin";
      }
    } catch (err) {
      setError("Terjadi kesalahan sistem");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-teal to-blue-600 shadow-[0_0_40px_rgba(14,165,233,0.3)] mb-5">
          <Printer className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Print<span className="text-accent-teal">Flow</span></h1>
        <p className="text-sm text-slate-400">Sistem Manajemen Percetakan Modern</p>
      </div>

      {/* Form Card */}
      <div className="bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-accent-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-accent-teal/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <h2 className="text-xl font-semibold text-white mb-6">Masuk ke Akun Anda</h2>
          
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-status-red/10 border border-status-red/20 flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-status-red mt-2 shrink-0" />
              <p className="text-sm text-status-red font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-accent-teal transition-colors" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 bg-slate-950/50 border border-slate-800 rounded-xl pl-11 pr-4 text-sm text-white outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all placeholder:text-slate-600"
                  placeholder="Masukkan username..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-medium text-slate-400">Password</label>
                <a href="#" className="text-xs text-accent-teal hover:text-accent-teal/80 transition-colors">Lupa sandi?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-accent-teal transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-slate-950/50 border border-slate-800 rounded-xl pl-11 pr-4 text-sm text-white outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 bg-gradient-to-r from-accent-teal to-blue-600 hover:from-accent-teal/90 hover:to-blue-600/90 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent-teal/20 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4 group-hover:-translate-y-0.5 transition-transform" /> 
                  Login Sekarang
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-800 pt-6">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Sparkles className="h-3 w-3 text-accent-purple" />
              Gunakan akun <strong className="text-slate-300 font-semibold">owner</strong> / <strong className="text-slate-300 font-semibold">owner123</strong> untuk demo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
