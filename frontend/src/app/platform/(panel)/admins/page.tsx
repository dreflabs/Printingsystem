"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, AlertTriangle, X, KeyRound, Lock, UserPlus } from "lucide-react";
import {
  listSuperAdmins,
  createSuperAdmin,
  setSuperAdminActive,
  resetSuperAdminPassword,
  unlockSuperAdmin,
} from "@/actions/platform-admins";

type Admin = {
  id: string;
  name: string;
  email: string;
  subLevel: string;
  active: boolean;
  locked: boolean;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
};

const dt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function PlatformAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [me, setMe] = useState<{ id: string; subLevel: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pwFor, setPwFor] = useState<Admin | null>(null);

  const canManage = me?.subLevel === "SUPER_ADMIN";

  const load = useCallback(async () => {
    const r = await listSuperAdmins();
    if (r.success) {
      setAdmins(r.data.admins);
      setMe(r.data.me);
      setError(null);
    } else setError(r.error);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function run(id: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(id);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.success) setError(r.error ?? "Aksi gagal.");
    else await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Akun Super Admin</h1>
          <p className="text-sm text-muted mt-0.5">
            Kelola akun pengelola platform. Semua akun punya akses penuh (satu level).
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 shrink-0"
          >
            <UserPlus className="h-3.5 w-3.5" /> Tambah
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4 text-accent-teal" />
          <h2 className="text-sm font-semibold text-primary">{admins.length} akun</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Nama / Email</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Login terakhir</th>
                {canManage && <th className="px-4 py-2.5 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {admins.map((a) => {
                const self = a.id === me?.id;
                return (
                  <tr key={a.id} className="hover:bg-elevated/30 align-top">
                    <td className="px-4 py-3">
                      <div className="text-primary font-medium">
                        {a.name} {self && <span className="text-[10px] text-muted">(Anda)</span>}
                      </div>
                      <div className="text-xs text-muted font-mono">{a.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          a.active
                            ? "bg-status-green/10 text-status-green border-status-green/30"
                            : "bg-muted/10 text-muted border-muted/30"
                        }`}
                      >
                        {a.active ? "AKTIF" : "NONAKTIF"}
                      </span>
                      {a.locked && (
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-red/10 text-status-red border border-status-red/30">
                          TERKUNCI
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{dt(a.lastLoginAt)}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                          <button
                            disabled={busy === a.id}
                            onClick={() => setPwFor(a)}
                            className="inline-flex items-center gap-1 text-muted hover:text-primary disabled:opacity-40"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Sandi
                          </button>
                          {a.locked && (
                            <button
                              disabled={busy === a.id}
                              onClick={() => run(a.id, () => unlockSuperAdmin(a.id))}
                              className="inline-flex items-center gap-1 text-status-green hover:underline disabled:opacity-40"
                            >
                              <Lock className="h-3.5 w-3.5" /> Buka kunci
                            </button>
                          )}
                          {!self && (
                            <button
                              disabled={busy === a.id}
                              onClick={() => run(a.id, () => setSuperAdminActive(a.id, !a.active))}
                              className={`inline-flex items-center gap-1 disabled:opacity-40 ${
                                a.active ? "text-status-red hover:underline" : "text-status-green hover:underline"
                              }`}
                            >
                              {a.active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={load} />}
      {pwFor && <PasswordModal admin={pwFor} onClose={() => setPwFor(null)} />}
    </div>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await createSuperAdmin({ name, email, password });
    setBusy(false);
    if (r.success) {
      onDone();
      onClose();
    } else setErr(r.error ?? "Gagal.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-modal space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">Tambah Super Admin</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>
        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama"
          className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@printpilot.id"
          className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Kata sandi (min. 12, huruf + angka)"
          className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
        />
        <p className="text-[11px] text-muted">Akun ini akan punya <b>akses penuh</b> (semua Super Admin satu level).</p>
        <button
          onClick={submit}
          disabled={busy}
          className="w-full h-10 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Membuat…" : "Buat akun"}
        </button>
      </div>
    </div>
  );
}

function PasswordModal({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await resetSuperAdminPassword(admin.id, password);
    setBusy(false);
    if (r.success) {
      setMsg("Kata sandi diperbarui & kunci dibuka.");
      setPassword("");
    } else setErr(r.error ?? "Gagal.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-modal space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">Reset kata sandi</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-muted font-mono">{admin.email}</p>
        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
        {msg && <p className="rounded-lg bg-status-green/10 border border-status-green/30 px-3 py-2 text-xs text-status-green">{msg}</p>}
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Kata sandi baru (min. 12, huruf + angka)"
          className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
        />
        <button
          onClick={submit}
          disabled={busy || password.length < 12}
          className="w-full h-10 rounded-lg bg-status-red text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Menyimpan…" : "Reset kata sandi"}
        </button>
      </div>
    </div>
  );
}
