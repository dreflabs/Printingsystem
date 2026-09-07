"use client";

import { Scanner, type IScannerError } from "@yudiel/react-qr-scanner";
import { Camera, X, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";

const CAMERA_ERR: Record<string, string> = {
  "permission-denied": "Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser.",
  "no-camera": "Tidak ada kamera terdeteksi di perangkat ini.",
  "in-use": "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.",
  "insecure-context": "Scan kamera butuh HTTPS — halaman ini dibuka lewat http://.",
  "overconstrained": "Kamera belakang tidak tersedia. Coba lagi.",
  unsupported: "Browser ini tidak mendukung pemindaian kamera. Pakai Chrome/Safari terbaru.",
};

interface QRScannerProps {
  onScan: (text: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [secure, setSecure] = useState(true);

  useEffect(() => {
    // getUserMedia diblokir browser di origin non-HTTPS (kecuali localhost).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecure(window.isSecureContext);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-elevated border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-accent-teal" />
            <h3 className="font-semibold text-primary">Scan QR Code</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-base rounded-full hover:bg-border transition-colors text-muted hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="relative aspect-square w-full bg-black flex items-center justify-center">
          {!secure ? (
            <div className="text-center p-6">
              <ShieldAlert className="h-8 w-8 text-status-yellow-text mx-auto mb-3" />
              <p className="text-status-yellow-text text-sm font-semibold mb-2">Scan kamera butuh HTTPS</p>
              <p className="text-xs text-muted leading-relaxed">
                Halaman ini dibuka lewat <span className="font-mono">http://</span>. Browser memblokir akses
                kamera di koneksi tidak aman. Minta admin mengaktifkan HTTPS, atau pakai mode
                <b> Hardware Scanner</b> / ketik kode manual.
              </p>
            </div>
          ) : error ? (
            <div className="text-center p-6">
              <p className="text-status-red text-sm font-medium mb-2">Gagal mengakses kamera</p>
              <p className="text-xs text-muted">{error}</p>
              <p className="text-[11px] text-muted mt-3">Pastikan izin kamera diberikan, dan tidak ada aplikasi lain yang memakai kamera.</p>
            </div>
          ) : (
            <Scanner
              onScan={(result) => {
                if (result && result.length > 0) onScan(result[0].rawValue);
              }}
              onError={(err: IScannerError) =>
                setError(CAMERA_ERR[err?.kind] ?? err?.message ?? "Kamera tidak tersedia")
              }
              constraints={{ facingMode: "environment" }}
              formats={["qr_code"]}
              allowMultiple={false}
              scanDelay={500}
              components={{ finder: false, torch: true }}
              styles={{ container: { width: "100%", height: "100%" }, video: { objectFit: "cover" } }}
            />
          )}

          {/* Scanning Reticle */}
          {secure && !error && (
            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
              <div className="w-full h-full border-2 border-accent-teal rounded-xl relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-accent-teal to-transparent opacity-50" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-accent-teal to-transparent opacity-50" />
                <div className="absolute left-0 right-0 h-[2px] bg-accent-teal shadow-[0_0_10px_#0492B2] animate-[qrscan_2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-elevated text-center border-t border-border">
          <p className="text-xs text-muted font-medium">Arahkan kamera ke QR Code pada SPK atau Label Barang</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes qrscan {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}} />
    </div>
  );
}
