"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { Plus, Search, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getRetailProducts, createRetailProduct, updateRetailProduct, deleteRetailProduct,
  getPrintingProducts, createPrintingProduct, updatePrintingProduct, deletePrintingProduct,
  getMachines, createMachine, updateMachine, deleteMachine,
  getMaterials, getProductCategories,
} from "@/actions/master-data";
import { PRINTING_UNITS, MACHINE_CATEGORIES, MACHINE_STATUSES } from "@/lib/catalog-constants";

type Tab = "retail" | "printing" | "machine";
type Retail = {
  id: string; sku: string; name: string; category: string;
  price: number; makloon_price: number | null; stock_quantity: number; min_stock: number; active: boolean;
};
type Printing = {
  id: string; name: string; category: string; unit: string;
  base_price: number | null; default_material_id: string | null; default_machine_id: string | null; active: boolean;
};
type Machine = { id: string; machine_code: string; name: string; category: string; status: string; notes: string | null };
type MatOpt = { id: string; name: string };

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const inp = "w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm text-primary outline-none focus:border-accent-teal";

// ─── Retail modal (create + edit) ────────────────────────────────────────────
function RetailModal({
  editing, categories, onClose, onSaved,
}: {
  editing: Retail | null; categories: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState({
    sku: editing?.sku ?? "",
    name: editing?.name ?? "",
    category: editing?.category ?? "",
    price: editing ? String(editing.price) : "",
    makloon: editing?.makloon_price != null ? String(editing.makloon_price) : "",
    stock: editing ? String(editing.stock_quantity) : "",
    minStock: editing ? String(editing.min_stock) : "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!f.name.trim()) { setErr("Nama produk wajib diisi."); return; }
    setBusy(true); setErr(null);
    const common = {
      name: f.name.trim(),
      category: f.category.trim() || "GENERAL",
      price: Number(f.price) || 0,
      makloon_price: f.makloon ? Number(f.makloon) : null,
      min_stock: Number(f.minStock) || 0,
    };
    const res = editing
      ? await updateRetailProduct(editing.id, { ...common, sku: f.sku.trim() })
      : await createRetailProduct({
          ...common,
          sku: f.sku.trim() || `RET-${Date.now().toString().slice(-5)}`,
          stock_quantity: Number(f.stock) || 0,
        });
    setBusy(false);
    if (!res.success) { setErr(res.error ?? "Gagal."); return; }
    onSaved();
  }

  return (
    <Shell title={editing ? "Edit Barang Retail" : "Tambah Barang Retail"} onClose={onClose} busy={busy}>
      {err && <Err msg={err} />}
      <Grid2>
        <Field label="SKU *"><input className={inp} value={f.sku} onChange={(e) => set("sku", e.target.value)} placeholder="P-KRT-001" /></Field>
        <Field label="Kategori">
          <input className={inp} value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Ketik bebas — mis. Stiker" />
        </Field>
      </Grid2>
      <Field label="Nama Produk *"><input className={inp} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama lengkap produk" /></Field>
      <Field label="Harga (Rp) *"><input className={inp} type="number" min={0} value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="20000" /></Field>
      <Grid2>
        <Field label={editing ? "Stok (ubah lewat menu Gudang)" : "Stok Awal"}>
          <input className={inp} type="number" min={0} value={f.stock} onChange={(e) => set("stock", e.target.value)} placeholder="0" disabled={!!editing} />
        </Field>
        <Field label="Stok Minimum"><input className={inp} type="number" min={0} value={f.minStock} onChange={(e) => set("minStock", e.target.value)} placeholder="0" /></Field>
      </Grid2>
      <SaveBtn busy={busy} onClick={save} />
    </Shell>
  );
}

// ─── Printing service modal (create + edit) ──────────────────────────────────
function PrintingModal({
  editing, materials, machines, categories, onClose, onSaved,
}: {
  editing: Printing | null; materials: MatOpt[]; machines: Machine[]; categories: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [unit, setUnit] = useState(editing?.unit ?? "M2");
  const [basePrice, setBasePrice] = useState(editing?.base_price != null ? String(editing.base_price) : "");
  const [materialId, setMaterialId] = useState(editing?.default_material_id ?? "");
  const [machineId, setMachineId] = useState(editing?.default_machine_id ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setErr("Nama produk wajib diisi."); return; }
    setBusy(true); setErr(null);
    const payload = {
      name: name.trim(),
      category: (category.trim() || "LAINNYA").toUpperCase(),
      unit,
      base_price: basePrice ? Number(basePrice) : null,
      default_material_id: materialId || null,
      default_machine_id: machineId || null,
    };
    const res = editing
      ? await updatePrintingProduct(editing.id, { ...payload, active })
      : await createPrintingProduct(payload);
    setBusy(false);
    if (!res.success) { setErr(res.error ?? "Gagal."); return; }
    onSaved();
  }

  return (
    <Shell title={editing ? "Edit Jasa Cetak" : "Tambah Jasa Cetak"} onClose={onClose} busy={busy}>
      {err && <Err msg={err} />}
      <Field label="Nama Produk *"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Spanduk Outdoor" /></Field>
      <Field label="Kategori">
        <input className={inp} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ketik bebas — mis. STIKER" />
      </Field>
      <Grid2>
        <Field label="Satuan Harga">
          <select className={inp} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {PRINTING_UNITS.map((u) => <option key={u} value={u}>{u === "M2" ? "per m²" : `per ${u.toLowerCase()}`}</option>)}
          </select>
        </Field>
        <Field label={`Harga Dasar / ${unit === "M2" ? "m²" : unit.toLowerCase()} (Rp)`}>
          <input className={inp} type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="kosong = harga manual" />
        </Field>
      </Grid2>
      <p className="text-[10px] text-muted -mt-2">Harga dasar dipakai untuk mengisi otomatis &quot;Harga Total&quot; saat buat order (tetap bisa diubah). Kosongkan kalau harga selalu ditentukan manual.</p>
      <Field label="Material Default (opsional)">
        <select className={inp} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
          <option value="">—</option>
          {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
      <Field label="Mesin Default">
        <select className={inp} value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">— belum diset (order butuh assign manual)</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id} disabled={m.status !== "ACTIVE"}>
              {m.name} ({m.machine_code}){m.status !== "ACTIVE" ? ` — ${m.status}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-[10px] text-muted -mt-2">Order yang semua itemnya punya mesin default + lolos syarat kelayakan akan turun ke antrian produksi otomatis, tanpa &quot;Assign ke Produksi&quot; manual.</p>
      {editing && (
        <label className="flex items-center gap-2 text-xs text-primary">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Aktif
        </label>
      )}
      <SaveBtn busy={busy} onClick={save} />
    </Shell>
  );
}

// ─── Machine modal (create + edit) ──────────────────────────────────────────
function MachineModal({
  editing, suggestions, onClose, onSaved,
}: {
  editing: Machine | null; suggestions: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [status, setStatus] = useState(editing?.status ?? "ACTIVE");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setErr("Nama mesin wajib diisi."); return; }
    setBusy(true); setErr(null);
    const payload = { name: name.trim(), category: category.trim(), status, notes: notes.trim() || null };
    const res = editing ? await updateMachine(editing.id, payload) : await createMachine(payload);
    setBusy(false);
    if (!res.success) { setErr(res.error ?? "Gagal."); return; }
    onSaved();
  }

  return (
    <Shell title={editing ? `Edit Mesin ${editing.machine_code}` : "Tambah Mesin"} onClose={onClose} busy={busy}>
      {err && <Err msg={err} />}
      <Field label="Nama Mesin *"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Epson SureColor S60, Roland VersaUV" /></Field>
      <Grid2>
        <Field label="Jenis / Kategori (opsional)">
          <input
            className={inp}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ketik bebas — mis. Eco Solvent, UV Flatbed, DTF"
          />
        </Field>
        <Field label="Status">
          <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
            {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </Grid2>
      <p className="text-[10px] text-muted -mt-2">Jenis hanya untuk pengelompokan Anda sendiri — isi apa pun, atau biarkan kosong.</p>
      <Field label="Catatan (opsional)">
        <textarea className={cn(inp, "h-16 py-2")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. print head no.2 lemah" />
      </Field>
      <p className="text-[10px] text-muted -mt-2">Hanya mesin <b>ACTIVE</b> yang muncul di form &quot;Assign ke Produksi&quot;.</p>
      <SaveBtn busy={busy} onClick={save} />
    </Shell>
  );
}

// ─── Small shared bits ──────────────────────────────────────────────────────
function Shell({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-modal space-y-3.5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-primary">{title}</h3>
          <button onClick={onClose} disabled={busy} className="p-1 rounded-lg text-muted hover:text-primary disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="text-xs font-medium text-muted block mb-1">{label}</label>{children}</div>
);
const Grid2 = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-3">{children}</div>;
const Err = ({ msg }: { msg: string }) => <div className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{msg}</div>;
const SaveBtn = ({ busy, onClick }: { busy: boolean; onClick: () => void }) => (
  <button disabled={busy} onClick={onClick} className="w-full h-11 bg-accent-teal text-white rounded-xl text-sm font-bold hover:brightness-110 disabled:opacity-50">
    {busy ? "Menyimpan…" : "Simpan"}
  </button>
);

// ─── Page ───────────────────────────────────────────────────────────────────
export default function AdminProductsPage() {
  const [tab, setTab] = useState<Tab>("retail");
  const [search, setSearch] = useState("");
  const [retail, setRetail] = useState<Retail[]>([]);
  const [printing, setPrinting] = useState<Printing[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [materials, setMaterials] = useState<MatOpt[]>([]);
  const [cats, setCats] = useState<{ retail: string[]; printing: string[] }>({ retail: [], printing: [] });
  const [retailModal, setRetailModal] = useState<{ open: boolean; editing: Retail | null }>({ open: false, editing: null });
  const [printingModal, setPrintingModal] = useState<{ open: boolean; editing: Printing | null }>({ open: false, editing: null });
  const [machineModal, setMachineModal] = useState<{ open: boolean; editing: Machine | null }>({ open: false, editing: null });
  const [confirmDel, setConfirmDel] = useState<{ type: Tab; item: any } | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, p, mac, m, c] = await Promise.all([
      getRetailProducts(), getPrintingProducts(), getMachines(), getMaterials(), getProductCategories(),
    ]);
    if (r.success) setRetail(r.data as Retail[]);
    if (p.success) setPrinting(p.data as Printing[]);
    if (mac.success) setMachines(mac.data as Machine[]);
    if (m.success) setMaterials((m.data as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name })));
    if (c.success) setCats(c.data);
    if (!p.success) setError(p.error ?? null);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const done = () => { setRetailModal({ open: false, editing: null }); setPrintingModal({ open: false, editing: null }); setMachineModal({ open: false, editing: null }); load(); };
  const matName = (id: string | null) => materials.find((m) => m.id === id)?.name ?? "—";
  const machName = (id: string | null) => machines.find((m) => m.id === id)?.name ?? "—";
  const q = search.toLowerCase();
  
  // Filter logic
  const fRetail = retail.filter((p) => {
    const matchQ = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchC = activeCategoryFilter === "ALL" || p.category === activeCategoryFilter;
    return matchQ && matchC;
  });
  const fPrinting = printing.filter((p) => {
    const matchQ = p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchC = activeCategoryFilter === "ALL" || p.category === activeCategoryFilter;
    return matchQ && matchC;
  });
  const fMachine = machines.filter((p) => {
    const matchQ = p.name.toLowerCase().includes(q) || p.machine_code.toLowerCase().includes(q);
    const matchC = activeCategoryFilter === "ALL" || p.category === activeCategoryFilter;
    return matchQ && matchC;
  });
  
  const machineCatSuggestions = Array.from(
    new Set<string>([...MACHINE_CATEGORIES, ...machines.map((m) => m.category).filter(Boolean)]),
  ).sort((a, b) => a.localeCompare(b, "id"));

  async function del() {
    if (!confirmDel) return;
    const { type, item } = confirmDel;
    setConfirmDel(null);
    let res;
    if (type === "retail") res = await deleteRetailProduct(item.id);
    else if (type === "printing") res = await deletePrintingProduct(item.id);
    else res = await deleteMachine(item.id);

    if (!res.success) { setError(res.error ?? null); return; }
    load();
  }

  // Handle Tab Change to reset category filter
  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setActiveCategoryFilter("ALL");
  };

  const addLabel = tab === "retail" ? "Tambah Barang" : tab === "printing" ? "Tambah Jasa Cetak" : "Tambah Mesin";
  const onAdd = () =>
    tab === "retail" ? setRetailModal({ open: true, editing: null })
      : tab === "printing" ? setPrintingModal({ open: true, editing: null })
        : setMachineModal({ open: true, editing: null });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Master Produk & Mesin</h1>
          <p className="text-sm text-muted mt-1">Barang retail, jasa cetak, dan katalog mesin produksi.</p>
        </div>
        <button onClick={onAdd} className="flex items-center gap-2 bg-accent-teal text-white px-5 py-2.5 rounded-xl font-bold hover:brightness-110 shadow-lg shadow-accent-teal/20 transition-all">
          <Plus className="h-5 w-5" /> {addLabel}
        </button>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="flex items-center gap-4 border-b border-border">
        {(["retail", "printing", "machine"] as const).map((t) => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={cn("pb-3 px-1 border-b-2 font-bold text-sm transition-colors", tab === t ? "border-accent-teal text-accent-teal" : "border-transparent text-muted hover:text-primary")}>
            {t === "retail" ? "Barang Retail" : t === "printing" ? "Jasa Cetak" : "Mesin"}
          </button>
        ))}
      </div>

      <div className="bg-card p-4 rounded-xl border border-border flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input placeholder="Cari nama / kode…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-elevated border border-border rounded-lg outline-none focus:border-accent-teal text-sm" />
        </div>
        
        {/* Category Filter */}
        <select 
          value={activeCategoryFilter}
          onChange={(e) => setActiveCategoryFilter(e.target.value)}
          className="w-full sm:w-64 px-4 py-2 bg-elevated border border-border rounded-lg outline-none focus:border-accent-teal text-sm text-primary appearance-none cursor-pointer"
        >
          <option value="ALL">Semua Kategori</option>
          {(tab === "retail" ? cats.retail : tab === "printing" ? cats.printing : machineCatSuggestions).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated border-b border-border text-muted uppercase text-xs font-semibold">
              {tab === "retail" && (
                <tr><th className="px-5 py-4">SKU</th><th className="px-5 py-4">Produk & Kategori</th><th className="px-5 py-4">Harga</th><th className="px-5 py-4">Stok</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aksi</th></tr>
              )}
              {tab === "printing" && (
                <tr><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Kategori</th><th className="px-5 py-4">Harga Dasar</th><th className="px-5 py-4">Material Default</th><th className="px-5 py-4">Mesin Default</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aksi</th></tr>
              )}
              {tab === "machine" && (
                <tr><th className="px-5 py-4">Kode</th><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Kategori</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Aksi</th></tr>
              )}
            </thead>
            <tbody className="divide-y divide-border">
              {tab === "retail" && fRetail.map((p) => (
                <tr key={p.id} className={cn("hover:bg-elevated/50 transition-colors", !p.active && "opacity-60")}>
                  <td className="px-5 py-4 font-mono text-xs text-muted">{p.sku}</td>
                  <td className="px-5 py-4"><div className="font-semibold text-primary">{p.name}</div><div className="text-xs text-muted mt-0.5">{p.category}</div></td>
                  <td className="px-5 py-4 font-mono text-status-blue">{rupiah(p.price)}</td>
                  <td className="px-5 py-4 text-xs"><span className={cn(p.stock_quantity <= p.min_stock && "text-status-red font-bold")}>{p.stock_quantity}</span> {p.min_stock > 0 && <span className="text-muted">/ min {p.min_stock}</span>}</td>
                  <td className="px-5 py-4"><Badge active={p.active} /></td>
                  <td className="px-5 py-4 text-right">
                    <RowActions
                      onEdit={() => setRetailModal({ open: true, editing: p })}
                      onDelete={() => setConfirmDel({ type: "retail", item: p })}
                    />
                  </td>
                </tr>
              ))}
              {tab === "printing" && fPrinting.map((p) => (
                <tr key={p.id} className={cn("hover:bg-elevated/50 transition-colors", !p.active && "opacity-60")}>
                  <td className="px-5 py-4 font-semibold text-primary">{p.name}</td>
                  <td className="px-5 py-4 text-muted text-xs">{p.category}</td>
                  <td className="px-5 py-4 font-mono text-xs">{p.base_price != null ? `${rupiah(p.base_price)} / ${p.unit === "M2" ? "m²" : p.unit.toLowerCase()}` : <span className="bg-muted/10 text-muted px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Harga Manual</span>}</td>
                  <td className="px-5 py-4 text-muted text-xs">{matName(p.default_material_id)}</td>
                  <td className="px-5 py-4 text-muted text-xs">{p.default_machine_id ? machName(p.default_machine_id) : <span className="text-status-yellow-text">belum diset</span>}</td>
                  <td className="px-5 py-4"><Badge active={p.active} /></td>
                  <td className="px-5 py-4 text-right">
                    <RowActions 
                      onEdit={() => setPrintingModal({ open: true, editing: p })} 
                      onDelete={() => setConfirmDel({ type: "printing", item: p })}
                    />
                  </td>
                </tr>
              ))}
              {tab === "machine" && fMachine.map((p) => (
                <tr key={p.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-muted">{p.machine_code}</td>
                  <td className="px-5 py-4 font-semibold text-primary">{p.name}</td>
                  <td className="px-5 py-4 text-muted text-xs">{p.category}</td>
                  <td className="px-5 py-4">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      p.status === "ACTIVE" ? "bg-status-green/10 text-status-green border-status-green/30"
                        : p.status === "MAINTENANCE" ? "bg-status-yellow/10 text-status-yellow-text border-status-yellow/30"
                          : "bg-muted/10 text-muted border-muted/20")}>{p.status}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <RowActions 
                      onEdit={() => setMachineModal({ open: true, editing: p })} 
                      onDelete={() => setConfirmDel({ type: "machine", item: p })}
                    />
                  </td>
                </tr>
              ))}
              {((tab === "retail" && fRetail.length === 0) || (tab === "printing" && fPrinting.length === 0) || (tab === "machine" && fMachine.length === 0)) && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center">
                    <p className="text-sm text-primary font-medium">
                      {q
                        ? "Tidak ada yang cocok dengan pencarian."
                        : tab === "retail"
                          ? "Belum ada barang eceran."
                          : tab === "printing"
                            ? "Belum ada jasa cetak."
                            : "Belum ada mesin."}
                    </p>
                    {!q && (
                      <p className="text-xs text-muted mt-1">
                        {tab === "retail"
                          ? "Tambahkan produk jadi (ATK, souvenir, dll.) beserta stok & harga jualnya."
                          : tab === "printing"
                            ? "Tambahkan jasa cetak (spanduk, stiker, dll.) — bahan, mesin default, dan harga dipakai saat buat order."
                            : "Tambahkan mesin cetak supaya order bisa dirilis ke produksi. Set juga “Mesin Default” di tiap jasa cetak."}
                        {" "}Klik <b>{addLabel}</b> di kanan atas.
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {retailModal.open && <RetailModal editing={retailModal.editing} categories={cats.retail} onClose={() => setRetailModal({ open: false, editing: null })} onSaved={done} />}
      {printingModal.open && <PrintingModal editing={printingModal.editing} materials={materials} machines={machines} categories={cats.printing} onClose={() => setPrintingModal({ open: false, editing: null })} onSaved={done} />}
      {machineModal.open && <MachineModal editing={machineModal.editing} suggestions={machineCatSuggestions} onClose={() => setMachineModal({ open: false, editing: null })} onSaved={done} />}

      {confirmDel && (
        <Shell 
          title={`Hapus ${confirmDel.type === "retail" ? "Barang Retail" : confirmDel.type === "printing" ? "Jasa Cetak" : "Mesin"}`} 
          onClose={() => setConfirmDel(null)} 
          busy={false}
        >
          <p className="text-sm text-primary"><b>{confirmDel.type === "machine" ? confirmDel.item.name : confirmDel.item.name}</b> akan dihapus.</p>
          <p className="text-xs text-muted">
            {confirmDel.type === "retail" && "Kalau produk ini sudah pernah masuk penjualan atau mutasi stok, ia tidak dihapus permanen (memutus riwayat) — hanya dinonaktifkan dan disembunyikan dari kasir."}
            {confirmDel.type === "printing" && "Kalau jasa ini sudah memiliki riwayat produksi, Anda mungkin tidak bisa menghapusnya secara langsung."}
            {confirmDel.type === "machine" && "Kalau mesin ini terikat dengan riwayat produksi, statusnya akan diubah menjadi INACTIVE agar riwayat tidak hilang."}
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setConfirmDel(null)} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs font-bold text-muted hover:text-primary">Batal</button>
            <button onClick={() => del()} className="flex-1 h-10 rounded-xl bg-status-red text-white text-xs font-bold hover:brightness-110">Hapus</button>
          </div>
        </Shell>
      )}
    </div>
  );
}

function Badge({ active }: { active: boolean }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border",
      active ? "bg-status-green/10 text-status-green border-status-green/30" : "bg-muted/10 text-muted border-muted/20")}>
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete?: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={onEdit} className="p-1.5 text-muted hover:text-accent-teal hover:bg-accent-teal/10 rounded-md transition-colors" title="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      {onDelete && (
        <button onClick={onDelete} className="p-1.5 text-muted hover:text-status-red hover:bg-status-red/10 rounded-md transition-colors" title="Hapus">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
