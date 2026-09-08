"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, MapPin, Camera, Coffee, LogIn, LogOut, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui";
import {
  getMyAttendanceToday,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  type AttendanceToday,
} from "@/actions/clock";

const BREAK_MAX_MIN = 60;

function hhmm(d: Date | string | null): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Ambil posisi GPS; jangan pernah throw — kembalikan null kalau gagal / ditolak. */
function getPosition(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  });
}

export function AbsenCard() {
  const { toast } = useToast();
  const [data, setData] = useState<AttendanceToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Kamera selfie
  const [camFor, setCamFor] = useState<null | "IN" | "OUT">(null);
  const [camReady, setCamReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const load = useCallback(async () => {
    const res = await getMyAttendanceToday();
    if (res.success) setData(res.data);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Tik untuk hitung-mundur istirahat
  useEffect(() => {
    if (!data?.onBreak) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [data?.onBreak]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamReady(false);
    setCamFor(null);
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  const openCamera = useCallback(async (dir: "IN" | "OUT") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamFor(dir);
      // video element muncul setelah render berikutnya
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
          setCamReady(true);
        }
      }, 50);
    } catch {
      toast({ type: "error", title: "Kamera tidak bisa diakses", message: "Izinkan kamera di browser lalu coba lagi." });
    }
  }, [toast]);

  /** Tangkap frame → WebP ≤320px → dataURL. */
  const grabSelfie = useCallback((): string | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const size = Math.min(320, side);
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const sx = (v.videoWidth - side) / 2;
    const sy = (v.videoHeight - side) / 2;
    ctx.drawImage(v, sx, sy, side, side, 0, 0, size, size);
    return c.toDataURL("image/webp", 0.7);
  }, []);

  const doPunch = useCallback(
    async (dir: "IN" | "OUT", selfie: string | null) => {
      setBusy(true);
      try {
        const pos = await getPosition();
        if (!pos && data?.settings.geofenceMode === "ENFORCE") {
          toast({ type: "error", title: "Lokasi wajib", message: "Aktifkan izin lokasi untuk absen." });
          return;
        }
        const payload = { lat: pos?.lat, lng: pos?.lng, accuracyM: pos?.accuracyM, selfie };
        if (dir === "IN") {
          const res = await clockIn(payload);
          if (!res.success) {
            toast({ type: "error", title: "Gagal absen masuk", message: res.error });
            return;
          }
          const late = res.data.status === "LATE";
          toast({
            type: late ? "warning" : "success",
            title: late ? `Absen masuk — terlambat ${res.data.lateMinutes} menit` : "Absen masuk tercatat",
            message: res.data.geoFlag ? "Lokasi di luar area kantor — ditandai untuk Owner." : undefined,
          });
        } else {
          const res = await clockOut(payload);
          if (!res.success) {
            toast({ type: "error", title: "Gagal absen pulang", message: res.error });
            return;
          }
          toast({ type: "success", title: "Absen pulang tercatat", message: "Terima kasih, hati-hati di jalan." });
        }
        await load();
      } finally {
        setBusy(false);
      }
    },
    [data?.settings.geofenceMode, load, toast]
  );

  const handleAbsen = useCallback(
    async (dir: "IN" | "OUT") => {
      if (!data) return;
      if (data.settings.selfieRequired) {
        await openCamera(dir);
        return;
      }
      await doPunch(dir, null);
    },
    [data, openCamera, doPunch]
  );

  const confirmSelfie = useCallback(async () => {
    const shot = grabSelfie();
    const dir = camFor;
    stopCam();
    if (!dir) return;
    if (!shot) {
      toast({ type: "error", title: "Foto gagal diambil", message: "Coba lagi." });
      return;
    }
    await doPunch(dir, shot);
  }, [camFor, grabSelfie, stopCam, doPunch, toast]);

  const handleBreak = useCallback(
    async (action: "start" | "end") => {
      setBusy(true);
      try {
        const res = action === "start" ? await startBreak() : await endBreak();
        if (!res.success) {
          toast({ type: "error", title: "Gagal", message: res.error });
          return;
        }
        if (action === "end" && "status" in res.data && res.data.status === "EXCEEDED") {
          toast({ type: "warning", title: "Istirahat berlebih", message: `Tercatat ${res.data.durationMin} menit.` });
        } else {
          toast({ type: "success", title: action === "start" ? "Istirahat dimulai" : "Istirahat selesai" });
        }
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load, toast]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/70 p-4 flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat absensi…
      </div>
    );
  }
  if (!data) return null;

  // Toko kiosk-only: kartu ini jadi baca-saja (semua aksi lewat perangkat kiosk).
  if (!data.settings.personalDeviceEnabled) {
    return (
      <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm">
        <p className="font-bold text-primary flex items-center gap-2"><Clock className="h-4 w-4 text-accent-teal" /> Absensi Hari Ini</p>
        <div className="mt-2 space-y-1 text-muted">
          <p>Masuk: <span className="font-semibold text-primary">{hhmm(data.checkIn)}</span>
            {data.checkedIn && (data.checkInStatus === "LATE" ? <span className="text-status-yellow-text"> · telat {data.lateMinutes}m</span> : <span className="text-status-green"> · tepat waktu</span>)}
          </p>
          {data.checkedOut && <p>Pulang: <span className="font-semibold text-primary">{hhmm(data.checkOut)}</span></p>}
        </div>
        <p className="mt-2 text-[11px] text-muted">Absen dari HP pribadi dinonaktifkan — gunakan perangkat kiosk di kantor.</p>
      </div>
    );
  }

  const breakElapsed = data.break.breakStart
    ? Math.floor((now - new Date(data.break.breakStart).getTime()) / 60000)
    : 0;
  const breakRemaining = Math.max(0, BREAK_MAX_MIN - breakElapsed);

  return (
    <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-elevated/40 flex items-center gap-2">
        <Clock className="h-4 w-4 text-accent-teal" />
        <span className="text-sm font-bold text-primary">Absensi Hari Ini</span>
      </div>

      <div className="p-4 space-y-3">
        {!data.checkedIn ? (
          <>
            <p className="text-sm text-muted">Anda belum absen masuk.</p>
            <button
              onClick={() => handleAbsen("IN")}
              disabled={busy}
              className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Absen Masuk
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Masuk</span>
              <span className="font-bold text-primary">
                {hhmm(data.checkIn)}{" "}
                {data.checkInStatus === "LATE" ? (
                  <span className="text-status-yellow-text">· telat {data.lateMinutes}m</span>
                ) : (
                  <span className="text-status-green">· tepat waktu</span>
                )}
              </span>
            </div>

            {data.checkedOut ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Pulang</span>
                <span className="font-bold text-primary">
                  {hhmm(data.checkOut)}
                  {data.checkOutStatus === "EARLY" && <span className="text-status-yellow-text"> · pulang cepat</span>}
                  {data.checkOutStatus === "AUTO_CLOSED" && <span className="text-status-red"> · ditutup sistem</span>}
                </span>
              </div>
            ) : (
              <>
                {/* Istirahat */}
                {data.onBreak ? (
                  <div className="rounded-xl border border-status-yellow/30 bg-status-yellow/10 p-3 space-y-2">
                    <p className="text-xs text-status-yellow-text font-semibold flex items-center gap-1.5">
                      <Coffee className="h-3.5 w-3.5" /> Istirahat berjalan — {breakElapsed} menit
                      {breakRemaining > 0 ? ` · sisa ${breakRemaining} menit` : " · sudah lewat 1 jam"}
                    </p>
                    <button
                      onClick={() => handleBreak("end")}
                      disabled={busy}
                      className="w-full h-9 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"
                    >
                      Selesai Istirahat
                    </button>
                  </div>
                ) : data.breakDoneToday ? (
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <Coffee className="h-3.5 w-3.5" /> Jatah istirahat hari ini sudah dipakai
                    {data.break.breakDurationMin > 0 && ` (${data.break.breakDurationMin} menit)`}.
                  </p>
                ) : (
                  <button
                    onClick={() => handleBreak("start")}
                    disabled={busy}
                    className="w-full h-9 rounded-lg border border-border text-xs font-bold text-primary hover:bg-elevated inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Coffee className="h-3.5 w-3.5" /> Mulai Istirahat
                  </button>
                )}

                <button
                  onClick={() => handleAbsen("OUT")}
                  disabled={busy || data.onBreak}
                  className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Absen Pulang
                </button>
              </>
            )}
          </>
        )}

        <p className="text-[11px] text-muted flex items-center gap-1.5 pt-0.5">
          <MapPin className="h-3 w-3" />
          {data.settings.selfieRequired ? "Absen memakai lokasi + foto selfie." : "Absen memakai lokasi."} Waktu dari server, tidak bisa diubah.
        </p>
      </div>

      {/* Modal kamera selfie */}
      {camFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-xs rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-bold text-primary flex items-center gap-2">
                <Camera className="h-4 w-4" /> Selfie {camFor === "IN" ? "Absen Masuk" : "Absen Pulang"}
              </span>
              <button onClick={stopCam} className="p-1 rounded-full hover:bg-elevated text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover -scale-x-100" />
              </div>
              <button
                onClick={confirmSelfie}
                disabled={!camReady || busy}
                className="w-full h-11 rounded-xl bg-accent-teal text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Ambil Foto &amp; Absen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
