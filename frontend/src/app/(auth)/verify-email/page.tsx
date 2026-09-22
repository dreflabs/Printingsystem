"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { resendRegistrationVerification, verifyRegistrationEmail } from "@/actions/email-verification";

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Memeriksa tautan verifikasi…");
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void verifyRegistrationEmail(token).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setState("success");
        setMessage("Email terverifikasi. Anda sekarang dapat masuk ke workspace Print Pilot.");
      } else {
        setState("error");
        setMessage(result.error);
      }
    });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main className="min-h-screen bg-base flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-teal/10 text-accent-teal">
          {state === "loading" ? <Loader2 className="h-7 w-7 animate-spin" /> : state === "success" ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7 text-status-red" />}
        </div>
        <div className="mb-2 flex items-center justify-center gap-2 text-lg font-bold text-primary">
          <ShieldCheck className="h-5 w-5 text-accent-teal" /> Verifikasi Email
        </div>
        <p className="text-sm text-muted">{message}</p>
        {state !== "loading" && (
          <>
            <Link href="/login" className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-accent-teal px-6 text-sm font-bold text-white hover:brightness-110">
              Ke halaman masuk
            </Link>
            {state === "error" && (
              <form
                className="mt-7 space-y-3 border-t border-border pt-5 text-left"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setResending(true);
                  const result = await resendRegistrationVerification(email, workspace);
                  setMessage(result.success ? "Jika akun masih menunggu verifikasi, tautan baru telah dikirim." : result.error);
                  setResending(false);
                }}
              >
                <p className="text-xs font-semibold text-muted">Minta tautan baru</p>
                <input className="h-10 w-full rounded-xl border border-border bg-base px-3 text-sm" type="email" placeholder="Email owner" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="h-10 w-full rounded-xl border border-border bg-base px-3 text-sm" placeholder="Workspace / subdomain" value={workspace} onChange={(e) => setWorkspace(e.target.value)} required />
                <button disabled={resending} className="h-10 w-full rounded-xl border border-accent-teal text-sm font-bold text-accent-teal disabled:opacity-50" type="submit">{resending ? "Mengirim…" : "Kirim ulang"}</button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<div className="min-h-screen bg-base" />}><VerifyEmailContent /></Suspense>;
}
