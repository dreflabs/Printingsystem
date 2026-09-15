"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, LayoutDashboard, ArrowRight } from "lucide-react";
import { WorkQueue } from "@/components/dashboard/WorkQueue";
import { getSessionUser } from "@/actions/session";

/**
 * Beranda mode Solo — Antrean Kerja jadi layar utama: satu daftar semua order
 * aktif dikelompokkan per tahap, tiap baris menunjuk aksi berikutnya.
 * Menggantikan kebiasaan pindah-pindah dashboard peran. Panel keputusan Owner
 * yang lebih lengkap (diskon, rework, audit, anomali) tetap di Dashboard Owner.
 *
 * Absensi mandiri Owner menyusul sebagai opsi terpisah (rencana Tahap 6).
 */
export default function BerandaPage() {
  const [name, setName] = useState<string>("");

  useEffect(() => {
    getSessionUser().then((r) => {
      if (r.ok) setName(r.user.name);
    });
  }, []);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Home className="h-6 w-6 text-accent-teal" />
            {name ? `Halo, ${name.split(" ")[0]}` : "Beranda"}
          </h1>
          <p className="text-sm text-muted mt-0.5">Semua yang menunggu tindakan Anda hari ini.</p>
        </div>
        <Link
          href="/owner"
          className="inline-flex items-center gap-1 shrink-0 text-xs font-bold text-accent-teal hover:underline"
        >
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard lengkap <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <WorkQueue />
    </div>
  );
}
