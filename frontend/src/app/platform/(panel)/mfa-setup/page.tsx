"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { signOut } from "next-auth/react";
import { ShieldCheck, Copy, Check, AlertTriangle } from "lucide-react";
import { getMyMfaState, startMfaEnrollment, confirmMfaEnrollment } from "@/actions/platform-admins";

type Step = "intro" | "scan" | "backup" | "done";

export default function MfaSetupPage() {
  const [step, setStep] = useState<Step>("intro");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    getMyMfaState().then((r) => {
      if (r.success) {
        setEmail(r.data.email);
        // Jika entah bagaimana MFA sudah aktif, tak ada yang perlu dilakukan di sini.
        if (r.data.enabled) setStep("done");
      }
    });
  }, []);

  async function begin() {
    setBusy(true);
    setError(null);
    const r = await startMfaEnrollment();
    setBusy(false);
    if (!r.success) return setError(r.error);
    setSecret(r.data.secret);
    setUri(r.data.uri);
    setStep("scan");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const r = await confirmMfaEnrollment(code.trim());
    setBusy(false);
    if (!r.success) return setError(r.error);
    setBackupCodes(r.data.backupCodes);
    setStep("backup");
  }

  function copyBackup() {
    navigator.clipboard?.writeText(backupCodes.join("\n")).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 py-4">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-teal/10 text-accent-teal mb-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-primary">Aktifkan MFA</h1>
        <p className="text-sm text-muted mt-1">
          Akun Super Admin menjangkau semua tenant — MFA wajib sebelum bisa memakai panel.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        {step === "intro" && (
          <>
            <p className="text-sm text-muted">
              Siapkan aplikasi authenticator (Google Authenticator, Authy, 1Password, dll). Anda akan
              memindai QR lalu memasukkan satu kode untuk memastikannya bekerja.
            </p>
            <button
              onClick={begin}
              disabled={busy}
              className="w-full h-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Menyiapkan…" : "Mulai"}
            </button>
          </>
        )}

        {step === "scan" && (
          <>
            <div className="flex justify-center rounded-xl bg-white p-4">
              <QRCodeSVG value={uri} size={176} />
            </div>
            <div className="text-center">
              <p className="text-[11px] text-muted">Tidak bisa memindai? Masukkan kunci ini manual:</p>
              <p className="font-mono text-xs text-primary break-all mt-1">{secret}</p>
            </div>
            <label className="block text-xs font-medium text-muted">
              Kode 6 digit dari aplikasi
              <input
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="mt-1 w-full h-11 rounded-xl bg-elevated border border-border px-3 text-center text-lg tracking-[0.3em] font-mono text-primary outline-none focus:border-accent-teal"
              />
            </label>
            <button
              onClick={verify}
              disabled={busy || code.length !== 6}
              className="w-full h-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Memverifikasi…" : "Verifikasi & aktifkan"}
            </button>
          </>
        )}

        {step === "backup" && (
          <>
            <div className="rounded-xl border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow-text">
              Simpan kode cadangan ini di tempat aman. <b>Hanya ditampilkan sekali.</b> Masing-masing
              bisa dipakai satu kali untuk masuk jika kehilangan perangkat.
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm text-primary bg-elevated rounded-xl p-3">
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <button
              onClick={copyBackup}
              className="w-full h-9 rounded-lg border border-border text-xs font-bold text-muted hover:text-primary inline-flex items-center justify-center gap-1.5"
            >
              {copied ? <><Check className="h-3.5 w-3.5" /> Tersalin</> : <><Copy className="h-3.5 w-3.5" /> Salin semua</>}
            </button>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              Saya sudah menyimpan kode cadangan ini
            </label>
            <button
              onClick={() => signOut({ redirectTo: "/platform/login" })}
              disabled={!saved}
              className="w-full h-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
            >
              Selesai — login ulang dengan MFA
            </button>
          </>
        )}

        {step === "done" && (
          <>
            <p className="text-sm text-status-green font-semibold">MFA sudah aktif untuk {email}.</p>
            <a href="/platform" className="block text-center h-10 leading-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110">
              Ke dashboard
            </a>
          </>
        )}
      </div>
    </div>
  );
}
