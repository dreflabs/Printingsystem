"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";

export default function PrintLabelPage() {
  const params = useParams();
  const id = params.id as string;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Auto print when loaded
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full flex justify-center bg-elevated min-h-screen pt-10 print:bg-white print:pt-0">
      {/* Tombol Print Manual (Sembunyi saat print) */}
      <button 
        onClick={() => window.print()} 
        className="fixed top-4 right-4 print:hidden flex items-center gap-2 bg-accent-teal text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-accent-teal/90"
      >
        <Printer className="h-5 w-5" /> Cetak Sekarang
      </button>

      {/* Area Stiker Thermal (Ukuran 100mm x 150mm) */}
      <div className="w-[100mm] h-[150mm] bg-white text-black p-4 border border-gray-300 print:border-none shadow-xl print:shadow-none relative">
        {/* Header Percetakan */}
        <div className="text-center border-b-2 border-black pb-2 mb-3">
          <h1 className="text-xl font-extrabold uppercase">Print Pilot</h1>
          <p className="text-[10px] font-medium">Jl. Pahlawan No. 123, Bandung - 08123456789</p>
        </div>

        {/* QR Code Placeholder (Using simple borders for mockup) */}
        <div className="flex justify-center mb-3">
          <div className="w-24 h-24 border-4 border-black p-1 flex flex-wrap gap-1 items-center justify-center relative">
            <div className="w-3 h-3 bg-black absolute top-1 left-1" />
            <div className="w-3 h-3 bg-black absolute top-1 right-1" />
            <div className="w-3 h-3 bg-black absolute bottom-1 left-1" />
            {/* Pattern */}
            <div className="w-full h-full flex flex-wrap gap-0.5">
              {[...Array(49)].map((_, i) => (
                <div key={i} className={`w-2 h-2 ${Math.random() > 0.5 ? 'bg-black' : 'bg-transparent'}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="text-center font-mono font-bold text-lg mb-4 tracking-wider">
          {id}
        </div>

        <div className="space-y-2 text-sm border-t-2 border-dashed border-black pt-3">
          <div className="flex justify-between">
            <span className="font-semibold">Pelanggan:</span>
            <span>Bpk. Anton</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Produk:</span>
            <span className="font-bold">Spanduk Outdoor</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Ukuran:</span>
            <span>3 x 1 M</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Qty:</span>
            <span className="font-bold text-lg">2 Pcs</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Finishing:</span>
            <span>Mata Ayam</span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-center border-t border-black pt-2">
          <p className="text-[10px] font-bold">Harap periksa barang sebelum diterima.</p>
          <p className="text-[8px]">Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; size: 100mm 150mm; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
