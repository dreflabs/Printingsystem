"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Save, Image as ImageIcon, User, Shield, Lock, Building2, Copy, Check, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { updateProfile, changePassword } from "@/actions/profile";
import { createAvatarUploadUrl } from "@/actions/avatar";

interface ProfileModalProps {
  userId: string;
  initialName: string;
  initialUsername: string;
  initialEmail: string;
  initialPhone: string | null;
  initialAvatar: string | null;
  workspaceSlug?: string | null;
  onClose: () => void;
  onSuccess: (updatedUser: any) => void;
}

export function ProfileModal({ 
  userId, 
  initialName, 
  initialUsername,
  initialEmail,
  initialPhone,
  initialAvatar,
  workspaceSlug,
  onClose,
  onSuccess
}: ProfileModalProps) {

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"umum" | "keamanan">("umum");
  const [copied, setCopied] = useState<"" | "slug" | "link">("");

  const loginLink =
    typeof window !== "undefined" && workspaceSlug
      ? `${window.location.origin}/login?workspace=${workspaceSlug}`
      : "";

  const copy = async (value: string, which: "slug" | "link") => {
    if (!value) return;
    if (await copyText(value)) {
      setCopied(which);
      setTimeout(() => setCopied(""), 1500);
    }
  };

  // General Info State
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone || "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  
  // Security State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSaveUmum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !email.trim()) return;

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    let finalAvatarUrl = avatarUrl;

    if (avatarFile) {
      const prep = await createAvatarUploadUrl(avatarFile.name, avatarFile.size, avatarFile.type);
      if (!prep.success || !prep.data) {
        setErrorMsg(prep.error || "Gagal menyiapkan upload foto.");
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(prep.data.uploadUrl, { method: "PUT", body: avatarFile });
        if (!res.ok) throw new Error(`Upload gagal (HTTP ${res.status})`);
        finalAvatarUrl = `/api/avatar?key=${prep.data.objectKey}`;
      } catch (e: any) {
        setErrorMsg("Gagal mengunggah foto profil: " + e.message);
        setIsLoading(false);
        return;
      }
    }

    const result = await updateProfile(userId, { 
      name, 
      username, 
      email, 
      phone, 
      avatar_url: finalAvatarUrl 
    });
    
    if (result.success && result.user) {
      setSuccessMsg("Profil berhasil diperbarui!");
      // Notify parent after a short delay so user sees the success message
      setTimeout(() => {
        onSuccess(result.user);
      }, 1000);
    } else {
      setErrorMsg(result.error || "Gagal menyimpan profil.");
    }
    setIsLoading(false);
  };

  const handleSaveKeamanan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrorMsg("Harap isi semua kolom password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Password baru dan konfirmasi tidak cocok.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg("Password baru minimal 6 karakter.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const result = await changePassword(userId, oldPassword, newPassword);
    
    if (result.success) {
      setSuccessMsg("Kata sandi berhasil diubah!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setErrorMsg(result.error || "Gagal mengubah kata sandi.");
    }
    setIsLoading(false);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border bg-elevated/50">
          <h2 className="text-lg font-bold text-primary">Pengaturan Akun</h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-base text-muted transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-4 border-b border-border">
          <button
            onClick={() => { setActiveTab("umum"); setErrorMsg(""); setSuccessMsg(""); }}
            className={cn(
              "flex items-center gap-2 pb-3 px-1 border-b-2 font-semibold text-sm transition-colors cursor-pointer",
              activeTab === "umum" ? "border-accent-teal text-accent-teal" : "border-transparent text-muted hover:text-primary"
            )}
          >
            <User className="h-4 w-4" /> Informasi Umum
          </button>
          <button
            onClick={() => { setActiveTab("keamanan"); setErrorMsg(""); setSuccessMsg(""); }}
            className={cn(
              "flex items-center gap-2 pb-3 px-1 border-b-2 font-semibold text-sm transition-colors cursor-pointer",
              activeTab === "keamanan" ? "border-accent-teal text-accent-teal" : "border-transparent text-muted hover:text-primary"
            )}
          >
            <Shield className="h-4 w-4" /> Keamanan
          </button>
        </div>

        <div className="p-5">
          {errorMsg && (
            <div className="p-3 mb-4 rounded-lg bg-status-red/10 border border-status-red/30 text-status-red text-xs font-semibold">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 mb-4 rounded-lg bg-status-green/10 border border-status-green/30 text-status-green text-xs font-semibold">
              {successMsg}
            </div>
          )}

          {activeTab === "umum" && (
            <form onSubmit={handleSaveUmum} className="space-y-4">
              {/* Workspace / alamat login pegawai */}
              {workspaceSlug && (
                <div className="rounded-xl border border-border bg-elevated/50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Building2 className="h-4 w-4 text-accent-teal" /> Workspace
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono text-primary truncate">{workspaceSlug}</code>
                    <button
                      type="button"
                      onClick={() => copy(workspaceSlug, "slug")}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-accent-teal hover:underline cursor-pointer"
                    >
                      {copied === "slug" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === "slug" ? "Tersalin" : "Salin slug"}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed">
                    Pegawai mengisi <span className="font-mono">{workspaceSlug}</span> di kolom Workspace saat login.
                  </p>
                  <button
                    type="button"
                    onClick={() => copy(loginLink, "link")}
                    disabled={!loginLink}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-accent-teal/40 text-accent-teal text-[11px] font-semibold hover:bg-accent-teal/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === "link" ? "Link login tersalin" : "Salin link login pegawai"}
                  </button>
                </div>
              )}

              {/* Avatar Preview */}
              <div className="flex items-center gap-4 mb-2">
                <div className="h-16 w-16 shrink-0 rounded-full overflow-hidden border-2 border-accent-teal/50 bg-elevated flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" onError={(e) => {
                      (e.target as HTMLImageElement).src = "";
                    }} />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted/50" />
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-semibold text-primary">Foto Profil</label>
                  <div className="relative">
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAvatarFile(file);
                          setAvatarUrl(URL.createObjectURL(file));
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-base border border-border rounded-xl text-primary text-sm transition-all hover:border-accent-teal group">
                      <Upload className="h-4 w-4 text-muted group-hover:text-accent-teal transition-colors" />
                      <span className="truncate">{avatarFile ? avatarFile.name : "Pilih gambar..."}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted">Maksimal 5 MB. Format: JPG, PNG, WEBP.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">Nama Lengkap</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-primary">Username</label>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-primary">Nomor WhatsApp</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0812..."
                    className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">Email</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={isLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm border border-border text-primary hover:bg-elevated transition-colors cursor-pointer"
                > Batal </button>
                <button type="submit" disabled={isLoading}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-accent-teal text-white transition-all shadow-sm cursor-pointer",
                    isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-accent-teal/90 hover:shadow-md hover:-translate-y-0.5"
                  )}
                > <Save className="h-4 w-4" /> {isLoading ? "Menyimpan..." : "Simpan Profil"} </button>
              </div>
            </form>
          )}

          {activeTab === "keamanan" && (
            <form onSubmit={handleSaveKeamanan} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">Kata Sandi Lama</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input 
                    type="password" required value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input 
                    type="password" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">Konfirmasi Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input 
                    type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 mt-4">
                <button type="button" onClick={onClose} disabled={isLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm border border-border text-primary hover:bg-elevated transition-colors cursor-pointer"
                > Batal </button>
                <button type="submit" disabled={isLoading}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-accent-teal text-white transition-all shadow-sm cursor-pointer",
                    isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-accent-teal/90 hover:shadow-md hover:-translate-y-0.5"
                  )}
                > <Save className="h-4 w-4" /> {isLoading ? "Menyimpan..." : "Perbarui Sandi"} </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
