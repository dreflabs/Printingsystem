import { Crown, DollarSign, TrendingUp, Users, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui";

export default function OwnerPage() {
  const kpis = [
    { label: "Omset Bulan Ini", value: "Rp 124.5M", color: "text-accent-teal", icon: DollarSign },
    { label: "Total Order (Bulan Ini)", value: "3,450", color: "text-status-green", icon: ShoppingBag },
    { label: "Pelanggan Baru", value: "+124", color: "text-status-blue", icon: Users },
    { label: "Pertumbuhan Omset", value: "+15.2%", color: "text-status-orange", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Dashboard Owner</h1>
        <p className="text-sm text-muted mt-0.5">Ringkasan bisnis dan finansial</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="hover:border-accent-purple/30 transition-colors">
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
          <Crown className="h-12 w-12 text-accent-purple mx-auto mb-3" />
          <p className="text-muted">Analitik Lanjutan & Arus Kas (Sprint Berikutnya)</p>
        </div>
      </div>
    </div>
  );
}
