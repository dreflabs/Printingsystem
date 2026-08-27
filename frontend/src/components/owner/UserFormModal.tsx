"use client";

import { useState } from "react";
import { X, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserFormModalProps {
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isLoading: boolean;
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

export function UserFormModal({ onClose, onSave, isLoading }: UserFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
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

          {/* Default password info */}
          <div className="p-3 bg-status-yellow/10 border border-status-yellow/30 rounded-xl">
            <p className="text-xs text-status-yellow-text font-medium">
              Password otomatis (Default):{" "}
              <strong className="font-mono bg-status-yellow/20 px-1 py-0.5 rounded">printpilot123!</strong>
              <br />
              Pegawai wajib mengubah password pada saat login pertama kali.
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
