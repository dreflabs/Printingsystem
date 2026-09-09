"use client";

import { useCallback, useEffect, useState } from "react";
import { Store, Save, Loader2, Camera } from "lucide-react";
import { useToast } from "@/components/ui";
import { getShopIdentity, updateShopIdentity, createLogoUploadUrl, updateLogoUrl, type ShopIdentity } from "@/actions/shop";

const field =
  "w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm";

export default function ShopIdentityPage() {
  const { toast } = useToast();
  const [s, setS] = useState<ShopIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = useCallback(async () => {
    const res = await getShopIdentity();
    if (res.success) setS(res.data);
    else toast({ type: "error", title: "Gagal memuat", message: res.error });
    setLoading(false);
  }, [toast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const res = await updateShopIdentity({ name: s.name, phone: s.phone, address: s.address });
    setSaving(false);
    if (res.success) {
      setS(res.data);
      toast({ type: "success", title: "Identitas toko disimpan" });
    } else {
      toast({ type: "error", title: "Gagal menyimpan", message: res.error });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !s) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ type: "error", title: "File terlalu besar", message: "Maksimal 5MB" });
      return;
    }

    setUploadingLogo(true);
    try {
      const presign = await createLogoUploadUrl(file.type);
      if (!presign.success) throw new Error(presign.error);

      const uploadRes = await fetch(presign.data.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Gagal mengunggah file ke cloud.");

      const updateRes = await updateLogoUrl(presign.data.key);
      if (!updateRes.success) throw new Error(updateRes.error);

      setS({ ...s, logo_url: updateRes.data });
      toast({ type: "success", title: "Logo berhasil diperbarui" });
    } catch (err) {
      toast({ type: "error", title: "Gagal", message: err instanceof Error ? err.message : "Terjadi kesalahan." });
    } finally {
      setUploadingLogo(false);
      e.target.value = ""; // Reset input
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }
  if (!s) return null;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-primary">Identitas Toko</h1>
        <p className="text-sm text-muted mt-0.5">Dipakai di kepala nota / bukti transaksi yang dicetak.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card/70 p-4 space-y-4">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <Store className="h-4 w-4 text-accent-teal" /> Data Toko
        </h2>

        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 bg-base border border-border rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/logo?key=${encodeURIComponent(s.logo_url)}`} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Store className="h-8 w-8 text-muted/30" />
            )}
          </div>
          <div>
            <label className="text-xs font-bold bg-accent-teal/10 text-accent-teal px-3 py-1.5 rounded-lg cursor-pointer hover:bg-accent-teal/20 transition-colors inline-flex items-center gap-2">
              {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploadingLogo ? "Mengunggah..." : "Pilih Logo Baru"}
              <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" disabled={uploadingLogo} onChange={handleLogoUpload} />
            </label>
            <p className="text-[10px] text-muted mt-1.5">JPG, PNG, atau WEBP. Maks 5MB. Rasio 1:1 disarankan.</p>
          </div>
        </div>

        <label className="block space-y-1 text-xs font-semibold text-muted">
          Nama toko
          <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className={field} placeholder="mis. Maju Jaya Print" />
        </label>

        <label className="block space-y-1 text-xs font-semibold text-muted">
          Nomor telepon / WhatsApp
          <input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} className={field} placeholder="08xxxxxxxxxx" />
        </label>

        <label className="block space-y-1 text-xs font-semibold text-muted">
          Alamat
          <textarea
            value={s.address}
            onChange={(e) => setS({ ...s, address: e.target.value })}
            rows={3}
            className={field + " resize-none"}
            placeholder="Jl. ... No. ..., Kota, Provinsi"
          />
        </label>

        <p className="text-[11px] text-muted">
          Workspace (subdomain): <span className="font-mono">{s.slug}</span> — tidak bisa diubah di sini.
        </p>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan
        </button>
      </div>
    </div>
  );
}
