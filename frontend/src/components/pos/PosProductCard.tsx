import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
  isCustom?: boolean;
}

interface PosProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export function PosProductCard({ product, onClick }: PosProductCardProps) {
  const isOutOfStock = product.stock <= 0 && !product.isCustom;

  return (
    <div
      onClick={() => !isOutOfStock && onClick(product)}
      className={cn(
        "relative flex items-center justify-between overflow-hidden rounded-xl border bg-card p-3 transition-all duration-200 cursor-pointer group",
        isOutOfStock 
          ? "opacity-60 cursor-not-allowed border-border grayscale-[0.5]" 
          : "hover:border-status-yellow/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] border-border"
      )}
    >
      <div className="flex items-center flex-1 min-w-0 pr-4 gap-4">
        {/* Kolom Nama & Kategori (Kiri) */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">{product.category}</span>
          <h3 className="font-semibold text-primary line-clamp-1 leading-tight text-sm">{product.name}</h3>
        </div>

        {/* Kolom Harga & Stok (Kanan) */}
        <div className="flex flex-col items-end shrink-0 gap-1">
          <div className="font-mono font-bold text-base text-primary tracking-tight">
            {product.isCustom ? "Rp ???" : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.price)}
          </div>
          {product.isCustom ? (
            <span className="text-status-purple font-bold text-xs bg-status-purple/10 px-2 py-0.5 rounded">⭐ Custom</span>
          ) : (
            <div className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold",
              isOutOfStock ? "bg-status-red/10 text-status-red" : "bg-status-green/10 text-status-green"
            )}>
              Stok: {product.stock}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 pl-2 border-l border-border/50">
        {!isOutOfStock ? (
          <div className="h-10 w-10 rounded-full bg-status-yellow/10 group-hover:bg-status-yellow flex items-center justify-center transition-colors">
            <Plus className="h-5 w-5 text-status-yellow-text group-hover:text-white transition-colors" />
          </div>
        ) : (
          <div className="h-10 w-10 flex items-center justify-center">
            <span className="text-xs font-bold text-status-red">Habis</span>
          </div>
        )}
      </div>
    </div>
  );
}
