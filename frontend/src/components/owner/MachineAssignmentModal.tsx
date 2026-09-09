"use client";

import { useState, useEffect } from "react";
import { X, Printer, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMachines } from "@/actions/master-data";
import { updateOperatorMachines } from "@/actions/user-management";

interface MachineAssignmentModalProps {
  user: {
    id: string;
    name: string;
    user_machines: { machine_id: string }[];
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function MachineAssignmentModal({ user, onClose, onSuccess }: MachineAssignmentModalProps) {
  const [machines, setMachines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>(
    user.user_machines?.map((m: any) => m.machine_id) || []
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    setIsLoading(true);
    try {
      const result = await getMachines();
      if (result.success) {
        setMachines(result.data);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat daftar mesin.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMachine = (id: string) => {
    setSelectedMachineIds(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await updateOperatorMachines(user.id, selectedMachineIds);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-elevated/50">
          <div>
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <Printer className="h-5 w-5 text-accent-teal" />
              Checklist Mesin Cetak
            </h2>
            <p className="text-xs text-muted mt-1">Operator: <span className="font-semibold text-primary">{user.name}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-base text-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex gap-2 items-start p-3 bg-status-blue/10 border border-status-blue/20 rounded-xl mb-4 text-status-blue text-sm">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Pilih mesin yang bisa diakses oleh operator ini. Antrean job produksi di dashboard mereka akan disaring hanya untuk mesin-mesin yang dicentang di sini.</p>
          </div>

          {error && (
            <div className="p-3 bg-status-red/10 border border-status-red/30 rounded-xl mb-4 text-status-red text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : machines.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm">
              Belum ada mesin yang didaftarkan.
            </div>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {machines.map((machine) => {
                const isSelected = selectedMachineIds.includes(machine.id);
                return (
                  <button
                    key={machine.id}
                    onClick={() => toggleMachine(machine.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      isSelected
                        ? "border-accent-teal/50 bg-accent-teal/5"
                        : "border-border hover:border-border/80 hover:bg-elevated/50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                        isSelected ? "bg-accent-teal border-accent-teal" : "border-muted/50"
                      )}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-primary">{machine.name}</div>
                      <div className="text-xs text-muted flex gap-2">
                        <span>{machine.machine_code}</span>
                        <span>•</span>
                        <span>{machine.category}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-elevated/50 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 font-semibold text-sm text-muted hover:text-primary transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-6 py-2 bg-accent-teal hover:bg-accent-teal/90 text-white text-sm font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {isSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</>
            ) : (
              "Simpan Checklist"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
