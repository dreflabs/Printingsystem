import { BarChart2, TrendingUp, Users, Package, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui";

export default function SupervisorPage() {
  const kpis = [
    { label: "Total Produksi (Hari Ini)", value: "142 Job", color: "text-accent-teal", icon: Package },
    { label: "Target Selesai", value: "85%", color: "text-status-green", icon: TrendingUp },
    { label: "Tingkat Waste", value: "4.5%", color: "text-status-orange", icon: AlertTriangle },
    { label: "Operator Aktif", value: "8 Orang", color: "text-status-blue", icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard Supervisor</h1>
        <p className="text-sm text-muted mt-0.5">Pemantauan kinerja produksi dan operator</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="hover:border-accent-teal/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-elevated`}>
                  <k.icon className={`h-5 w-5 ${k.color}`} />
                </div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">{k.label}</p>
              </div>
              <p className={`text-4xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center h-64 bg-card/70 backdrop-blur-xl border border-border border-dashed rounded-2xl">
        <div className="text-center">
          <BarChart2 className="h-12 w-12 text-muted mx-auto mb-3" />
          <p className="text-muted">Grafik & Laporan Lengkap (Sprint Berikutnya)</p>
        </div>
      </div>
    </div>
  );
}
