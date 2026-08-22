import { cn } from "@/lib/utils";
import { Minus, Plus, Trash2 } from "lucide-react";

export interface CartItemType {
  id: string; // generate unique id for cart
  productId: string;
  name: string;
  price: number;
  qty: number;
  isCustom?: boolean;
  notes?: string;
}

interface PosCartItemProps {
  item: CartItemType;
  onUpdateQty: (id: string, newQty: number) => void;
  onRemove: (id: string) => void;
  onUpdatePrice?: (id: string, newPrice: number) => void;
  onUpdateNotes?: (id: string, newNotes: string) => void;
  onUpdateName?: (id: string, newName: string) => void;
}

export function PosCartItem({ item, onUpdateQty, onRemove, onUpdatePrice, onUpdateNotes, onUpdateName }: PosCartItemProps) {
  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-card border-b border-border/50 hover:bg-elevated transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          {item.isCustom ? (
            <input 
              type="text"
              value={item.name}
              onChange={(e) => onUpdateName && onUpdateName(item.id, e.target.value)}
              className="w-full bg-transparent border-b border-dashed border-status-orange/50 font-semibold text-sm text-primary outline-none focus:border-status-orange truncate"
            />
          ) : (
            <h4 className="font-semibold text-sm text-primary truncate">
              {item.name}
            </h4>
          )}
          {item.isCustom ? (
             <div className="mt-1 flex items-center">
                <span className="text-xs text-muted mr-2">Rp</span>
                <input 
                  type="number"
                  value={item.price === 0 ? '' : item.price}
                  onChange={(e) => onUpdatePrice && onUpdatePrice(item.id, Number(e.target.value))}
                  placeholder="0"
                  className="w-24 bg-background border border-border rounded px-2 py-1 text-xs font-mono text-primary outline-none focus:border-status-orange"
                />
             </div>
          ) : (
             <p className="text-xs text-muted font-mono mt-0.5">{formatRupiah(item.price)}</p>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="font-bold text-sm text-primary font-mono">
            {formatRupiah(item.price * item.qty)}
          </div>
          <div className="flex items-center bg-background border border-border rounded-lg overflow-hidden h-8">
            <button 
              onClick={() => item.qty > 1 ? onUpdateQty(item.id, item.qty - 1) : onRemove(item.id)}
              className="w-8 h-full flex items-center justify-center hover:bg-elevated text-muted hover:text-status-red transition-colors"
            >
              {item.qty === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            </button>
            <div className="w-8 h-full flex items-center justify-center font-semibold text-sm text-primary border-x border-border">
              {item.qty}
            </div>
            <button 
              onClick={() => onUpdateQty(item.id, item.qty + 1)}
              className="w-8 h-full flex items-center justify-center hover:bg-elevated text-muted hover:text-status-green transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      
      {item.isCustom && (
        <input 
          type="text"
          value={item.notes || ''}
          onChange={(e) => onUpdateNotes && onUpdateNotes(item.id, e.target.value)}
          placeholder="Catatan item khusus..."
          className="w-full text-xs bg-background/50 border border-border rounded px-2 py-1.5 outline-none focus:border-status-orange"
        />
      )}
    </div>
  );
}
