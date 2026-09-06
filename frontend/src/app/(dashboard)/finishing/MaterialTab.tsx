"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Search, Plus, Save, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMaterials, adjustMaterialStock, createMaterial } from "@/actions/master-data";

type Material = {
  id: string;
  name: string;
  material_code: string;
  type: string;
  unit_stock: string;
  current_stock: number;
  min_stock: number;
  conversion_factor: number;
  standard_cost: number;
};


function MaterialModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [type, setType] = useState("MEDIA");
  const [unitStock, setUnitStock] = useState("ROLL");
  const [unitUsage, setUnitUsage] = useState("METER");
  const [conv, setConv] = useState("1");
  const [minStock, setMinStock] = useState("10");
  const [cost, setCost] = useState("0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createMaterial({
      name, type: type as "MEDIA" | "INK", unit_stock: unitStock, unit_usage: unitUsage,
      conversion_factor: Number(conv), is_shared: false,
      min_stock: Number(minStock), current_stock: 0, standard_cost: Number(cost),
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-border bg-elevated/50 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-primary">Tambah Material Baru</h3>
            <p className="text-xs text-muted mt-0.5">Stok awal otomatis 0. Silakan sesuaikan setelah dibuat.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <div className="p-3 bg-status-red/10 border border-status-red/30 rounded-xl text-xs text-status-red">{error}</div>}
          
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Nama Material *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal" placeholder="Cth: Flexi Korea 440gsm" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Tipe *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal">
                <option value="MEDIA">Media / Kertas</option>
                <option value="INK">Tinta</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Standard Cost (Rp)</label>
              <input type="number" required min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Satuan Beli / Gudang *</label>
              <select value={unitStock} onChange={(e) => setUnitStock(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal">
                <option value="ROLL">Roll</option>
                <option value="LITER">Liter</option>
                <option value="RIM">Rim</option>
                <option value="PCS">Pcs</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Satuan Produksi *</label>
              <select value={unitUsage} onChange={(e) => setUnitUsage(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal">
                <option value="METER">Meter</option>
                <option value="ML">Mililiter (ml)</option>
                <option value="LEMBAR">Lembar</option>
                <option value="PCS">Pcs</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Faktor Konversi *</label>
              <p className="text-[10px] text-muted mb-1">1 {unitStock} = berapa {unitUsage}?</p>
              <input type="number" step="0.01" required min="0.01" value={conv} onChange={(e) => setConv(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Batas Minimum Stok *</label>
              <p className="text-[10px] text-muted mb-1">Peringatan jika sisa {'<'} (satuan {unitStock})</p>
              <input type="number" step="0.01" required min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal" />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary transition-all">Batal</button>
            <button type="submit" disabled={busy} className="flex-1 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50">
              {busy ? "Menyimpan..." : "Simpan Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockAdjuster({ material, onDone }: { material: Material; onDone: () => void }) {
  const [val, setVal] = useState(String(material.current_stock));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    const res = await adjustMaterialStock(material.id, { newStock: Number(val), reason: "Penyesuaian stok gudang" });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onDone();
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-24 h-9 bg-card border border-border rounded-lg px-2 text-sm text-primary outline-none focus:border-accent-teal"
      />
      <button 
        onClick={handleSave} 
        disabled={busy || val === String(material.current_stock)}
        className="h-9 w-9 flex items-center justify-center bg-accent-teal text-white rounded-lg hover:brightness-110 disabled:opacity-30 disabled:bg-elevated disabled:text-muted transition-colors"
      >
        <Save className="h-4 w-4" />
      </button>
      {error && <span className="text-[10px] text-status-red ml-1">{error}</span>}
    </div>
  );
}

export function MaterialTab() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getMaterials();
    if (res.success) setMaterials(res.data);
    else setError(res.error);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  const filtered = materials.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) || m.material_code.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Pemantauan stok bahan baku dan penyesuaian manual (opname).</p>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-accent-teal to-accent-teal/70 text-white rounded-lg text-sm font-bold shadow-lg shadow-accent-teal/20 hover:brightness-110 transition-all"
        >
          <Plus className="h-4 w-4" /> Tambah Material
        </button>
      </div>

      {showModal && <MaterialModal onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); loadData(); }} />}

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-elevated/30 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Cari nama atau kode material..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-10 bg-card border border-border rounded-xl pl-10 pr-4 text-sm text-primary outline-none focus:border-accent-teal transition-all"
            />
          </div>
          <button onClick={loadData} className="p-2 text-muted hover:text-primary transition-colors rounded-lg border border-border bg-card">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated border-b border-border text-muted font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Material</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Satuan Beli</th>
                  <th className="px-4 py-3">Stok Aktual</th>
                  <th className="px-4 py-3">Batas Min.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(m => {
                  const isLow = Number(m.current_stock) <= Number(m.min_stock);
                  return (
                    <tr key={m.id} className="hover:bg-elevated/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted">{m.material_code}</td>
                      <td className="px-4 py-3 font-bold text-primary">{m.name}</td>
                      <td className="px-4 py-3 text-muted">{m.type}</td>
                      <td className="px-4 py-3 text-muted">{m.unit_stock}</td>
                      <td className="px-4 py-3">
                        <StockAdjuster material={m as any} onDone={loadData} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-1 rounded font-bold", isLow ? "bg-status-red/10 text-status-red" : "text-muted")}>
                          {m.min_stock}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted">Material tidak ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
