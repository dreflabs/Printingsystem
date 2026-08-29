"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Map, Box, MapPin, Loader2, ArrowRight, Settings2, Plus, Check, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getStorageLocationsWithItems,
  searchStorageItems,
  createStorageLocation,
  updateStorageLocation,
  seedDefaultStorageLayout,
} from "@/actions/storage";
import { getSessionUser } from "@/actions/session";
import { useToast } from "@/components/ui";
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

const ZONES = ["A", "B", "C", "D", "COUNTER"];

export function StorageTab() {
  const { toast } = useToast();
  const [locs, setLocs] = useState<LocWithItems>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ zone: "A", rack: "", slot: "", capacityMax: "3" });

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
    getSessionUser().then((r) => {
      if (r.ok && (r.user.role === "owner" || r.user.role === "admin")) setCanManage(true);
    });
  }, []);

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

  const runSeed = async () => {
    setBusy(true);
    const res = await seedDefaultStorageLayout();
    setBusy(false);
    if (res.success) {
      toast({ type: "success", title: "Layout rak dibuat", message: `${res.data.created} lokasi ditambahkan.` });
      loadLocs();
    } else toast({ type: "error", title: "Gagal", message: res.error });
  };

  const addLocation = async () => {
    setBusy(true);
    const res = await createStorageLocation({
      zone: form.zone,
      rack: form.rack || undefined,
      slot: form.slot || undefined,
      floor: form.zone === "COUNTER" ? 1 : 3,
      capacityMax: Number(form.capacityMax) || 1,
    });
    setBusy(false);
    if (res.success) {
      toast({ type: "success", title: "Lokasi ditambahkan", message: res.data.location_code });
      setForm((f) => ({ ...f, rack: "", slot: "" }));
      loadLocs();
    } else toast({ type: "error", title: "Gagal", message: res.error });
  };

  const patchLocation = async (id: string, data: { capacityMax?: number; active?: boolean }) => {
    setBusy(true);
    const res = await updateStorageLocation(id, data);
    setBusy(false);
    if (res.success) {
      toast({ type: "success", title: "Lokasi diperbarui" });
      loadLocs();
    } else toast({ type: "error", title: "Gagal", message: res.error });
  };

  const visibleLocs = managing ? locs : locs.filter((l) => l.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Manajemen barang di gudang (pencarian &amp; ketersediaan rak).</p>
        {canManage && (
          <button
            onClick={() => setManaging((m) => !m)}
            className={cn(
              "flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-bold transition-all shrink-0",
              managing
                ? "bg-accent-teal text-white border-accent-teal"
                : "bg-elevated border-border text-muted hover:text-primary hover:border-accent-teal"
            )}
          >
            <Settings2 className="h-3.5 w-3.5" /> Kelola Lokasi
          </button>
        )}
      </div>

      {error && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      {/* Panel manajemen lokasi rak */}
      {managing && canManage && (
        <div className="bg-card/70 backdrop-blur-xl border border-accent-teal/30 rounded-2xl p-6 space-y-5">
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-accent-teal" /> Kelola Lokasi Rak
          </h2>

          {locs.length === 0 && (
            <div className="rounded-xl border border-border bg-elevated/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-primary">Belum ada lokasi rak</p>
                <p className="text-xs text-muted mt-0.5">Buat layout standar: LT3 Zona A–D + Counter LT1.</p>
              </div>
              <button
                onClick={runSeed}
                disabled={busy}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40 transition-all shrink-0"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Buat Layout Standar
              </button>
            </div>
          )}

          {/* Form tambah lokasi tunggal */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Zona</span>
              <select
                value={form.zone}
                onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                className="h-9 rounded-lg bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal"
              >
                {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Rak</span>
              <input
                value={form.rack}
                onChange={(e) => setForm((f) => ({ ...f, rack: e.target.value }))}
                placeholder="01"
                className="h-9 w-20 rounded-lg bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Slot</span>
              <input
                value={form.slot}
                onChange={(e) => setForm((f) => ({ ...f, slot: e.target.value }))}
                placeholder="01"
                className="h-9 w-20 rounded-lg bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Kapasitas</span>
              <input
                type="number"
                min={1}
                value={form.capacityMax}
                onChange={(e) => setForm((f) => ({ ...f, capacityMax: e.target.value }))}
                className="h-9 w-24 rounded-lg bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal"
              />
            </label>
            <button
              onClick={addLocation}
              disabled={busy}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-40 transition-all"
            >
              <Plus className="h-4 w-4" /> Tambah
            </button>
          </div>

          {/* Daftar lokasi */}
          {locs.length > 0 && (
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="bg-elevated/50 border-b border-border text-muted text-xs font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2.5">Kode</th><th className="px-3 py-2.5">Nama</th>
                    <th className="px-3 py-2.5">Isi</th><th className="px-3 py-2.5">Kapasitas</th>
                    <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {locs.map((l) => (
                    <LocRow key={l.id} loc={l} busy={busy} onPatch={patchLocation} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
        ) : visibleLocs.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-center">
            <Box className="h-8 w-8 text-muted/50" />
            <p className="text-sm text-muted">Belum ada lokasi rak.</p>
            {canManage && <p className="text-xs text-muted/70">Klik &ldquo;Kelola Lokasi&rdquo; di atas untuk membuat layout.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleLocs.map((loc) => {
              const isFull = loc.capacity_current >= loc.capacity_max;
              const fillPct = (loc.capacity_current / loc.capacity_max) * 100;
              return (
                <div key={loc.id} className={cn("rounded-xl border p-4 flex flex-col justify-between gap-4 transition-colors",
                  !loc.active ? "bg-elevated/20 border-border/50 opacity-60" :
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
                      {!loc.active && <span className="text-[10px] text-muted ml-auto mb-1 font-bold uppercase">Nonaktif</span>}
                    </div>
                    <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isFull ? "bg-status-red" : "bg-status-green")}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

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

function LocRow({
  loc,
  busy,
  onPatch,
}: {
  loc: LocWithItems[number];
  busy: boolean;
  onPatch: (id: string, data: { capacityMax?: number; active?: boolean }) => void;
}) {
  const [cap, setCap] = useState(String(loc.capacity_max));
  const dirty = cap !== String(loc.capacity_max) && Number(cap) >= 1;

  return (
    <tr className="hover:bg-elevated/30">
      <td className="px-3 py-2 font-mono text-xs text-accent-teal font-bold">{loc.location_code}</td>
      <td className="px-3 py-2 text-muted text-xs">{loc.name}</td>
      <td className="px-3 py-2 text-muted">{loc.capacity_current}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className="h-8 w-16 rounded-md bg-elevated border border-border text-sm text-primary px-2 outline-none focus:border-accent-teal"
          />
          {dirty && (
            <button
              onClick={() => onPatch(loc.id, { capacityMax: Number(cap) })}
              disabled={busy}
              className="p-1.5 rounded-md bg-accent-teal/15 text-accent-teal hover:bg-accent-teal/25 disabled:opacity-40"
              title="Simpan kapasitas"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={cn(
          "px-2 py-0.5 text-[10px] rounded border font-bold uppercase",
          loc.active ? "bg-status-green/10 text-status-green border-status-green/30" : "bg-elevated text-muted border-border"
        )}>
          {loc.active ? "Aktif" : "Nonaktif"}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={() => onPatch(loc.id, { active: !loc.active })}
          disabled={busy || (loc.active && loc.capacity_current > 0)}
          className={cn(
            "inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[11px] font-bold transition-all disabled:opacity-30",
            loc.active
              ? "border-border text-muted hover:text-status-red hover:border-status-red/40"
              : "border-status-green/40 text-status-green hover:bg-status-green/10"
          )}
          title={loc.active && loc.capacity_current > 0 ? "Masih berisi barang" : undefined}
        >
          <Power className="h-3 w-3" /> {loc.active ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </td>
    </tr>
  );
}
