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
        "relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-all duration-200 cursor-pointer group",
        isOutOfStock 
          ? "opacity-60 cursor-not-allowed border-border grayscale-[0.5]" 
          : "hover:border-status-orange/50 hover:shadow-md hover:-translate-y-1 active:scale-[0.98] border-border"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted uppercase tracking-wider">{product.category}</span>
          <h3 className="font-semibold text-primary mt-1 line-clamp-2 leading-tight">{product.name}</h3>
        </div>
        {product.isCustom ? (
          <div className="h-8 w-8 rounded-full bg-status-purple/10 flex items-center justify-center shrink-0">
            <span className="text-status-purple font-bold text-xs">⭐</span>
          </div>
        ) : (
          <div className={cn(
            "px-2 py-1 rounded-md text-xs font-medium",
            isOutOfStock ? "bg-status-red/10 text-status-red" : "bg-status-green/10 text-status-green"
          )}>
            Stok: {product.stock}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="font-mono font-bold text-lg text-primary">
          {product.isCustom ? "Rp ???" : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(product.price)}
        </div>
        
        {!isOutOfStock && (
          <div className="h-8 w-8 rounded-full bg-status-orange/10 group-hover:bg-status-orange flex items-center justify-center transition-colors">
            <Plus className="h-4 w-4 text-status-orange group-hover:text-white transition-colors" />
          </div>
        )}
      </div>
    </div>
  );
}
