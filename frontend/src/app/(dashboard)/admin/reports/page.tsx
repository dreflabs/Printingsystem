"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, PackageX, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const revenueData = [
  { name: 'Sen', cetak: 4000000, retail: 2400000 },
  { name: 'Sel', cetak: 3000000, retail: 1398000 },
  { name: 'Rab', cetak: 2000000, retail: 9800000 },
  { name: 'Kam', cetak: 2780000, retail: 3908000 },
  { name: 'Jum', cetak: 1890000, retail: 4800000 },
  { name: 'Sab', cetak: 2390000, retail: 3800000 },
  { name: 'Min', cetak: 3490000, retail: 4300000 },
];

const operatorData = [
  { name: 'Andi (OUT)', waste: 4, jobs: 12 },
  { name: 'Budi (IND)', waste: 1, jobs: 15 },
  { name: 'Citra (A3)', waste: 7, jobs: 40 },
  { name: 'Dodi (UV)', waste: 2, jobs: 8 },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState("minggu");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Analytics & Laporan</h1>
          <p className="text-sm text-muted mt-0.5">Ringkasan performa bisnis Anda</p>
        </div>
        <select 
          value={period} 
          onChange={e => setPeriod(e.target.value)}
          className="h-10 rounded-xl bg-elevated border border-border text-sm text-primary px-4 outline-none focus:border-accent-teal"
        >
          <option value="hari">Hari Ini</option>
          <option value="minggu">7 Hari Terakhir</option>
          <option value="bulan">Bulan Ini</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Pendapatan", value: "Rp 32.5M", change: "+12.5%", isUp: true, icon: DollarSign, color: "text-status-green", bg: "bg-status-green/10" },
          { label: "Pesanan Selesai", value: "482", change: "+5.2%", isUp: true, icon: Activity, color: "text-accent-teal", bg: "bg-accent-teal/10" },
          { label: "Total Waste (Cacat)", value: "14", change: "-2.1%", isUp: false, icon: PackageX, color: "text-status-red", bg: "bg-status-red/10" },
          { label: "Rata-rata Waktu", value: "2.4 Jam", change: "-10%", isUp: false, icon: TrendingDown, color: "text-status-blue", bg: "bg-status-blue/10" },
        ].map((kpi, i) => (
          <div key={i} className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-2 rounded-xl", kpi.bg)}>
                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
              </div>
              <div className={cn("flex items-center gap-1 text-xs font-bold", kpi.isUp ? "text-status-green" : "text-status-red")}>
                {kpi.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {kpi.change}
              </div>
            </div>
            <p className="text-3xl font-bold text-primary mb-1">{kpi.value}</p>
            <p className="text-xs text-muted font-medium">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <h3 className="text-base font-bold text-primary mb-6">Trend Pendapatan</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000000}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#F8FAFC' }}
                  itemStyle={{ color: '#F8FAFC' }}
                />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="cetak" name="Cetak (Printing)" stroke="#0EA5E9" strokeWidth={3} dot={{ r: 4, fill: '#0EA5E9', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="retail" name="Eceran (Retail)" stroke="#7C3AED" strokeWidth={3} dot={{ r: 4, fill: '#7C3AED', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operator Waste Chart */}
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          <h3 className="text-base font-bold text-primary mb-6">Performa Operator (Waste)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operatorData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#334155', opacity: 0.4}}
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="waste" name="Jumlah Waste" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
