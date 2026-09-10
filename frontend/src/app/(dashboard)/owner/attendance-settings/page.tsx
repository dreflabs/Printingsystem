"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, MapPin, Camera, Shield, Save, Loader2, Crosshair, Tablet, Trash2, Copy, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { useToast } from "@/components/ui";
import {
  getAttendanceSettings,
  updateAttendanceSettings,
  setEmployeePin,
  type AttendanceSettings,
} from "@/actions/attendance-settings";
import {
  listKioskDevices,
  createKioskDevice,
  revokeKioskDevice,
  listEmployeesForKiosk,
  type KioskDeviceRow,
  type KioskPinRow,
} from "@/actions/kiosk";

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

      {s.kioskEnabled && <KioskPanel />}
    </div>
  );
}

function KioskPanel() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<KioskDeviceRow[]>([]);
  const [emps, setEmps] = useState<KioskPinRow[]>([]);
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<{ label: string; token: string } | null>(null);
  const [pinDraft, setPinDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, e] = await Promise.all([listKioskDevices(), listEmployeesForKiosk()]);
    if (d.success) setDevices(d.data);
    if (e.success) setEmps(e.data);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const addDevice = async () => {
    setBusy(true);
    const res = await createKioskDevice(label);
    setBusy(false);
    if (!res.success) {
      toast({ type: "error", title: "Gagal", message: res.error });
      return;
    }
    setNewToken({ label: res.data.label, token: res.data.token });
    setLabel("");
    await load();
  };

  const revoke = async (id: string) => {
    const res = await revokeKioskDevice(id);
    if (!res.success) {
      toast({ type: "error", title: "Gagal", message: res.error });
      return;
    }
    toast({ type: "success", title: "Perangkat dicabut" });
    await load();
  };

  const savePin = async (userId: string) => {
    const pin = (pinDraft[userId] ?? "").trim();
    const res = await setEmployeePin(userId, pin);
    if (!res.success) {
      toast({ type: "error", title: "Gagal", message: res.error });
      return;
    }
    toast({ type: "success", title: pin ? "PIN disimpan" : "PIN dihapus" });
    setPinDraft((p) => ({ ...p, [userId]: "" }));
    await load();
  };

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2"><Tablet className="h-4 w-4 text-accent-teal" /> Perangkat Kiosk</h2>
        <a href="/kiosk" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-accent-teal hover:underline">
          Buka layar kiosk ↗
        </a>
      </div>
      <p className="text-[11px] text-muted -mt-2">
        Buat perangkat → buka <b>/kiosk</b> di tablet/PC kantor → tempel token. Setiap pegawai butuh PIN (di bawah).
      </p>

      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nama perangkat, mis. Tablet Meja Depan"
          className={field}
        />
        <button
          onClick={addDevice}
          disabled={busy || label.trim().length < 2}
          className="shrink-0 px-4 h-10 rounded-xl bg-accent-teal text-white text-sm font-bold disabled:opacity-50"
        >
          Buat
        </button>
      </div>

      {newToken && (
        <div className="rounded-xl border border-status-yellow/40 bg-status-yellow/10 p-3 space-y-2">
          <p className="text-xs text-status-yellow-text font-semibold">
            Token untuk &quot;{newToken.label}&quot; — tampil sekali. Buka <b>/kiosk</b> di perangkat lalu tempel token ini.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-base border border-border rounded-lg px-2 py-1.5 break-all">{newToken.token}</code>
            <button
              onClick={async () => {
                const ok = await copyText(newToken.token);
                toast(ok
                  ? { type: "success", title: "Token disalin" }
                  : { type: "error", title: "Gagal menyalin — salin manual dari kotak di sebelah kiri" });
              }}
              className="shrink-0 h-9 px-3 rounded-lg border border-border text-xs font-bold text-muted inline-flex items-center gap-1"
            >
              <Copy className="h-3.5 w-3.5" /> Salin
            </button>
          </div>
          <button onClick={() => setNewToken(null)} className="text-xs text-muted underline">Tutup</button>
        </div>
      )}

      {devices.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <span className={cn("font-semibold", d.active ? "text-primary" : "text-muted line-through")}>{d.label}</span>
                <span className="text-[11px] text-muted ml-2">
                  {d.active ? (d.lastSeenAt ? `aktif · terakhir ${new Date(d.lastSeenAt).toLocaleString("id-ID")}` : "aktif · belum dipakai") : "dicabut"}
                </span>
              </div>
              {d.active && (
                <button onClick={() => revoke(d.id)} className="text-status-red inline-flex items-center gap-1 text-xs font-bold">
                  <Trash2 className="h-3.5 w-3.5" /> Cabut
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2">
        <h3 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-2"><KeyRound className="h-3.5 w-3.5" /> PIN Kiosk Pegawai (4–6 digit)</h3>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {emps.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-primary">{e.name}</span>
                <span className="text-[11px] text-muted ml-2">{e.roleLabel} · {e.hasPin ? "PIN aktif" : "belum ada PIN"}</span>
              </div>
              <input
                value={pinDraft[e.id] ?? ""}
                onChange={(ev) => setPinDraft((p) => ({ ...p, [e.id]: ev.target.value.replace(/\D/g, "").slice(0, 6) }))}
                inputMode="numeric"
                placeholder={e.hasPin ? "PIN baru" : "PIN"}
                className="w-24 px-2 py-1.5 bg-base border border-border rounded-lg text-sm text-primary"
              />
              <button
                onClick={() => savePin(e.id)}
                className="shrink-0 h-8 px-3 rounded-lg border border-border text-xs font-bold text-primary"
              >
                {(pinDraft[e.id] ?? "").trim() === "" && e.hasPin ? "Hapus" : "Simpan"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
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
