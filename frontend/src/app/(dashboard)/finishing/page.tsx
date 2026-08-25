"use client";

import { useState } from "react";
import { ClipboardList, Wrench, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { QCTab } from "./QCTab";
import { FinishingTab } from "./FinishingTab";

type FinishingTab = "qc" | "finishing";

const TABS: { id: FinishingTab; label: string; icon: typeof ClipboardList }[] = [
  { id: "qc", label: "QC", icon: ClipboardList },
  { id: "finishing", label: "Finishing", icon: Wrench },
];

export default function FinishingPage() {
  const [activeTab, setActiveTab] = useState<FinishingTab>("qc");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard Finishing</h1>
        <p className="text-sm text-muted mt-0.5">QC dan Finishing — tahap akhir produksi sebelum diserahkan ke pelanggan</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-elevated p-1 rounded-xl border border-border w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === tab.id ? "bg-accent-teal text-white shadow-sm" : "text-muted hover:text-primary"
            )}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "qc" && <QCTab />}
      {activeTab === "finishing" && <FinishingTab />}
    </div>
  );
}
