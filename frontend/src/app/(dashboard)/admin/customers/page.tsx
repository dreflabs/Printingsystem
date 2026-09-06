"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Users, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { getCustomers, createCustomer, updateCustomer } from "@/actions/master-data";

type Row = Extract<Awaited<ReturnType<typeof getCustomers>>, { success: true }>["data"][number];

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"Umum" | "Makloon" | "B2B">("Umum");
  const [discount, setDiscount] = useState("");

  const load = useCallback(async () => {
    const res = await getCustomers();
    if (!res.success) { setError(res.error); return; }
    setError(null);
    setRows(res.data);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? "").includes(search) || c.customer_code.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditingId(null); setName(""); setPhone(""); setType("Umum"); setDiscount(""); setError(null);
    setModalOpen(true);
  }
  function openEdit(c: Row) {
    setEditingId(c.id); setName(c.name); setPhone(c.phone ?? "");
    setType((["Umum", "Makloon", "B2B"].includes(c.type) ? c.type : "Umum") as "Umum" | "Makloon" | "B2B");
    setDiscount(c.default_discount ? String(c.default_discount) : ""); setError(null);
    setModalOpen(true);
  }

  async function save() {
    if (!name.trim()) { setError("Nama pelanggan wajib diisi."); return; }
    setBusy(true);
    const payload = { name: name.trim(), phone: phone.trim() || undefined, type, default_discount: Number(discount) || null };
    const res = editingId ? await updateCustomer(editingId, payload) : await createCustomer(payload);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setModalOpen(false);
    await load();
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Database Pelanggan</h1>
          <p className="text-sm text-muted mt-1">Kelola pelanggan Umum, Makloon, dan B2B beserta hak diskon.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-accent-teal text-white px-5 py-2.5 rounded-xl font-bold hover:brightness-110 shadow-lg shadow-accent-teal/20 transition-all">
          <Plus className="h-5 w-5" /> Tambah Pelanggan
        </button>
      </div>

      {error && !modalOpen && <div className="rounded-xl border border-status-red/30 bg-status-red/10 px-4 py-2 text-sm text-status-red">{error}</div>}

      <div className="bg-card p-4 rounded-xl border border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input
            placeholder="Cari nama / No WA / kode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-elevated border border-border rounded-lg outline-none focus:border-accent-teal text-sm"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated border-b border-border text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Kode</th>
                <th className="px-6 py-4">Nama & Kontak</th>
                <th className="px-6 py-4">Tipe</th>
                <th className="px-6 py-4">Diskon Default</th>
                <th className="px-6 py-4">Bergabung</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-primary">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-muted">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-20" /> Belum ada pelanggan yang cocok.
                </td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-accent-teal">{c.customer_code}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold">{c.name}</p>
                    <p className="text-xs text-muted">{c.phone || "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold border",
                      c.type === "Makloon" ? "bg-status-yellow/10 text-status-yellow-text border-status-yellow/30"
                        : c.type === "B2B" ? "bg-status-green/10 text-status-green border-status-green/30"
                        : "bg-muted/10 text-muted border-muted/20")}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {c.default_discount && c.default_discount > 0
                      ? <span className="font-mono font-bold text-status-red">-{rupiah(c.default_discount)}</span>
                      : <span className="text-muted">-</span>}
                  </td>
                  <td className="px-6 py-4 text-muted text-xs">{fmtDate(c.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(c)} className="p-2 bg-elevated border border-border rounded-lg text-muted hover:text-accent-teal hover:border-accent-teal transition-all">
                      <Edit className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-status-red/10 border border-status-red/30 px-3 py-2 text-xs text-status-red">{error}</div>}
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Nama Pelanggan *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Budi (Makloon A)"
              className="w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm outline-none focus:border-accent-teal" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Nomor WhatsApp</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234..."
              className="w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm outline-none focus:border-accent-teal font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Tipe Pelanggan</label>
            <div className="flex gap-2 p-1 bg-elevated rounded-xl">
              {(["Umum", "Makloon", "B2B"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all", type === t ? "bg-accent-teal text-white shadow-sm" : "text-muted hover:text-primary")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Diskon Default per Transaksi (Rp)</label>
            <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0"
              className="w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm outline-none focus:border-accent-teal font-mono" />
            <p className="text-[10px] text-muted mt-1">Otomatis memotong total tagihan saat pelanggan ini dipilih di Kasir (POS).</p>
          </div>
          <button disabled={busy} onClick={save} className="w-full h-11 mt-2 bg-accent-teal text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50">
            {busy ? "Menyimpan…" : "Simpan Pelanggan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
