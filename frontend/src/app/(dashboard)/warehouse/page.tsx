"use client";

import { useState } from "react";
import { Warehouse, Package, AlertTriangle, ArrowDown, ScanLine, Search, MapPin } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { QRScanner } from "@/components/ui/QRScanner";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

const KPI = [
  { label: "Menunggu Disimpan", value: "3", color: "text-status-yellow", bg: "bg-status-yellow/10" },
  { label: "Slot Terisi", value: "14/40", color: "text-accent-teal", bg: "bg-accent-teal/10" },
  { label: "Zona Hampir Penuh", value: "1", color: "text-status-red", bg: "bg-status-red/10" },
  { label: "Dipindah Hari Ini", value: "5", color: "text-status-green", bg: "bg-status-green/10" },
];

// Peta Gudang: 5 zona × 8 slot
const ZONES = ["A", "B", "C", "D", "E"];
const SLOTS_PER_ZONE = 8;
const SLOT_DATA: Record<string, { status: "empty" | "filled" | "full"; job?: string; product?: string }> = {
  "A-1": { status: "filled", job: "JOB-0038", product: "Spanduk Kain 2×5m" },
  "A-2": { status: "filled", job: "JOB-0035", product: "Banner Indoor" },
  "A-3": { status: "filled", job: "JOB-0031", product: "Kartu Nama 500pcs" },
  "A-4": { status: "empty" },
  "A-5": { status: "empty" },
  "A-6": { status: "empty" },
  "A-7": { status: "empty" },
  "A-8": { status: "empty" },
  "B-1": { status: "filled", job: "JOB-0029", product: "X-Banner 2 pcs" },
  "B-2": { status: "filled", job: "JOB-0027", product: "Brosur A5 1000pcs" },
  "B-3": { status: "full" },
  "B-4": { status: "full" },
  "B-5": { status: "filled", job: "JOB-0024", product: "Roll Banner" },
  "B-6": { status: "empty" },
  "B-7": { status: "empty" },
  "B-8": { status: "empty" },
};

// Hapus WAITING statis

function SlotCell({ id, data, onClick }: { id: string; data?: typeof SLOT_DATA[string]; onClick: (id: string) => void }) {
  const d = data ?? { status: "empty" };
  return (
    <button
      onClick={() => d.status !== "empty" && onClick(id)}
      title={id}
      className={cn(
        "h-10 w-full rounded-lg border text-[10px] font-bold transition-all",
        d.status === "empty" && "bg-status-green/10 border-status-green/30 text-status-green cursor-default",
        d.status === "filled" && "bg-status-blue/20 border-status-blue/40 text-status-blue cursor-pointer hover:bg-status-blue/30",
        d.status === "full" && "bg-status-red/20 border-status-red/40 text-status-red cursor-default",
      )}
    >
      {id.split("-")[1]}
    </button>
  );
}

export default function WarehousePage() {
  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);

  // Jobs yang sudah selesai QC dan siap masuk gudang
  const waitingJobs = jobs.filter(j => j.status === "QC_PASSED" || j.status === "WAITING_FINISHING");

  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div className="space-y-6">
      {showScanner && (
        <QRScanner 
          onClose={() => setShowScanner(false)} 
          onScan={(data) => {
            alert(`Ter-scan: ${data}. Fitur simulasi gudang berjalan.`);
            setShowScanner(false);
          }}
        />
      )}

      {/* Slot popup */}
      {activeSlot && SLOT_DATA[activeSlot] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={() => setActiveSlot(null)} />
          <div className="relative w-full max-w-xs bg-card border border-border rounded-2xl p-5 shadow-[0_8px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-5 w-5 text-accent-teal" />
              <span className="font-bold text-primary">Lokasi {activeSlot}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Kode Job</span><span className="text-accent-teal font-mono">{SLOT_DATA[activeSlot].job}</span></div>
              <div className="flex justify-between"><span className="text-muted">Produk</span><span className="text-primary">{SLOT_DATA[activeSlot].product}</span></div>
            </div>
            <button onClick={() => setActiveSlot(null)} className="w-full mt-4 h-10 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary transition-colors cursor-pointer">Tutup</button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard Gudang</h1>
        <p className="text-sm text-muted mt-0.5">Penyimpanan barang jadi Lantai 3</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <p className={cn("text-4xl font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "SIMPAN JOB", icon: Package, color: "from-accent-teal to-blue-500" },
          { label: "CARI JOB", icon: Search, color: "from-elevated to-elevated", border: true },
          { label: "SCAN QR", icon: ScanLine, color: "from-accent-purple to-blue-500" },
          { label: "PINDAH KE COUNTER", icon: ArrowDown, color: "from-status-orange to-status-red" },
        ].map((btn) => (
          <button
            key={btn.label}
            id={`btn-warehouse-${btn.label.toLowerCase().replace(/\s/g, "-")}`}
            onClick={() => btn.label === "SCAN QR" ? setShowScanner(true) : null}
            className={cn(
              "flex flex-col items-center justify-center gap-2 h-20 rounded-xl text-xs font-bold transition-all cursor-pointer",
              btn.border
                ? "bg-elevated border-2 border-dashed border-border text-muted hover:border-accent-teal hover:text-accent-teal"
                : `bg-gradient-to-br ${btn.color} text-white hover:brightness-110 shadow-lg`
            )}
          >
            <btn.icon className="h-6 w-6" />
            {btn.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Waiting List */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <AlertTriangle className="h-4 w-4 text-status-yellow" />
            <h2 className="text-sm font-semibold text-primary">Menunggu Disimpan</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-yellow/10 text-status-yellow border border-status-yellow/30">{waitingJobs.length}</span>
          </div>
          <div className="divide-y divide-border/50">
            {waitingJobs.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3 p-4 hover:bg-elevated/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-accent-teal">{w.id}</span>
                    <StatusPill status="WAITING_WAREHOUSE" />
                  </div>
                  <p className="text-sm font-medium text-primary">{w.product}</p>
                  <p className="text-xs text-muted">{w.qty} pcs</p>
                </div>
                <button
                  id={`btn-simpan-${i}`}
                  onClick={() => updateJobStatus(w.id, "STORED")}
                  className="shrink-0 h-9 px-3 rounded-xl bg-accent-teal/20 border border-accent-teal/40 text-accent-teal text-xs font-bold hover:bg-accent-teal/30 transition-all cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Warehouse Map */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-accent-teal" />
              <h2 className="text-sm font-semibold text-primary">Peta Gudang LT3</h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-status-green/60" /> Kosong</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-status-blue/60" /> Terisi</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-status-red/60" /> Penuh</span>
            </div>
          </div>
          <div className="space-y-2">
            {ZONES.map((zone) => (
              <div key={zone} className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted w-5 shrink-0">{zone}</span>
                <div className="flex-1 grid grid-cols-8 gap-1">
                  {Array.from({ length: SLOTS_PER_ZONE }, (_, i) => {
                    const id = `${zone}-${i + 1}`;
                    return <SlotCell key={id} id={id} data={SLOT_DATA[id]} onClick={setActiveSlot} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
