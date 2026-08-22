"use client";

import { useState } from "react";
import { Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PINModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function PINModal({ open, onClose, onSuccess, title = "Otorisasi Supervisor", description = "Masukkan PIN Supervisor untuk melanjutkan tindakan ini." }: PINModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === "123456") {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setPin("");
        onSuccess();
      }, 500);
    } else {
      setError("PIN tidak valid. Silakan coba lagi.");
      setPin("");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-status-orange/30 rounded-2xl p-6 shadow-[0_8px_48px_rgba(0,0,0,0.6)]">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted hover:text-primary transition-colors cursor-pointer">
          <X className="h-5 w-5" />
        </button>
        
        <div className="flex flex-col items-center text-center mb-6 mt-2">
          <div className="h-12 w-12 bg-status-orange/10 rounded-full flex items-center justify-center mb-3">
            <Lock className="h-6 w-6 text-status-orange" />
          </div>
          <h3 className="text-lg font-bold text-primary">{title}</h3>
          <p className="text-sm text-muted mt-1">{description}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setError("");
            }}
            placeholder="••••••"
            className={cn(
              "w-full h-14 rounded-xl bg-elevated border text-center text-2xl tracking-[0.5em] font-mono outline-none focus:ring-2 transition-all",
              error ? "border-status-red focus:ring-status-red/20 text-status-red" : "border-border text-primary focus:border-status-orange focus:ring-status-orange/20"
            )}
          />
          {error && <p className="text-xs text-status-red text-center mt-2">{error}</p>}
          
          <button
            type="submit"
            disabled={pin.length < 4 || isLoading}
            className="w-full h-12 mt-5 rounded-xl bg-gradient-to-r from-status-orange to-red-500 text-white text-sm font-bold shadow-lg shadow-status-orange/20 hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
          >
            {isLoading ? "Memverifikasi..." : "Konfirmasi Otorisasi"}
          </button>
        </form>
      </div>
    </div>
  );
}
