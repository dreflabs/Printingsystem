"use client";

import { useEffect, useState } from "react";
import { Lock, User, LogIn, Eye, EyeOff, Building2 } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";

/** Terima hanya path relatif same-origin sebagai tujuan setelah login. */
function safeCallback(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

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

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [workspace, setWorkspace] = useState(workspaceFromHost);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("/");

  useEffect(() => {
    try {
      setCallbackUrl(safeCallback(new URLSearchParams(window.location.search).get("callbackUrl")));
    } catch {
      /* keep default */
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        workspace: workspace.trim().toLowerCase(),
        username: username.trim(),
        password,
      });

      if (result?.error) {
        setError("Workspace, username, atau kata sandi salah.");
        setLoading(false);
        return;
      }

      // Biarkan tujuan penuh dimuat ulang agar sesi terbaca di server components.
      window.location.href = callbackUrl;
    } catch {
      setError("Terjadi kesalahan sistem. Coba lagi sebentar.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 mb-4 overflow-hidden">
          <img
            src="/PRINT_PILOT_LOGO.png"
            alt="Print Pilot Logo"
            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(14,165,233,0.3)]"
          />
        </div>
        <h1 className="text-3xl font-bold text-primary tracking-tight">
          Print Pilot<span className="text-accent-teal">.id</span>
        </h1>
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
              <label htmlFor="login-workspace" className="text-xs font-medium text-muted ml-1">
                Workspace
              </label>
              <div className="relative group">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent-teal transition-colors" />
                <input
                  id="login-workspace"
                  name="workspace"
                  type="text"
                  autoComplete="organization"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  className="w-full h-11 bg-elevated border border-border rounded-xl pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal transition-all placeholder:text-muted"
                  placeholder="subdomain workspace, mis. narativa"
                />
              </div>
              <p className="text-[10px] text-muted ml-1">
                Bagian sebelum <span className="font-mono">.printpilot.id</span> pada alamat workspace Anda.
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="login-username" className="text-xs font-medium text-muted ml-1">
                Username
              </label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent-teal transition-colors" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-11 bg-elevated border border-border rounded-xl pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal transition-all placeholder:text-muted"
                  placeholder="Masukkan username…"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center ml-1">
                <label htmlFor="login-password" className="text-xs font-medium text-muted">
                  Kata Sandi
                </label>
                <Link href="/forgot-password" className="text-xs text-accent-teal hover:underline font-medium">
                  Lupa kata sandi?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-accent-teal transition-colors" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 bg-elevated border border-border rounded-xl pl-10 pr-10 text-sm text-primary outline-none focus:border-accent-teal transition-all placeholder:text-muted"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-accent-teal hover:brightness-110 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent-teal/20 cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Masuk
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted">
              Belum punya workspace?{" "}
              <Link href="/register" className="text-accent-teal hover:underline font-bold">
                Daftar di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
