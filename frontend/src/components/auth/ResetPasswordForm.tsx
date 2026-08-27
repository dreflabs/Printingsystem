"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { resetPassword } from "@/actions/password-reset";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const missingToken = !token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setIsLoading(true);
    const res = await resetPassword(token, password);
    setIsLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <div className="w-full max-w-[420px] bg-card p-8 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-border">
      <div className="w-12 h-12 rounded-xl bg-accent-teal/10 flex items-center justify-center mb-6">
        <KeyRound className="h-6 w-6 text-accent-teal" />
      </div>
      <h1 className="text-2xl font-bold text-primary mb-2">Atur Kata Sandi Baru</h1>
      <p className="text-muted text-sm leading-relaxed mb-8">
        Buat kata sandi baru untuk akun Owner Anda. Sesi login lama tetap berlaku
        hingga kedaluwarsa.
      </p>

      {missingToken ? (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm font-semibold text-status-red">
          Tautan reset tidak lengkap. Minta tautan baru dari halaman{" "}
          <Link href="/forgot-password" className="underline">
            Lupa Password
          </Link>
          .
        </div>
      ) : done ? (
        <div className="bg-status-green/10 border border-status-green/20 rounded-xl p-5 text-center animate-in zoom-in duration-300">
          <CheckCircle2 className="h-8 w-8 text-status-green mx-auto mb-3" />
          <h3 className="font-bold text-primary mb-1">Kata Sandi Diperbarui!</h3>
          <p className="text-sm text-muted">Mengalihkan ke halaman login…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2.5 text-xs font-semibold text-status-red">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Kata Sandi Baru</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-base outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Konfirmasi Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-base outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all"
              />
            </div>
          </div>
          <Button type="submit" isLoading={isLoading} className="w-full h-12 rounded-xl text-base mt-2">
            Simpan Kata Sandi
          </Button>
        </form>
      )}

      <Link
        href="/login"
        className="mt-6 inline-block text-sm text-muted hover:text-primary transition-colors"
      >
        ← Kembali ke Login
      </Link>
    </div>
  );
}
