"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  Loader2,
  Printer,
  Upload,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui";
import {
  createPaymentProofUploadUrl,
  getTenantInvoiceDetail,
  submitPaymentProof,
  type TenantInvoiceDetail,
} from "@/actions/billing";

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const dateLabel = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Pembayaran",
  PAID: "Lunas",
  FAILED: "Gagal",
  WAIVED: "Dibebaskan",
};

const PROOF_LABEL: Record<string, string> = {
  PENDING: "Menunggu verifikasi",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = decodeURIComponent((params.id as string) ?? "");
  const { toast } = useToast();
  const [data, setData] = useState<TenantInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getTenantInvoiceDetail(invoiceId);
    if (res.success) setData(res.data);
    else toast({ type: "error", title: "Gagal memuat invoice", message: res.error });
    setLoading(false);
  }, [invoiceId, toast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const copyAccount = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast({ type: "error", title: "Gagal menyalin", message: "Salin nomor rekening secara manual." });
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file || !data) return;
    setUploading(true);
    try {
      const urlRes = await createPaymentProofUploadUrl(data.id, { fileName: file.name, size: file.size });
      if (!urlRes.success) {
        toast({ type: "error", title: "Upload gagal", message: urlRes.error });
        return;
      }
      const put = await fetch(urlRes.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!put.ok) {
        toast({ type: "error", title: "Upload gagal", message: "File tidak berhasil diunggah. Coba lagi." });
        return;
      }
      const sub = await submitPaymentProof(data.id, {
        fileKey: urlRes.data.objectKey,
        fileName: file.name,
        note,
      });
      if (!sub.success) {
        toast({ type: "error", title: "Gagal mengirim bukti", message: sub.error });
        return;
      }
      toast({ type: "success", title: "Bukti pembayaran terkirim", message: "Tim kami akan memverifikasi dalam 1×24 jam." });
      setNote("");
      void load();
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat invoice…
      </div>
    );
  }
  if (!data) return null;

  const paid = data.status === "PAID";
  const waived = data.status === "WAIVED";
  const pendingProof = data.proofs.find((p) => p.status === "PENDING") ?? null;
  const lastRejected = data.proofs.find((p) => p.status === "REJECTED") ?? null;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/owner/billing" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Paket &amp; Tagihan
      </Link>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">Nomor Invoice</p>
            <p className="text-lg font-bold text-primary font-mono">{data.number}</p>
            <p className="text-xs text-muted mt-1">Paket {data.planName}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted">Total Tagihan</p>
            <p className="text-2xl font-extrabold text-primary">{rupiah(data.amount)}</p>
            <span
              className={
                "inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border " +
                (paid
                  ? "bg-status-green/10 text-status-green border-status-green/30"
                  : waived
                  ? "bg-muted/10 text-muted border-muted/30"
                  : "bg-status-yellow/10 text-status-yellow-text border-status-yellow/30")
              }
            >
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-border text-xs">
          <div>
            <p className="text-muted">Pelanggan</p>
            <p className="font-bold text-primary">{data.tenantName}</p>
          </div>
          <div>
            <p className="text-muted">Jatuh Tempo</p>
            <p className="font-bold text-primary">{dateLabel(data.dueDate)}</p>
          </div>
          <div>
            <p className="text-muted">Periode</p>
            <p className="font-bold text-primary">
              {dateLabel(data.periodStart)} – {dateLabel(data.periodEnd)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent-teal" /> Rincian Tagihan
        </h2>
        <div className="space-y-2">
          {data.lines.map((l, i) => (
            <div key={i} className="flex items-start justify-between gap-3 text-xs">
              <span className="text-muted min-w-0">{l.description}</span>
              <span className={"shrink-0 " + (l.amount < 0 ? "text-status-green font-semibold" : "text-primary")}>
                {rupiah(l.amount)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-sm font-bold text-primary">Total Pembayaran</span>
          <span className="text-lg font-extrabold text-primary">{rupiah(data.amount)}</span>
        </div>
      </section>

      {!paid && !waived && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent-teal" /> Informasi Pembayaran
          </h2>

          {data.gatewayEnabled && (
            <div className="rounded-xl border border-border px-3 py-2 text-[11px] text-muted">
              {data.gatewayReady
                ? "Pembayaran otomatis via payment gateway tersedia."
                : "Pembayaran otomatis via gateway sedang disiapkan. Untuk sekarang gunakan transfer bank."}
            </div>
          )}

          {data.manualEnabled && data.bankAccounts.length > 0 ? (
            <>
              <div className="space-y-2">
                {data.bankAccounts.map((b) => (
                  <div key={b.id} className="rounded-xl border border-border bg-elevated px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-accent-teal">
                          {b.bankName}
                          {b.label ? ` · ${b.label}` : ""}
                        </p>
                        <p className="text-lg font-extrabold text-primary font-mono">{b.accountNumber}</p>
                        <p className="text-[11px] text-muted">a.n. {b.accountHolder}</p>
                        {b.notes && <p className="text-[10px] text-muted mt-1">{b.notes}</p>}
                      </div>
                      <button
                        onClick={() => copyAccount(b.id, b.accountNumber)}
                        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-card border border-border text-[11px] font-bold text-primary hover:border-accent-teal/50"
                      >
                        {copiedId === b.id ? <Check className="h-3.5 w-3.5 text-status-green" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId === b.id ? "Tersalin" : "Salin"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted leading-relaxed">{data.manualInstructions}</p>

              <div className="rounded-xl border border-border p-4 space-y-3">
                <p className="text-xs font-bold text-primary flex items-center gap-2">
                  <Upload className="h-4 w-4 text-accent-teal" /> Upload Bukti Pembayaran
                </p>
                {pendingProof ? (
                  <p className="text-[11px] text-status-yellow-text font-semibold">
                    Bukti pembayaran sudah dikirim dan sedang menunggu verifikasi tim kami.
                  </p>
                ) : (
                  <>
                    {lastRejected && (
                      <p className="text-[11px] text-status-red font-semibold">
                        Bukti sebelumnya ditolak{lastRejected.reviewNote ? `: ${lastRejected.reviewNote}` : "."} Silakan unggah ulang.
                      </p>
                    )}
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Catatan (opsional): nama pengirim, tanggal transfer…"
                      className="w-full h-10 rounded-lg bg-elevated border border-border px-3 text-sm text-primary placeholder:text-muted/50 outline-none focus:border-accent-teal"
                    />
                    <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-accent-teal text-white text-xs font-bold cursor-pointer hover:brightness-110">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Mengunggah…" : "Pilih File"}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          void onPickFile(f);
                        }}
                      />
                    </label>
                    <p className="text-[10px] text-muted">Format JPG, PNG, atau PDF. Maks 5 MB.</p>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted">
              Belum ada rekening tujuan. Hubungi tim Print Pilot untuk cara pembayaran.
            </p>
          )}
        </section>
      )}

      {data.proofs.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
          <h2 className="text-sm font-bold text-primary">Riwayat Bukti Pembayaran</h2>
          <div className="divide-y divide-border">
            {data.proofs.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <a
                    href={`/api/payment-proof/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-accent-teal hover:underline truncate block"
                  >
                    {p.fileName ?? "bukti-pembayaran"}
                  </a>
                  <p className="text-muted mt-0.5">{new Date(p.createdAt).toLocaleString("id-ID")}</p>
                  {p.note && <p className="text-muted mt-0.5">{p.note}</p>}
                  {p.reviewNote && <p className="text-status-red mt-0.5">{p.reviewNote}</p>}
                </div>
                <span
                  className={
                    "shrink-0 inline-flex items-center gap-1 text-[11px] font-bold " +
                    (p.status === "APPROVED"
                      ? "text-status-green"
                      : p.status === "REJECTED"
                      ? "text-status-red"
                      : "text-status-yellow-text")
                  }
                >
                  {p.status === "APPROVED" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : p.status === "REJECTED" ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Clock3 className="h-3.5 w-3.5" />
                  )}
                  {PROOF_LABEL[p.status] ?? p.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <a
        href={`/print/invoice/${data.id}`}
        target="_blank"
        rel="noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-elevated border border-border text-sm font-bold text-primary hover:border-accent-teal/50"
      >
        <Printer className="h-4 w-4" /> Cetak / Download Invoice
      </a>
    </div>
  );
}
