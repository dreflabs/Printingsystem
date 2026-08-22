import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Textarea,
  Select,
  StatusPill,
} from "@/components/ui";
import { Printer, Search, Plus, Download } from "lucide-react";

export default function DesignSystemPage() {
  const statuses = [
    "DRAFT",
    "DESIGNING",
    "WAITING_APPROVAL",
    "APPROVED",
    "WAITING_PAYMENT",
    "CONFIRMED",
    "PRODUCTION_STARTED",
    "QC_PENDING",
    "QC_PASSED",
    "QC_FAILED",
    "QC_REWORK_PENDING",
    "FINISHING_STARTED",
    "READY_FOR_PICKUP",
    "PICKED_UP",
    "OVERDUE",
    "ON_HOLD",
    "CANCELLED",
    "INCIDENT",
    "CLOSED",
  ] as const;

  return (
    <main className="min-h-screen bg-base p-8">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-teal to-blue-500">
            <Printer className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-primary">PrintFlow</h1>
            <p className="text-sm text-muted">Design System Preview — Sprint 1</p>
          </div>
        </div>

        {/* Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Tombol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-center">
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>Order Baru</Button>
              <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />}>Export</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="danger">Batalkan</Button>
              <Button variant="ghost">Lihat Detail</Button>
            </div>
            <div className="flex flex-wrap gap-4 items-center mt-4">
              <Button size="sm">Kecil</Button>
              <Button size="md">Sedang</Button>
              <Button size="lg">Besar</Button>
              <Button isLoading>Loading...</Button>
              <Button disabled>Tidak Aktif</Button>
            </div>
          </CardContent>
        </Card>

        {/* Form Fields */}
        <Card>
          <CardHeader>
            <CardTitle>Form Fields</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nama Konsumen" placeholder="Masukkan nama..." />
            <Input
              label="Nomor Telepon"
              placeholder="08xx..."
              leftAddon={<Search className="h-4 w-4" />}
            />
            <Input
              label="Email"
              placeholder="email@contoh.com"
              error="Email tidak valid"
            />
            <Select
              label="Produk"
              placeholder="Pilih produk..."
              options={[
                { label: "Banner Indoor", value: "banner-indoor" },
                { label: "Stiker Cutting", value: "stiker-cutting" },
                { label: "Kartu Nama", value: "kartu-nama" },
              ]}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Catatan"
                placeholder="Catatan tambahan untuk order..."
                hint="Isi jika ada instruksi khusus dari konsumen."
              />
            </div>
          </CardContent>
        </Card>

        {/* Status Pills */}
        <Card>
          <CardHeader>
            <CardTitle>Status Pills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                // @ts-ignore — using const array
                <StatusPill key={s} status={s} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Card Biasa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">Ini adalah card standar dengan glassmorphism.</p>
            </CardContent>
          </Card>
          <Card glow>
            <CardHeader>
              <CardTitle>Card dengan Glow ✨</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">Card ini menunjukkan status aktif dengan border teal.</p>
            </CardContent>
          </Card>
        </div>

        {/* KPI Numbers Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Contoh KPI Widget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Total Order Hari Ini", value: "47", color: "text-accent-teal" },
                { label: "Siap Diambil", value: "12", color: "text-status-green" },
                { label: "Overdue", value: "3", color: "text-status-red" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-elevated rounded-xl p-4 text-center">
                  <p className={`text-4xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted mt-1">{kpi.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
