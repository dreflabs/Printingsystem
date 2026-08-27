"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, KeyRound, Ban, CheckCircle2, ShieldAlert, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserFormModal } from "@/components/owner/UserFormModal";
import { getTenantUsers, createEmployee, toggleEmployeeStatus, resetEmployeePassword } from "@/actions/user-management";

export default function OwnerUsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMessage, setActionMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getTenantUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
    setIsLoading(false);
  };

  const handleSaveUser = async (formData: any) => {
    setIsSaving(true);
    setActionMessage(null);
    const result = await createEmployee(formData);
    
    if (result.success) {
      setIsModalOpen(false);
      setActionMessage({ type: "success", text: `Pegawai ${formData.name} berhasil ditambahkan.` });
      loadUsers();
    } else {
      setActionMessage({ type: "error", text: result.error || "Gagal menambah pegawai." });
    }
    setIsSaving(false);
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean, roleName: string) => {
    if (roleName === "owner") {
      alert("Akun owner tidak bisa dinonaktifkan.");
      return;
    }
    
    const confirmMsg = currentStatus 
      ? "Apakah Anda yakin ingin MENONAKTIFKAN pegawai ini? Mereka tidak akan bisa login lagi."
      : "Apakah Anda yakin ingin MENGAKTIFKAN kembali pegawai ini?";
      
    if (!confirm(confirmMsg)) return;

    const result = await toggleEmployeeStatus(userId, !currentStatus);
    if (result.success) {
      loadUsers();
    } else {
      alert("Gagal mengubah status: " + result.error);
    }
  };

  const handleResetPassword = async (userId: string, roleName: string) => {
    if (roleName === "owner") {
      alert("Reset password Owner harus dilakukan secara mandiri melalui menu Lupa Password.");
      return;
    }

    if (!confirm("Apakah Anda yakin ingin MERESET password pegawai ini menjadi password bawaan (printpilot123!)?")) return;

    const result = await resetEmployeePassword(userId);
    if (result.success) {
      alert("Password berhasil direset menjadi: " + result.newPassword + "\\nPegawai akan dipaksa mengganti password saat login berikutnya.");
      loadUsers();
    } else {
      alert("Gagal mereset password: " + result.error);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
    owner:          { label: "Owner",             cls: "bg-accent-teal/10 text-accent-teal border-accent-teal/20" },
    admin:          { label: "Admin",             cls: "bg-accent-teal/10 text-accent-teal border-accent-teal/20" },
    designer_sales: { label: "Designer/Setting",  cls: "bg-status-yellow/10 text-status-yellow-text border-status-yellow/20" },
    operator:       { label: "Operator Cetak",    cls: "bg-status-blue/10 text-status-blue border-status-blue/20" },
    gudang:         { label: "Finishing & Gudang", cls: "bg-status-green/10 text-status-green border-status-green/20" },
  };

  /** Returns all role names for a user (primary + extra) */
  const getUserRoles = (user: any): string[] => {
    const primary = user.role?.name;
    const extra: string[] = (user.extra_roles ?? []).map((ur: any) => ur.role?.name).filter(Boolean);
    return Array.from(new Set([primary, ...extra].filter(Boolean)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Users className="h-6 w-6 text-accent-teal" />
            Manajemen Pegawai
          </h1>
          <p className="text-sm text-muted mt-0.5">Kelola akses, role, dan akun karyawan Anda.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-accent-teal text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-accent-teal/90 transition-colors shadow-sm hover:shadow-md active:scale-95"
        >
          <UserPlus className="h-4 w-4" />
          Tambah Pegawai
        </button>
      </div>

      {actionMessage && (
        <div className={cn(
          "p-4 rounded-xl border text-sm font-semibold flex items-center gap-2",
          actionMessage.type === "success" ? "bg-status-green/10 border-status-green/30 text-status-green" : "bg-status-red/10 border-status-red/30 text-status-red"
        )}>
          {actionMessage.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          {actionMessage.text}
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input 
            type="text" 
            placeholder="Cari berdasarkan nama, email, atau role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal text-sm text-primary transition-colors"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-elevated border-b border-border text-muted uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Informasi Pegawai</th>
                <th className="px-6 py-4">Role / Peran</th>
                <th className="px-6 py-4">Status Akun</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted">Memuat data pegawai...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted flex flex-col items-center justify-center">
                    <Users className="h-12 w-12 mb-3 opacity-20" />
                    Belum ada data pegawai ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className={cn("transition-colors hover:bg-elevated/30", !user.active && "opacity-60 bg-base/50")}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{user.name}</span>
                        <span className="text-xs text-muted flex items-center gap-2 mt-0.5">
                          @{user.username} <span className="text-border/50">•</span> {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {getUserRoles(user).map((roleName) => {
                          const badge = ROLE_BADGE[roleName] ?? { label: roleName, cls: "bg-base text-muted border-border" };
                          return (
                            <span key={roleName} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", badge.cls)}>
                              {badge.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          user.active ? "bg-status-green/10 text-status-green" : "bg-status-red/10 text-status-red"
                        )}>
                          {user.active ? "Aktif" : "Nonaktif"}
                        </span>
                        {user.must_change_password && (
                          <span className="text-[10px] text-status-yellow-text font-medium flex items-center gap-1 bg-status-yellow/10 px-1.5 py-0.5 rounded">
                            <KeyRound className="h-3 w-3" /> Wajib ubah sandi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.role.name !== "owner" && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResetPassword(user.id, user.role.name)}
                            className="p-2 text-muted hover:text-status-yellow-text hover:bg-status-yellow/10 rounded-lg transition-colors group relative"
                            title="Reset Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(user.id, user.active, user.role.name)}
                            className={cn(
                              "p-2 rounded-lg transition-colors group relative",
                              user.active 
                                ? "text-muted hover:text-status-red hover:bg-status-red/10" 
                                : "text-status-red bg-status-red/10 hover:text-status-green hover:bg-status-green/10"
                            )}
                            title={user.active ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                          >
                            {user.active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <UserFormModal
          isLoading={isSaving}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
}
