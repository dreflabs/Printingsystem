"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Save, Loader2, ArrowRight, Receipt, History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMaterials, getMaterialMovementHistory, adjustMaterialStock, receiveMaterialStock, createMaterial, updateMaterial, getMachines } from "@/actions/master-data";
import { getSessionUser } from "@/actions/session";
import { getMaterialStocktake, startMaterialStocktake, recordMaterialStocktakeCount, submitMaterialStocktake, approveMaterialStocktake } from "@/actions/stocktake";

type Material = {
  id: string;
  name: string;
  material_code: string;
  type: string;
  purpose: string;
  group_name: string | null;
  specifications: string | null;
  active: boolean;
  machine_ids: string[];
  unit_usage: string;
  unit_custom: string | null;
  product_options: { product: { name: string } }[];
  unit_stock: string;
  current_stock: number;
  min_stock: number;
  conversion_factor: number;
  standard_cost: number;
};


const UNIT_STOCK = ["ROLL", "METER", "LEMBAR", "LITER", "KG", "RIM", "BOTOL", "PCS"];
const UNIT_USAGE = ["METER", "LEMBAR", "ML", "GRAM", "PCS"];
const CUSTOM = "__CUSTOM__";

function MaterialModal({ editing, groups, onClose, onDone }: { editing: Material | null; groups: string[]; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState(editing?.type ?? "MEDIA");
  const [unitStock, setUnitStock] = useState(editing?.unit_stock ?? "ROLL");
  const [unitUsage, setUnitUsage] = useState(editing?.unit_usage ?? "METER");
  const [unitCustom, setUnitCustom] = useState("");
  const [conv, setConv] = useState(String(editing?.conversion_factor ?? 1));
  const [minStock, setMinStock] = useState(String(editing?.min_stock ?? 10));
  const [cost, setCost] = useState(String(editing?.standard_cost ?? 0));

  const [group, setGroup] = useState(editing?.group_name ?? "");
  const [specs, setSpecs] = useState(editing?.specifications ?? "");
  const [purpose, setPurpose] = useState(editing?.purpose ?? "PRIMARY");
  const [active, setActive] = useState(editing?.active ?? true);
  const [machineIds, setMachineIds] = useState<string[]>(editing?.machine_ids ?? []);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { getMachines().then(r => { if (r.success) setMachines(r.data); else setError(r.error); }); }, []);
  const usingCustom = unitStock === CUSTOM || unitUsage === CUSTOM;
  const resolvedStock = unitStock === CUSTOM ? unitCustom.trim().toUpperCase() : unitStock;
  const resolvedUsage = unitUsage === CUSTOM ? unitCustom.trim().toUpperCase() : unitUsage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usingCustom && !unitCustom.trim()) { setError("Isi nama satuan custom."); return; }
    setBusy(true);
    setError(null);
    const payload = {
      name, type, unit_stock: resolvedStock, unit_usage: resolvedUsage,
      unit_custom: usingCustom ? unitCustom.trim().toUpperCase() : null,
      conversion_factor: Number(conv), is_shared: false,
      min_stock: Number(minStock), standard_cost: Number(cost),
      group_name: group, specifications: specs, purpose: type === "INK" ? "CONSUMABLE" : purpose,
      machine_ids: machineIds,
    };
    const res = editing ? await updateMaterial(editing.id, { ...payload, active }) : await createMaterial({ ...payload, current_stock: 0 });
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
            <h3 className="text-base font-bold text-primary">{editing ? "Edit Material" : "Tambah Material Baru"}</h3>
            <p className="text-xs text-muted mt-0.5">Bahan utama dihubungkan ke produk melalui Katalog. Bahan pendukung mengikuti mesin.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && <div className="p-3 bg-status-red/10 border border-status-red/30 rounded-xl text-xs text-status-red">{error}</div>}
          
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Nama Material *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal" placeholder="Cth: Flexi Korea 440gsm" />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted block">Kelompok bahan</label>
            <input className="w-full h-11 rounded-xl border border-border bg-elevated px-3 text-sm" list="material-groups" value={group} onChange={e => setGroup(e.target.value)} placeholder="Mis. Flexi Banner" />
            <datalist id="material-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
            <label className="text-xs text-muted block">Spesifikasi</label>
            <input className="w-full h-11 rounded-xl border border-border bg-elevated px-3 text-sm" value={specs} onChange={e => setSpecs(e.target.value)} placeholder="Mis. 280 gsm, lebar roll 320 cm" />
            <label className="text-xs text-muted block">Fungsi material</label>
            <select className="w-full h-11 rounded-xl border border-border bg-elevated px-3 text-sm" disabled={type === "INK"} value={type === "INK" ? "CONSUMABLE" : purpose} onChange={e => setPurpose(e.target.value)}>
              <option value="PRIMARY">Bahan utama — pilihan pada produk</option>
              <option value="CONSUMABLE">Bahan pendukung — konsumsi mesin</option>
            </select>
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
                {UNIT_STOCK.map((u) => <option key={u} value={u}>{u}</option>)}
                <option value={CUSTOM}>Custom…</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Satuan Produksi *</label>
              <select value={unitUsage} onChange={(e) => setUnitUsage(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal">
                {UNIT_USAGE.map((u) => <option key={u} value={u}>{u}</option>)}
                <option value={CUSTOM}>Custom…</option>
              </select>
            </div>
          </div>

          {usingCustom && (
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Nama Satuan Custom *</label>
              <input value={unitCustom} onChange={(e) => setUnitCustom(e.target.value)} placeholder="mis. YARD, PAK, SET" className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal" />
              <p className="text-[10px] text-muted mt-1">Dipakai untuk satuan yang di-set &quot;Custom…&quot; di atas.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Faktor Konversi *</label>
              <p className="text-[10px] text-muted mb-1">1 {resolvedStock || "?"} = berapa {resolvedUsage || "?"}?</p>
              <input type="number" step="0.01" required min="0.01" value={conv} onChange={(e) => setConv(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Batas Minimum Stok *</label>
              <p className="text-[10px] text-muted mb-1">Peringatan jika sisa {'<'} (satuan {resolvedStock || "?"})</p>
              <input type="number" step="0.01" required min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal" />
            </div>
          </div>

          <fieldset className="rounded-xl border border-border p-3 space-y-2">
            <legend className="text-xs text-muted px-1">Mesin yang dapat memakai material</legend>
            {machines.map(m => <label key={m.id} className="flex gap-2 text-sm"><input type="checkbox" checked={machineIds.includes(m.id)} onChange={e => setMachineIds(ids => e.target.checked ? [...ids, m.id] : ids.filter(id => id !== m.id))} />{m.name}</label>)}
            {!machines.length && <p className="text-xs text-muted">Tambahkan mesin melalui Katalog Produk & Mesin.</p>}
          </fieldset>
          {editing && <label className="flex gap-2 text-sm"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Material aktif</label>}
          {editing && <p className="text-xs text-muted">Satuan dan konversi bahan yang sudah digunakan tidak bisa diubah agar histori stok tetap konsisten.</p>}
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

function MaterialReceiptModal({ materials, onClose, onDone }: { materials: Material[]; onClose: () => void; onDone: () => void }) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = materials.find((m) => m.id === materialId);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await receiveMaterialStock(materialId, {
      quantity: Number(quantity),
      supplier,
      referenceNo,
      unitCost: unitCost ? Number(unitCost) : undefined,
      receivedAt,
      notes,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-border bg-elevated/50">
          <h3 className="text-base font-bold text-primary">Catat Stok Masuk</h3>
          <p className="text-xs text-muted mt-0.5">Jumlah diterima akan ditambahkan ke stok saat ini dan dicatat sebagai IN.</p>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-status-red/10 border border-status-red/30 rounded-xl text-xs text-status-red">{error}</div>}
          <div>
            <label className="text-xs font-medium text-muted mb-1 block">Material *</label>
            <select required value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="w-full h-11 bg-elevated border border-border rounded-xl px-3 text-sm text-primary">
              <option value="">Pilih material...</option>
              {materials.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.material_code} · {m.name} ({m.unit_stock})</option>)}
            </select>
            {selected && <p className="text-[11px] text-muted mt-1">Stok saat ini: {selected.current_stock} {selected.unit_stock}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted">Jumlah masuk ({selected?.unit_stock ?? "satuan"}) *<input required type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm text-primary" /></label>
            <label className="text-xs text-muted">Tanggal terima *<input required type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="mt-1 w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm text-primary" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted">Supplier<input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nama supplier" className="mt-1 w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm text-primary" /></label>
            <label className="text-xs text-muted">No. invoice/surat jalan<input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Opsional" className="mt-1 w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm text-primary" /></label>
          </div>
          <label className="text-xs text-muted">Harga beli per satuan<input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Opsional" className="mt-1 w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm text-primary" /></label>
          <label className="text-xs text-muted">Catatan<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" className="mt-1 w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm text-primary" /></label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted">Batal</button>
            <button type="submit" disabled={busy} className="flex-1 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold disabled:opacity-50">{busy ? "Menyimpan..." : "Simpan Stok Masuk"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function StockAdjuster({ material, onDone, canAdjust }: { material: Material; onDone: () => void; canAdjust: boolean }) {
  const [val, setVal] = useState(String(material.current_stock));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!reason.trim()) { setError("Isi alasan penyesuaian stok."); return; }
    setBusy(true);
    setError(null);
    const res = await adjustMaterialStock(material.id, { newStock: Number(val), reason: reason.trim() });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onDone();
  };

  if (!canAdjust) return <span className="text-sm text-primary">{material.current_stock}</span>;
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-24 h-9 bg-card border border-border rounded-lg px-2 text-sm text-primary outline-none focus:border-accent-teal"
      />
      <input aria-label="Alasan penyesuaian stok" className="w-36 h-9 rounded-lg border border-border bg-card px-2 text-xs" placeholder="Alasan penyesuaian" value={reason} onChange={e => setReason(e.target.value)} />
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

type StocktakeData = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  submittedAt: string | Date | null;
  approvedAt: string | Date | null;
  createdBy: string;
  submittedBy: string | null;
  approvedBy: string | null;
  items: { id: string; materialId: string; materialCode: string; materialName: string; unitStock: string; systemStock: number; countedStock: number | null; variance: number | null; currentStock: number; notes: string | null }[];
};

function StocktakeModal({ canCount, canApprove, onClose, onDone }: { canCount: boolean; canApprove: boolean; onClose: () => void; onDone: () => void }) {
  const [data, setData] = useState<StocktakeData | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { const res = await getMaterialStocktake(); if (res.success) { setData(res.data); if (res.data) { setCounts(Object.fromEntries(res.data.items.map((item) => [item.materialId, item.countedStock == null ? "" : String(item.countedStock)]))); setNotes(Object.fromEntries(res.data.items.map((item) => [item.materialId, item.notes || ""]))); } } else setError(res.error); setLoading(false); };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);
  const start = async () => { setBusy(true); const res = await startMaterialStocktake(); setBusy(false); if (res.success) { setData(res.data); setCounts(Object.fromEntries(res.data.items.map((item) => [item.materialId, item.countedStock == null ? "" : String(item.countedStock)]))); } else setError(res.error); };
  const saveCount = async (item: StocktakeData["items"][number]) => { const value = Number(counts[item.materialId]); if (!Number.isFinite(value) || value < 0) { setError("Jumlah fisik harus diisi dengan angka nol atau lebih."); return; } setBusy(true); const res = await recordMaterialStocktakeCount(data!.id, item.materialId, value, notes[item.materialId]); setBusy(false); if (!res.success) setError(res.error); else { setError(null); await load(); } };
  const submit = async () => { setBusy(true); const res = await submitMaterialStocktake(data!.id); setBusy(false); if (!res.success) setError(res.error); else { await load(); } };
  const approve = async () => { setBusy(true); const res = await approveMaterialStocktake(data!.id); setBusy(false); if (!res.success) setError(res.error); else { onDone(); } };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} /><div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-card border border-border rounded-2xl shadow-2xl flex flex-col"><div className="p-5 border-b border-border flex items-center justify-between"><div><h3 className="text-base font-bold text-primary">Stock Opname Material</h3><p className="text-xs text-muted mt-0.5">Snapshot saldo sistem → hitung fisik → approval Owner</p></div><button onClick={onClose} aria-label="Tutup stock opname" className="p-2 text-muted hover:text-primary"><X className="h-4 w-4" /></button></div><div className="overflow-auto p-5 space-y-4">{error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">{error}</div>}{loading ? <div className="h-40 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div> : !data ? <div className="rounded-xl border border-border bg-elevated/40 p-6 text-center"><p className="text-sm text-primary font-semibold">Belum ada sesi stock opname aktif.</p><p className="text-xs text-muted mt-1">Sistem akan mengambil snapshot semua material aktif.</p>{canCount && <button onClick={start} disabled={busy} className="mt-4 h-10 rounded-lg bg-accent-teal px-4 text-sm font-bold text-white disabled:opacity-40">Mulai Stock Opname</button>}</div> : <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">Status: <span className="font-bold text-primary">{data.status}</span> · Dibuat oleh {data.createdBy}</p>{data.status === "DRAFT" && canCount && <button onClick={submit} disabled={busy || data.items.some((item) => item.countedStock == null)} className="h-9 rounded-lg bg-accent-teal px-3 text-xs font-bold text-white disabled:opacity-40">Kirim untuk Approval</button>}{data.status === "SUBMITTED" && canApprove && <button onClick={approve} disabled={busy} className="h-9 rounded-lg bg-status-green px-3 text-xs font-bold text-white disabled:opacity-40">Approve & Terapkan Selisih</button>}</div><div className="overflow-x-auto border border-border rounded-xl"><table className="w-full text-xs text-left"><thead className="bg-elevated border-b border-border text-muted font-semibold uppercase tracking-wide"><tr><th className="px-3 py-3">Material</th><th className="px-3 py-3">Saldo Snapshot</th><th className="px-3 py-3">Hitung Fisik</th><th className="px-3 py-3">Selisih</th><th className="px-3 py-3">Aksi</th></tr></thead><tbody className="divide-y divide-border/50">{data.items.map((item) => <tr key={item.id}><td className="px-3 py-3"><p className="font-semibold text-primary">{item.materialName}</p><p className="text-[11px] text-muted">{item.materialCode} · {item.unitStock}</p></td><td className="px-3 py-3 text-muted">{item.systemStock}</td><td className="px-3 py-3">{data.status === "DRAFT" && canCount ? <input type="number" min="0" step="0.01" value={counts[item.materialId] || ""} onChange={(e) => setCounts((p) => ({ ...p, [item.materialId]: e.target.value }))} className="h-9 w-28 rounded-lg border border-border bg-elevated px-2 text-sm text-primary" /> : <span className="text-primary">{item.countedStock ?? "—"}</span>}</td><td className={cn("px-3 py-3 font-semibold", (item.variance ?? 0) < 0 ? "text-status-red" : (item.variance ?? 0) > 0 ? "text-status-green" : "text-muted")}>{item.variance == null ? "—" : `${item.variance > 0 ? "+" : ""}${item.variance}`}</td><td className="px-3 py-3">{data.status === "DRAFT" && canCount && <button onClick={() => saveCount(item)} disabled={busy} className="rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-primary disabled:opacity-40">Simpan</button>}</td></tr>)}</tbody></table></div></>}</div></div></div>;
}

type MaterialMovementRow = {
  id: string;
  materialCode: string;
  materialName: string;
  unitStock: string;
  movementType: string;
  quantityUsage: number;
  quantityStockChange: number;
  beforeStock: number;
  afterStock: number;
  supplier: string | null;
  unitCost: number | null;
  referenceNo: string | null;
  receivedAt: string | Date;
  performedBy: string;
  machine: string | null;
  jobCode: string | null;
  orderCode: string | null;
  reason: string | null;
  createdAt: string | Date;
};

function MaterialHistoryModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const [rows, setRows] = useState<MaterialMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getMaterialMovementHistory(material.id).then((res) => {
      if (res.success) setRows(res.data);
      else setError(res.error);
      setLoading(false);
    });
  }, [material.id]);
  const fmt = (value: string | Date) => new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  const movementLabel: Record<string, string> = { IN: "Stok Masuk", OUT: "Pemakaian", WASTE: "Waste", ADJUSTMENT: "Adjustment" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-card border border-border rounded-2xl shadow-2xl flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div><h3 className="text-base font-bold text-primary">Riwayat Material</h3><p className="text-xs text-muted mt-0.5">{material.material_code} · {material.name}</p></div>
          <button onClick={onClose} aria-label="Tutup riwayat" className="p-2 text-muted hover:text-primary"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-auto p-5">
          {error && <div className="mb-3 rounded-xl border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">{error}</div>}
          {loading ? <div className="h-32 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div> : rows.length === 0 ? <p className="p-8 text-center text-sm text-muted">Belum ada pergerakan material.</p> : (
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated border-b border-border text-muted font-semibold uppercase tracking-wide"><tr><th className="px-3 py-3">Waktu</th><th className="px-3 py-3">Jenis</th><th className="px-3 py-3">Perubahan</th><th className="px-3 py-3">Saldo</th><th className="px-3 py-3">Referensi</th><th className="px-3 py-3">Petugas</th><th className="px-3 py-3">Konteks</th></tr></thead>
              <tbody className="divide-y divide-border/50">{rows.map((row) => <tr key={row.id} className="hover:bg-elevated/30"><td className="px-3 py-3 text-muted whitespace-nowrap">{fmt(row.createdAt)}</td><td className="px-3 py-3"><span className={cn("rounded-full px-2 py-1 font-semibold", row.movementType === "IN" ? "bg-status-green/10 text-status-green" : row.movementType === "ADJUSTMENT" ? "bg-status-yellow/10 text-status-yellow-text" : "bg-elevated text-muted")}>{movementLabel[row.movementType] || row.movementType}</span></td><td className={cn("px-3 py-3 font-semibold", row.quantityStockChange >= 0 ? "text-status-green" : "text-status-red")}>{row.quantityStockChange > 0 ? "+" : ""}{row.quantityStockChange} {row.unitStock}</td><td className="px-3 py-3 text-primary">{row.beforeStock} → {row.afterStock} {row.unitStock}</td><td className="px-3 py-3 text-muted">{row.referenceNo || row.supplier || row.reason || "—"}</td><td className="px-3 py-3 text-muted">{row.performedBy}</td><td className="px-3 py-3 text-muted">{row.jobCode || row.orderCode || row.machine || "—"}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function MaterialTab() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [historyFor, setHistoryFor] = useState<Material | null>(null);
  const [showStocktake, setShowStocktake] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const canReceive = roles.includes("owner") || roles.includes("gudang");
  const canAdjust = roles.includes("owner");
  const canStocktake = roles.includes("owner") || roles.includes("gudang");
  const groups = [...new Set(materials.map(m => m.group_name).filter((g): g is string => !!g))].sort();

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getMaterials();
    if (res.success) setMaterials(res.data);
    else setError(res.error);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { getSessionUser().then((r) => { if (r.ok) setRoles(r.user.roles); }); }, []);

  const filtered = materials.filter(m => (!groupFilter || m.group_name === groupFilter) && (m.name.toLowerCase().includes(query.toLowerCase()) || m.material_code.toLowerCase().includes(query.toLowerCase())));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Pemantauan stok bahan baku dan penyesuaian manual (opname).</p>
        <div className="flex items-center gap-2">
        {canStocktake && <button
          onClick={() => setShowStocktake(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-status-yellow text-primary rounded-lg text-sm font-bold shadow-sm hover:brightness-110 transition-all"
        >
          Stock Opname
        </button>}
        {canReceive && <button
          onClick={() => setShowReceipt(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-status-green text-white rounded-lg text-sm font-bold shadow-sm hover:brightness-110 transition-all"
        >
          <Receipt className="h-4 w-4" /> Stok Masuk
        </button>}
        {canReceive && <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent-teal text-white rounded-lg text-sm font-bold shadow-sm hover:brightness-110 transition-all"
        >
          <Plus className="h-4 w-4" /> Tambah Material
        </button>}
        </div>
      </div>

      {showModal && <MaterialModal editing={editing} groups={groups} onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); loadData(); }} />}
      {showReceipt && <MaterialReceiptModal materials={materials} onClose={() => setShowReceipt(false)} onDone={() => { setShowReceipt(false); loadData(); }} />}
      {historyFor && <MaterialHistoryModal material={historyFor} onClose={() => setHistoryFor(null)} />}
      {showStocktake && <StocktakeModal canCount={canStocktake} canApprove={canAdjust} onClose={() => setShowStocktake(false)} onDone={() => { setShowStocktake(false); loadData(); }} />}

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden flex flex-col">
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
          <button aria-label="Muat ulang material" onClick={loadData} className="p-2 text-muted hover:text-primary transition-colors rounded-lg border border-border bg-card">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-4 border-b border-border"><select aria-label="Filter kelompok bahan" className="bg-elevated border border-border rounded-lg p-2 text-sm" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}><option value="">Semua kelompok</option>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
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
                  <th className="px-4 py-3 text-right">Riwayat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(m => {
                  const isLow = Number(m.current_stock) <= Number(m.min_stock);
                  return (
                    <tr key={m.id} className="hover:bg-elevated/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted">{m.material_code}</td>
                      <td className="px-4 py-3 text-primary">{canReceive ? <button className="font-bold text-accent-teal" onClick={() => { setEditing(m); setShowModal(true); }}>{m.name}</button> : <span className="font-bold">{m.name}</span>}<p className="text-xs text-muted">{m.group_name || "Belum ada kelompok"} · {m.active ? "Aktif" : "Nonaktif"}</p><p className="text-xs text-muted">{m.specifications}</p><p className="text-xs text-muted" title={m.product_options.map(p => p.product.name).join(", ")}>{m.purpose === "CONSUMABLE" ? "Bahan pendukung mesin" : m.product_options.length ? `Dipakai pada ${m.product_options.length} produk` : "Belum terhubung ke produk"}</p></td>
                      <td className="px-4 py-3 text-muted">{m.type}</td>
                      <td className="px-4 py-3 text-muted">{m.unit_stock}</td>
                      <td className="px-4 py-3">
                        <StockAdjuster material={m} onDone={loadData} canAdjust={canAdjust} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-1 rounded font-bold", isLow ? "bg-status-red/10 text-status-red" : "text-muted")}>
                          {m.min_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right"><button onClick={() => setHistoryFor(m)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-primary hover:border-accent-teal"><History className="h-3.5 w-3.5" /> Riwayat</button></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted">Material tidak ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
