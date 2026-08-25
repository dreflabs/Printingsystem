"use client";

import { useState } from "react";
import { Lock, User, LogIn, Printer, Sparkles, Shield, ChevronRight } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";

const DEMO_ACCOUNTS = [
  { role: "owner", name: "Pak Hendra", title: "Owner", user: "owner", pass: "owner123", path: "/owner", color: "border-accent-teal/40 text-accent-teal bg-accent-teal/10" },
  { role: "admin", name: "Rere", title: "Admin", user: "admin", pass: "admin123", path: "/admin", color: "border-accent-teal/40 text-accent-teal bg-accent-teal/10" },
  { role: "designer", name: "Ayu", title: "Designer", user: "designer", pass: "designer123", path: "/designer", color: "border-status-blue/40 text-status-blue bg-status-blue/10" },
  { role: "operator", name: "Budi", title: "Operator", user: "operator", pass: "operator123", path: "/operator", color: "border-status-blue/40 text-status-blue bg-status-blue/10" },
  { role: "finishing", name: "Fajar", title: "Finishing (QC & Storage)", user: "finishing", pass: "finishing123", path: "/finishing", color: "border-status-green/40 text-status-green bg-status-green/10" },
];

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleQuickLogin = (demo: typeof DEMO_ACCOUNTS[0]) => {
    localStorage.setItem("userRole", demo.role);
    localStorage.setItem("userName", `${demo.name} (${demo.title})`);
    window.location.href = demo.path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const matchedDemo = DEMO_ACCOUNTS.find(d => d.user === username && d.pass === password);
    if (matchedDemo) {
      handleQuickLogin(matchedDemo);
      return;
    }

    try {
      const result = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (result?.error) {
        setError("Username atau password salah. Silakan pilih Akun Demo di bawah.");
        setLoading(false);
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError("Terjadi kesalahan sistem");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 mb-4 overflow-hidden">
          <img src="/PRINT_PILOT_LOGO.png" alt="Print Pilot Logo" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(14,165,233,0.3)]" />
        </div>
        <h1 className="text-3xl font-bold text-primary tracking-tight">Print Pilot<span className="text-accent-teal">.id</span></h1>
        <p className="text-sm text-muted">Sistem Manajemen Percetakan Modern</p>
      </div>

      {/* Form Card */}
      <div className="bg-card/70 backdrop-blur-2xl border border-border rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="relative">
          <h2 className="text-lg font-bold text-primary mb-4">Masuk ke Akun Anda</h2>
          
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-status-red/10 border border-status-red/30 flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-status-red mt-2 shrink-0" />
              <p className="text-xs text-status-red font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent-teal transition-colors" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-11 bg-elevated border border-border rounded-xl pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal transition-all placeholder:text-muted"
                  placeholder="Masukkan username..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-medium text-muted">Password</label>
                <Link href="/forgot-password" className="text-xs text-accent-teal hover:underline font-medium">Lupa Password?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent-teal transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 bg-elevated border border-border rounded-xl pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal transition-all placeholder:text-muted"
                  placeholder="••••••••"
                />
              </div>
            </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-accent-teal hover:brightness-110 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent-teal/20 cursor-pointer mt-2"
              >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> 
                  Login Sekarang
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted">
              Belum punya workspace? <Link href="/register" className="text-accent-teal hover:underline font-bold">Daftar di sini</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Demo Users Panel */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-teal" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Akses Cepat Demo Users (All Roles)</h3>
          </div>
          <span className="text-[10px] text-accent-teal font-mono bg-accent-teal/10 px-2 py-0.5 rounded-full border border-accent-teal/30">1-Click Login</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {DEMO_ACCOUNTS.map((d) => (
            <button
              key={d.role}
              onClick={() => handleQuickLogin(d)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/60 border border-border hover:border-accent-teal/40 transition-all text-left group cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary truncate">{d.title}</p>
                <p className="text-[10px] text-muted truncate">{d.name}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted group-hover:text-accent-teal group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
