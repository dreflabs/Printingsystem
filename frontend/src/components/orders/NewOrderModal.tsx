"use client";

import React, { useState, useEffect } from "react";
import { Check, ChevronRight, ChevronLeft, X, Package, FileText, CreditCard } from "lucide-react";
import { Button, Input, Textarea, Select, StatusPill } from "@/components/ui";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface OrderForm {
  // Step 1
  customerName: string;
  customerPhone: string;
  orderType: string;
  productId: string;
  // Step 2
  width: string;
  height: string;
  qty: string;
  material: string;
  finishing: string;
  notes: string;
  deadline: string;
  // Step 3
  totalPrice: string;
  dpAmount: string;
  dpMethod: string;
  discountRp: number;
}

const INITIAL_FORM: OrderForm = {
  customerName: "", customerPhone: "", orderType: "", productId: "",
  width: "", height: "", qty: "1", material: "", finishing: "", notes: "", deadline: "",
  totalPrice: "", dpAmount: "", dpMethod: "", discountRp: 0,
};

// PRODUCTS is now fetched from store

// MATERIALS and FINISHING_OPTIONS are now dynamically generated per product

const STEPS = [
  { label: "Produk", icon: Package },
  { label: "Spesifikasi", icon: FileText },
  { label: "Harga & DP", icon: CreditCard },
];

// â”€â”€â”€ Step Indicators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                  done
                    ? "bg-accent-teal border-accent-teal text-white"
                    : active
                    ? "bg-accent-teal/20 border-accent-teal text-accent-teal"
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

// ─── Step 1: Produk & Konsumen ──────────────────────────────────────────────────
function Step1({ form, onChange, products }: { form: OrderForm; onChange: (k: keyof OrderForm, v: any) => void; products: any[] }) {
  const customers = useWorkflowStore((s) => s.customers);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter suggestions based on typed name and selected order type
  const suggestions = customers.filter(c => {
    if (!form.customerName || form.customerName.length < 1) return false;
    
    // Optional: filter by order type if selected
    if (form.orderType === "makloon" && c.type !== "Makloon") return false;
    
    return c.name.toLowerCase().includes(form.customerName.toLowerCase());
  });

  const handleSelectCustomer = (c: any) => {
    onChange("customerName", c.name);
    onChange("customerPhone", c.phone);
    onChange("discountRp", c.defaultDiscountRp || 0);
    // Auto set to makloon if they pick a makloon customer
    if (c.type === "Makloon" && form.orderType !== "makloon") {
      onChange("orderType", "makloon");
    }
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
              onChange("customerName", e.target.value);
              // Reset discount if they type something new to avoid keeping old discount
              if (form.discountRp > 0) onChange("discountRp", 0);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            error={!form.customerName ? "" : undefined}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-elevated border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map(c => (
                <div 
                  key={c.id} 
                  className="px-4 py-2 hover:bg-background cursor-pointer flex justify-between items-center border-b border-border last:border-0"
                  onClick={() => handleSelectCustomer(c)}
                >
                  <div>
                    <div className="text-sm font-medium text-primary">{c.name}</div>
                    <div className="text-xs text-muted">{c.phone || "No HP tidak ada"}</div>
                  </div>
                  {c.type === "Makloon" && (
                    <span className="text-[10px] bg-accent-teal/20 text-accent-teal px-2 py-0.5 rounded-full">Makloon</span>
                  )}
                </div>
              ))}
            </div>
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

// ──────────────────────────────────────────────────────────────────────────────────────────────────
function Step2({ form, onChange, products }: { form: OrderForm; onChange: (k: keyof OrderForm, v: any) => void; products: any[] }) {
  const selectedProduct = products.find(p => p.value === form.productId);
  
  const materialOptions = selectedProduct?.variants?.length
    ? selectedProduct.variants.map((v: any) => ({ label: `${v.name} (Rp ${v.price.toLocaleString()})`, value: v.name }))
    : [{ label: "Default", value: "default" }];
    
  const finishingOptions = selectedProduct?.finishings?.length
    ? selectedProduct.finishings.map((f: any) => ({ label: `${f.name} (${f.price === 0 ? 'Gratis' : '+Rp' + f.price.toLocaleString()})`, value: f.name }))
    : [{ label: "Tanpa Finishing", value: "none" }];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Lebar (cm)"
          type="number"
          placeholder="mis. 200"
          value={form.width}
          onChange={(e) => onChange("width", e.target.value)}
        />
        <Input
          label="Tinggi (cm)"
          type="number"
          placeholder="mis. 100"
          value={form.height}
          onChange={(e) => onChange("height", e.target.value)}
        />
        <Input
          label="Qty (pcs)"
          type="number"
          min="1"
          value={form.qty}
          onChange={(e) => onChange("qty", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Material / Bahan"
          placeholder="Pilih bahan..."
          value={form.material}
          onChange={(e) => onChange("material", e.target.value)}
          options={materialOptions}
        />
        <Select
          label="Finishing"
          placeholder="Pilih finishing..."
          value={form.finishing}
          onChange={(e) => onChange("finishing", e.target.value)}
          options={finishingOptions}
        />
      </div>
      <Input
        label="Deadline"
        type="date"
        value={form.deadline}
        onChange={(e) => onChange("deadline", e.target.value)}
      />
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

// ─── Step 3: Harga & DP ───────────────────────────────────────────────────────
function Step3({ form, onChange, role, products }: { form: OrderForm; onChange: (k: keyof OrderForm, v: any) => void; role: string; products: any[] }) {
  const total = parseFloat(form.totalPrice.replace(/\./g, "")) || 0;
  const dp = parseFloat(form.dpAmount.replace(/\./g, "")) || 0;
  const sisa = total - dp;

  function formatRp(val: string) {
    const num = val.replace(/\D/g, "");
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  useEffect(() => {
    // Auto calculate if price is empty
    if (!form.totalPrice) {
      const product = products.find(p => p.value === form.productId);
      if (product) {
        let basePrice = product.basePrice;
        const selectedVariant = product.variants?.find((v: any) => v.name === form.material);
        if (selectedVariant) basePrice = selectedVariant.price;
        
        const selectedFinishing = product.finishings?.find((f: any) => f.name === form.finishing);
        let finishingCost = 0;
        
        let calc = 0;
        const qty = parseInt(form.qty) || 1;
        const w = parseFloat(form.width) || 100;
        const h = parseFloat(form.height) || 100;
        const area = (w * h) / 10000;
        
        if (product.unit === "m2") {
          calc = area * basePrice * qty;
        } else {
          calc = basePrice * qty;
        }
        
        if (selectedFinishing) {
          if (selectedFinishing.type === 'per_m2') finishingCost = selectedFinishing.price * area * qty;
          else if (selectedFinishing.type === 'per_pcs') finishingCost = selectedFinishing.price * qty;
          else finishingCost = selectedFinishing.price;
        }
        
        calc += finishingCost;

        if (form.discountRp && form.discountRp > 0) {
          let multiplier = 1;
          if (product.unit === "m2") multiplier = area * qty;
          else multiplier = qty;
          
          const totalDiscount = form.discountRp * multiplier;
          calc = Math.max(0, calc - totalDiscount);
        }
        
        onChange("totalPrice", formatRp(calc.toString()));
      }
    }
  }, [form.productId, form.qty, form.width, form.height, form.material, form.finishing, form.totalPrice, form.discountRp, onChange, products]);

  // Hitung ulang total discount khusus untuk tampilan UI
  let displayTotalDiscount = 0;
  if (form.discountRp && form.discountRp > 0) {
    const product = products.find(p => p.value === form.productId);
    const qty = parseInt(form.qty) || 1;
    const w = parseFloat(form.width) || 100;
    const h = parseFloat(form.height) || 100;
    const area = (w * h) / 10000;
    let multiplier = 1;
    if (product?.unit === "m2") multiplier = area * qty;
    else multiplier = qty;
    displayTotalDiscount = form.discountRp * multiplier;
  }

  return (
    <div className="space-y-5">
      <div className="bg-elevated/60 rounded-xl p-4 border border-border space-y-2 text-sm">
        <div className="flex justify-between text-muted">
          <span>Produk</span><span className="text-primary font-medium">{products.find(p => p.value === form.productId)?.label ?? "-"}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Ukuran</span><span className="text-primary">{form.width && form.height ? `${form.width} × ${form.height} cm` : "-"}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Qty</span><span className="text-primary">{form.qty} pcs</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Material</span><span className="text-primary">{form.material || "-"}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Finishing</span><span className="text-primary">{form.finishing || "-"}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Deadline</span><span className="text-primary">{form.deadline || "-"}</span>
        </div>
      </div>

      {form.discountRp > 0 && (
        <div className="bg-status-yellow/10 border border-status-yellow/30 rounded-xl p-3 text-xs text-status-yellow font-bold flex flex-col gap-1">
          <div className="flex justify-between">
            <span>Diskon Khusus (Rp {formatRp(form.discountRp.toString())} / Unit):</span>
            <span>-Rp {formatRp(displayTotalDiscount.toString())}</span>
          </div>
        </div>
      )}

      <div className="bg-status-blue/5 border border-status-blue/20 rounded-xl p-3 text-xs text-status-blue">
        ℹ️ Harga total <strong>dihitung otomatis</strong> berdasarkan produk, ukuran, dan jumlah. Anda bisa menyesuaikannya jika diperlukan.
      </div>

      <Input
        label="Harga Total (Rp) *"
        placeholder="mis. 450.000"
        value={form.totalPrice}
        onChange={(e) => onChange("totalPrice", formatRp(e.target.value))}
        leftAddon={<span className="text-xs font-semibold">Rp</span>}
      />

      {role !== "designer" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Jumlah DP (Rp)"
            placeholder="mis. 225.000"
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
              { label: "Tunai", value: "tunai" },
              { label: "Transfer Bank", value: "transfer" },
              { label: "QRIS", value: "qris" },
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

// ──────────────────────────────────────────────────────────────────────────────────────────────────
interface NewOrderModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewOrderModal({ open, onClose }: NewOrderModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OrderForm>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState("");
  
  const products = useWorkflowStore((s) => s.printingProducts) || [];

  useEffect(() => {
    setRole(localStorage.getItem("userRole") || "");
  }, []);

  const handleFormChange = React.useCallback((key: keyof OrderForm, value: any) => {
    setForm(prev => {
      if (prev[key] === value) return prev; // Prevent unnecessary state updates
      return { ...prev, [key]: value };
    });
  }, []);

  function canNext() {
    if (step === 0) return form.customerName && form.orderType && form.productId;
    if (step === 1) return form.qty;
    return true;
  }

  const addOrderAndJob = useWorkflowStore((s) => s.addOrderAndJob);

  async function handleSubmit() {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));

    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10).replace(/-/g, "");
    const orderId = `ORD-${dateStr}-${Date.now().toString().slice(-4)}`;
    const jobId = `JOB-${Date.now().toString().slice(-4)}`;
    const productLabel = products.find(p => p.value === form.productId)?.label || form.productId;
    const totalNum = parseFloat(form.totalPrice.replace(/\./g, "")) || 0;
    const dpNum = parseFloat(form.dpAmount.replace(/\./g, "")) || 0;

    addOrderAndJob(
      {
        id: orderId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        orderType: form.orderType,
        productId: form.productId,
        product: productLabel,
        qty: parseInt(form.qty) || 1,
        material: form.material,
        finishing: form.finishing,
        notes: form.notes,
        deadline: form.deadline,
        totalPrice: totalNum.toString(),
        dpAmount: dpNum.toString(),
        dpMethod: form.dpMethod,
        status: dpNum > 0 ? "DESIGNING" : "WAITING_PAYMENT",
        paymentStatus: dpNum >= totalNum && totalNum > 0 ? "PAID" : dpNum > 0 ? "DP_PAID" : "UNPAID",
        createdAt: now,
        createdBy: role || "Admin",
        overdue: false,
      },
      {
        id: jobId,
        orderId,
        product: productLabel,
        qty: parseInt(form.qty) || 1,
        material: form.material,
        finishing: form.finishing,
        width: parseFloat(form.width) || undefined,
        height: parseFloat(form.height) || undefined,
        status: "WAITING_DESIGN",
        createdAt: now,
      }
    );

    setIsSubmitting(false);
    setForm(INITIAL_FORM);
    setStep(0);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card/95 backdrop-blur-2xl border border-border rounded-3xl shadow-[0_8px_48px_rgba(0,0,0,0.6)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <h2 className="text-lg font-bold text-primary">Order Baru (Printing)</h2>
            <p className="text-xs text-muted">Langkah {step + 1} dari {STEPS.length}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4">
          <StepIndicator currentStep={step} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {step === 0 && <Step1 form={form} onChange={handleFormChange} products={products} />}
          {step === 1 && <Step2 form={form} onChange={handleFormChange} products={products} />}
          {step === 2 && <Step3 form={form} onChange={handleFormChange} role={role} products={products} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => step === 0 ? onClose() : setStep((s) => s - 1)}
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
            <Button
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              onClick={handleSubmit}
              disabled={!form.totalPrice}
            >
              Buat Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
