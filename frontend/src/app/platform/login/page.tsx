"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ShieldCheck, Lock, Mail, LogIn } from "lucide-react";

export default function PlatformLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { redirect: false, username: email, password });
    if (res?.error || !res?.ok) {
      setError("Email atau password salah.");
      setLoading(false);
      return;
    }
    window.location.href = "/platform";
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-teal/10 text-accent-teal mb-3">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-primary">Print Pilot — Platform</h1>
          <p className="text-sm text-muted">Panel Super Admin (pengelola SaaS)</p>
        </div>

        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          {error && (
            <p className="rounded-xl bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{error}</p>
          )}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@printpilot.id"
                className="w-full h-11 rounded-xl bg-elevated border border-border pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 rounded-xl bg-elevated border border-border pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
          >
            {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="h-4 w-4" /> Masuk</>}
          </button>
        </form>
        <p className="text-center text-[11px] text-muted">
          Akun ini terpisah dari akun tenant. MFA belum diaktifkan (roadmap SaaS).
        </p>
      </div>
    </div>
  );
}
