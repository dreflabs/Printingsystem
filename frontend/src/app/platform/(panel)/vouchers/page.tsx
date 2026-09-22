"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, X, Plus, Pencil, Ticket } from "lucide-react";
import { listVouchers, createVoucher, updateVoucher, type VoucherInput } from "@/actions/platform-billing";

type Voucher = {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  redemptionCount: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const discountLabel = (v: { discountType: string; discountValue: number }) =>
  v.discountType === "PERCENT" ? `${v.discountValue}%` : rupiah(v.discountValue);
const dateLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PlatformVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Voucher | "new" | null>(null);

  const load = useCallback(async () => {
    const r = await listVouchers();
    if (r.success) {
      setVouchers(r.data);
      setError(null);
    } else {
      setError(r.error);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Voucher</h1>
          <p className="text-sm text-muted mt-0.5">
            Kode diskon untuk wizard pendaftaran dan halaman Paket &amp; Tagihan. Voucher dipakai sekali per invoice.
          </p>
        </div>
        <button
          onClick={() => setEdit("new")}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Voucher baru
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-3 text-sm text-status-red flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vouchers.map((v) => (
          <div key={v.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col">
            <div className="flex items-start justify-between">
              <div className="inline-flex p-2 rounded-xl bg-accent-teal/10">
                <Ticket className="h-5 w-5 text-accent-teal" />
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  v.active
                    ? "bg-status-green/10 text-status-green border-status-green/30"
                    : "bg-muted/10 text-muted border-muted/30"
                }`}
              >
                {v.active ? "AKTIF" : "NONAKTIF"}
              </span>
            </div>
            <p className="text-base font-bold text-primary mt-3 font-mono">{v.code}</p>
            {v.description && <p className="text-[11px] text-muted mt-0.5">{v.description}</p>}
            <p className="text-xl font-bold text-primary font-mono mt-2">{discountLabel(v)}</p>
            <ul className="mt-3 space-y-1 text-xs text-muted flex-1">
              <li>
                Pemakaian:{" "}
                <span className="text-primary">
                  {v.usedCount}
                  {v.maxUses != null ? ` / ${v.maxUses}` : " (tanpa batas)"}
                </span>
              </li>
              <li>
                Berlaku: <span className="text-primary">{dateLabel(v.validFrom)} – {dateLabel(v.validUntil)}</span>
              </li>
              <li>
                Redemption tercatat: <span className="text-primary">{v.redemptionCount}</span>
              </li>
            </ul>
            <div className="mt-4 flex items-center justify-end">
              <button
                onClick={() => setEdit(v)}
                className="inline-flex items-center gap-1 text-xs font-bold text-accent-teal hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" /> Ubah
              </button>
            </div>
          </div>
        ))}
        {vouchers.length === 0 && !error && (
          <p className="text-sm text-muted col-span-full py-8 text-center">Belum ada voucher.</p>
        )}
      </div>

      {edit && (
        <VoucherModal
          voucher={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onDone={() => { setEdit(null); load(); }}
        />
      )}
    </div>
  );
}

function VoucherModal({ voucher, onClose, onDone }: { voucher: Voucher | null; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState(voucher?.code ?? "");
  const [description, setDescription] = useState(voucher?.description ?? "");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">(
    voucher?.discountType === "PERCENT" ? "PERCENT" : "FIXED",
  );
  const [discountValue, setDiscountValue] = useState(String(voucher?.discountValue ?? ""));
  const [maxUses, setMaxUses] = useState(voucher?.maxUses != null ? String(voucher.maxUses) : "");
  const [validFrom, setValidFrom] = useState(voucher?.validFrom ? voucher.validFrom.slice(0, 10) : "");
  const [validUntil, setValidUntil] = useState(voucher?.validUntil ? voucher.validUntil.slice(0, 10) : "");
  const [active, setActive] = useState(voucher?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const payload: VoucherInput = {
      code: code.trim().toUpperCase(),
      description,
      discountType,
      discountValue: Number(discountValue),
      maxUses: maxUses.trim() === "" ? null : Number(maxUses),
      validFrom: validFrom || null,
      validUntil: validUntil || null,
      active,
    };
    const r = voucher ? await updateVoucher(voucher.id, payload) : await createVoucher(payload);
    setBusy(false);
    if (r.success) onDone();
    else setErr(r.error ?? "Gagal.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-modal space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">{voucher ? "Ubah Voucher" : "Voucher Baru"}</h3>
          <button aria-label="Tutup voucher" onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

        <Field label="Kode">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PROMO2026"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono"
          />
        </Field>
        <Field label="Keterangan (opsional)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Promo launching"
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis diskon">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value === "PERCENT" ? "PERCENT" : "FIXED")}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
            >
              <option value="FIXED">Nominal (Rp)</option>
              <option value="PERCENT">Persen (%)</option>
            </select>
          </Field>
          <Field label={discountType === "PERCENT" ? "Nilai (%)" : "Nilai (Rp)"}>
            <input
              type="number"
              min={1}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono"
            />
          </Field>
        </div>
        <Field label="Kuota pemakaian (kosong = tanpa batas)">
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal font-mono"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Berlaku dari">
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
            />
          </Field>
          <Field label="Berlaku sampai">
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary outline-none focus:border-accent-teal"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Voucher aktif
        </label>

        <button
          onClick={submit}
          disabled={busy}
          className="w-full h-10 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Menyimpan…" : voucher ? "Simpan perubahan" : "Buat voucher"}
        </button>
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
