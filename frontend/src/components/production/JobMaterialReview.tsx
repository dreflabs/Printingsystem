"use client";
import { useEffect, useState } from "react";
import { getJobMaterialReview, saveJobMaterialReview } from "@/actions/job-materials";
type Review = Extract<Awaited<ReturnType<typeof getJobMaterialReview>>, { success: true }>["data"];
const field = "w-full rounded-xl border border-border bg-elevated p-3 text-sm text-primary";

export function JobMaterialReview({ jobCode, onClose, onSaved }: { jobCode: string; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<Review | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let cancelled = false; getJobMaterialReview(jobCode).then(r => {
    if (cancelled) return;
    if (!r.success) { setError(r.error); return; }
    setData(r.data); setSelected(Object.fromEntries(r.data.items.filter(i => i.selected).map(i => [i.id, i.materialId])));
  }); return () => { cancelled = true; }; }, [jobCode]);
  async function save() {
    setBusy(true); setError("");
    const r = await saveJobMaterialReview(jobCode, { items: Object.entries(selected).map(([itemId, materialId]) => ({ itemId, materialId })), reason, confirmed });
    setBusy(false); if (!r.success) { setError(r.error); return; } onSaved();
  }
  return <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="job-material-title">
    <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-6 space-y-4">
      <div className="flex justify-between gap-4"><h2 id="job-material-title" className="font-bold text-lg">Item & bahan · {jobCode}</h2><button disabled={busy} onClick={onClose} className="text-sm text-muted">Tutup</button></div>
      {error && <p role="alert" className="text-sm text-status-red">{error}</p>}
      {!data && !error && <p className="text-sm text-muted">Memuat item...</p>}
      {data && <>
        <p className="text-sm text-muted">Mesin: {data.machine}. {data.scopeLocked ? "Item job sudah ditetapkan." : "Job lama: pilih item yang dikerjakan pada mesin ini."} {data.started ? "Produksi sudah dimulai; bahan tidak dapat diganti." : "Substitusi hanya untuk bahan yang sesuai produk dan mesin."}</p>
        {data.items.map(i => <div key={i.id} className="border-b border-border pb-3 space-y-2">
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={i.id in selected} disabled={data.scopeLocked || busy} onChange={e => setSelected(prev => { const next = { ...prev }; if (e.target.checked) next[i.id] = i.materialId; else delete next[i.id]; return next; })} />{i.name} · {i.quantity} pcs</label>
          <p className="text-xs text-muted">Bahan pada order: {i.originalMaterial}</p>
          {i.id in selected && <select aria-label={`Bahan ${i.name}`} className={field} disabled={data.started || busy} value={selected[i.id]} onChange={e => setSelected(p => ({ ...p, [i.id]: e.target.value }))}>
            <option value="">Pilih bahan...</option>
            {!i.options.some(o => o.id === selected[i.id]) && selected[i.id] && <option value={selected[i.id]} disabled>Bahan saat ini belum sesuai konfigurasi</option>}
            {i.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>}
          {i.id in selected && !i.options.length && <p className="text-xs text-status-yellow-text">Lengkapi bahan produk dan mesin melalui Katalog/Gudang.</p>}
        </div>)}
        <textarea className={field} aria-label="Alasan peninjauan" placeholder="Alasan dan bukti konfirmasi pelanggan (minimal 10 karakter)" value={reason} onChange={e => setReason(e.target.value)} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>Saya sudah memeriksa persetujuan pelanggan, desain, ukuran, dan harga. Perubahan ini tidak membutuhkan revisi file atau perubahan tagihan. Jika membutuhkan revisi, kembalikan ke alur revisi order/desain terlebih dahulu.</span></label>
        <button disabled={busy || !confirmed || reason.trim().length < 10 || !Object.keys(selected).length || Object.values(selected).some(v => !v)} onClick={save} className="w-full rounded-xl bg-accent-teal text-white p-3 font-bold disabled:opacity-40">{busy ? "Menyimpan..." : "Simpan peninjauan"}</button>
        {Array.isArray(data.history) && data.history.length > 0 && <p className="text-xs text-muted">{data.history.length} peninjauan tercatat dalam riwayat job dan audit.</p>}
      </>}
    </div>
  </div>;
}
