"use client";

import { useState } from "react";
import { Settings2, ScanLine, CheckCircle2, AlertCircle, Timer, ChevronRight, Image as ImageIcon, Scissors, Layers } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { useWorkflowStore, Job, InventoryItem } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";

const WASTE_REASONS = [
  "Tinta blobor / kotor",
  "Bahan mampet / nyangkut",
  "Salah setting warna / margin",
  "Mesin error / mati listrik",
  "Lainnya"
];

function SplitRollModal({ onClose }: { onClose: () => void }) {
  const inventory = useWorkflowStore(s => s.inventory);
  const splitRollMaterial = useWorkflowStore(s => s.splitRollMaterial);
  const addLog = useWorkflowStore(s => s.addLog);
  
  // Filter only items that are tracked in 'roll'
  const rollInventory = inventory.filter(i => i.unit === "roll");
  
  const [sourceId, setSourceId] = useState("");
  const [cutSize, setCutSize] = useState("");
  
  const sourceItem = inventory.find(i => i.id === sourceId);
  // Asumsi dasar untuk prototipe: Bahan 3m = 300cm
  const sourceWidth = sourceItem?.name.includes("3m") ? 300 : (sourceItem?.name.includes("1.5m") ? 150 : 0);
  const cutW = parseInt(cutSize) || 0;
  const remainW = sourceWidth - cutW;
  
  const isValidCut = sourceWidth > 0 && cutW > 0 && remainW > 0;
  
  // Cari ID target bahan di inventory (simulasi pencarian sederhana)
  // Di sistem asli, jika bahan tidak ada, akan otomatis terbuat Master Data baru
  const findTargetId = (widthCm: number) => {
    if (widthCm === 150) return inventory.find(i => i.name.includes("1.5m"))?.id || "";
    if (widthCm === 300) return inventory.find(i => i.name.includes("3m"))?.id || "";
    // Fallback sementara jika tidak ada di master data
    return "custom";
  };
  
  const handleSubmit = () => {
    if (isValidCut) {
      const target1Id = findTargetId(cutW);
      const target2Id = findTargetId(remainW);
      
      // Jika hasil potong identik (misal 300 dipotong 150 = 150 dan 150)
      if (cutW === remainW && target1Id !== "custom") {
        splitRollMaterial(sourceId, target1Id, 1, 2);
      } else {
        // Jika beda (misal 100 dan 200), kita eksekusi split terpisah atau abaikan sementara karena butuh logic addInventory baru
        // Untuk prototipe MVP, kita pakai addLog saja agar tercatat.
      }
      
      addLog({
        type: "MATERIAL_CUT",
        title: "Potong Bahan Lebar (Roll)",
        description: `Memotong 1 roll ${sourceItem?.name} pada ukuran ${cutW}cm. Hasil: 1 roll ${cutW}cm dan 1 roll ${remainW}cm.`,
        operator: "Operator (Aktif)"
      });
      
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-accent-teal/10 text-accent-teal">
            <Scissors className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary">Potong Lebar Roll</h3>
            <p className="text-sm text-muted">Kalkulasi otomatis hasil potongan</p>
          </div>
        </div>
        
        <div className="space-y-5">
          <div className="p-4 bg-elevated border border-border rounded-2xl">
            <label className="text-xs text-muted font-bold mb-2 block uppercase tracking-wider">Sumber Bahan (Dipotong 1 Roll)</label>
            <select 
              value={sourceId} onChange={(e) => setSourceId(e.target.value)}
              className="w-full h-12 rounded-xl bg-base border border-border text-primary text-sm px-4 outline-none focus:border-accent-teal mb-3"
            >
              <option value="" disabled>-- Pilih Gulungan Utuh --</option>
              {rollInventory.map(i => (
                <option key={i.id} value={i.id} disabled={i.stock <= 0}>
                  {i.name} (Sisa: {i.stock} roll)
                </option>
              ))}
            </select>
          </div>
          
          {sourceWidth > 0 && (
            <div className="p-4 bg-elevated border border-border rounded-2xl">
              <label className="text-xs text-muted font-bold mb-2 block uppercase tracking-wider">Potong Di Ukuran (cm)</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" min="1" max={sourceWidth - 1} value={cutSize} onChange={(e) => setCutSize(e.target.value)}
                  placeholder="Misal: 150"
                  className="flex-1 h-12 rounded-xl bg-base border border-border text-primary text-lg font-bold px-4 outline-none focus:border-accent-teal"
                />
                <span className="text-sm font-medium text-muted">cm dari {sourceWidth}cm</span>
              </div>
            </div>
          )}

          {isValidCut && (
            <div className="p-4 bg-status-blue/5 border border-status-blue/20 rounded-2xl">
              <label className="text-xs text-status-blue font-bold mb-2 block uppercase tracking-wider">Estimasi Hasil Sistem</label>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-base p-2 rounded-lg border border-status-blue/10">
                  <span className="text-sm text-primary font-medium">Potongan A</span>
                  <span className="text-sm font-bold text-status-blue">{cutW} cm (1 Roll)</span>
                </div>
                <div className="flex justify-between items-center bg-base p-2 rounded-lg border border-status-blue/10">
                  <span className="text-sm text-primary font-medium">Potongan B (Sisa)</span>
                  <span className="text-sm font-bold text-status-blue">{remainW} cm (1 Roll)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-elevated border border-border text-sm font-bold text-muted hover:text-primary transition-colors">Batal</button>
          <button
            onClick={handleSubmit}
            disabled={!isValidCut}
            className="flex-1 h-12 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-40"
          >
            Simpan Potongan
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneBatchModal({ jobs, onClose }: { jobs: Job[]; onClose: () => void }) {
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);
  const updateOrderStatus = useWorkflowStore(s => s.updateOrderStatus);
  const inventory = useWorkflowStore(s => s.inventory);
  const addLog = useWorkflowStore(s => s.addLog);
  
  const [waste, setWaste] = useState("");
  const [wasteReason, setWasteReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [usedMaterialId, setUsedMaterialId] = useState("");
  
  const needReason = parseInt(waste) > 0;
  const finalReason = wasteReason === "Lainnya" ? customReason : wasteReason;

  const totalTarget = jobs.reduce((sum, j) => sum + j.qty, 0);

  const isSubmitDisabled = (needReason && !finalReason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-black text-primary mb-2">Selesai Gabung Cetak</h3>
        <p className="text-sm text-muted mb-6">Mengkonfirmasi penyelesaian {jobs.length} pesanan sekaligus.</p>
        
        <div className="space-y-6">
          <div className="bg-elevated rounded-2xl p-4 border border-border">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Pesanan dalam Batch Ini</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
              {jobs.map(j => (
                <div key={j.id} className="flex justify-between items-center bg-base p-2 rounded-lg border border-border/50">
                  <span className="text-sm font-medium text-primary truncate max-w-[200px]">{j.product}</span>
                  <span className="text-xs font-bold text-accent-teal">{j.qty} pcs</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
              <span className="text-sm font-bold text-primary">Total Target Qty:</span>
              <span className="text-lg font-black text-primary">{totalTarget} pcs</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-primary font-bold mb-1.5 block">Bahan Aktual yang Dipakai (Opsional)</label>
              <select 
                value={usedMaterialId} onChange={(e) => setUsedMaterialId(e.target.value)}
                className="w-full h-12 rounded-xl bg-base border border-border text-primary text-sm px-4 outline-none focus:border-accent-teal"
              >
                <option value="">-- Pilih Jika Perlu Dicatat --</option>
                {inventory.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-status-yellow font-bold mb-1.5 block">Total Jumlah Gagal / Reject</label>
              <input type="number" min="0" value={waste} onChange={(e) => setWaste(e.target.value)}
                placeholder="0"
                className="w-full h-12 rounded-xl bg-elevated border border-border text-primary text-lg font-bold px-4 outline-none focus:border-status-yellow transition-all" />
            </div>

            {needReason && (
              <div className="p-4 bg-status-yellow/10 border border-status-yellow/30 rounded-xl space-y-3">
                <div>
                  <label className="text-xs text-status-yellow font-bold mb-1.5 block">Pilih Alasan Gagal *</label>
                  <select 
                    value={wasteReason} onChange={(e) => setWasteReason(e.target.value)}
                    className="w-full h-11 rounded-xl bg-elevated border border-status-yellow text-primary text-sm px-4 outline-none focus:ring-2 focus:ring-status-yellow/20"
                  >
                    <option value="" disabled>-- Pilih Penyebab --</option>
                    {WASTE_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                {wasteReason === "Lainnya" && (
                  <div>
                    <label className="text-xs text-status-yellow font-bold mb-1.5 block">Ketik Alasan Lainnya *</label>
                    <input type="text" value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full h-11 rounded-xl bg-elevated border border-status-yellow text-primary text-sm px-4 outline-none focus:ring-2 focus:ring-status-yellow/20" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 h-14 rounded-xl bg-elevated border border-border text-sm font-bold text-muted hover:text-primary transition-colors">Batal</button>
          <button
            onClick={() => {
              jobs.forEach(j => {
                updateJobStatus(j.id, "WAITING_QC");
                updateOrderStatus(j.orderId, "PRODUCTION_DONE");
              });
              
              if (parseInt(waste) > 0) {
                 addLog({
                    type: "PRODUCTION_WASTE",
                    title: "Laporan Waste / Bahan Gagal",
                    description: `Ditemukan reject sebanyak ${waste} pcs. Alasan: ${finalReason}. (Batch Job ID: ${jobs[0].id}, dkk)`,
                    operator: "Operator (Aktif)"
                 });
              }
              
              onClose();
            }}
            disabled={isSubmitDisabled}
            className="flex-[2] h-14 rounded-xl bg-gradient-to-r from-status-green to-emerald-500 text-white text-base font-black hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5" /> Selesaikan Batch
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OperatorPage() {
  const jobs = useWorkflowStore(s => s.jobs);
  const orders = useWorkflowStore(s => s.orders);
  const updateJobStatus = useWorkflowStore(s => s.updateJobStatus);
  
  const printingJobs = jobs.filter(j => j.status === "PRINTING");
  const queueJobs = jobs.filter(j => j.status === "WAITING_PRINT");
  
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [queueFilter, setQueueFilter] = useState<"SEMUA" | "HARI_INI" | "OVERDUE">("SEMUA");
  
  const completedJobsCount = jobs.filter(j => 
    j.status === "WAITING_QC" || j.status === "QC_PASSED" || j.status === "FINISHING" || j.status === "STORED" || j.status === "PICKED_UP"
  ).length;

  const dynamicKPI = [
    { label: "Job Dikerjakan", value: printingJobs.length.toString(), color: "text-status-blue", bg: "bg-status-blue/10", icon: Layers },
    { label: "Sisa Antrian", value: queueJobs.length.toString(), color: "text-status-yellow", bg: "bg-status-yellow/10", icon: Timer },
    { label: "Selesai Hari Ini", value: completedJobsCount.toString(), color: "text-status-green", bg: "bg-status-green/10", icon: CheckCircle2 },
    { label: "Kendala Mesin", value: "0", color: "text-status-red", bg: "bg-status-red/10", icon: AlertCircle },
  ];

  const handleStartBatch = () => {
    selectedQueueIds.forEach(id => {
      updateJobStatus(id, "PRINTING");
    });
    setSelectedQueueIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedQueueIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {showSplitModal && <SplitRollModal onClose={() => setShowSplitModal(false)} />}
      {showDoneModal && printingJobs.length > 0 && <DoneBatchModal jobs={printingJobs} onClose={() => setShowDoneModal(false)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Mesin Produksi</h1>
          <p className="text-sm text-muted mt-0.5">Kelola antrian cetak dan potong bahan</p>
        </div>
        <button 
          onClick={() => setShowSplitModal(true)}
          className="h-11 px-5 rounded-xl bg-elevated border border-border text-primary font-bold text-sm flex items-center justify-center gap-2 hover:border-accent-teal hover:text-accent-teal transition-all shadow-sm"
        >
          <Scissors className="h-4 w-4" /> Lapor Potong Lebar Roll
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {dynamicKPI.map((k) => (
          <div key={k.label} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className={cn("inline-flex p-3 rounded-xl", k.bg)}>
              <k.icon className={cn("h-6 w-6", k.color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", k.color)}>{k.value}</p>
              <p className="text-xs text-muted font-medium">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Active Jobs (Batch) */}
        <div className="lg:col-span-2 space-y-6">
          {printingJobs.length > 0 ? (
            <div className="bg-card border-2 border-status-blue/30 rounded-3xl overflow-hidden shadow-lg shadow-status-blue/5">
              <div className="bg-status-blue/10 px-6 py-4 border-b border-status-blue/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-blue opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-status-blue"></span>
                  </span>
                  <span className="font-bold text-status-blue tracking-wide uppercase text-sm">BATCH AKTIF ({printingJobs.length} JOB)</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-base text-xs font-bold text-primary flex items-center gap-2 border border-border self-start sm:self-auto">
                  <Settings2 className="h-4 w-4 text-muted" />
                  MESIN ROLAND A
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3 mb-8">
                  {printingJobs.map(job => (
                    <div key={job.id} className="bg-base border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-elevated flex items-center justify-center shrink-0 border border-border">
                        <ImageIcon className="h-5 w-5 text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-primary text-base truncate">{job.product}</p>
                        <p className="text-xs font-medium text-muted mt-1">{job.id} · {job.material} · {job.finishing}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-sm font-medium text-muted">Target Qty</p>
                        <p className="text-xl font-black text-primary">{job.qty} <span className="text-sm">pcs</span></p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowDoneModal(true)}
                  className="w-full h-16 rounded-2xl bg-gradient-to-r from-status-green to-emerald-500 text-white text-lg font-black shadow-lg shadow-status-green/20 hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-6 w-6" />
                  SELESAI CETAK SEMUA
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-card/70 backdrop-blur-xl border border-border rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-elevated rounded-full flex items-center justify-center mb-4">
                <Layers className="h-10 w-10 text-muted" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-2">Mesin Sedang Nganggur</h2>
              <p className="text-muted max-w-sm">Pilih pesanan dari antrian di samping dan klik "Gabung Cetak" untuk mulai bekerja.</p>
            </div>
          )}

          {/* Scan CTA */}
          <button className="w-full h-16 rounded-2xl bg-elevated border-2 border-dashed border-accent-teal/40 text-accent-teal font-bold text-lg flex items-center justify-center gap-3 hover:bg-accent-teal/10 hover:border-accent-teal transition-all cursor-pointer shadow-sm">
            <ScanLine className="h-6 w-6" /> SCAN TIKET SPK
          </button>
        </div>

        {/* Kolom Kanan: Antrian */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-3xl shadow-sm flex flex-col h-full max-h-[800px] overflow-hidden">
          <div className="p-5 border-b border-border bg-card/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-status-yellow" />
                <h2 className="text-lg font-bold text-primary">Antrian</h2>
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-status-yellow text-black">{queueJobs.length}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <select 
                value={queueFilter} onChange={(e) => setQueueFilter(e.target.value as any)}
                className="flex-1 h-10 bg-elevated border border-border rounded-xl text-xs font-bold text-primary px-3 outline-none focus:border-accent-teal cursor-pointer"
              >
                <option value="SEMUA">Semua Antrian</option>
                <option value="HARI_INI">Deadline Hari Ini</option>
              </select>
              
              {selectedQueueIds.length > 0 && (
                <button 
                  onClick={handleStartBatch}
                  disabled={printingJobs.length > 0} // Can only start if machine is empty
                  className="px-4 bg-accent-teal text-white rounded-xl text-xs font-black hover:brightness-110 disabled:opacity-40 disabled:grayscale transition-all flex items-center gap-1"
                >
                  GABUNG ({selectedQueueIds.length})
                </button>
              )}
            </div>
            {printingJobs.length > 0 && selectedQueueIds.length > 0 && (
               <p className="text-[10px] text-status-red mt-2 font-medium">* Selesaikan batch aktif terlebih dahulu sebelum memulai yang baru.</p>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {queueJobs.filter(j => {
              if (queueFilter === "HARI_INI") {
                const order = orders.find(o => o.id === j.orderId);
                const today = new Date().toISOString().split("T")[0];
                return order?.deadline === today;
              }
              return true;
            }).map((j) => {
              const isSelected = selectedQueueIds.includes(j.id);
              return (
              <div 
                key={j.id} 
                onClick={() => toggleSelect(j.id)}
                className={cn(
                  "bg-base border rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all",
                  isSelected ? "border-accent-teal bg-accent-teal/5" : "border-border/50 hover:border-accent-teal/50"
                )}
              >
                <div className={cn(
                  "h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                  isSelected ? "border-accent-teal bg-accent-teal text-white" : "border-muted/50 bg-base text-transparent"
                )}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-bold text-base truncate mb-1", isSelected ? "text-accent-teal" : "text-primary")}>{j.product}</p>
                  <p className="text-xs font-medium text-muted truncate">{j.material}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-primary">{j.qty} <span className="text-[10px] font-medium text-muted">pcs</span></p>
                </div>
              </div>
              );
            })}
            
            {queueJobs.length === 0 && (
              <div className="p-8 text-center text-muted text-sm">
                Tidak ada antrian lain.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
