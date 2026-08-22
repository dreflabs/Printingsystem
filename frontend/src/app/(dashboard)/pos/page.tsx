"use client";

import { useState } from "react";
import { Search, ShoppingCart, User, PlusCircle, LayoutGrid } from "lucide-react";
import { PosProductCard, Product } from "@/components/pos/PosProductCard";
import { PosCartItem, CartItemType } from "@/components/pos/PosCartItem";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/store/useWorkflowStore";

const CATEGORIES = ["Semua", "Kertas", "Tinta", "Alat Tulis", "Merchandise", "Lainnya"];

export default function PosPage() {
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [customerName, setCustomerName] = useState("");

  const retailProducts = useWorkflowStore((s) => s.retailProducts);
  const deductRetailStock = useWorkflowStore((s) => s.deductRetailStock);

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

  const handleCheckout = () => {
    if (cart.length === 0) return;
    // Deduct stock for each non-custom item
    cart.forEach(item => {
      if (!item.isCustom) {
        deductRetailStock(item.productId, item.qty);
      }
    });
    setCart([]);
    setCustomerName("");
    alert(`Transaksi berhasil! Total: ${formatRupiah(total)}`);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tax = subtotal * 0.11; // PPN 11%
  const total = subtotal + tax;

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
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
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl outline-none focus:border-status-orange focus:ring-1 focus:ring-status-orange transition-all"
            />
          </div>
          <button 
            onClick={handleAddCustomItem}
            className="flex items-center gap-2 bg-status-purple/10 text-status-purple hover:bg-status-purple hover:text-white px-4 py-2.5 rounded-xl font-medium transition-all"
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
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeCategory === cat 
                  ? "bg-blue-600 text-white border border-blue-600" 
                  : "bg-card text-muted hover:text-primary border border-border"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
              <ShoppingCart className="h-5 w-5 text-status-orange" />
              Keranjang
            </h2>
            <button 
              onClick={clearCart}
              disabled={cart.length === 0}
              className="text-xs text-status-red hover:bg-status-red/10 px-2 py-1 rounded transition-colors disabled:opacity-50"
            >
              Kosongkan
            </button>
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Nama Pelanggan (Opsional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-status-orange text-sm"
            />
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
              <span className="font-mono text-2xl font-bold text-status-orange">{formatRupiah(total)}</span>
            </div>
          </div>
          
          <button 
            disabled={cart.length === 0}
            onClick={handleCheckout}
            className="w-full h-14 bg-gradient-to-r from-status-orange to-red-500 hover:brightness-110 text-white rounded-xl font-bold text-lg shadow-lg shadow-status-orange/20 transition-all disabled:opacity-50 disabled:grayscale-[0.5] disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Bayar <span className="opacity-80">({cart.length} item)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
