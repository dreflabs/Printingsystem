"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, MapPin, Camera, Shield, Save, Loader2, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui";
import {
  getAttendanceSettings,
  updateAttendanceSettings,
  type AttendanceSettings,
} from "@/actions/attendance-settings";

const DAYS = [
  { n: 1, l: "Sen" }, { n: 2, l: "Sel" }, { n: 3, l: "Rab" }, { n: 4, l: "Kam" },
  { n: 5, l: "Jum" }, { n: 6, l: "Sab" }, { n: 7, l: "Min" },
];
const MODES = [
  { v: "OFF", l: "Nonaktif" },
  { v: "FLAG", l: "Catat & tandai" },
  { v: "ENFORCE", l: "Tolak absen" },
] as const;

const field = "w-full px-3 py-2 bg-base border border-border rounded-xl focus:outline-none focus:border-accent-teal focus:ring-1 focus:ring-accent-teal text-primary text-sm";

export default function AttendanceSettingsPage() {
  const { toast } = useToast();
  const [s, setS] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await getAttendanceSettings();
    if (res.success) setS(res.data);
    else toast({ type: "error", title: "Gagal memuat", message: res.error });
    setLoading(false);
  }, [toast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof AttendanceSettings>(k: K, v: AttendanceSettings[K]) =>
    setS((p) => (p ? { ...p, [k]: v } : p));

  const toggleDay = (n: number) =>
    setS((p) => {
      if (!p) return p;
      const has = p.workdays.includes(n);
      return { ...p, workdays: has ? p.workdays.filter((x) => x !== n) : [...p.workdays, n].sort() };
    });

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("geofenceLat", Number(pos.coords.latitude.toFixed(6)));
        set("geofenceLng", Number(pos.coords.longitude.toFixed(6)));
        toast({ type: "success", title: "Lokasi terisi", message: `Akurasi ~${Math.round(pos.coords.accuracy)} m` });
      },
      () => toast({ type: "error", title: "Lokasi gagal diambil", message: "Izinkan lokasi di browser." }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const res = await updateAttendanceSettings(s);
    setSaving(false);
    if (res.success) {
      setS(res.data);
      toast({ type: "success", title: "Pengaturan absensi disimpan" });
    } else {
      toast({ type: "error", title: "Gagal menyimpan", message: res.error });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
      </div>
    );
  }
  if (!s) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-primary">Pengaturan Absensi</h1>
        <p className="text-sm text-muted mt-0.5">
          Berlaku untuk absen in-app pegawai. Import CSV fingerprint tetap tersedia sebagai cadangan.
        </p>
      </div>

      {/* Jam kerja */}
      <section className="rounded-2xl border border-border bg-card/70 p-4 space-y-4">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2"><Clock className="h-4 w-4 text-accent-teal" /> Jam Kerja</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="space-y-1 text-xs font-semibold text-muted">Jam masuk
            <input type="time" value={s.workStart} onChange={(e) => set("workStart", e.target.value)} className={field} />
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted">Batas telat
            <input type="time" value={s.lateAfter} onChange={(e) => set("lateAfter", e.target.value)} className={field} />
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted">Jam pulang
            <input type="time" value={s.workEnd} onChange={(e) => set("workEnd", e.target.value)} className={field} />
          </label>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted">Hari kerja</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d.n}
                type="button"
                onClick={() => toggleDay(d.n)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                  s.workdays.includes(d.n)
                    ? "border-accent-teal/50 bg-accent-teal/10 text-accent-teal"
                    : "border-border text-muted hover:bg-elevated"
                )}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-semibold text-muted">Batas absen paling awal (menit sebelum jam masuk)
            <input type="number" min={0} max={720} value={s.earliestClockInMin} onChange={(e) => set("earliestClockInMin", Number(e.target.value))} className={field} />
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted">Batas istirahat (menit)
            <input type="number" min={15} max={240} value={s.breakMaxMin} onChange={(e) => set("breakMaxMin", Number(e.target.value))} className={field} />
          </label>
        </div>
        <label className="space-y-1 text-xs font-semibold text-muted block max-w-[12rem]">Jam auto-tutup absen lupa pulang
          <input type="time" value={s.autoCloseAt} onChange={(e) => set("autoCloseAt", e.target.value)} className={field} />
        </label>
      </section>

      {/* Lokasi */}
      <section className="rounded-2xl border border-border bg-card/70 p-4 space-y-4">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2"><MapPin className="h-4 w-4 text-accent-teal" /> Lokasi Kantor (Geofence)</h2>
        <ModeRow label="Mode geofence" value={s.geofenceMode} onChange={(v) => set("geofenceMode", v)} />
        {s.geofenceMode !== "OFF" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-semibold text-muted">Lintang (lat)
                <input type="number" step="0.000001" value={s.geofenceLat ?? ""} onChange={(e) => set("geofenceLat", e.target.value === "" ? null : Number(e.target.value))} className={field} />
              </label>
              <label className="space-y-1 text-xs font-semibold text-muted">Bujur (lng)
                <input type="number" step="0.000001" value={s.geofenceLng ?? ""} onChange={(e) => set("geofenceLng", e.target.value === "" ? null : Number(e.target.value))} className={field} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={useMyLocation} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-teal hover:underline">
                <Crosshair className="h-3.5 w-3.5" /> Pakai lokasi saya sekarang
              </button>
              <label className="space-y-1 text-xs font-semibold text-muted">
                Radius (m)
                <input type="number" min={20} max={2000} value={s.geofenceRadiusM} onChange={(e) => set("geofenceRadiusM", Number(e.target.value))} className={cn(field, "w-28")} />
              </label>
            </div>
            <p className="text-[11px] text-muted">
              Saran: mulai dari <b>Catat &amp; tandai</b> dulu. Naikkan ke <b>Tolak absen</b> setelah yakin titik &amp; radiusnya pas
              (akurasi GPS dalam ruangan bisa 20–50 m).
            </p>
          </>
        )}
      </section>

      {/* IP kantor */}
      <section className="rounded-2xl border border-border bg-card/70 p-4 space-y-4">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2"><Shield className="h-4 w-4 text-accent-teal" /> Jaringan Kantor (IP)</h2>
        <ModeRow label="Mode IP" value={s.ipMode} onChange={(v) => set("ipMode", v)} />
        {s.ipMode !== "OFF" && (
          <label className="space-y-1 text-xs font-semibold text-muted block">Daftar IP / CIDR (pisahkan koma)
            <input value={s.ipAllowlist} onChange={(e) => set("ipAllowlist", e.target.value)} placeholder="103.10.20.30, 192.168.1.0/24" className={field} />
          </label>
        )}
      </section>

      {/* Selfie & jalur */}
      <section className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2"><Camera className="h-4 w-4 text-accent-teal" /> Selfie &amp; Jalur Absen</h2>
        <Check label="Wajib selfie tiap absen" checked={s.selfieRequired} onChange={(v) => set("selfieRequired", v)} />
        <Check label="Izinkan absen dari HP pribadi pegawai" checked={s.personalDeviceEnabled} onChange={(v) => set("personalDeviceEnabled", v)} />
        <Check label="Izinkan absen dari perangkat kiosk (tablet kantor)" checked={s.kioskEnabled} onChange={(v) => set("kioskEnabled", v)} />
        <label className="space-y-1 text-xs font-semibold text-muted block max-w-[12rem]">Simpan selfie berapa hari
          <input type="number" min={7} max={730} value={s.selfieRetentionDays} onChange={(e) => set("selfieRetentionDays", Number(e.target.value))} className={field} />
        </label>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-accent-teal text-white text-sm font-bold hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Pengaturan
        </button>
      </div>
    </div>
  );
}

function ModeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "OFF" | "FLAG" | "ENFORCE";
  onChange: (v: "OFF" | "FLAG" | "ENFORCE") => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="flex gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => onChange(m.v)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
              value === m.v ? "border-accent-teal/50 bg-accent-teal/10 text-accent-teal" : "border-border text-muted hover:bg-elevated"
            )}
          >
            {m.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-primary cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded accent-accent-teal" />
      {label}
    </label>
  );
}
