"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldCheck, Lock, Mail, LogIn } from "lucide-react";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      redirect: false,
      username: email.trim(),
      password,
    });
    if (res?.error || !res?.ok) {
      setError("Email atau kata sandi salah.");
      setLoading(false);
      return;
    }
    router.push("/platform");
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <Image src="/PRINT_PILOT_LOGO.png" alt="Print Pilot" width={48} height={48} priority className="mx-auto mb-3 h-12 w-12 object-contain" />
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-teal/20 bg-accent-teal/10 px-3 py-1 text-xs font-bold text-accent-teal">
            <ShieldCheck className="h-4 w-4" /> Khusus Super Admin
          </div>
          <h1 className="mt-3 text-xl font-bold text-primary">Masuk ke Console Platform</h1>
          <p className="text-sm text-muted">Kelola tenant dan operasional Print Pilot</p>
        </div>

        <form onSubmit={submit} className="bg-card border border-border rounded-3xl p-7 shadow-card space-y-4">
          {error && (
            <p className="rounded-xl bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{error}</p>
          )}
          <div>
            <label className="text-sm font-semibold text-primary mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@printpilot.id"
                className="w-full h-12 rounded-xl bg-elevated border border-border pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/15"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-primary mb-1.5 block">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 rounded-xl bg-elevated border border-border pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/15"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
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

        <p className="text-center text-xs leading-relaxed text-muted">
          Akun ini terpisah dari akun tenant. Percobaan gagal berturut-turut mengunci akun sementara.
        </p>
      </div>
    </div>
  );
}
