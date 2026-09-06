import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { ProductVariant, ProductFinishing, PrintingProduct } from "@/types/products";

interface PrintingProductModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (product: Omit<PrintingProduct, "id" | "value">) => void;
}

export function PrintingProductModal({ open, onClose, onSave }: PrintingProductModalProps) {
  const [label, setLabel] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [unit, setUnit] = useState("m2");
  
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [finishings, setFinishings] = useState<ProductFinishing[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setLabel("");
      setBasePrice("");
      setUnit("m2");
      setVariants([{ name: "", price: 0 }]);
      setFinishings([{ name: "", price: 0, type: "flat" }]);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    if (!label) return;
    
    // Filter out empty variants and finishings
    const validVariants = variants.filter(v => v.name.trim() !== "");
    const validFinishings = finishings.filter(f => f.name.trim() !== "");

    onSave({
      label,
      basePrice: Number(basePrice) || (validVariants.length > 0 ? validVariants[0].price : 0),
      unit,
      variants: validVariants,
      finishings: validFinishings
    });
  };

  const addVariant = () => setVariants([...variants, { name: "", price: 0 }]);
  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };
  const removeVariant = (index: number) => setVariants(variants.filter((_, i) => i !== index));

  const addFinishing = () => setFinishings([...finishings, { name: "", price: 0, type: "flat" }]);
  const updateFinishing = (index: number, field: keyof ProductFinishing, value: any) => {
    const newFinishings = [...finishings];
    newFinishings[index] = { ...newFinishings[index], [field]: value };
    setFinishings(newFinishings);
  };
  const removeFinishing = (index: number) => setFinishings(finishings.filter((_, i) => i !== index));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-xl font-bold text-primary">Tambah Jasa Cetak</h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-primary border-b border-border pb-2">Informasi Dasar</h3>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Kategori / Nama Produk *</label>
              <input 
                type="text" 
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-primary outline-none focus:border-accent-teal"
                placeholder="Misal: Spanduk Outdoor"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Satuan Dasar</label>
                <select 
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-primary outline-none focus:border-accent-teal"
                >
                  <option value="m2">Per Meter (m²)</option>
                  <option value="pcs">Per Pcs</option>
                  <option value="rim">Per Rim</option>
                  <option value="box">Per Box</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Harga Dasar Default (Rp)</label>
                <input 
                  type="number" 
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-primary outline-none focus:border-accent-teal"
                  placeholder="Misal: 15000"
                />
                <p className="text-xs text-muted mt-1">Gunakan jika produk tidak memiliki varian bahan.</p>
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-bold text-primary">Varian Bahan & Harga</h3>
              <button onClick={addVariant} className="text-xs font-bold text-accent-teal flex items-center gap-1 hover:underline cursor-pointer">
                <Plus className="h-3 w-3" /> Tambah Bahan
              </button>
            </div>
            {variants.length === 0 && <p className="text-xs text-muted italic">Tidak ada varian bahan khusus.</p>}
            {variants.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={v.name}
                  onChange={e => updateVariant(i, 'name', e.target.value)}
                  placeholder="Nama Bahan (mis. Flexi China)"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-primary outline-none focus:border-accent-teal text-sm"
                />
                <div className="relative w-1/3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">Rp</span>
                  <input 
                    type="number" 
                    value={v.price || ""}
                    onChange={e => updateVariant(i, 'price', Number(e.target.value))}
                    placeholder="Harga"
                    className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-primary outline-none focus:border-accent-teal text-sm"
                  />
                </div>
                <button onClick={() => removeVariant(i)} className="text-status-red hover:bg-status-red/10 p-2 rounded-md transition-colors cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Finishings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-bold text-primary">Biaya Finishing</h3>
              <button onClick={addFinishing} className="text-xs font-bold text-accent-teal flex items-center gap-1 hover:underline cursor-pointer">
                <Plus className="h-3 w-3" /> Tambah Finishing
              </button>
            </div>
            {finishings.length === 0 && <p className="text-xs text-muted italic">Tidak ada finishing tambahan.</p>}
            {finishings.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={f.name}
                  onChange={e => updateFinishing(i, 'name', e.target.value)}
                  placeholder="Nama (mis. Mata Ayam)"
                  className="w-1/3 bg-background border border-border rounded-lg px-3 py-2 text-primary outline-none focus:border-accent-teal text-sm"
                />
                <div className="relative w-1/3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">Rp</span>
                  <input 
                    type="number" 
                    value={f.price === 0 && !f.name ? "" : f.price}
                    onChange={e => updateFinishing(i, 'price', Number(e.target.value))}
                    placeholder="Biaya (0 = Gratis)"
                    className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-primary outline-none focus:border-accent-teal text-sm"
                  />
                </div>
                <select 
                  value={f.type}
                  onChange={e => updateFinishing(i, 'type', e.target.value)}
                  className="w-1/3 bg-background border border-border rounded-lg px-3 py-2 text-primary outline-none focus:border-accent-teal text-sm"
                >
                  <option value="flat">Flat / Borongan</option>
                  <option value="per_m2">Per m²</option>
                  <option value="per_pcs">Per Pcs/Titik</option>
                </select>
                <button onClick={() => removeFinishing(i)} className="text-status-red hover:bg-status-red/10 p-2 rounded-md transition-colors cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-muted mt-1">Biaya 0 otomatis dihitung sebagai gratis (Free).</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-border bg-card rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-muted hover:text-primary transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button 
            onClick={handleSave}
            disabled={!label}
            className="px-5 py-2.5 rounded-xl font-bold bg-accent-teal text-white hover:bg-accent-teal/90 shadow-lg shadow-accent-teal/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            Simpan Produk
          </button>
        </div>
      </div>
    </div>
  );
}
