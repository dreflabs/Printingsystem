import { Button } from "@/components/ui";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any;
}

export function ProductModal({ isOpen, onClose, product }: ProductModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-[0_8px_48px_rgba(0,0,0,0.6)] p-6">
        <h2 className="text-xl font-bold text-primary mb-5">
          {product ? "Edit Produk" : "Tambah Produk Baru"}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Nama Produk</label>
            <input 
              type="text" 
              defaultValue={product?.name}
              placeholder="Cth: Banner Flexi 280gr" 
              className="w-full h-11 bg-elevated border border-border rounded-xl px-4 text-sm text-primary outline-none focus:border-accent-teal transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Kategori</label>
              <select className="w-full h-11 bg-elevated border border-border rounded-xl px-4 text-sm text-primary outline-none focus:border-accent-teal transition-colors appearance-none">
                <option>Outdoor</option>
                <option>Indoor</option>
                <option>Digital A3</option>
                <option>Offset</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Satuan</label>
              <select className="w-full h-11 bg-elevated border border-border rounded-xl px-4 text-sm text-primary outline-none focus:border-accent-teal transition-colors appearance-none">
                <option>m²</option>
                <option>Pcs</option>
                <option>Rim</option>
                <option>Box</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Harga Dasar (Rp)</label>
            <input 
              type="number" 
              defaultValue={product?.price}
              placeholder="Cth: 15000" 
              className="w-full h-11 bg-elevated border border-border rounded-xl px-4 text-sm text-primary outline-none focus:border-accent-teal transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
          <Button variant="primary" className="flex-1" onClick={onClose}>Simpan Data</Button>
        </div>
      </div>
    </div>
  );
}
