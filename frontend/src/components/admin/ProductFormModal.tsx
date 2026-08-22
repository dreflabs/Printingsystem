"use client";

import { X } from "lucide-react";
import { useState } from "react";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (product: any) => void;
}

export function ProductFormModal({ open, onClose, onSave }: ProductFormModalProps) {
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "Kertas",
    cogs: "",
    price: "",
    stock: "",
    minStock: ""
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: Math.random().toString(36).substr(2, 9)
    });
    onClose();
  };

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
            {/* Informasi Dasar */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary border-b border-border pb-2">Informasi Dasar</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">SKU <span className="text-status-red">*</span></label>
                  <input required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} type="text" placeholder="Misal: P-KRT-001" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-status-blue" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Kategori</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-status-blue">
                    <option>Kertas</option>
                    <option>Tinta</option>
                    <option>Alat Tulis</option>
                    <option>Merchandise</option>
                    <option>Lainnya</option>
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-medium text-primary">Nama Produk <span className="text-status-red">*</span></label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" placeholder="Nama lengkap produk..." className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-status-blue" />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary border-b border-border pb-2">Harga (Pricing)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Harga Modal (COGS) <span className="text-status-red">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
                    <input required value={formData.cogs} onChange={e => setFormData({...formData, cogs: e.target.value})} type="number" className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-status-blue" />
                  </div>
                  <p className="text-xs text-muted">Untuk menghitung laba rugi.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Harga Jual POS <span className="text-status-red">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">Rp</span>
                    <input required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} type="number" className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-status-blue" />
                  </div>
                </div>
              </div>
            </div>

            {/* Stok */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-primary border-b border-border pb-2">Manajemen Stok</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Stok Awal</label>
                  <input value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-status-blue" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-primary">Minimum Stok Peringatan</label>
                  <input value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-status-blue" />
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <div className="pt-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-elevated transition-colors">Batal</button>
          <button type="submit" form="productForm" className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-md shadow-blue-500/20">Simpan Produk</button>
        </div>
      </div>
    </div>
  );
}
