"use client";

import { useState, useEffect } from "react";
import { Search, ShoppingCart, User, PlusCircle, LayoutGrid, Receipt, ClipboardList, Package, CheckCircle2, Printer } from "lucide-react";
import { PosProductCard, Product } from "@/components/pos/PosProductCard";
import { PosCartItem, CartItemType } from "@/components/pos/PosCartItem";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/store/useWorkflowStore";

const CATEGORIES = ["Semua", "Kertas", "Tinta", "Alat Tulis", "Merchandise", "Lainnya"];

function ReceiptModal({ open, transactionData, onClose }: { open: boolean, transactionData: any, onClose: () => void }) {
  if (!open || !transactionData) return null;
  const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] flex flex-col items-center">
        <div className="h-16 w-16 bg-status-green/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-status-green" />
        </div>
        <h3 className="text-xl font-bold text-primary mb-1">Transaksi Berhasil!</h3>
        <p className="text-sm text-muted mb-6">Metode: {transactionData.method}</p>
        
        <div className="w-full bg-elevated/50 p-4 rounded-xl border border-border border-dashed space-y-2 text-sm mb-6 font-mono">
          <div className="flex justify-between"><span className="text-muted">Total Bayar</span><span className="font-bold text-primary">{formatRupiah(transactionData.total)}</span></div>
          {transactionData.method === "TUNAI" && (
            <>
              <div className="flex justify-between"><span className="text-muted">Tunai Diterima</span><span className="font-bold text-primary">{formatRupiah(transactionData.cashGiven)}</span></div>
              <div className="flex justify-between border-t border-border border-dashed mt-2 pt-2"><span className="text-muted">Kembalian</span><span className="font-bold text-status-green">{formatRupiah(transactionData.change)}</span></div>
            </>
          )}
        </div>

        <div className="flex gap-3 w-full">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm font-bold text-muted hover:text-primary cursor-pointer transition-colors">Tutup Kasir</button>
          <button onClick={() => { alert("Mencetak 2 Struk:\n1. Struk Bukti Bayar Konsumen\n2. Struk Kerja (Berisi QR Code untuk ditempel oleh QC & Finishing)\n\nHarap berikan Struk Kerja (2) ke Operator Mesin!"); onClose(); }} className="flex-1 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold flex justify-center items-center gap-2 cursor-pointer hover:brightness-110"><Printer className="h-4 w-4" /> Cetak 2 Struk</button>
        </div>
      </div>
    </div>
  );
}

function PosPaymentModal({
  open,
  totalAmount,
  customerName,
  defaultDiscount = 0,
  onClose,
  onSuccess,
}: {
  open: boolean;
  totalAmount: number;
  customerName: string;
  defaultDiscount?: number;
  onClose: () => void;
  onSuccess: (method: "TUNAI" | "QRIS", cashGiven: number) => void;
}) {
  const [method, setMethod] = useState<"TUNAI" | "QRIS">("TUNAI");
  const [cashInput, setCashInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [qrisRef, setQrisRef] = useState("");

  // Set default discount when modal opens
  useEffect(() => {
    if (open) {
      setDiscountInput(defaultDiscount > 0 ? defaultDiscount.toString() : "");
      setCashInput("");
      setMethod("TUNAI");
    }
  }, [open, defaultDiscount]);

  if (!open) return null;

  const discount = Number(discountInput) || 0;
  const finalAmount = Math.max(0, totalAmount - discount);
  const cashGiven = Number(cashInput) || 0;
  const change = Math.max(0, cashGiven - finalAmount);
  const isValidCash = method === "TUNAI" ? cashGiven >= finalAmount : true;

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] space-y-5">
        <h3 className="text-lg font-bold text-primary">Pembayaran POS Kasir</h3>

        {/* Total Summary */}
        <div className="bg-elevated p-4 rounded-xl flex justify-between items-center">
          <div>
            <p className="text-xs text-muted">Pelanggan: {customerName || "Umum"}</p>
            <p className="text-xs text-muted mt-1">Subtotal: {formatRupiah(totalAmount)}</p>
            {discount > 0 && <p className="text-xs text-status-red font-bold">Diskon: -{formatRupiah(discount)}</p>}
            <p className="text-sm font-bold text-primary mt-2">Total Akhir</p>
          </div>
          <p className="text-3xl font-mono font-bold text-status-yellow">{formatRupiah(finalAmount)}</p>
        </div>

        {/* Discount Input */}
        <div>
          <label className="text-xs text-muted font-medium mb-1 block">Potongan Harga / Diskon (Rp) - Opsional</label>
          <input
            type="number"
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
            placeholder="0"
            className="w-full h-10 rounded-xl bg-elevated border border-border text-primary text-sm px-4 outline-none focus:border-status-yellow transition-all"
          />
        </div>

        {/* Method Toggle */}
        <div className="flex gap-2 bg-elevated p-1 rounded-xl">
          <button
            onClick={() => setMethod("TUNAI")}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer",
              method === "TUNAI" ? "bg-status-yellow text-white" : "text-muted hover:text-primary"
            )}
          >
            💵 TUNAI
          </button>
          <button
            onClick={() => setMethod("QRIS")}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer",
              method === "QRIS" ? "bg-status-yellow text-white" : "text-muted hover:text-primary"
            )}
          >
            📱 QRIS
          </button>
        </div>

        {/* TUNAI form */}
        {method === "TUNAI" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted font-medium mb-1 block">Nominal Diterima (Rp)</label>
              <input
                type="number"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                placeholder={finalAmount.toString()}
                className="w-full h-12 rounded-xl bg-elevated border border-border text-primary text-xl font-mono font-bold px-4 outline-none focus:border-status-yellow"
              />
            </div>
            <div className="flex justify-between items-center bg-elevated/50 p-3 rounded-xl">
              <span className="text-sm font-medium text-muted">Kembalian</span>
              <span className={cn("text-lg font-mono font-bold", change >= 0 ? "text-status-green" : "text-status-red")}>
                {formatRupiah(change)}
              </span>
            </div>
          </div>
        )}

        {/* QRIS form */}
        {method === "QRIS" && (
          <div className="text-center space-y-3">
            <div className="bg-white p-4 rounded-xl inline-block border-2 border-dashed border-border">
              <p className="text-xs text-black font-bold mb-1">SCAN QRIS PRINT PILOT</p>
              <div className="h-36 w-36 bg-elevated mx-auto flex items-center justify-center text-xs text-black font-mono">
                [ QR CODE ]
              </div>
            </div>
            <input
              type="text"
              value={qrisRef}
              onChange={(e) => setQrisRef(e.target.value)}
              placeholder="No. Referensi Transaksi (Opsional)"
              className="w-full h-10 rounded-xl bg-elevated border border-border text-primary text-xs px-3 outline-none focus:border-status-yellow"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary transition-colors cursor-pointer">
            Batal
          </button>
          <button onClick={() => onSuccess(method, cashGiven)} disabled={!isValidCash} className={cn("flex-[2] h-11 rounded-xl text-white text-sm font-bold flex items-center justify-center transition-all shadow-sm", isValidCash ? "bg-status-green hover:brightness-110 shadow-status-green/20 cursor-pointer" : "bg-status-green/50 cursor-not-allowed")}>
            Selesaikan Transaksi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PosPage() {
  const [activeTab, setActiveTab] = useState<"KASIR" | "HISTORY" | "STOCK">("KASIR");
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const retailProducts = useWorkflowStore((s) => s.retailProducts);
  const deductRetailStock = useWorkflowStore((s) => s.deductRetailStock);
  const customers = useWorkflowStore((s) => s.customers);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const displayCustomerName = selectedCustomer ? selectedCustomer.name : "Umum";
  const defaultDiscount = selectedCustomer ? selectedCustomer.defaultDiscountRp : 0;

  // Map store products to Product interface
  const allProducts: Product[] = retailProducts.map(p => ({
    id: p.id, name: p.name, price: p.price, stock: p.stock, category: p.category
  }));

  const filteredProducts = allProducts.filter(p => {
    const matchCategory = activeCategory === "Semua" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && !item.isCustom);
      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        isCustom: product.isCustom || false
      }];
    });
  };

  const handleAddCustomItem = () => {
    setCart(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      productId: "CUSTOM",
      name: "Item Khusus / Custom",
      price: 0,
      qty: 1,
      isCustom: true,
      notes: ""
    }]);
  };

  const handleUpdateQty = (id: string, qty: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty } : item));
  };

  const handleRemoveItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdatePrice = (id: string, price: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, price } : item));
  };

  const handleUpdateName = (id: string, name: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, name } : item));
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, notes } : item));
  };

  const clearCart = () => {
    if(confirm("Kosongkan keranjang?")) setCart([]);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tax = subtotal * 0.11; // PPN 11%
  const total = subtotal + tax;

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const handleCheckoutSuccess = (method: "TUNAI" | "QRIS", cashGiven: number) => {
    cart.forEach(item => {
      if (!item.isCustom) {
        deductRetailStock(item.productId, item.qty);
      }
    });
    const totalVal = total;
    const changeVal = method === "TUNAI" ? Math.max(0, cashGiven - totalVal) : 0;
    
    setShowPaymentModal(false);
    setReceiptData({ total: totalVal, method, cashGiven, change: changeVal });
    
    setCart([]);
    setSelectedCustomerId("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] bg-base gap-4 pb-4">
      
      {/* TABS */}
      <div className="flex gap-2 p-1 bg-card border border-border rounded-xl w-fit shadow-sm shrink-0">
        {[
          { id: "KASIR", label: "Kasir POS", icon: Receipt },
          { id: "HISTORY", label: "Riwayat Transaksi", icon: ClipboardList },
          { id: "STOCK", label: "Manajemen Stok", icon: Package },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn("px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 cursor-pointer transition-all",
              activeTab === tab.id ? "bg-accent-teal text-white shadow-md" : "text-muted hover:text-primary hover:bg-elevated"
            )}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      <ReceiptModal open={!!receiptData} transactionData={receiptData} onClose={() => setReceiptData(null)} />
      <PosPaymentModal
        open={showPaymentModal}
        totalAmount={total}
        customerName={displayCustomerName}
        defaultDiscount={defaultDiscount}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handleCheckoutSuccess}
      />

      {activeTab === "KASIR" && (
        <div className="flex-1 flex overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
          {/* LEFT PANEL - PRODUCTS */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* Top Bar */}
        <div className="p-4 border-b border-border bg-card flex gap-4 items-center shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
            <input
              type="text"
              placeholder="Cari produk (F3)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl outline-none focus:border-status-yellow focus:ring-1 focus:ring-status-yellow transition-all"
            />
          </div>
          <button 
            onClick={handleAddCustomItem}
            className="flex items-center gap-2 bg-accent-teal/10 text-accent-teal hover:bg-accent-teal hover:text-white px-4 py-2.5 rounded-xl font-medium transition-all cursor-pointer"
          >
            <PlusCircle className="h-5 w-5" />
            <span className="hidden sm:inline">Custom Item</span>
          </button>
        </div>

        {/* Categories */}
        <div className="px-4 py-3 bg-elevated border-b border-border overflow-x-auto shrink-0 flex gap-2 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer",
                activeCategory === cat 
                  ? "bg-accent-teal text-white border border-accent-teal" 
                  : "bg-card text-muted hover:text-primary border border-border"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          <div className="flex flex-col gap-3">
            {filteredProducts.map(product => (
              <PosProductCard 
                key={product.id} 
                product={product} 
                onClick={handleAddToCart} 
              />
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted">
              <LayoutGrid className="h-12 w-12 mb-4 opacity-20" />
              <p>Tidak ada produk ditemukan.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - CART */}
      <div className="w-[380px] shrink-0 flex flex-col bg-card shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10">
        {/* Customer Info */}
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-status-yellow" />
              Keranjang
            </h2>
            <button 
              onClick={clearCart}
              disabled={cart.length === 0}
              className="text-xs text-status-red hover:bg-status-red/10 px-2 py-1 rounded transition-colors disabled:opacity-50 cursor-pointer"
            >
              Kosongkan
            </button>
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-status-yellow text-sm appearance-none cursor-pointer"
            >
              <option value="">Pelanggan Umum</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.type === "Makloon" || c.type === "B2B" ? `(${c.type})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto bg-background/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted p-8 text-center">
              <div className="h-24 w-24 rounded-full bg-elevated flex items-center justify-center mb-4 border border-dashed border-border">
                <ShoppingCart className="h-8 w-8 text-muted/50" />
              </div>
              <p className="font-medium">Keranjang masih kosong</p>
              <p className="text-xs mt-1">Pilih produk di sebelah kiri atau tambah custom item.</p>
            </div>
          ) : (
            cart.map(item => (
              <PosCartItem 
                key={item.id} 
                item={item} 
                onUpdateQty={handleUpdateQty}
                onRemove={handleRemoveItem}
                onUpdatePrice={handleUpdatePrice}
                onUpdateNotes={handleUpdateNotes}
                onUpdateName={handleUpdateName}
              />
            ))
          )}
        </div>

        {/* Summary & Checkout */}
        <div className="p-4 border-t border-border bg-card shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="font-mono">{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>PPN (11%)</span>
              <span className="font-mono">{formatRupiah(tax)}</span>
            </div>
            <div className="flex justify-between items-end mt-2 pt-2 border-t border-border border-dashed">
              <span className="font-bold">Total</span>
              <span className="font-mono text-2xl font-bold text-status-yellow">{formatRupiah(total)}</span>
            </div>
          </div>
          
          <button 
            disabled={cart.length === 0}
            onClick={() => setShowPaymentModal(true)}
            className="w-full h-14 bg-accent-teal hover:brightness-110 text-white rounded-xl font-bold text-lg shadow-lg shadow-accent-teal/20 transition-all disabled:opacity-50 disabled:grayscale-[0.5] disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            Bayar <span className="opacity-80">({cart.length} item)</span>
          </button>
        </div>
        </div>
      </div>
      )}

      {activeTab === "HISTORY" && (
        <div className="flex-1 bg-card border border-border rounded-2xl p-6 shadow-lg overflow-y-auto">
          <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-accent-teal"/> Riwayat Transaksi Retail</h2>
          <div className="bg-elevated rounded-xl border border-border overflow-hidden">
             <div className="grid grid-cols-5 text-xs font-bold text-muted p-4 border-b border-border bg-background">
               <div>WAKTU</div>
               <div>NO. REF</div>
               <div>PELANGGAN</div>
               <div>METODE</div>
               <div className="text-right">TOTAL</div>
             </div>
             <div className="p-8 text-center text-muted text-sm">
                Riwayat transaksi sedang kosong.
             </div>
          </div>
        </div>
      )}

      {activeTab === "STOCK" && (
        <div className="flex-1 bg-card border border-border rounded-2xl p-6 shadow-lg overflow-y-auto">
          <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-status-yellow"/> Manajemen Stok Retail</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {retailProducts.map(p => (
              <div key={p.id} className="bg-elevated p-4 rounded-xl border border-border flex items-center justify-between">
                 <div>
                   <p className="font-bold text-primary text-sm">{p.name}</p>
                   <p className="text-xs text-muted">SKU: {p.sku}</p>
                 </div>
                 <div className="text-right">
                   <p className={cn("text-lg font-bold font-mono", p.stock < 10 ? "text-status-red" : "text-status-green")}>{p.stock}</p>
                   <p className="text-[10px] text-muted uppercase">Pcs</p>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
