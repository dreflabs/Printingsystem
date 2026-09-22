"use client";

import { useState, useEffect } from "react";
import { ClipboardList, Wrench, Package, Box, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleGuide } from "@/components/dashboard/RoleGuide";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AbsenCard } from "@/components/dashboard/AbsenCard";
import { OperationalAlertStrip } from "@/components/dashboard/OperationalAlertStrip";
import { getSessionUser } from "@/actions/session";
import { QCTab } from "./QCTab";
import { FinishingTab } from "./FinishingTab";
import { StorageTab } from "./StorageTab";
import { MaterialTab } from "./MaterialTab";
import { PurchaseOrderTab } from "./PurchaseOrderTab";

type FinishingTab = "qc" | "finishing" | "storage" | "material" | "purchase";

const TABS: { id: FinishingTab; label: string; icon: typeof ClipboardList }[] = [
  { id: "qc", label: "QC", icon: ClipboardList },
  { id: "finishing", label: "Finishing", icon: Wrench },
  { id: "storage", label: "Storage", icon: Package },
  { id: "material", label: "Material", icon: Box },
  { id: "purchase", label: "Pembelian", icon: ShoppingCart },
];

/**
 * Tab qc/finishing/storage hanya bisa DISELESAIKAN oleh gudang/admin/owner di
 * server (submitQC/startFinishing/finishFinishing/assignStorageLocation). Route
 * `/finishing` sengaja tetap dibuka untuk operator (cek stok bahan di Material),
 * tapi tanpa gate ini operator bisa mengisi form QC/Finishing penuh dulu baru
 * ditolak server — dead-end yang membingungkan.
 */
const OPERATOR_ALLOWED_TABS: FinishingTab[] = ["material"];

export default function FinishingPage() {
  const [activeTab, setActiveTab] = useState<FinishingTab>("qc");

  // Seed tab dari ?tab= (deep-link dari Dashboard Owner: qc/finishing/storage/material).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    const allowed: FinishingTab[] = ["qc", "finishing", "storage", "material", "purchase"];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && (allowed as string[]).includes(t)) setActiveTab(t as FinishingTab);
  }, []);

  const [isOperatorOnly, setIsOperatorOnly] = useState(false);

  useEffect(() => {
    getSessionUser().then((r) => {
      if (r.ok && r.user.role === "operator") {
        setIsOperatorOnly(true);
        setActiveTab("material");
      }
    });
  }, []);

  // Operator hanya boleh membuka tab "material". Kalau deep-link (atau perubahan
  // peran) meninggalkan tab yang tidak diizinkan, isi halaman jadi kosong —
  // paksa kembali ke tab yang tersedia.
  useEffect(() => {
    if (isOperatorOnly && !OPERATOR_ALLOWED_TABS.includes(activeTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(OPERATOR_ALLOWED_TABS[0]);
    }
  }, [isOperatorOnly, activeTab]);

  useEffect(() => {
    const syncTab = () => {
      const hash = window.location.hash.replace("#", "");
      if (["qc", "finishing", "storage", "material", "purchase"].includes(hash)) setActiveTab(hash as FinishingTab);
    };
    syncTab();
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);

  const visibleTabs = isOperatorOnly ? TABS.filter((t) => OPERATOR_ALLOWED_TABS.includes(t.id)) : TABS;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Gudang & Finishing"
        subtitle="Inspeksi QC, penyelesaian produk, dan pengaturan barang di rak & stok bahan baku"
      />

      <RoleGuide role="gudang" defaultCollapsed />

      <AbsenCard />
      <OperationalAlertStrip />

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-elevated p-1 rounded-xl border border-border w-fit overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
              activeTab === tab.id ? "bg-accent-teal text-white shadow-sm" : "text-muted hover:text-primary"
            )}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "qc" && !isOperatorOnly && <QCTab />}
      {activeTab === "finishing" && !isOperatorOnly && <FinishingTab />}
      {activeTab === "storage" && !isOperatorOnly && <StorageTab />}
      {activeTab === "material" && <MaterialTab />}
      {activeTab === "purchase" && !isOperatorOnly && <PurchaseOrderTab />}
    </div>
  );
}
