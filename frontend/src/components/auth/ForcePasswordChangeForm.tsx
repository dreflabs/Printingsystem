"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { KeyRound, Lock, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { forcePasswordChange } from "@/actions/profile";

export function ForcePasswordChangeForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const hasLen = password.length >= 8;
  const hasMix = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const matches = password.length > 0 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasLen) return setError("Kata sandi minimal 8 karakter.");
    if (!hasMix) return setError("Kata sandi harus mengandung huruf dan angka.");
    if (!matches) return setError("Konfirmasi kata sandi tidak cocok.");

    setIsLoading(true);
    const res = await forcePasswordChange(password);
    if (!res.success) {
      setError(res.error || "Gagal mengubah kata sandi.");
      setIsLoading(false);
      return;
    }
    setDone(true);
    // Sesi lama sudah tidak berlaku (password_changed_at di-bump) — keluar &
    // minta login ulang dengan kata sandi baru.
    //
    // Redirect-nya lewat window.location, BUKAN callbackUrl signOut: di belakang
    // reverse proxy, Auth.js kadang menyusun URL absolut dari origin internal
    // (localhost:3000) sehingga callback melempar ke host yang salah. Browser
    // me-resolve path relatif ini terhadap origin yang benar.
    setTimeout(async () => {
      await signOut({ redirect: false });
      window.location.href = "/login?changed=1";
    }, 1800);
  }

  return (
    <div className="w-full max-w-[420px] bg-card p-8 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-border">
      <div className="w-12 h-12 rounded-xl bg-accent-teal/10 flex items-center justify-center mb-6">
        <KeyRound className="h-6 w-6 text-accent-teal" />
      </div>
      <h1 className="text-2xl font-bold text-primary mb-2">Ganti Kata Sandi</h1>
      <p className="text-muted text-sm leading-relaxed mb-8">
        Akun Anda masih memakai kata sandi bawaan sistem. Buat kata sandi baru
        untuk melanjutkan. Setelah diganti, Anda akan diminta masuk ulang.
      </p>

      {done ? (
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
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-border bg-base outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Konfirmasi Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-base outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal transition-all"
              />
            </div>
          </div>

          <ul className="text-xs space-y-1">
            <li className={hasLen ? "text-status-green" : "text-muted"}>• Minimal 8 karakter</li>
            <li className={hasMix ? "text-status-green" : "text-muted"}>• Gabungan huruf dan angka</li>
            <li className={matches ? "text-status-green" : "text-muted"}>• Konfirmasi cocok</li>
          </ul>

          <Button type="submit" isLoading={isLoading} className="w-full h-12 rounded-xl text-base mt-2">
            Simpan &amp; Masuk Ulang
          </Button>
        </form>
      )}
    </div>
  );
}
