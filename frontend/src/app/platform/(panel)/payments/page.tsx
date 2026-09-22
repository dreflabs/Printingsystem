"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, CreditCard, Loader2, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import {
  getPaymentSettingsAdmin,
  updatePaymentSettings,
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  listPaymentProofs,
  reviewPaymentProof,
  type BankAccountInput,
} from "@/actions/platform-payments";
import type { PaymentSettings } from "@/lib/payment-settings";

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label: string | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
};

type Proof = {
  id: string;
  tenantSlug: string;
  tenantName: string;
  invoiceNumber: string;
  invoiceAmount: number;
  invoiceStatus: string;
  billingPeriod: string;
  fileName: string | null;
  note: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default function PlatformPaymentsPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [gatewayPending, setGatewayPending] = useState(true);
  const [providers, setProviders] = useState<{ key: string; label: string }[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | "new" | null>(null);
  const [rejecting, setRejecting] = useState<Proof | null>(null);

  const load = useCallback(async () => {
    const [s, a, p] = await Promise.all([
      getPaymentSettingsAdmin(),
      listBankAccounts(),
      listPaymentProofs("PENDING"),
    ]);
    if (s.success) {
      setSettings(s.data.settings);
      setGatewayConfigured(s.data.gatewayConfigured);
      setGatewayPending(s.data.gatewayPending);
      setProviders(s.data.providers);
    } else setError(s.error);
    if (a.success) setAccounts(a.data);
    else setError(a.error);
    if (p.success) setProofs(p.data);
    else setError(p.error);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    const res = await updatePaymentSettings(settings);
    setSavingSettings(false);
    if (res.success) {
      setSettings(res.data);
      void load();
    } else {
      setError(res.error);
    }
  };

  const removeAccount = async (id: string) => {
    const res = await deleteBankAccount(id);
    if (res.success) void load();
    else setError(res.error);
  };

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-primary">Pembayaran</h1>
        <p className="text-sm text-muted mt-0.5">
          Atur metode pembayaran yang tersedia untuk tenant: payment gateway dan/atau transfer bank manual.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-accent-teal" /> Metode Pembayaran
        </h2>

        <label className="flex items-start justify-between gap-4 rounded-xl border border-border p-3 opacity-70">
          <span>
            <span className="block text-sm font-bold text-primary flex items-center gap-2">
              Payment Gateway
              <span className="rounded-full bg-status-yellow/20 px-2 py-0.5 text-[9px] font-bold text-status-yellow-text">
                PENDING
              </span>
            </span>
            <span className="block text-[11px] text-muted mt-0.5">
              {gatewayPending
                ? "Integrasi gateway (Midtrans) masih dipending. Sementara ini semua tenant memakai transfer bank manual. Toggle akan dibuka setelah Snap + webhook siap."
                : gatewayConfigured
                ? "Provider terkonfigurasi."
                : "Provider belum dikonfigurasi — tenant akan diarahkan ke transfer bank."}
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.gatewayEnabled}
            disabled
            className="mt-1 h-4 w-4 accent-accent-teal cursor-not-allowed"
          />
        </label>

        {settings.gatewayEnabled && (
          <div className="pl-3">
            <label className="block text-[11px] text-muted mb-1">Provider gateway</label>
            <select
              value={settings.gatewayProvider}
              onChange={(e) => setSettings({ ...settings, gatewayProvider: e.target.value })}
              className="h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
            >
              <option value="">— pilih provider —</option>
              {providers.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            {!gatewayConfigured && settings.gatewayProvider && (
              <p className="text-[11px] text-status-yellow-text mt-1">
                Kredensial provider belum ada di environment. Toggle boleh aktif, tetapi tenant belum bisa membayar lewat gateway.
              </p>
            )}
          </div>
        )}

        <label className="flex items-start justify-between gap-4 rounded-xl border border-border p-3 cursor-pointer">
          <span>
            <span className="block text-sm font-bold text-primary">Transfer Bank Manual</span>
            <span className="block text-[11px] text-muted mt-0.5">
              Tenant transfer ke rekening di bawah lalu mengunggah bukti pembayaran untuk diverifikasi.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.manualEnabled}
            onChange={(e) => setSettings({ ...settings, manualEnabled: e.target.checked })}
            className="mt-1 h-4 w-4 accent-accent-teal"
          />
        </label>

        <div>
          <label className="block text-[11px] text-muted mb-1">Instruksi pembayaran manual</label>
          <textarea
            rows={2}
            value={settings.manualInstructions}
            onChange={(e) => setSettings({ ...settings, manualInstructions: e.target.value })}
            className="w-full rounded-lg bg-elevated border border-border p-3 text-sm text-primary outline-none focus:border-accent-teal resize-none"
          />
        </div>

        <button
          onClick={saveSettings}
          disabled={savingSettings}
          className="h-10 px-5 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-50"
        >
          {savingSettings ? "Menyimpan…" : "Simpan pengaturan"}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Wallet className="h-4 w-4 text-accent-teal" /> Rekening Bank
          </h2>
          <button
            onClick={() => setEditAccount("new")}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-elevated border border-border text-xs font-bold text-primary hover:border-accent-teal/50"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah
          </button>
        </div>
        {accounts.length === 0 ? (
          <p className="text-xs text-muted">Belum ada rekening. Tenant tidak bisa transfer manual sampai ada rekening aktif.</p>
        ) : (
          <div className="divide-y divide-border">
            {accounts.map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-primary">
                    {a.bankName} {a.label ? `· ${a.label}` : ""}{" "}
                    {!a.active && <span className="text-muted font-normal">(nonaktif)</span>}
                  </p>
                  <p className="font-mono text-primary">{a.accountNumber}</p>
                  <p className="text-muted">a.n. {a.accountHolder}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditAccount(a)}
                    className="p-2 rounded-lg text-muted hover:text-accent-teal"
                    aria-label="Ubah rekening"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeAccount(a.id)}
                    className="p-2 rounded-lg text-muted hover:text-status-red"
                    aria-label="Hapus rekening"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-bold text-primary">Bukti Pembayaran Menunggu Verifikasi</h2>
        {proofs.length === 0 ? (
          <p className="text-xs text-muted">Tidak ada bukti pembayaran yang menunggu.</p>
        ) : (
          <div className="divide-y divide-border">
            {proofs.map((p) => (
              <div key={p.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-primary">{p.tenantName} <span className="font-mono text-muted">({p.tenantSlug})</span></p>
                  <p className="text-muted mt-0.5">
                    {p.invoiceNumber} · {rupiah(p.invoiceAmount)} · periode {p.billingPeriod}
                  </p>
                  <a
                    href={`/api/payment-proof/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-teal hover:underline font-semibold"
                  >
                    {p.fileName ?? "Lihat bukti"}
                  </a>
                  {p.note && <p className="text-muted mt-0.5">Catatan tenant: {p.note}</p>}
                  <p className="text-muted mt-0.5">{new Date(p.createdAt).toLocaleString("id-ID")}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={async () => {
                      const r = await reviewPaymentProof(p.id, "APPROVE");
                      if (r.success) void load();
                      else setError(r.error);
                    }}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-status-green/10 border border-status-green/30 text-[11px] font-bold text-status-green hover:bg-status-green/20"
                  >
                    <Check className="h-3.5 w-3.5" /> Setujui
                  </button>
                  <button
                    onClick={() => setRejecting(p)}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-status-red/10 border border-status-red/30 text-[11px] font-bold text-status-red hover:bg-status-red/20"
                  >
                    <X className="h-3.5 w-3.5" /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editAccount && (
        <AccountModal
          account={editAccount === "new" ? null : editAccount}
          onClose={() => setEditAccount(null)}
          onDone={() => { setEditAccount(null); void load(); }}
        />
      )}

      {rejecting && (
        <RejectModal
          proof={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => { setRejecting(null); void load(); }}
        />
      )}
    </div>
  );
}

function AccountModal({ account, onClose, onDone }: { account: BankAccount | null; onClose: () => void; onDone: () => void }) {
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [accountHolder, setAccountHolder] = useState(account?.accountHolder ?? "");
  const [label, setLabel] = useState(account?.label ?? "");
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [active, setActive] = useState(account?.active ?? true);
  const [sortOrder, setSortOrder] = useState(String(account?.sortOrder ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const payload: BankAccountInput = {
      bankName,
      accountNumber,
      accountHolder,
      label,
      notes,
      active,
      sortOrder: Number(sortOrder) || 0,
    };
    const r = account ? await updateBankAccount(account.id, payload) : await createBankAccount(payload);
    setBusy(false);
    if (r.success) onDone();
    else setErr(r.error ?? "Gagal.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-modal space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">{account ? "Ubah Rekening" : "Rekening Baru"}</h3>
          <button aria-label="Tutup rekening" onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

        <Field label="Nama bank">
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BCA"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal" />
        </Field>
        <Field label="Nomor rekening">
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="1234567890"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
        </Field>
        <Field label="Nama pemilik rekening">
          <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="PT Print Pilot Digital"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Label (opsional)">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rekening utama"
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal" />
          </Field>
          <Field label="Urutan tampil">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono" />
          </Field>
        </div>
        <Field label="Catatan (opsional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Konfirmasi ke WA 0812… setelah transfer"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal" />
        </Field>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktif (ditampilkan di halaman invoice tenant)
        </label>

        <button onClick={submit} disabled={busy}
          className="w-full h-10 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-40">
          {busy ? "Menyimpan…" : account ? "Simpan perubahan" : "Tambah rekening"}
        </button>
      </div>
    </div>
  );
}

function RejectModal({ proof, onClose, onDone }: { proof: Proof; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await reviewPaymentProof(proof.id, "REJECT", note);
    setBusy(false);
    if (r.success) onDone();
    else setErr(r.error ?? "Gagal.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-modal space-y-3">
        <h3 className="text-base font-bold text-primary">Tolak Bukti Pembayaran</h3>
        <p className="text-xs text-muted">{proof.invoiceNumber} · {proof.tenantName}</p>
        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Alasan penolakan (wajib) — mis. nominal tidak sesuai"
          className="w-full rounded-lg bg-elevated border border-border p-3 text-sm text-primary outline-none focus:border-accent-teal resize-none"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-lg bg-elevated border border-border text-xs font-bold text-primary">Batal</button>
          <button onClick={submit} disabled={busy || !note.trim()}
            className="h-9 px-4 rounded-lg bg-status-red text-white text-xs font-bold disabled:opacity-40">
            {busy ? "Mengirim…" : "Tolak bukti"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}
