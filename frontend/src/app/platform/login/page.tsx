"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ShieldCheck, Lock, Mail, LogIn, KeyRound, ArrowLeft } from "lucide-react";
import { requestPlatformLoginOtp } from "@/actions/platform-auth";

type Step = "credentials" | "otp";

export default function PlatformLoginPage() {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNote("");
    const res = await requestPlatformLoginOtp(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Gagal mengirim kode.");
      return;
    }
    if (res.note) setNote(res.note);
    setStep("otp");
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      redirect: false,
      username: email,
      password,
      otp: otp.trim(),
    });
    if (res?.error || !res?.ok) {
      setError("Kode salah atau kedaluwarsa. Coba lagi, atau kirim ulang kode.");
      setLoading(false);
      return;
    }
    window.location.href = "/platform";
  }

  async function resend() {
    setLoading(true);
    setError("");
    setNote("");
    const res = await requestPlatformLoginOtp(email, password);
    setLoading(false);
    if (!res.ok) setError(res.error || "Gagal mengirim ulang kode.");
    else setNote(res.note || "Kode baru sudah dikirim.");
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

        {step === "credentials" ? (
          <form onSubmit={submitCredentials} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
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
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Kirim kode ke email
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setOtp("");
                setError("");
                setNote("");
              }}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Ganti email / password
            </button>
            <p className="text-xs text-muted">
              Kode 6 digit dikirim ke <span className="font-medium text-primary">{email}</span>. Berlaku 10 menit.
            </p>
            {note && (
              <p className="rounded-xl bg-status-yellow/10 border border-status-yellow/30 px-3 py-2 text-xs text-status-yellow-text">{note}</p>
            )}
            {error && (
              <p className="rounded-xl bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{error}</p>
            )}
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Kode dari email</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full h-11 rounded-xl bg-elevated border border-border pl-10 pr-4 text-center text-lg tracking-[0.3em] font-mono text-primary outline-none focus:border-accent-teal"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Masuk
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={loading}
              className="w-full text-xs text-accent-teal hover:underline disabled:opacity-50"
            >
              Kirim ulang kode
            </button>
          </form>
        )}

        <p className="text-center text-[11px] text-muted">
          Akun ini terpisah dari akun tenant. Setiap login butuh kode yang dikirim ke email Super Admin.
        </p>
      </div>
    </div>
  );
}
