"use client";

import { useState } from "react";
import { ClipboardList, Wrench, Package, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleGuide } from "@/components/dashboard/RoleGuide";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AbsenCard } from "@/components/dashboard/AbsenCard";
import { QCTab } from "./QCTab";
import { FinishingTab } from "./FinishingTab";
import { StorageTab } from "./StorageTab";
import { MaterialTab } from "./MaterialTab";

type FinishingTab = "qc" | "finishing" | "storage" | "material";

const TABS: { id: FinishingTab; label: string; icon: typeof ClipboardList }[] = [
  { id: "qc", label: "QC", icon: ClipboardList },
  { id: "finishing", label: "Finishing", icon: Wrench },
  { id: "storage", label: "Storage", icon: Package },
  { id: "material", label: "Material", icon: Box },
];

export default function FinishingPage() {
  const [activeTab, setActiveTab] = useState<FinishingTab>("qc");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Gudang & Finishing"
        subtitle="Inspeksi QC, penyelesaian produk, dan pengaturan barang di rak & stok bahan baku"
      />

      <RoleGuide role="gudang" defaultCollapsed />

      <AbsenCard />

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-elevated p-1 rounded-xl border border-border w-fit overflow-x-auto">
        {TABS.map((tab) => (
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

      {activeTab === "qc" && <QCTab />}
      {activeTab === "finishing" && <FinishingTab />}
      {activeTab === "storage" && <StorageTab />}
      {activeTab === "material" && <MaterialTab />}
    </div>
  );
}
