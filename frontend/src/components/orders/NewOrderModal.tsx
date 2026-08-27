"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Check, ChevronRight, ChevronLeft, X, Package, FileText, CreditCard } from "lucide-react";
import { Button, Input, Textarea, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getOrderFormData, createPrintingOrder, type CreatePrintingOrderInput } from "@/actions/orders";
import { addPayment } from "@/actions/orders";

// ─── Types ───────────────────────────────────────────────────────────────────
interface OrderForm {
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  productId: string;
  width: string;
  height: string;
  qty: string;
  materialId: string;
  finishing: string;
  notes: string;
  deadline: string;
  totalPrice: string;
  dpAmount: string;
  dpMethod: string;
  discountRp: number;
  discountReason: string;
}

const INITIAL_FORM: OrderForm = {
  customerId: "", customerName: "", customerPhone: "", orderType: "", productId: "",
  width: "", height: "", qty: "1", materialId: "", finishing: "", notes: "", deadline: "",
  totalPrice: "", dpAmount: "", dpMethod: "", discountRp: 0, discountReason: "",
};

type Opt = { value: string; label: string };
type CustomerRow = { id: string; name: string; phone: string | null; type: string; defaultDiscountRp: number };

const STEPS = [
  { label: "Produk", icon: Package },
  { label: "Spesifikasi", icon: FileText },
  { label: "Harga & DP", icon: CreditCard },
];

const ORDER_TYPE_TO_INPUT: Record<string, CreatePrintingOrderInput["orderType"]> = {
  walkin: "walkin",
  online: "online",
  makloon: "makloon",
};

function formatRp(val: string) {
  return val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function parseRp(val: string) {
  return parseFloat(val.replace(/\./g, "")) || 0;
}

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                  done ? "bg-accent-teal border-accent-teal text-white"
                    : active ? "bg-accent-teal/20 border-accent-teal text-accent-teal"
                    : "bg-elevated border-border text-muted"
                )}
              >
                {done ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={cn("text-xs font-medium", active ? "text-accent-teal" : done ? "text-primary" : "text-muted")}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("w-20 h-0.5 mb-5 mx-2 transition-all duration-300", i < currentStep ? "bg-accent-teal" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 ──────────────────────────────────────────────────────────────────
function Step1({
  form, onChange, products, customers,
}: {
  form: OrderForm;
  onChange: (k: keyof OrderForm, v: string | number) => void;
  products: Opt[];
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
    onChange("discountRp", c.defaultDiscountRp || 0);
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

      <Select
        label="Produk *"
        placeholder="Pilih jenis produk..."
        value={form.productId}
        onChange={(e) => onChange("productId", e.target.value)}
        options={products}
      />
    </div>
  );
}

// ─── Step 2 ──────────────────────────────────────────────────────────────────
function Step2({
  form, onChange, materials,
}: {
  form: OrderForm;
  onChange: (k: keyof OrderForm, v: string | number) => void;
  materials: Opt[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Input label="Lebar (cm)" type="number" placeholder="mis. 200" value={form.width} onChange={(e) => onChange("width", e.target.value)} />
        <Input label="Tinggi (cm)" type="number" placeholder="mis. 100" value={form.height} onChange={(e) => onChange("height", e.target.value)} />
        <Input label="Qty (pcs)" type="number" min="1" value={form.qty} onChange={(e) => onChange("qty", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Material / Bahan"
          placeholder="Pilih bahan..."
          value={form.materialId}
          onChange={(e) => onChange("materialId", e.target.value)}
          options={materials}
        />
        <Input label="Finishing" placeholder="mis. Laminasi doff + potong" value={form.finishing} onChange={(e) => onChange("finishing", e.target.value)} />
      </div>
      <Input label="Deadline" type="date" value={form.deadline} onChange={(e) => onChange("deadline", e.target.value)} />
      <Textarea
        label="Catatan Tambahan"
        placeholder="Instruksi khusus, warna pilihan, atau catatan penting lainnya..."
        value={form.notes}
        onChange={(e) => onChange("notes", e.target.value)}
        hint="Misal: Tolong cetak dengan bleed 3mm, warna harus vivid."
      />
    </div>
  );
}

// ─── Step 3 ──────────────────────────────────────────────────────────────────
function Step3({
  form, onChange, role,
}: {
  form: OrderForm;
  onChange: (k: keyof OrderForm, v: string | number) => void;
  role: string;
}) {
  const total = parseRp(form.totalPrice);
  const dp = parseRp(form.dpAmount);
  const sisa = total - dp;
  const suggestedDp = total > 0 ? Math.round(total * 0.5) : 0;

  return (
    <div className="space-y-5">
      <div className="bg-status-blue/5 border border-status-blue/20 rounded-xl p-3 text-xs text-status-blue">
        ℹ️ Masukkan harga total order. DP minimum yang disarankan adalah <strong>50%</strong>
        {suggestedDp > 0 && <> (Rp {formatRp(String(suggestedDp))})</>}.
      </div>

      <Input
        label="Harga Total (Rp) *"
        placeholder="mis. 450.000"
        value={form.totalPrice}
        onChange={(e) => onChange("totalPrice", formatRp(e.target.value))}
        leftAddon={<span className="text-xs font-semibold">Rp</span>}
      />

      {form.discountRp > 0 && (
        <div className="space-y-2">
          <Input
            label="Diskon (Rp)"
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

      {role !== "designer" && (
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
            <span className="text-primary font-semibold">Rp {form.totalPrice}</span>
          </div>
          {role !== "designer" ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted">DP Dibayar</span>
                <span className="text-status-green font-semibold">Rp {form.dpAmount || "0"}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-primary font-semibold">Sisa Tagihan</span>
                <span className={cn("font-bold text-base", sisa > 0 ? "text-status-yellow" : "text-status-green")}>
                  Rp {sisa.toLocaleString("id-ID")}
                </span>
              </div>
            </>
          ) : (
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-status-yellow text-xs font-medium">
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
  const [form, setForm] = useState<OrderForm>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Opt[]>([]);
  const [materials, setMaterials] = useState<Opt[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(localStorage.getItem("userRole") || "");
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getOrderFormData().then((res) => {
      if (cancelled || !res.success) {
        if (!res.success) setError(res.error);
        return;
      }
      setProducts(res.data.products.map((p) => ({ value: p.id, label: p.name })));
      setMaterials(res.data.materials.map((m) => ({ value: m.id, label: m.name })));
      setCustomers(res.data.customers as CustomerRow[]);
    });
    return () => { cancelled = true; };
  }, [open]);

  const handleFormChange = useCallback((key: keyof OrderForm, value: string | number) => {
    setForm((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  function canNext() {
    if (step === 0) return !!(form.customerName && form.orderType && form.productId);
    if (step === 1) return !!form.qty;
    return true;
  }

  async function handleSubmit() {
    setError(null);
    if (form.discountRp > 0 && !form.discountReason.trim()) {
      setError("Alasan diskon wajib diisi.");
      return;
    }
    setIsSubmitting(true);
    try {
      const total = parseRp(form.totalPrice);
      const qty = Number(form.qty) || 1;
      // Field "Harga Total" = harga seluruh order untuk 1 item ini → turunkan ke harga satuan
      const unitPrice = qty > 0 ? Math.round(total / qty) : total;
      const input: CreatePrintingOrderInput = {
        customer: form.customerId
          ? { id: form.customerId }
          : { name: form.customerName.trim(), phone: form.customerPhone || undefined },
        orderType: ORDER_TYPE_TO_INPUT[form.orderType] ?? "walkin",
        deadline: form.deadline || null,
        notes: form.notes || null,
        discount: form.discountRp || 0,
        discountReason: form.discountReason || undefined,
        items: [
          {
            productId: form.productId || null,
            width: form.width ? Number(form.width) : undefined,
            height: form.height ? Number(form.height) : undefined,
            quantity: qty,
            materialId: form.materialId || null,
            finishing: form.finishing || null,
            unitPrice,
          },
        ],
      };

      const res = await createPrintingOrder(input);
      if (!res.success) {
        setError(res.error);
        return;
      }

      const dp = parseRp(form.dpAmount);
      if (role !== "designer" && dp > 0 && form.dpMethod) {
        const pay = await addPayment(res.data.orderId, {
          amount: dp,
          method: form.dpMethod as "CASH" | "TRANSFER" | "QRIS",
        });
        if (!pay.success) {
          setError(`Order ${res.data.orderCode} dibuat, tapi pencatatan DP gagal: ${pay.error}`);
          return;
        }
      }

      onCreated?.(res.data.orderCode);
      setForm(INITIAL_FORM);
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
      <div className="relative w-full max-w-xl bg-card/95 backdrop-blur-2xl border border-border rounded-3xl shadow-[0_8px_48px_rgba(0,0,0,0.6)] flex flex-col max-h-[90vh]">
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
          {step === 0 && <Step1 form={form} onChange={handleFormChange} products={products} customers={customers} />}
          {step === 1 && <Step2 form={form} onChange={handleFormChange} materials={materials} />}
          {step === 2 && <Step3 form={form} onChange={handleFormChange} role={role} />}
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
            <Button
              variant="primary"
              size="sm"
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Lanjutkan
            </Button>
          ) : (
            <Button variant="primary" size="sm" isLoading={isSubmitting} onClick={handleSubmit} disabled={!form.totalPrice}>
              Buat Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
