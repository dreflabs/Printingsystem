"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, X, Package, FileText, CreditCard, Grid2x2, Plus, Trash2 } from "lucide-react";
import { Button, Input, Textarea, Select, Modal } from "@/components/ui";
import { LayoutCalculator } from "@/components/tools/LayoutCalculator";
import { cn } from "@/lib/utils";
import { getOrderFormData, createPrintingOrder, type CreatePrintingOrderInput } from "@/actions/orders";
import { addPayment } from "@/actions/orders";
import { getSessionUser } from "@/actions/session";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ItemRow {
  key: string;
  productId: string;
  width: string;
  height: string;
  qty: string;
  materialId: string;
  finishing: string;
  /** total harga item (Rp, ter-format). Auto dari produk selama belum diubah manual. */
  price: string;
  priceTouched: boolean;
  /** override deadline item (datetime-local). Kosong = ikut deadline order. */
  deadline: string;
}

interface OrderForm {
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  items: ItemRow[];
  notes: string;
  deadline: string;
  dpAmount: string;
  dpMethod: string;
  discountRp: number;
  /** % diskon default pelanggan — mengisi awal discountRp; 0 = tak ada */
  discountPct: number;
  discountReason: string;
}

let rowSeq = 0;
const blankItem = (): ItemRow => ({
  key: `it${++rowSeq}`,
  productId: "", width: "", height: "", qty: "1", materialId: "", finishing: "",
  price: "", priceTouched: false, deadline: "",
});

const INITIAL_FORM: OrderForm = {
  customerId: "", customerName: "", customerPhone: "", orderType: "",
  items: [blankItem()],
  notes: "", deadline: "",
  dpAmount: "", dpMethod: "", discountRp: 0, discountPct: 0, discountReason: "",
};

function getDefaultDeadline(): string {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

type Opt = { value: string; label: string };
type ProductOpt = Opt & { category: string; unit: string; basePrice: number | null };
type CustomerRow = { id: string; name: string; phone: string | null; type: string; defaultDiscountPct: number };

const STEPS = [
  { label: "Pelanggan", icon: Package },
  { label: "Item Pesanan", icon: FileText },
  { label: "Harga & DP", icon: CreditCard },
];

const ORDER_TYPE_TO_INPUT: Record<string, CreatePrintingOrderInput["orderType"]> = {
  walkin: "walkin", online: "online", makloon: "makloon",
};

function formatRp(val: string) {
  return val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function parseRp(val: string) {
  return parseFloat(String(val).replace(/\./g, "")) || 0;
}

/** Harga item otomatis dari harga dasar produk (M2 = per m², selain itu per pcs). */
function autoItemPrice(it: ItemRow, products: ProductOpt[]): number {
  const p = products.find((x) => x.value === it.productId);
  if (!p?.basePrice) return 0;
  const qty = Math.max(1, Number(it.qty) || 1);
  if (p.unit === "M2") {
    const area = ((Number(it.width) || 0) / 100) * ((Number(it.height) || 0) / 100);
    return area > 0 ? Math.round(p.basePrice * area * qty) : 0;
  }
  return Math.round(p.basePrice * qty);
}

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, index) => {
        const isDone = index < currentStep;
        const isActive = index === currentStep;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isActive ? "border-accent-teal bg-accent-teal text-white" :
                  isDone ? "border-accent-teal bg-accent-teal/10 text-accent-teal" :
                  "border-border bg-elevated text-muted"
                )}
              >
                <step.icon className="h-4 w-4" />
              </div>
              <span className={cn("text-[10px] font-bold", isActive || isDone ? "text-primary" : "text-muted")}>{step.label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn("mx-2 h-0.5 w-8 sm:w-12 rounded", index < currentStep ? "bg-accent-teal" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Pelanggan & order ───────────────────────────────────────────────
function Step1({
  form, onChange, customers,
}: {
  form: OrderForm;
  onChange: (k: keyof OrderForm, v: string | number) => void;
  customers: CustomerRow[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = customers.filter((c) => {
    if (!form.customerName || form.customerName.length < 1) return false;
    if (form.orderType === "makloon" && c.type !== "Makloon") return false;
    return c.name.toLowerCase().includes(form.customerName.toLowerCase());
  });

  const selectCustomer = (c: CustomerRow) => {
    onChange("customerId", c.id);
    onChange("customerName", c.name);
    onChange("customerPhone", c.phone ?? "");
    onChange("discountPct", c.defaultDiscountPct || 0);
    if (c.type === "Makloon" && form.orderType !== "makloon") onChange("orderType", "makloon");
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4">
      <Select
        label="Tipe Order *"
        placeholder="Pilih tipe order..."
        value={form.orderType}
        onChange={(e) => onChange("orderType", e.target.value)}
        options={[
          { label: "Umum / Walk-in", value: "walkin" },
          { label: "Online (WA / Medsos)", value: "online" },
          { label: "Makloon (Harga Khusus)", value: "makloon" },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
        <div className="relative">
          <Input
            label="Nama Konsumen *"
            placeholder="Ketik nama (min. 2 huruf)..."
            value={form.customerName}
            onChange={(e) => {
              onChange("customerId", "");
              onChange("customerName", e.target.value);
              if (form.discountPct > 0) onChange("discountPct", 0);
              if (form.discountRp > 0) onChange("discountRp", 0);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-elevated border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((c) => (
                <div
                  key={c.id}
                  className="px-4 py-2 hover:bg-background cursor-pointer flex justify-between items-center border-b border-border last:border-0"
                  onClick={() => selectCustomer(c)}
                >
                  <div>
                    <div className="text-sm font-medium text-primary">{c.name}</div>
                    <div className="text-xs text-muted">{c.phone || "No HP tidak ada"}</div>
                  </div>
                  {c.type !== "Umum" && (
                    <span className="text-[10px] bg-accent-teal/20 text-accent-teal px-2 py-0.5 rounded-full">{c.type}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {!form.customerId && form.customerName.length > 1 && (
            <p className="text-[11px] text-muted mt-1">Konsumen baru akan dibuat otomatis.</p>
          )}
        </div>
        <Input
          label="Nomor HP"
          placeholder="08xx-xxxx-xxxx"
          value={form.customerPhone}
          onChange={(e) => onChange("customerPhone", e.target.value)}
        />
      </div>

      <Input label="Deadline Order *" type="datetime-local" value={form.deadline} onChange={(e) => onChange("deadline", e.target.value)} />

      <Textarea
        label="Catatan Tambahan"
        placeholder="Instruksi khusus, warna pilihan, atau catatan penting lainnya..."
        value={form.notes}
        onChange={(e) => onChange("notes", e.target.value)}
        hint="Berlaku untuk seluruh order. Detail per produk isi di tiap item."
      />
    </div>
  );
}

// ─── Step 2: Item pesanan (multi) ────────────────────────────────────────────
function ItemsStep({
  form, products, materials, finishings, subtotal,
  updateItem, addItem, removeItem,
}: {
  form: OrderForm;
  products: ProductOpt[];
  materials: Opt[];
  finishings: string[];
  subtotal: number;
  updateItem: (key: string, patch: Partial<ItemRow>) => void;
  addItem: () => void;
  removeItem: (key: string) => void;
}) {
  const [calcFor, setCalcFor] = useState<string | null>(null);

  const productGroups = Object.entries(
    products.reduce<Record<string, Opt[]>>((acc, p) => {
      (acc[p.category] ??= []).push({ value: p.value, label: p.label });
      return acc;
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b, "id"))
    .map(([label, options]) => ({ label, options }));

  const calcItem = form.items.find((i) => i.key === calcFor) ?? null;

  return (
    <div className="space-y-4">
      {products.length === 0 && (
        <p className="text-[11px] text-status-yellow-text">Belum ada produk cetak — tambahkan dulu di Katalog Produk.</p>
      )}

      {form.items.map((it, i) => (
        <div key={it.key} className="rounded-2xl border border-border bg-base p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted">Item {i + 1}</span>
            {form.items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(it.key)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-status-red hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            )}
          </div>

          <Select
            label="Produk *"
            placeholder="Pilih jenis produk..."
            value={it.productId}
            onChange={(e) => updateItem(it.key, { productId: e.target.value, priceTouched: false })}
            groups={productGroups}
          />

          <div className="grid grid-cols-3 gap-3">
            <Input label="Lebar (cm)" type="number" placeholder="mis. 300" value={it.width} onChange={(e) => updateItem(it.key, { width: e.target.value })} />
            <Input label="Tinggi (cm)" type="number" placeholder="mis. 100" value={it.height} onChange={(e) => updateItem(it.key, { height: e.target.value })} />
            <Input label="Qty (pcs) *" type="number" min="1" value={it.qty} onChange={(e) => updateItem(it.key, { qty: e.target.value })} />
          </div>

          <button
            type="button"
            onClick={() => setCalcFor(it.key)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-teal hover:underline"
          >
            <Grid2x2 className="h-3.5 w-3.5" /> Kalkulator layout — potong/lembar
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Material / Bahan"
              placeholder="Pilih bahan..."
              value={it.materialId}
              onChange={(e) => updateItem(it.key, { materialId: e.target.value })}
              options={materials}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted">Finishing</label>
              <input
                list="order-finishing-list"
                placeholder="mis. Laminasi doff + potong"
                value={it.finishing}
                onChange={(e) => updateItem(it.key, { finishing: e.target.value })}
                className="w-full h-12 rounded-xl bg-elevated border border-border text-primary text-sm px-4 outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Harga item (Rp) *"
              placeholder="mis. 450.000"
              value={it.price}
              onChange={(e) => updateItem(it.key, { price: formatRp(e.target.value), priceTouched: true })}
              leftAddon={<span className="text-xs font-semibold">Rp</span>}
            />
            <Input
              label="Deadline item (opsional)"
              type="datetime-local"
              value={it.deadline}
              onChange={(e) => updateItem(it.key, { deadline: e.target.value })}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-accent-teal/40 bg-accent-teal/5 px-4 py-2 text-xs font-bold text-accent-teal hover:bg-accent-teal/10"
      >
        <Plus className="h-4 w-4" /> Tambah item
      </button>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <span className="text-muted">Subtotal ({form.items.length} item)</span>
        <span className="font-bold text-primary">Rp {formatRp(String(subtotal))}</span>
      </div>

      <datalist id="order-finishing-list">
        {finishings.map((f) => <option key={f} value={f} />)}
      </datalist>

      <Modal open={!!calcItem} onClose={() => setCalcFor(null)} title="Kalkulator Layout" size="lg">
        {calcItem && (
          <LayoutCalculator
            initialPieceW={calcItem.width}
            initialPieceH={calcItem.height}
            initialQty={calcItem.qty}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Step 3: Harga & DP ──────────────────────────────────────────────────────
function Step3({
  form, onChange, role, subtotal,
}: {
  form: OrderForm;
  onChange: (k: keyof OrderForm, v: string | number) => void;
  role: string;
  subtotal: number;
}) {
  const total = subtotal;
  const dp = parseRp(form.dpAmount);
  const sisa = total - dp;
  const suggestedDp = total > 0 ? Math.round(total * 0.5) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-sm text-muted">Harga Total Order</span>
        <span className="text-lg font-black text-primary">Rp {formatRp(String(subtotal))}</span>
      </div>
      <p className="text-[11px] text-muted">Dihitung dari harga tiap item. DP minimum disarankan <b>50%</b>{suggestedDp > 0 && <> (Rp {formatRp(String(suggestedDp))})</>}.</p>

      {(form.discountRp > 0 || form.discountPct > 0) && (
        <div className="space-y-2">
          <Input
            label={form.discountPct > 0 ? `Diskon (Rp) — default pelanggan ${form.discountPct}%` : "Diskon (Rp)"}
            value={formatRp(String(form.discountRp))}
            onChange={(e) => onChange("discountRp", parseRp(e.target.value))}
            leftAddon={<span className="text-xs font-semibold">Rp</span>}
          />
          <Input
            label="Alasan Diskon * (butuh approval Owner)"
            placeholder="mis. pelanggan tetap, order besar"
            value={form.discountReason}
            onChange={(e) => onChange("discountReason", e.target.value)}
          />
        </div>
      )}

      {role !== "designer_sales" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Jumlah DP (Rp)"
            placeholder={suggestedDp > 0 ? formatRp(String(suggestedDp)) : "mis. 225.000"}
            value={form.dpAmount}
            onChange={(e) => onChange("dpAmount", formatRp(e.target.value))}
            leftAddon={<span className="text-xs font-semibold">Rp</span>}
          />
          <Select
            label="Metode Pembayaran DP"
            placeholder="Pilih metode..."
            value={form.dpMethod}
            onChange={(e) => onChange("dpMethod", e.target.value)}
            options={[
              { label: "Tunai", value: "CASH" },
              { label: "Transfer Bank", value: "TRANSFER" },
              { label: "QRIS", value: "QRIS" },
            ]}
          />
        </div>
      )}

      {total > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Total Order</span>
            <span className="text-primary font-semibold">Rp {formatRp(String(total))}</span>
          </div>
          {role !== "designer_sales" ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted">DP Dibayar</span>
                <span className="text-status-green font-semibold">Rp {form.dpAmount || "0"}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-primary font-semibold">Sisa Tagihan</span>
                <span className={cn("font-bold text-base", sisa > 0 ? "text-status-yellow-text" : "text-status-green")}>
                  Rp {sisa.toLocaleString("id-ID")}
                </span>
              </div>
            </>
          ) : (
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-status-yellow-text text-xs font-medium">
                ⚠️ Pembayaran DP / Pelunasan akan ditagihkan oleh Admin Kasir.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
interface NewOrderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (orderCode: string) => void;
}

export function NewOrderModal({ open, onClose, onCreated }: NewOrderModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OrderForm>(() => ({ ...INITIAL_FORM, items: [blankItem()], deadline: getDefaultDeadline() }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [discountTouched, setDiscountTouched] = useState(false);

  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [materials, setMaterials] = useState<Opt[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [finishings, setFinishings] = useState<string[]>([]);

  useEffect(() => {
    getSessionUser().then((r) => {
      if (r.ok) setRole(r.user.role);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getOrderFormData().then((res) => {
      if (cancelled || !res.success) {
        if (!res.success) setError(res.error);
        return;
      }
      setProducts(res.data.products.map((p) => ({
        value: p.id, label: p.name, category: p.category || "Lainnya", unit: p.unit, basePrice: p.basePrice ?? null,
      })));
      setMaterials(res.data.materials.map((m) => ({ value: m.id, label: `${m.material_code} · ${m.name}` })));
      setCustomers(res.data.customers as CustomerRow[]);
      setFinishings(res.data.finishings ?? []);
    });
    return () => { cancelled = true; };
  }, [open]);

  const subtotal = useMemo(
    () => form.items.reduce((s, it) => s + parseRp(it.price), 0),
    [form.items]
  );

  const handleFormChange = useCallback((key: keyof OrderForm, value: string | number) => {
    if (key === "discountRp") setDiscountTouched(true);
    if (key === "discountPct") setDiscountTouched(false);
    setForm((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const updateItem = useCallback((key: string, patch: Partial<ItemRow>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, ...patch };
        // Auto-isi harga kalau produk/dimensi/qty berubah & belum diubah manual.
        if (!next.priceTouched && ("productId" in patch || "width" in patch || "height" in patch || "qty" in patch)) {
          const auto = autoItemPrice(next, products);
          if (auto > 0) next.price = formatRp(String(auto));
        }
        return next;
      }),
    }));
  }, [products]);

  const addItem = useCallback(() => setForm((p) => ({ ...p, items: [...p.items, blankItem()] })), []);
  const removeItem = useCallback((key: string) =>
    setForm((p) => ({ ...p, items: p.items.length > 1 ? p.items.filter((it) => it.key !== key) : p.items })), []);

  // Diskon default pelanggan (%) → nominal Rp dari subtotal. Berhenti bila Admin ubah manual.
  useEffect(() => {
    if (discountTouched) return;
    const rp = form.discountPct > 0 && subtotal > 0 ? Math.round((subtotal * form.discountPct) / 100) : 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((prev) => (prev.discountRp === rp ? prev : { ...prev, discountRp: rp }));
  }, [discountTouched, form.discountPct, subtotal]);

  function canNext() {
    if (step === 0) return !!(form.customerName && form.orderType && form.deadline);
    if (step === 1) return form.items.every((it) => it.productId && Number(it.qty) > 0 && parseRp(it.price) >= 0) && subtotal > 0;
    return true;
  }

  async function handleSubmit() {
    setError(null);
    if (!form.deadline) { setError("Deadline order wajib diisi."); return; }
    if (form.discountRp > 0 && !form.discountReason.trim()) { setError("Alasan diskon wajib diisi."); return; }
    if (form.items.some((it) => !it.productId || Number(it.qty) <= 0)) { setError("Tiap item wajib punya produk & qty > 0."); return; }

    setIsSubmitting(true);
    try {
      const input: CreatePrintingOrderInput = {
        customer: form.customerId
          ? { id: form.customerId }
          : { name: form.customerName.trim(), phone: form.customerPhone || undefined },
        orderType: ORDER_TYPE_TO_INPUT[form.orderType] ?? "walkin",
        deadline: form.deadline || null,
        notes: form.notes || null,
        discount: form.discountRp || 0,
        discountReason: form.discountReason || undefined,
        items: form.items.map((it) => {
          const qty = Math.max(1, Number(it.qty) || 1);
          const itemTotal = parseRp(it.price) || autoItemPrice(it, products);
          return {
            productId: it.productId || null,
            width: it.width ? Number(it.width) : undefined,
            height: it.height ? Number(it.height) : undefined,
            quantity: qty,
            materialId: it.materialId || null,
            finishing: it.finishing || null,
            unitPrice: Math.round(itemTotal / qty),
            deadline: it.deadline || null,
          };
        }),
      };

      const res = await createPrintingOrder(input);
      if (!res.success) { setError(res.error); return; }

      const dp = parseRp(form.dpAmount);
      if (role !== "designer_sales" && dp > 0 && form.dpMethod) {
        const pay = await addPayment(res.data.orderId, {
          amount: dp,
          method: form.dpMethod as "CASH" | "TRANSFER" | "QRIS",
        });
        if (!pay.success) {
          setError(`Order ${res.data.orderCode} dibuat, tapi pencatatan DP gagal: ${pay.error}`);
          return;
        }
        window.open(`/print/kwitansi/${pay.data.paymentId}?noprint`, "_blank", "noopener");
      }

      onCreated?.(res.data.orderCode);
      rowSeq = 0;
      setForm({ ...INITIAL_FORM, items: [blankItem()], deadline: getDefaultDeadline() });
      setStep(0);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card border border-border rounded-3xl shadow-modal flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h2 className="text-lg font-bold text-primary">Order Baru (Printing)</h2>
            <p className="text-xs text-muted">Langkah {step + 1} dari {STEPS.length}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <StepIndicator currentStep={step} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {error && (
            <div className="mb-4 rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
              {error}
            </div>
          )}
          {step === 0 && <Step1 form={form} onChange={handleFormChange} customers={customers} />}
          {step === 1 && (
            <ItemsStep
              form={form}
              products={products}
              materials={materials}
              finishings={finishings}
              subtotal={subtotal}
              updateItem={updateItem}
              addItem={addItem}
              removeItem={removeItem}
            />
          )}
          {step === 2 && <Step3 form={form} onChange={handleFormChange} role={role} subtotal={subtotal} />}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            {step === 0 ? "Batal" : "Kembali"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
              Lanjut
            </Button>
          ) : (
            <Button variant="primary" size="sm" isLoading={isSubmitting} onClick={handleSubmit} disabled={subtotal <= 0}>
              Buat Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
