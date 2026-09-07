"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";

export interface RetailProductDraft {
  sku: string;
  name: string;
  category: string;
  price: string;
  makloonPrice: string;
  stock: string;
  minStock: string;
}

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (product: RetailProductDraft) => void;
  /** Kategori yang sudah pernah dipakai — jadi saran autocomplete. */
  categories?: string[];
}

export function ProductFormModal({ open, onClose, onSave, categories = [] }: ProductFormModalProps) {
  const listId = useId();
  const [formData, setFormData] = useState<RetailProductDraft>({
    sku: "",
    name: "",
    category: "",
    price: "",
    makloonPrice: "",
    stock: "",
    minStock: "",
  });

  if (!open) return null;

  const set = (patch: Partial<RetailProductDraft>) => setFormData((f) => ({ ...f, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, category: formData.category.trim() });
    onClose();
  };

  const inp =
    "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-status-blue";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-xl font-bold text-primary">Tambah Produk Baru</h2>
          <button onClick={onClose} className="p-2 hover:bg-elevated rounded-full text-muted hover:text-primary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
          <form id="productForm" onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary border-b border-border pb-2">Informasi Dasar</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">SKU <span className="text-status-red">*</span></label>
                  <input required value={formData.sku} onChange={(e) => set({ sku: e.target.value })} type="text" placeholder="Misal: P-KRT-001" className={inp} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Kategori</label>
                  <input
                    list={listId}
                    value={formData.category}
                    onChange={(e) => set({ category: e.target.value })}
                    type="text"
                    placeholder="Ketik / pilih — mis. Stiker"
                    className={inp}
                  />
                  <datalist id={listId}>
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <p className="text-[11px] text-muted">Kategori baru langsung tersimpan begitu produk dibuat.</p>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-medium text-primary">Nama Produk <span className="text-status-red">*</span></label>
                  <input required value={formData.name} onChange={(e) => set({ name: e.target.value })} type="text" placeholder="Nama lengkap produk..." className={inp} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary border-b border-border pb-2">Harga (Pricing)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Harga Umum (Rp) <span className="text-status-red">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
                    <input required value={formData.price} onChange={(e) => set({ price: e.target.value })} type="number" min={0} className={inp + " pl-9"} placeholder="20000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Harga Makloon (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
                    <input value={formData.makloonPrice} onChange={(e) => set({ makloonPrice: e.target.value })} type="number" min={0} className={inp + " pl-9"} placeholder="15000" />
                  </div>
                </div>
              </div>

              {formData.price && formData.makloonPrice && parseFloat(formData.price) > 0 && parseFloat(formData.makloonPrice) < parseFloat(formData.price) && (
                <div className="bg-status-green/10 border border-status-green/30 rounded-xl p-3 text-xs text-status-green font-bold flex items-center justify-between">
                  <span>Persentase Diskon Makloon:</span>
                  <span className="text-sm bg-status-green text-white px-2 py-0.5 rounded-md shadow-sm">
                    {Math.round(((parseFloat(formData.price) - parseFloat(formData.makloonPrice)) / parseFloat(formData.price)) * 100)}%
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary border-b border-border pb-2">Stok Awal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Stok Awal</label>
                  <input value={formData.stock} onChange={(e) => set({ stock: e.target.value })} type="number" min={0} className={inp} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Stok Minimum</label>
                  <input value={formData.minStock} onChange={(e) => set({ minStock: e.target.value })} type="number" min={0} className={inp} placeholder="0" />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="pt-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-elevated transition-colors">Batal</button>
          <button type="submit" form="productForm" className="px-6 py-2 rounded-lg text-sm font-bold bg-accent-teal text-white hover:bg-accent-teal/90 transition-all shadow-md shadow-accent-teal/20">Simpan Produk</button>
        </div>
      </div>
    </div>
  );
}
