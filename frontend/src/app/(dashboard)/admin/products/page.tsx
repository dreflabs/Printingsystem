"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, MoreHorizontal, X } from "lucide-react";
import { ProductFormModal } from "@/components/admin/ProductFormModal";
import { cn } from "@/lib/utils";
import {
  getRetailProducts, createRetailProduct,
  getPrintingProducts, createPrintingProduct, updatePrintingProduct,
  getMaterials,
} from "@/actions/master-data";

type Retail = { id: string; sku: string; name: string; category: string; price: number };
type Printing = { id: string; name: string; category: string; default_material_id: string | null; active: boolean };
type MatOpt = { id: string; name: string };

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

function PrintingModal({
  editing, materials, onClose, onSaved,
}: {
  editing: Printing | null; materials: MatOpt[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState(editing?.category ?? "OUTDOOR");
  const [materialId, setMaterialId] = useState(editing?.default_material_id ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setErr("Nama produk wajib diisi."); return; }
    setBusy(true);
    const payload = { name: name.trim(), category, default_material_id: materialId || null };
    const res = editing
      ? await updatePrintingProduct(editing.id, { ...payload, active })
      : await createPrintingProduct(payload);
    setBusy(false);
    if (!res.success) { setErr(res.error); return; }
    onSaved();
  }
  const inp = "w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm outline-none focus:border-accent-teal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-modal space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">{editing ? "Edit Produk Cetak" : "Tambah Produk Cetak"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        {err && <div className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{err}</div>}
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Nama Produk *</label>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Spanduk Outdoor" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Kategori</label>
          <select className={inp} value={category} onChange={(e) => setCategory(e.target.value)}>
            {["OUTDOOR", "INDOOR", "KERTAS", "MERCHANDISE", "PACKAGING", "LAINNYA"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Material Default (opsional)</label>
          <select className={inp} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">—</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {editing && (
          <label className="flex items-center gap-2 text-xs text-primary">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Aktif
          </label>
        )}
        <p className="text-[10px] text-muted">Harga per produk cetak dihitung manual saat pembuatan order (belum ada model harga/varian di schema).</p>
        <button disabled={busy} onClick={save} className="w-full h-11 bg-accent-teal text-white rounded-xl text-sm font-bold hover:brightness-110 disabled:opacity-50">
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const [tab, setTab] = useState<"retail" | "printing">("retail");
  const [search, setSearch] = useState("");
  const [retail, setRetail] = useState<Retail[]>([]);
  const [printing, setPrinting] = useState<Printing[]>([]);
  const [materials, setMaterials] = useState<MatOpt[]>([]);
  const [retailModal, setRetailModal] = useState(false);
  const [printingModal, setPrintingModal] = useState<{ open: boolean; editing: Printing | null }>({ open: false, editing: null });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, p, m] = await Promise.all([getRetailProducts(), getPrintingProducts(), getMaterials()]);
    if (r.success) setRetail(r.data as Retail[]);
    if (p.success) setPrinting(p.data as Printing[]);
    if (m.success) setMaterials((m.data as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name })));
    if (!p.success) setError(p.error ?? null);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const matName = (id: string | null) => materials.find((m) => m.id === id)?.name ?? "—";
  const fRetail = retail.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
  const fPrinting = printing.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  async function saveRetail(np: { sku?: string; name: string; category?: string; price?: number; stock?: number; minStock?: number }) {
    const res = await createRetailProduct({
      sku: np.sku || `RET-${Date.now().toString().slice(-5)}`,
      name: np.name, category: np.category || "GENERAL",
      price: Number(np.price) || 0, stock_quantity: Number(np.stock) || 0, min_stock: Number(np.minStock) || 0,
    });
    if (res.success) { setRetailModal(false); load(); } else setError(res.error ?? null);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Master Produk</h1>
          <p className="text-sm text-muted mt-1">Produk retail (harga & stok) dan jasa cetak.</p>
        </div>
        <button
          onClick={() => (tab === "retail" ? setRetailModal(true) : setPrintingModal({ open: true, editing: null }))}
          className="flex items-center gap-2 bg-accent-teal text-white px-5 py-2.5 rounded-xl font-bold hover:brightness-110 shadow-lg shadow-accent-teal/20 transition-all"
        >
          <Plus className="h-5 w-5" /> Tambah Produk
        </button>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="flex items-center gap-4 border-b border-border">
        {(["retail", "printing"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("pb-3 px-1 border-b-2 font-bold text-sm transition-colors", tab === t ? "border-accent-teal text-accent-teal" : "border-transparent text-muted hover:text-primary")}>
            {t === "retail" ? "Barang Retail / Consumable" : "Jasa Cetak"}
          </button>
        ))}
      </div>

      <div className="bg-card p-4 rounded-xl border border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input placeholder="Cari SKU / Nama Produk..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-elevated border border-border rounded-lg outline-none focus:border-accent-teal text-sm" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated border-b border-border text-muted uppercase text-xs font-semibold">
              {tab === "retail" ? (
                <tr><th className="px-6 py-4">SKU</th><th className="px-6 py-4">Produk & Kategori</th><th className="px-6 py-4">Harga Jual</th><th className="px-6 py-4 text-right">Aksi</th></tr>
              ) : (
                <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Nama Produk Cetak</th><th className="px-6 py-4">Kategori</th><th className="px-6 py-4">Material Default</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Aksi</th></tr>
              )}
            </thead>
            <tbody className="divide-y divide-border">
              {tab === "retail" && fRetail.map((p) => (
                <tr key={p.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-muted">{p.sku}</td>
                  <td className="px-6 py-4"><div className="font-semibold text-primary">{p.name}</div><div className="text-xs text-muted mt-1">{p.category}</div></td>
                  <td className="px-6 py-4 font-mono font-medium text-status-blue">{rupiah(Number(p.price))}</td>
                  <td className="px-6 py-4 text-right"><button className="p-1.5 text-muted hover:text-primary rounded-md"><MoreHorizontal className="h-5 w-5" /></button></td>
                </tr>
              ))}
              {tab === "printing" && fPrinting.map((p) => (
                <tr key={p.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-muted">{p.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 font-semibold text-primary">{p.name}</td>
                  <td className="px-6 py-4 text-muted text-xs">{p.category}</td>
                  <td className="px-6 py-4 text-muted text-xs">{matName(p.default_material_id)}</td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", p.active ? "bg-status-green/10 text-status-green border-status-green/30" : "bg-muted/10 text-muted border-muted/20")}>
                      {p.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setPrintingModal({ open: true, editing: p })} className="text-xs font-bold text-accent-teal hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
              {((tab === "retail" && fRetail.length === 0) || (tab === "printing" && fPrinting.length === 0)) && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted">Tidak ada produk yang sesuai.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductFormModal open={retailModal} onClose={() => setRetailModal(false)} onSave={saveRetail} />
      {printingModal.open && (
        <PrintingModal
          editing={printingModal.editing}
          materials={materials}
          onClose={() => setPrintingModal({ open: false, editing: null })}
          onSaved={() => { setPrintingModal({ open: false, editing: null }); load(); }}
        />
      )}
    </div>
  );
}
