"use client";

import { useState } from "react";
import { Plus, Search, Users, Trash2, Edit } from "lucide-react";
import { useWorkflowStore, Customer } from "@/store/useWorkflowStore";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

export default function AdminCustomersPage() {
  const customers = useWorkflowStore((s) => s.customers);
  const addCustomer = useWorkflowStore((s) => s.addCustomer);
  const deleteCustomer = useWorkflowStore((s) => s.deleteCustomer);
  const updateCustomer = useWorkflowStore((s) => s.updateCustomer);

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"Umum" | "Makloon" | "B2B">("Umum");
  const [discount, setDiscount] = useState("");

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setType("Umum");
    setDiscount("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setType(c.type);
    setDiscount(c.defaultDiscountRp.toString());
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name || !phone) return alert("Nama dan No WA wajib diisi!");
    
    if (editingId) {
      updateCustomer(editingId, {
        name,
        phone,
        type,
        defaultDiscountRp: Number(discount) || 0,
      });
    } else {
      addCustomer({
        id: `CUST-${Date.now().toString().slice(-6)}`,
        name,
        phone,
        type,
        defaultDiscountRp: Number(discount) || 0,
        joinDate: new Date().toISOString().split("T")[0],
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, cName: string) => {
    if (confirm(`Yakin ingin menghapus pelanggan ${cName}?`)) {
      deleteCustomer(id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Database Pelanggan</h1>
          <p className="text-sm text-muted mt-1">
            Kelola data pelanggan Umum, Makloon, dan B2B beserta hak diskon mereka.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-accent-teal text-white px-5 py-2.5 rounded-xl font-bold hover:bg-accent-teal/90 shadow-lg shadow-accent-teal/20 transition-all"
        >
          <Plus className="h-5 w-5" />
          Tambah Pelanggan
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama atau No WA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg outline-none focus:border-status-blue transition-colors text-sm"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-elevated border-b border-border text-muted uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Nama & Kontak</th>
                <th className="px-6 py-4">Tipe Pelanggan</th>
                <th className="px-6 py-4">Diskon Default</th>
                <th className="px-6 py-4">Bergabung</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-primary">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    Belum ada data pelanggan yang cocok.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-elevated/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold">{c.name}</p>
                      <p className="text-xs text-muted">{c.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-bold border",
                          c.type === "Umum" && "bg-muted/10 text-muted border-muted/20",
                          c.type === "Makloon" && "bg-status-yellow/10 text-status-yellow-text border-status-yellow/30",
                          c.type === "B2B" && "bg-status-green/10 text-status-green border-status-green/30"
                        )}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {c.defaultDiscountRp > 0 ? (
                        <span className="font-mono font-bold text-status-red">
                          -{formatRupiah(c.defaultDiscountRp)}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted text-xs">{c.joinDate}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-2 bg-background border border-border rounded-lg text-muted hover:text-accent-teal hover:border-accent-teal transition-all"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-2 bg-background border border-border rounded-lg text-muted hover:text-status-red hover:border-status-red transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">
              Nama Pelanggan (Individu / Usaha) *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm outline-none focus:border-accent-teal"
              placeholder="Contoh: Budi (Makloon A)"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">
              Nomor WhatsApp *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm outline-none focus:border-accent-teal font-mono"
              placeholder="081234..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">
              Tipe Pelanggan
            </label>
            <div className="flex gap-2 p-1 bg-elevated rounded-xl">
              {(["Umum", "Makloon", "B2B"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    type === t
                      ? "bg-accent-teal text-white shadow-sm"
                      : "text-muted hover:text-primary"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">
              Hak Diskon Default per Transaksi (Rp)
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full h-10 bg-elevated border border-border rounded-xl px-3 text-sm outline-none focus:border-accent-teal font-mono"
              placeholder="0"
            />
            <p className="text-[10px] text-muted mt-1">
              * Angka ini akan otomatis memotong total tagihan saat pelanggan ini dipilih di Kasir (POS).
            </p>
          </div>
          <button
            onClick={handleSave}
            className="w-full h-11 mt-2 bg-status-blue text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all"
          >
            Simpan Pelanggan
          </button>
        </div>
      </Modal>
    </div>
  );
}
