"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, Plus, RefreshCw, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/actions/session";
import { getMaterials } from "@/actions/master-data";
import { createSupplier, createPurchaseOrder, getPurchaseOrders, getSuppliers, receivePurchaseOrder } from "@/actions/purchase-orders";

type Supplier = { id: string; code: string; name: string; phone: string | null; email: string | null; active: boolean };
type Material = { id: string; material_code: string; name: string; unit_stock: string; active: boolean };
type POItem = { id: string; materialId: string; material: { id: string; material_code: string; name: string; unit_stock: string }; orderedQty: number; receivedQty: number; unitCost: number; notes: string | null };
type PO = { id: string; poNumber: string; status: string; orderDate: Date; expectedDate: Date | null; notes: string | null; supplier: { id: string; code: string; name: string }; createdBy: string; items: POItem[] };

type DraftItem = { materialId: string; quantity: string; unitCost: string };
const today = () => new Date().toISOString().slice(0, 10);

export function PurchaseOrderTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [orders, setOrders] = useState<PO[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ materialId: "", quantity: "", unitCost: "" }]);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const [s, m, p] = await Promise.all([getSuppliers(), getMaterials(), getPurchaseOrders()]);
    if (s.success) setSuppliers(s.data as Supplier[]);
    if (m.success) setMaterials(m.data as Material[]);
    if (p.success) setOrders(p.data);
    const session = await getSessionUser();
    if (session.ok) setRoles(session.user.roles);
    if (!s.success) setError(s.error); else if (!m.success) setError(m.error); else if (!p.success) setError(p.error);
    setBusy(false);
  }, []);

  // Initial load synchronizes server data into this client component.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const canCreate = roles.includes("owner") || roles.includes("admin");
  const canReceive = roles.some((role) => ["owner", "admin", "gudang"].includes(role));

  const addSupplier = async () => {
    if (!supplierName.trim()) { setError("Nama supplier wajib diisi."); return; }
    setBusy(true); setError(null);
    const res = await createSupplier({ name: supplierName, code: supplierCode });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setSupplierName(""); setSupplierCode(""); setShowSupplier(false);
    await load();
    if (res.data) setSupplierId(res.data.id);
  };

  const submitPO = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    const res = await createPurchaseOrder({ supplierId, expectedDate, notes, items: items.map((item) => ({ materialId: item.materialId, quantity: Number(item.quantity), unitCost: Number(item.unitCost) })) });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setShowForm(false); setItems([{ materialId: "", quantity: "", unitCost: "" }]); setExpectedDate(""); setNotes(""); await load();
  };

  const receive = async (itemId: string) => {
    const qty = Number(receiveQty[itemId]);
    if (!Number.isFinite(qty) || qty <= 0) { setError("Isi jumlah penerimaan yang valid."); return; }
    setBusy(true); setError(null);
    const res = await receivePurchaseOrder(itemId, qty, { receivedAt: today() });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setReceiveQty((prev) => ({ ...prev, [itemId]: "" })); await load();
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-bold text-primary">Purchase Order & Supplier</h2><p className="text-sm text-muted">Rencanakan pembelian, terima sebagian, dan hubungkan penerimaan ke stok.</p></div>
      <div className="flex gap-2">{canCreate && <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-teal px-3 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4" /> Purchase Order</button>}<button aria-label="Muat ulang PO" onClick={() => void load()} className="rounded-lg border border-border bg-card p-2 text-muted hover:text-primary"><RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} /></button></div>
    </div>
    {error && <div className="flex items-center justify-between rounded-xl border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red"><span>{error}</span><button onClick={() => setError(null)}><X className="h-4 w-4" /></button></div>}
    {!orders.length && !busy && <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted"><ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />Belum ada purchase order.</div>}
    <div className="space-y-3">{orders.map((po) => <div key={po.id} className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-sm font-bold text-accent-teal">{po.poNumber}</p><p className="text-xs text-muted">{po.supplier.name} · dibuat oleh {po.createdBy} · {new Date(po.orderDate).toLocaleDateString("id-ID")}</p></div><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", po.status === "RECEIVED" ? "bg-status-green/10 text-status-green" : po.status === "PARTIAL" ? "bg-status-yellow/10 text-status-yellow-text" : po.status === "CANCELLED" ? "bg-status-red/10 text-status-red" : "bg-accent-teal/10 text-accent-teal")}>{po.status}</span></div><div className="mt-3 divide-y divide-border/50">{po.items.map((item) => { const remaining = Math.max(0, item.orderedQty - item.receivedQty); return <div key={item.id} className="flex flex-wrap items-center gap-3 py-2 text-xs"><div className="min-w-[220px] flex-1"><p className="font-semibold text-primary">{item.material.name}</p><p className="text-muted">{item.material.material_code} · {item.receivedQty} / {item.orderedQty} {item.material.unit_stock} · Rp {item.unitCost.toLocaleString("id-ID")}</p></div>{canReceive && remaining > 0 && !["CANCELLED", "DRAFT"].includes(po.status) && <><input aria-label={`Jumlah terima ${item.material.name}`} type="number" min="0" step="0.01" value={receiveQty[item.id] ?? ""} onChange={(e) => setReceiveQty((prev) => ({ ...prev, [item.id]: e.target.value }))} placeholder={`sisa ${remaining}`} className="h-9 w-28 rounded-lg border border-border bg-elevated px-2 text-xs" /><button onClick={() => void receive(item.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-status-green px-2.5 py-2 text-[11px] font-bold text-white disabled:opacity-50"><Truck className="h-3.5 w-3.5" /> Terima</button></>}{remaining <= 0 && <CheckCircle2 className="h-4 w-4 text-status-green" />}</div>; })}</div></div>)}</div>
    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={() => setShowForm(false)} /><form onSubmit={submitPO} className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-modal"><div className="mb-4 flex items-start justify-between"><div><h3 className="font-bold text-primary">Purchase Order Baru</h3><p className="text-xs text-muted">PO langsung berstatus SUBMITTED dan siap diterima Gudang.</p></div><button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5 text-muted" /></button></div><div className="space-y-4"><div className="flex gap-2"><select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-10 flex-1 rounded-lg border border-border bg-elevated px-3 text-sm"><option value="">Pilih supplier...</option>{suppliers.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select><button type="button" onClick={() => setShowSupplier((v) => !v)} className="rounded-lg border border-border px-3 text-xs font-bold text-muted">+ Supplier</button></div>{showSupplier && <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-elevated p-3 sm:grid-cols-3"><input value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} placeholder="Kode (opsional)" className="h-9 rounded-lg border border-border bg-card px-2 text-xs" /><input required value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nama supplier" className="h-9 rounded-lg border border-border bg-card px-2 text-xs" /><button type="button" disabled={busy} onClick={() => void addSupplier()} className="rounded-lg bg-accent-teal px-3 text-xs font-bold text-white">Simpan Supplier</button></div>}<div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-xs text-muted">Target tiba<input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-elevated px-3 text-sm" /></label><label className="text-xs text-muted">Catatan<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" className="mt-1 h-10 w-full rounded-lg border border-border bg-elevated px-3 text-sm" /></label></div><div className="space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-bold text-primary">Material yang dipesan</p><button type="button" onClick={() => setItems((prev) => [...prev, { materialId: "", quantity: "", unitCost: "" }])} className="text-xs font-bold text-accent-teal">+ Baris</button></div>{items.map((item, index) => <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_140px_auto]"><select required value={item.materialId} onChange={(e) => setItems((prev) => prev.map((row, i) => i === index ? { ...row, materialId: e.target.value } : row))} className="h-10 rounded-lg border border-border bg-elevated px-2 text-xs"><option value="">Pilih material...</option>{materials.filter((m) => m.active && !items.some((other, i) => i !== index && other.materialId === m.id)).map((m) => <option key={m.id} value={m.id}>{m.material_code} · {m.name}</option>)}</select><input required type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => setItems((prev) => prev.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} placeholder="Jumlah" className="h-10 rounded-lg border border-border bg-elevated px-2 text-xs" /><input required type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => setItems((prev) => prev.map((row, i) => i === index ? { ...row, unitCost: e.target.value } : row))} placeholder="Harga/satuan" className="h-10 rounded-lg border border-border bg-elevated px-2 text-xs" />{items.length > 1 && <button type="button" aria-label="Hapus baris material" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))} className="rounded-lg border border-border px-2 text-muted hover:text-status-red"><X className="h-4 w-4" /></button>}</div>)}</div><button type="submit" disabled={busy || !supplierId} className="h-11 w-full rounded-xl bg-accent-teal text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Simpan Purchase Order"}</button></div></form></div>}
  </div>;
}
