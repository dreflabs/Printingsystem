"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Map, Box, MapPin, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStorageLocationsWithItems, searchStorageItems } from "@/actions/storage";
import { Prisma } from "@prisma/client";

type LocWithItems = Prisma.StorageLocationGetPayload<{
  include: {
    stored_items: {
      include: { job: { include: { order: { include: { customer: true } } } } }
    }
  }
}>[];

type StorageItemSearch = Prisma.StorageItemGetPayload<{
  include: {
    location: true;
    transit_location: true;
    job: { include: { order: { include: { customer: true } } } }
  }
}>[];

export function StorageTab() {
  const [locs, setLocs] = useState<LocWithItems>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StorageItemSearch>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadLocs = useCallback(async () => {
    setLoading(true);
    const res = await getStorageLocationsWithItems();
    if (res.success) setLocs(res.data);
    else setError(res.error);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadLocs(); }, [loadLocs]);

  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const res = await searchStorageItems(searchQuery);
      if (res.success) setSearchResults(res.data);
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Manajemen barang di gudang (pencarian & ketersediaan rak).</p>
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent-teal transition-colors">
          {searchLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </div>
        <input
          type="text"
          placeholder="Cari job/order di gudang (min. 3 karakter)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-14 bg-card/70 backdrop-blur-xl border border-border rounded-2xl pl-12 pr-4 text-primary outline-none focus:border-accent-teal transition-all shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
        />
      </div>

      {/* Search Results */}
      {searchQuery.trim().length >= 3 && (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="p-4 border-b border-border bg-elevated/50">
            <h3 className="text-sm font-bold text-primary">Hasil Pencarian ({searchResults.length})</h3>
          </div>
          <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
            {searchResults.length === 0 && !searchLoading && (
              <div className="p-8 text-center text-muted">Tidak ditemukan barang dengan kata kunci tersebut di gudang.</div>
            )}
            {searchResults.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-elevated/30 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-accent-teal font-bold">{item.job.job_code}</span>
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] rounded border font-bold uppercase",
                      item.status === "STORED" ? "bg-status-green/10 text-status-green border-status-green/30" : "bg-status-yellow/10 text-status-yellow-text border-status-yellow/30"
                    )}>
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-primary">{item.job.order.order_code} · {item.job.order.customer?.name}</p>
                  <p className="text-xs text-muted mt-0.5">Qty: {item.quantity} pcs</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold bg-elevated px-3 py-1.5 rounded-lg border border-border text-primary">
                    <MapPin className="h-3.5 w-3.5 text-accent-teal" /> 
                    {item.status === "STORED" ? item.location.name : item.transit_location?.name ?? "Counter"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storage Map */}
      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Map className="h-5 w-5 text-accent-teal" />
            <h2 className="text-base font-bold text-primary">Peta Ketersediaan Rak</h2>
          </div>
          <button onClick={loadLocs} className="p-2 text-muted hover:text-primary transition-colors rounded-lg hover:bg-elevated">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locs.map((loc) => {
              const isFull = loc.capacity_current >= loc.capacity_max;
              const fillPct = (loc.capacity_current / loc.capacity_max) * 100;
              return (
                <div key={loc.id} className={cn("rounded-xl border p-4 flex flex-col justify-between gap-4 transition-colors",
                  isFull ? "bg-status-red/5 border-status-red/30" : "bg-elevated/40 border-border hover:border-accent-teal/40"
                )}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Box className={cn("h-4 w-4", isFull ? "text-status-red" : "text-accent-teal")} />
                        <h3 className="font-bold text-sm text-primary">{loc.name}</h3>
                      </div>
                      <span className="text-[10px] font-mono text-muted bg-card px-2 py-0.5 rounded border border-border">{loc.location_code}</span>
                    </div>
                    <div className="flex items-end gap-1.5 mb-3">
                      <span className={cn("text-2xl font-bold", isFull ? "text-status-red" : "text-primary")}>
                        {loc.capacity_current}
                      </span>
                      <span className="text-sm text-muted mb-1">/ {loc.capacity_max}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", isFull ? "bg-status-red" : "bg-status-green")}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Items List (max 3 preview) */}
                  {loc.stored_items.length > 0 && (
                    <div className="space-y-1.5 pt-3 border-t border-border/50">
                      {loc.stored_items.slice(0, 3).map(item => (
                        <div key={item.id} className="flex justify-between items-center text-xs">
                          <span className="font-mono text-muted truncate max-w-[120px]">{item.job.job_code}</span>
                          <span className="text-primary font-medium">{item.quantity} pcs</span>
                        </div>
                      ))}
                      {loc.stored_items.length > 3 && (
                        <p className="text-[10px] text-accent-teal text-center font-bold">+{loc.stored_items.length - 3} item lainnya</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
