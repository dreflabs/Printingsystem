"use client";

import { useRef, useState } from "react";
import { X, Info, ShieldCheck, Copy, Check, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";

export interface NewEmployeeInput {
  name: string;
  username: string;
  email: string;
  phone?: string;
  role_name: string;
  extra_role_names: string[];
}

interface UserFormModalProps {
  onClose: () => void;
  onSave: (data: NewEmployeeInput) => Promise<void>;
  isLoading: boolean;
  workspaceSlug?: string | null;
}

// Role definitions with labels and descriptions
const AVAILABLE_ROLES = [
  {
    id: "admin",
    name: "Admin",
    desc: "Order, pembayaran, assign produksi, pickup",
  },
  {
    id: "designer_sales",
    name: "Designer / Setting",
    desc: "Buat order, upload & approval desain",
  },
  {
    id: "operator",
    name: "Operator Cetak",
    desc: "Jalankan mesin, scan QR job, input material",
  },
  {
    id: "gudang",
    name: "Finishing & Gudang",
    desc: "QC, finishing, storage & input stok bahan",
  },
];

// Priority order for determining primary role
const PRIORITY = ["admin", "designer_sales", "operator", "gudang"];

export function UserFormModal({ onClose, onSave, isLoading, workspaceSlug }: UserFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    selectedRoles: ["operator"] as string[],
  });

  // Primary role = highest-priority among selected roles
  const primaryRole =
    PRIORITY.find((r) => formData.selectedRoles.includes(r)) ??
    formData.selectedRoles[0] ??
    "operator";

  const toggleRole = (roleId: string) => {
    setFormData((prev) => {
      const already = prev.selectedRoles.includes(roleId);
      // Must keep at least 1 role selected
      if (already && prev.selectedRoles.length === 1) return prev;
      return {
        ...prev,
        selectedRoles: already
          ? prev.selectedRoles.filter((r) => r !== roleId)
          : [...prev.selectedRoles, roleId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const extraRoles = formData.selectedRoles.filter((r) => r !== primaryRole);
    await onSave({
      name: formData.name,
      username: formData.username,
      email: formData.email,
      phone: formData.phone.trim() || undefined,
      role_name: primaryRole,
      extra_role_names: extraRoles,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-elevated/50">
          <h2 className="text-lg font-bold text-primary">Tambah Pegawai Baru</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-base text-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Nama */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Nama Lengkap</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
              placeholder="Contoh: Budi Santoso"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Username</label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, "") })
              }
              className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
              placeholder="Contoh: budi_s"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
              placeholder="budi@example.com"
            />
          </div>

          {/* Nomor HP */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">
              Nomor HP <span className="font-normal text-muted">(opsional)</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
              placeholder="08xxxxxxxxxx"
            />
            <p className="text-[11px] text-muted">Untuk notifikasi WhatsApp absensi (peringatan istirahat, dll).</p>
          </div>

          {/* Multi-role selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-primary">Role / Peran</label>
              <span className="text-[10px] text-muted flex items-center gap-1">
                <Info className="h-3 w-3" /> Bisa pilih lebih dari 1
              </span>
            </div>

            <div className="space-y-2">
              {AVAILABLE_ROLES.map((role) => {
                const isSelected = formData.selectedRoles.includes(role.id);
                const isPrimary = role.id === primaryRole && formData.selectedRoles.length > 1;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                      isSelected
                        ? "border-accent-teal/50 bg-accent-teal/5"
                        : "border-border hover:border-border/80 hover:bg-elevated/50"
                    )}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={cn(
                        "mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                        isSelected ? "bg-accent-teal border-accent-teal" : "border-muted/50"
                      )}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm font-semibold", isSelected ? "text-primary" : "text-muted")}>
                          {role.name}
                        </span>
                        {isPrimary && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-teal/20 text-accent-teal border border-accent-teal/30 flex items-center gap-0.5">
                            <ShieldCheck className="h-2.5 w-2.5" /> PRIMARY
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{role.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Solo Mode tip */}
            <div className="flex items-start gap-2 p-3 bg-status-blue/10 border border-status-blue/20 rounded-xl">
              <Info className="h-4 w-4 text-status-blue shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted leading-relaxed">
                <span className="font-bold text-status-blue">Solo Mode:</span> Untuk percetakan kecil, pilih{" "}
                <strong>semua role</strong> agar 1 karyawan bisa mengoperasikan seluruh bagian sistem.
              </p>
            </div>
          </div>

          {/* Password info */}
          <div className="p-3 bg-status-blue/10 border border-status-blue/20 rounded-xl">
            <p className="text-xs text-muted leading-relaxed">
              <span className="font-bold text-status-blue">Password sementara acak</span> akan dibuat saat
              disimpan dan ditampilkan sekali untuk Anda serahkan ke pegawai. Pegawai wajib menggantinya
              saat login pertama.
              {workspaceSlug && (
                <>
                  <br />
                  Workspace: <strong className="font-mono">{workspaceSlug}</strong>
                </>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm border border-border text-primary hover:bg-elevated transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading || formData.selectedRoles.length === 0}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm bg-accent-teal text-white transition-all shadow-sm",
                isLoading
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:bg-accent-teal/90 hover:shadow-md hover:-translate-y-0.5"
              )}
            >
              {isLoading ? "Menyimpan..." : "Simpan Pegawai"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Tampil SEKALI setelah pegawai dibuat / password direset. Menampilkan kredensial
 * lengkap (workspace + username + password sementara) untuk diserahkan Owner ke
 * pegawai. Tidak bisa ditutup sebelum Owner menandai sudah menyalin.
 */
export function CredentialRevealDialog({
  cred,
  workspaceSlug,
  onClose,
}: {
  cred: { name: string; username: string; tempPassword: string; reset?: boolean };
  workspaceSlug?: string | null;
  onClose: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [ack, setAck] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  const block =
    (workspaceSlug ? `Workspace: ${workspaceSlug}\n` : "") +
    `Username: ${cred.username}\n` +
    `Password sementara: ${cred.tempPassword}`;

  const copy = async () => {
    const ok = await copyText(block);
    setCopyState(ok ? "ok" : "fail");
    if (!ok) {
      // Fallback manual: seleksi blok teks supaya user tinggal tekan Ctrl/Cmd+C.
      const el = blockRef.current;
      if (el && typeof window !== "undefined") {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
    setTimeout(() => setCopyState("idle"), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 p-5 border-b border-border bg-elevated/50">
          <KeyRound className="h-5 w-5 text-accent-teal" />
          <h2 className="text-lg font-bold text-primary">
            {cred.reset ? "Password direset" : "Pegawai dibuat"} — {cred.name}
          </h2>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow-text">
            Salin sekarang &amp; serahkan ke pegawai lewat jalur pribadi. <b>Tidak ditampilkan lagi.</b>
            {cred.reset && " Sesi lama pegawai langsung berhenti."}
          </div>

          <div
            ref={blockRef}
            className="rounded-xl bg-elevated border border-border p-3 font-mono text-sm text-primary space-y-1.5 select-all"
          >
            {workspaceSlug && (
              <div>
                <span className="text-muted">Workspace</span>: {workspaceSlug}
              </div>
            )}
            <div>
              <span className="text-muted">Username</span>: {cred.username}
            </div>
            <div>
              <span className="text-muted">Password</span>:{" "}
              <span className="bg-status-yellow/20 px-1 py-0.5 rounded">{cred.tempPassword}</span>
            </div>
          </div>

          <button
            onClick={copy}
            className={cn(
              "w-full h-9 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5",
              copyState === "ok"
                ? "border-status-green/40 bg-status-green/10 text-status-green"
                : copyState === "fail"
                  ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow-text"
                  : "border-border text-muted hover:text-primary"
            )}
          >
            {copyState === "ok" ? (
              <><Check className="h-3.5 w-3.5" /> Tersalin</>
            ) : copyState === "fail" ? (
              <><Info className="h-3.5 w-3.5" /> Teks dipilih — tekan Ctrl/Cmd+C</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> Salin kredensial</>
            )}
          </button>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            Saya sudah menyalin &amp; akan menyerahkan ke pegawai
          </label>

          <button
            onClick={onClose}
            disabled={!ack}
            className="w-full h-10 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
