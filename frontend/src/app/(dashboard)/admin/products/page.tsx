"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter, MoreHorizontal, ArrowUpDown } from "lucide-react";
import { ProductFormModal } from "@/components/admin/ProductFormModal";
import { PrintingProductModal } from "@/components/admin/PrintingProductModal";
import { cn } from "@/lib/utils";
import { getRetailProducts, createRetailProduct } from "@/actions/master-data";
import { useWorkflowStore, PrintingProduct } from "@/store/useWorkflowStore";

export default function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState<"retail" | "printing">("retail");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPrintingModalOpen, setIsPrintingModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Retail products (Prisma backend)
  const [retailProducts, setRetailProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Printing products (Zustand frontend)
  const printingProducts = useWorkflowStore(s => s.printingProducts);
  const updatePrintingProduct = useWorkflowStore(s => s.updatePrintingProduct);
  const addPrintingProduct = useWorkflowStore(s => s.addPrintingProduct);
  
  const [editingPrintingPrice, setEditingPrintingPrice] = useState<{id: string, price: string} | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    const result = await getRetailProducts();
    if (result.success && result.data) {
      setRetailProducts(result.data);
    }
    setIsLoading(false);
  };

  const filteredRetail = retailProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPrinting = printingProducts.filter(p => 
    p.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const handleSaveProduct = async (newProduct: any) => {
    const result = await createRetailProduct({
      sku: newProduct.sku || "SKU-AUTO",
      name: newProduct.name,
      category: newProduct.category || "GENERAL",
      price: Number(newProduct.price) || 0,
      stock_quantity: Number(newProduct.stock) || 0,
      min_stock: Number(newProduct.minStock) || 0,
    });
    
    if (result.success) {
      setIsModalOpen(false);
      loadProducts();
    } else {
      alert("Gagal menyimpan produk: " + result.error);
    }
  };

  const handleSavePrintingProduct = (productData: any) => {
    const value = productData.label.toLowerCase().replace(/\s+/g, '-');
    const id = `PR-${Date.now().toString().slice(-4)}`;
    
    addPrintingProduct({
      id,
      value,
      ...productData
    });
    
    setIsPrintingModalOpen(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Master Produk</h1>
          <p className="text-sm text-muted mt-1">Kelola data produk retail, harga, dan stok.</p>
        </div>
        <button 
          onClick={() => activeTab === 'retail' ? setIsModalOpen(true) : setIsPrintingModalOpen(true)}
          className="flex items-center gap-2 bg-accent-teal text-white px-5 py-2.5 rounded-xl font-bold hover:bg-accent-teal/90 shadow-lg shadow-accent-teal/20 transition-all"
        >
          <Plus className="h-5 w-5" />
          Tambah Produk Baru
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6 border-b border-border">
        <button 
          onClick={() => setActiveTab("retail")}
          className={cn("pb-3 px-1 border-b-2 font-bold text-sm transition-colors", activeTab === "retail" ? "border-accent-teal text-accent-teal" : "border-transparent text-muted hover:text-primary")}
        >
          Barang Retail / Consumable
        </button>
        <button 
          onClick={() => setActiveTab("printing")}
          className={cn("pb-3 px-1 border-b-2 font-bold text-sm transition-colors", activeTab === "printing" ? "border-accent-teal text-accent-teal" : "border-transparent text-muted hover:text-primary")}
        >
          Jasa Cetak (Banner, Stiker, dll)
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input
            type="text"
            placeholder="Cari berdasarkan SKU atau Nama Produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-status-blue transition-colors text-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg bg-background hover:bg-elevated text-sm font-medium transition-colors">
          <Filter className="h-4 w-4 text-muted" />
          Filter Kategori
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated border-b border-border text-muted uppercase text-xs font-semibold">
              <tr>
                {activeTab === "retail" ? (
                  <>
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4">Produk & Kategori</th>
                    <th className="px-6 py-4">Harga Jual</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">ID Jasa</th>
                    <th className="px-6 py-4">Nama Produk Cetak</th>
                    <th className="px-6 py-4">Satuan Harga</th>
                    <th className="px-6 py-4">Harga Dasar (Rp)</th>
                  </>
                )}
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeTab === "retail" && filteredRetail.map((product) => (
                <tr key={product.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-muted">{product.sku}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-primary">{product.name}</div>
                    <div className="text-xs text-muted mt-1">{product.category}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-medium text-status-blue">
                    {formatRupiah(Number(product.price))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-muted hover:text-primary hover:bg-background rounded-md transition-colors">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              
              {activeTab === "printing" && filteredPrinting.map((product) => {
                const isEditing = editingPrintingPrice?.id === product.id;
                return (
                <tr key={product.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-muted">{product.id}</td>
                  <td className="px-6 py-4 font-semibold text-primary">{product.label}</td>
                  <td className="px-6 py-4 font-mono text-muted text-xs">Per {product.unit?.toUpperCase() || 'M2'}</td>
                  <td className="px-6 py-4">
                    {product.variants && product.variants.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {product.variants.map((v, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-elevated px-2 py-1 rounded">
                            <span className="text-muted">{v.name}</span>
                            <span className="font-mono text-status-blue font-medium">{formatRupiah(v.price)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="font-medium text-status-blue border-b border-dashed border-status-blue/50">
                        {formatRupiah(product.basePrice)}
                      </span>
                    )}
                    {product.finishings && product.finishings.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted flex gap-1 flex-wrap">
                        {product.finishings.map((f, idx) => (
                          <span key={idx} className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px]">
                            {f.name} ({f.price === 0 ? 'Gratis' : '+' + formatRupiah(f.price)})
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!isEditing && (
                      <button className="text-xs font-bold text-accent-teal hover:underline opacity-50 cursor-not-allowed">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              )})}
              
              {((activeTab === "retail" && filteredRetail.length === 0) || (activeTab === "printing" && filteredPrinting.length === 0)) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted">
                    Tidak ada produk yang sesuai dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductFormModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveProduct}
      />

      <PrintingProductModal 
        open={isPrintingModalOpen}
        onClose={() => setIsPrintingModalOpen(false)}
        onSave={handleSavePrintingProduct}
      />
    </div>
  );
}
