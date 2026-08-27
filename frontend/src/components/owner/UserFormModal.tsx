"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserFormModalProps {
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isLoading: boolean;
}

export function UserFormModal({ onClose, onSave, isLoading }: UserFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    role_name: "operator", // default
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const roles = [
    { id: "admin", name: "Admin" },
    { id: "designer_sales", name: "Designer / Setting" },
    { id: "operator", name: "Operator Cetak" },
    { id: "finishing", name: "Finishing (QC & Storage)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border bg-elevated/50">
          <h2 className="text-lg font-bold text-primary">Tambah Pegawai Baru</h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-base text-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Nama Lengkap</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
              placeholder="Contoh: Budi Santoso"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Username</label>
            <input 
              type="text" 
              required
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '')})}
              className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
              placeholder="Contoh: budi_s"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Email</label>
            <input 
              type="email" 
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
              placeholder="budi@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-primary">Role / Peran</label>
            <select
              value={formData.role_name}
              onChange={e => setFormData({...formData, role_name: e.target.value})}
              className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all appearance-none"
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-status-yellow/10 border border-status-yellow/30 rounded-xl mt-2">
            <p className="text-xs text-status-yellow-text font-medium">
              Password otomatis (Default): <strong className="font-mono bg-status-yellow/20 px-1 py-0.5 rounded">printpilot123!</strong><br />
              Pegawai wajib mengubah password pada saat login pertama kali.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
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
              disabled={isLoading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm bg-accent-teal text-white transition-all shadow-sm",
                isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-accent-teal/90 hover:shadow-md hover:-translate-y-0.5"
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
