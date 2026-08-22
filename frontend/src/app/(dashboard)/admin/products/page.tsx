"use client";

import { useState } from "react";
import { Plus, Search, Filter, MoreHorizontal, ArrowUpDown } from "lucide-react";
import { ProductFormModal } from "@/components/admin/ProductFormModal";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/store/useWorkflowStore";

export default function AdminProductsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Store as single source of truth
  const retailProducts = useWorkflowStore((s) => s.retailProducts);
  const addRetailProduct = useWorkflowStore((s) => s.addRetailProduct);

  const filteredProducts = retailProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const handleSaveProduct = (newProduct: any) => {
    addRetailProduct({
      id: Math.random().toString(36).substr(2, 9),
      sku: newProduct.sku || "SKU-AUTO",
      name: newProduct.name,
      category: newProduct.category,
      cogs: Number(newProduct.cogs) || 0,
      price: Number(newProduct.price) || 0,
      stock: Number(newProduct.stock) || 0,
      minStock: Number(newProduct.minStock) || 0,
    });
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
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all"
        >
          <Plus className="h-5 w-5" />
          Tambah Produk Baru
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
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Produk & Kategori</th>
                <th className="px-6 py-4">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-primary">
                    COGS (HPP) <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-6 py-4">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-primary">
                    Harga Jual <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-6 py-4">Stok</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-muted">
                    {product.sku}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-primary">{product.name}</div>
                    <div className="text-xs text-muted mt-1">{product.category}</div>
                  </td>
                  <td className="px-6 py-4 font-mono">
                    {formatRupiah(product.cogs)}
                  </td>
                  <td className="px-6 py-4 font-mono font-medium text-status-blue">
                    {formatRupiah(product.price)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        product.stock === 0 ? "bg-status-red" : product.stock <= product.minStock ? "bg-status-yellow" : "bg-status-green"
                      )} />
                      <span className={cn(
                        "font-medium",
                        product.stock === 0 ? "text-status-red" : "text-primary"
                      )}>
                        {product.stock}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-muted hover:text-primary hover:bg-background rounded-md transition-colors">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted">
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
    </div>
  );
}
