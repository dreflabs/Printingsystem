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

function MaterialModal({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [type, setType] = useState<"RECEIVE" | "ISSUE">("RECEIVE");
  
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-[0_8px_48px_rgba(0,0,0,0.5)]">
        <h3 className="text-base font-bold text-primary mb-4">Mutasi Material</h3>
        <div className="flex gap-2 mb-4 bg-elevated p-1 rounded-xl">
          <button onClick={() => setType("RECEIVE")} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all", type === "RECEIVE" ? "bg-status-green text-white" : "text-muted")}>Stok Masuk</button>
          <button onClick={() => setType("ISSUE")} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all", type === "ISSUE" ? "bg-status-red text-white" : "text-muted")}>Stok Keluar</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase text-muted">Material</label>
            <select className="w-full h-10 mt-1 bg-elevated border border-border rounded-lg px-3 text-sm text-primary outline-none focus:border-accent-teal">
              <option>Kertas Art Carton 260g</option>
              <option>Tinta Cyan</option>
              <option>Bahan Spanduk 280g</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted">Jumlah Qty</label>
            <input type="number" className="w-full h-10 mt-1 bg-elevated border border-border rounded-lg px-3 text-sm text-primary outline-none focus:border-accent-teal" placeholder="0" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-elevated border border-border text-xs text-muted hover:text-primary cursor-pointer">Batal</button>
          <button onClick={() => { alert("Mutasi berhasil dicatat."); onClose(); }} className="flex-1 h-10 rounded-xl bg-accent-teal text-white text-xs font-bold cursor-pointer">Submit</button>
        </div>
      </div>
    </div>
  );
}

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

export function StorageTab() {
  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);

  // Jobs yang sudah selesai QC dan siap masuk gudang
  const waitingJobs = jobs.filter(j => j.status === "QC_PASSED" || j.status === "WAITING_FINISHING");
  const storedJobsCount = jobs.filter(j => j.status === "STORED").length;
  const pickedUpCount = jobs.filter(j => j.status === "PICKED_UP").length;

  const dynamicKPI = [
    { label: "Menunggu Disimpan", value: waitingJobs.length.toString(), color: "text-status-yellow", bg: "bg-status-yellow/10" },
    { label: "Slot Terisi", value: `${storedJobsCount}/40`, color: "text-accent-teal", bg: "bg-accent-teal/10" },
    { label: "Zona Hampir Penuh", value: "0", color: "text-status-red", bg: "bg-status-red/10" },
    { label: "Dipindah Hari Ini", value: pickedUpCount.toString(), color: "text-status-green", bg: "bg-status-green/10" },
  ];

  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  
  // Store Flow States
  const [storeStep, setStoreStep] = useState<"hidden" | "scan_job" | "scan_location" | "confirm">("hidden");
  const [storeJobId, setStoreJobId] = useState("");
  const [storeLocation, setStoreLocation] = useState("");

  const handleStartStore = (jobId?: string) => {
    if (jobId) {
      setStoreJobId(jobId);
      setStoreStep("scan_location");
    } else {
      setStoreStep("scan_job");
    }
  };

  const handleStoreSubmit = () => {
    if (storeJobId) {
      updateJobStatus(storeJobId, "STORED");
      alert(`Job ${storeJobId} berhasil disimpan di ${storeLocation}.`);
    }
    setStoreStep("hidden");
    setStoreJobId("");
    setStoreLocation("");
  };

  return (
    <div className="space-y-6">
      <MaterialModal open={showMaterialModal} onClose={() => setShowMaterialModal(false)} />

      {/* Main Scanner */}
      {showScanner && (
        <QRScanner 
          onClose={() => setShowScanner(false)} 
          onScan={(data) => {
            alert(`Ter-scan: ${data}. Fitur simulasi gudang berjalan.`);
            setShowScanner(false);
          }}
        />
      )}

      {/* Store Job Flow Modals */}
      {storeStep === "scan_job" && (
        <QRScanner 
          onClose={() => setStoreStep("hidden")} 
          onScan={(data) => {
            setStoreJobId(data);
            setStoreStep("scan_location");
          }}
        />
      )}

      {storeStep === "scan_location" && (
        <QRScanner 
          onClose={() => setStoreStep("hidden")} 
          onScan={(data) => {
            setStoreLocation(data);
            setStoreStep("confirm");
          }}
        />
      )}

      {storeStep === "confirm" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={() => setStoreStep("hidden")} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.5)] space-y-4">
            <h3 className="text-base font-bold text-primary flex items-center gap-2">
              <Package className="h-5 w-5 text-accent-teal" /> Konfirmasi Penyimpanan
            </h3>
            <div className="bg-elevated p-4 rounded-xl border border-border space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Kode Job</span><span className="text-accent-teal font-mono">{storeJobId}</span></div>
              <div className="flex justify-between"><span className="text-muted">Lokasi Rak</span><span className="font-bold">{storeLocation}</span></div>
            </div>
            <p className="text-xs text-muted">Pastikan barang fisik benar-benar diletakkan di slot ini dan kuantitas sesuai dengan label.</p>
            <div className="flex gap-3">
              <button onClick={() => setStoreStep("hidden")} className="flex-1 h-11 rounded-xl bg-elevated border border-border text-sm text-muted hover:text-primary cursor-pointer">Batal</button>
              <button onClick={handleStoreSubmit} className="flex-1 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold cursor-pointer hover:brightness-110">Simpan Final</button>
            </div>
          </div>
        </div>
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

      <p className="text-sm text-muted">Penyimpanan barang jadi Lantai 3</p>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {dynamicKPI.map((k) => (
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
          { label: "SCAN QR", icon: ScanLine, color: "from-accent-teal to-blue-500" },
          { label: "PINDAH KE COUNTER", icon: ArrowDown, color: "from-status-yellow to-status-red" },
          { label: "RECEIVE/ISSUE", icon: Package, color: "from-elevated to-elevated", border: true },
        ].map((btn) => (
          <button
            key={btn.label}
            id={`btn-warehouse-${btn.label.toLowerCase().replace(/\s/g, "-")}`}
            onClick={() => {
              if (btn.label === "SCAN QR") setShowScanner(true);
              if (btn.label === "SIMPAN JOB") handleStartStore();
              if (btn.label === "RECEIVE/ISSUE") setShowMaterialModal(true);
            }}
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
                    <StatusPill status={"WAITING_WAREHOUSE" as any} />
                  </div>
                  <p className="text-sm font-medium text-primary">{w.product}</p>
                  <p className="text-xs text-muted">{w.qty} pcs</p>
                </div>
                <button
                  id={`btn-simpan-${i}`}
                  onClick={() => handleStartStore(w.id)}
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
