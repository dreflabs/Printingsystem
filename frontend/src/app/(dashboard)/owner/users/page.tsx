"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, KeyRound, UserX, UserCheck, CheckCircle2, ShieldAlert, Search, LockKeyhole, Unlock, Wallet, Trash2, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserFormModal, CredentialRevealDialog } from "@/components/owner/UserFormModal";
import { ConfirmDialog } from "@/components/ui";
import {
  getTenantUsers, createEmployee, toggleEmployeeStatus, resetEmployeePassword,
  unlockEmployeeAccount, getEmployeeDeleteImpact, deleteEmployee, updateUserRoles,
} from "@/actions/user-management";
import { getMyWorkspace } from "@/actions/profile";
import { setEmployeeBaseSalary } from "@/actions/payroll";

const formatRp = (n: number) => "Rp " + n.toLocaleString("id-ID");

type PendingConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "primary";
  run: () => Promise<void>;
};

const isLocked = (user: any) => !!user.locked_until && new Date(user.locked_until) > new Date();

export default function OwnerUsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMessage, setActionMessage] = useState<{type: "success" | "error", text: string} | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({});
  const [savingSalaryId, setSavingSalaryId] = useState<string | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [createdCred, setCreatedCred] = useState<
    { name: string; username: string; tempPassword: string; reset?: boolean } | null
  >(null);
  const [deleteFor, setDeleteFor] = useState<{ id: string; name: string } | null>(null);
  const [roleEditFor, setRoleEditFor] = useState<{ id: string; name: string; primary: string; roles: string[] } | null>(null);

  const runPendingConfirm = async () => {
    if (!pendingConfirm) return;
    setConfirmBusy(true);
    await pendingConfirm.run();
    setConfirmBusy(false);
    setPendingConfirm(null);
  };

  useEffect(() => {
    loadUsers();
    getMyWorkspace().then((w) => setWorkspaceSlug(w?.slug ?? null));
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
      setActionMessage(null);
      // Tampilkan kredensial sekali — password sementara acak, tidak bisa dilihat lagi.
      setCreatedCred({
        name: formData.name,
        username: formData.username,
        tempPassword: result.tempPassword!,
      });
      loadUsers();
    } else {
      setActionMessage({ type: "error", text: result.error || "Gagal menambah pegawai." });
    }
    setIsSaving(false);
  };

  const handleToggleStatus = (userId: string, currentStatus: boolean, roleName: string) => {
    if (roleName === "owner") {
      setActionMessage({ type: "error", text: "Akun Owner tidak bisa dinonaktifkan." });
      return;
    }
    setActionMessage(null);
    setPendingConfirm({
      title: currentStatus ? "Nonaktifkan Pegawai" : "Aktifkan Pegawai",
      message: currentStatus
        ? "Pegawai ini tidak akan bisa login lagi sampai diaktifkan kembali. Lanjutkan?"
        : "Pegawai ini akan bisa login kembali. Lanjutkan?",
      confirmLabel: currentStatus ? "Ya, Nonaktifkan" : "Ya, Aktifkan",
      variant: currentStatus ? "danger" : "primary",
      run: async () => {
        const result = await toggleEmployeeStatus(userId, !currentStatus);
        if (result.success) {
          setActionMessage({ type: "success", text: currentStatus ? "Pegawai dinonaktifkan." : "Pegawai diaktifkan kembali." });
          loadUsers();
        } else {
          setActionMessage({ type: "error", text: "Gagal mengubah status: " + result.error });
        }
      },
    });
  };

  const handleUnlock = async (userId: string, name: string) => {
    setActionMessage(null);
    const result = await unlockEmployeeAccount(userId);
    if (result.success) {
      setActionMessage({ type: "success", text: `Kunci akun ${name} berhasil dibuka. Pegawai bisa login kembali.` });
      loadUsers();
    } else {
      setActionMessage({ type: "error", text: "Gagal membuka kunci: " + result.error });
    }
  };

  const handleResetPassword = (user: { id: string; name: string; username: string; role: { name: string } }) => {
    if (user.role.name === "owner") {
      setActionMessage({ type: "error", text: "Reset password Owner dilakukan mandiri lewat menu Lupa Password." });
      return;
    }
    setActionMessage(null);
    setPendingConfirm({
      title: "Reset Password Pegawai",
      message:
        "Password diganti ke password sementara acak yang baru. Sesi pegawai yang sedang berjalan langsung berhenti, dan ia wajib menggantinya saat login berikutnya. Lanjutkan?",
      confirmLabel: "Ya, Reset",
      variant: "danger",
      run: async () => {
        const result = await resetEmployeePassword(user.id);
        if (result.success) {
          setActionMessage(null);
          setCreatedCred({
            name: user.name,
            username: user.username,
            tempPassword: result.newPassword!,
            reset: true,
          });
          loadUsers();
        } else {
          setActionMessage({ type: "error", text: "Gagal mereset password: " + result.error });
        }
      },
    });
  };

  const handleSaveSalary = async (userId: string) => {
    const raw = salaryDrafts[userId];
    const amount = Number(raw);
    if (raw === undefined || !Number.isFinite(amount) || amount < 0) {
      setActionMessage({ type: "error", text: "Nominal gaji tidak valid." });
      return;
    }
    setSavingSalaryId(userId);
    const result = await setEmployeeBaseSalary(userId, amount);
    setSavingSalaryId(null);
    if (result.success) {
      setActionMessage({ type: "success", text: "Gaji pokok berhasil disimpan." });
      setSalaryDrafts((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      loadUsers();
    } else {
      setActionMessage({ type: "error", text: "Gagal menyimpan gaji: " + result.error });
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
    owner:          { label: "Owner",             cls: "bg-accent-teal/10 text-accent-teal" },
    admin:          { label: "Admin",             cls: "bg-accent-teal/10 text-accent-teal" },
    designer_sales: { label: "Designer/Setting",  cls: "bg-status-yellow/10 text-status-yellow-text" },
    operator:       { label: "Operator Cetak",    cls: "bg-status-blue/10 text-status-blue" },
    gudang:         { label: "Finishing & Gudang", cls: "bg-status-green/10 text-status-green" },
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
                <th className="px-6 py-4">Gaji Pokok</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted">Memuat data pegawai...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted flex flex-col items-center justify-center">
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
                      <div className="flex flex-wrap items-center gap-1">
                        {getUserRoles(user).slice(0, 2).map((roleName) => {
                          const badge = ROLE_BADGE[roleName] ?? { label: roleName, cls: "bg-base text-muted" };
                          return (
                            <span key={roleName} className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", badge.cls)}>
                              {badge.label}
                            </span>
                          );
                        })}
                        {getUserRoles(user).length > 2 && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-elevated text-muted cursor-help" title={getUserRoles(user).slice(2).map(r => ROLE_BADGE[r]?.label || r).join(', ')}>
                            +{getUserRoles(user).length - 2} Lainnya
                          </span>
                        )}
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
                        {isLocked(user) && (
                          <span className="text-[10px] text-status-red font-medium flex items-center gap-1 bg-status-red/10 px-1.5 py-0.5 rounded">
                            <LockKeyhole className="h-3 w-3" /> Terkunci ({user.failed_login_count}× gagal)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-muted shrink-0" />
                        <input
                          type="number"
                          min={0}
                          placeholder="Belum diset"
                          value={salaryDrafts[user.id] ?? (user.base_salary ?? "")}
                          onChange={(e) => setSalaryDrafts((prev) => ({ ...prev, [user.id]: e.target.value }))}
                          className="w-28 px-2 py-1 bg-base border border-border rounded-lg text-xs text-primary focus:outline-none focus:border-accent-teal"
                        />
                        {salaryDrafts[user.id] !== undefined && Number(salaryDrafts[user.id]) !== (user.base_salary ?? null) && (
                          <button
                            onClick={() => handleSaveSalary(user.id)}
                            disabled={savingSalaryId === user.id}
                            className="text-[10px] font-bold text-accent-teal hover:underline disabled:opacity-50"
                          >
                            {savingSalaryId === user.id ? "..." : "Simpan"}
                          </button>
                        )}
                      </div>
                      {user.base_salary != null && salaryDrafts[user.id] === undefined && (
                        <span className="text-[10px] text-muted mt-0.5 block">{formatRp(user.base_salary)}/bulan</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            setRoleEditFor({
                              id: user.id,
                              name: user.name,
                              primary: user.role.name,
                              roles: getUserRoles(user),
                            })
                          }
                          className="p-2 text-muted hover:text-accent-teal hover:bg-accent-teal/10 rounded-lg transition-colors group relative"
                          title="Ubah Peran"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        
                        {user.role.name !== "owner" && (
                          <>
                            {isLocked(user) && (
                              <button
                                onClick={() => handleUnlock(user.id, user.name)}
                                className="p-2 text-status-red bg-status-red/10 hover:text-status-green hover:bg-status-green/10 rounded-lg transition-colors"
                                title="Buka Kunci Akun"
                              >
                                <Unlock className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleResetPassword(user)}
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
                              {user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => setDeleteFor({ id: user.id, name: user.name })}
                              className="p-2 text-muted hover:text-status-red hover:bg-status-red/10 rounded-lg transition-colors"
                              title="Hapus Pegawai"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
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
          workspaceSlug={workspaceSlug}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveUser}
        />
      )}

      {createdCred && (
        <CredentialRevealDialog
          cred={createdCred}
          workspaceSlug={workspaceSlug}
          onClose={() => setCreatedCred(null)}
        />
      )}

      <ConfirmDialog
        open={!!pendingConfirm}
        onClose={() => !confirmBusy && setPendingConfirm(null)}
        onConfirm={runPendingConfirm}
        title={pendingConfirm?.title ?? ""}
        message={pendingConfirm?.message ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        variant={pendingConfirm?.variant}
        isLoading={confirmBusy}
      />

      {deleteFor && (
        <DeleteEmployeeModal
          userId={deleteFor.id}
          name={deleteFor.name}
          onClose={() => setDeleteFor(null)}
          onDone={(msg) => {
            setDeleteFor(null);
            setActionMessage({ type: "success", text: msg });
            loadUsers();
          }}
        />
      )}

      {roleEditFor && (
        <RoleEditModal
          target={roleEditFor}
          onClose={() => setRoleEditFor(null)}
          onDone={(msg) => {
            setRoleEditFor(null);
            setActionMessage({ type: "success", text: msg });
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

const ALL_ROLE_OPTIONS: { name: string; label: string }[] = [
  { name: "owner", label: "Owner" },
  { name: "admin", label: "Admin / Kasir" },
  { name: "designer_sales", label: "Designer / Setting" },
  { name: "operator", label: "Operator Cetak" },
  { name: "gudang", label: "Finishing & Gudang" },
];

function RoleEditModal({
  target, onClose, onDone,
}: {
  target: { id: string; name: string; primary: string; roles: string[] };
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const isOwner = target.primary === "owner";
  const [selected, setSelected] = useState<Set<string>>(new Set(target.roles));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(name: string) {
    if (name === "owner") return; // peran Owner terkunci
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setErr(null);
    const names = ALL_ROLE_OPTIONS.map((r) => r.name).filter((n) => selected.has(n));
    const r = await updateUserRoles(target.id, names);
    setBusy(false);
    if (!r.success) { setErr(r.error ?? "Gagal menyimpan peran."); return; }
    onDone(`Peran ${target.name} diperbarui.`);
  }

  // Owner: opsi "owner" selalu tercentang & dikunci.
  const options = isOwner ? ALL_ROLE_OPTIONS : ALL_ROLE_OPTIONS.filter((r) => r.name !== "owner");
  const count = [...selected].length;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">Ubah Peran — {target.name}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-muted">
          {isOwner
            ? "Owner selalu punya akses penuh. Centang peran operasional yang Anda pegang sendiri; cabut saat sudah ada pegawainya."
            : "Centang semua peran yang boleh dijalankan pegawai ini. Aksi di aplikasi menyesuaikan gabungan peran."}
        </p>
        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}

        <div className="space-y-1.5">
          {options.map((o) => {
            const locked = o.name === "owner";
            const checked = selected.has(o.name) || locked;
            return (
              <label
                key={o.name}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                  checked ? "border-accent-teal/40 bg-accent-teal/5 text-primary" : "border-border text-muted",
                  locked ? "opacity-70 cursor-default" : "cursor-pointer hover:border-accent-teal/40",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked || busy}
                  onChange={() => toggle(o.name)}
                />
                {o.label}
                {locked && <span className="ml-auto text-[10px] text-muted">terkunci</span>}
              </label>
            );
          })}
        </div>

        <button
          onClick={save}
          disabled={busy || count === 0}
          className="w-full h-10 rounded-lg bg-accent-teal text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Menyimpan…" : "Simpan peran"}
        </button>
      </div>
    </div>
  );
}

function DeleteEmployeeModal({
  userId, name, onClose, onDone,
}: {
  userId: string; name: string; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [impact, setImpact] = useState<
    | { canHardDelete: boolean; total: number; buckets: { label: string; n: number }[] }
    | null
  >(null);
  const [err, setErr] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getEmployeeDeleteImpact(userId).then((r) => {
      if (r.success) setImpact({ canHardDelete: r.data.canHardDelete, total: r.data.total, buckets: r.data.buckets });
      else setErr(r.error);
    });
  }, [userId]);

  async function run() {
    setBusy(true);
    setErr(null);
    const r = await deleteEmployee(userId);
    setBusy(false);
    if (!r.success) { setErr(r.error ?? "Gagal."); return; }
    onDone(
      r.mode === "deleted"
        ? `Pegawai ${name} dihapus permanen.`
        : `Identitas ${name} dihapus. Riwayat kerjanya tetap tersimpan sebagai "Mantan Pegawai".`
    );
  }

  const hard = impact?.canHardDelete;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h3 className="text-base font-bold text-status-red flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Hapus Pegawai
          </h3>
          <button onClick={onClose} disabled={busy} className="p-1 rounded-lg text-muted hover:text-primary disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        {err && <p className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</p>}
        {!impact && !err && <p className="text-xs text-muted">Mengecek riwayat…</p>}

        {impact && hard && (
          <>
            <p className="text-sm text-primary">
              <b>{name}</b> belum pernah menyentuh order, pembayaran, produksi, gaji, atau data apa pun.
              Akun bisa dihapus <b>permanen</b>.
            </p>
            <p className="text-xs text-muted">Tindakan ini tidak bisa dibatalkan.</p>
          </>
        )}

        {impact && !hard && (
          <>
            <p className="text-sm text-primary">
              <b>{name}</b> punya riwayat kerja yang <b>tidak bisa ikut dihapus</b> — data itu milik
              percetakan (order pelanggan, catatan pembayaran, slip gaji, jejak audit), bukan sekadar
              milik pegawai. Menghapusnya akan merusak pembukuan &amp; laporan.
            </p>
            <ul className="text-xs text-muted bg-elevated/60 border border-border rounded-xl p-3 space-y-0.5">
              {impact.buckets.map((b) => (
                <li key={b.label} className="flex justify-between">
                  <span className="capitalize">{b.label}</span>
                  <span className="font-mono text-primary">{b.n}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-primary">
              Yang dilakukan: <b>identitas pegawai dihapus</b> — nama, kontak, email, dan akun login —
              lalu akun dinonaktifkan. Riwayat tetap ada, tercatat atas nama <b>&quot;Mantan Pegawai&quot;</b>.
              Pegawai ini tidak akan bisa login lagi.
            </p>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              Saya mengerti riwayat tidak terhapus dan identitas pegawai akan dihilangkan permanen
            </label>
          </>
        )}

        {impact && (
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={busy} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs font-bold text-muted hover:text-primary disabled:opacity-40">Batal</button>
            <button
              onClick={run}
              disabled={busy || (!hard && !ack)}
              className="flex-1 h-10 rounded-xl bg-status-red text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Memproses…" : hard ? "Hapus Permanen" : "Hapus Identitas Pegawai"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
