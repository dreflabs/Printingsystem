"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Camera, Delete, LogIn, LogOut, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  roleLabel: string;
  checkedIn: boolean;
  checkedOut: boolean;
  onBreak: boolean;
}
interface Roster {
  device: { label: string };
  tenantName: string;
  selfieRequired: boolean;
  kioskEnabled: boolean;
  employees: Employee[];
}
type Phase = "loading" | "activate" | "grid" | "pinpad" | "camera" | "done";

function getPosition(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

export default function KioskPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [busy, setBusy] = useState(false);

  const [target, setTarget] = useState<{ emp: Employee; direction: "IN" | "OUT" } | null>(null);
  const [pin, setPin] = useState("");
  const [doneMsg, setDoneMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadRoster = useCallback(async () => {
    const res = await fetch("/api/kiosk/roster", { cache: "no-store" });
    if (res.status === 401) {
      setPhase("activate");
      return;
    }
    const j = await res.json();
    if (j.ok) {
      setRoster(j);
      setPhase("grid");
    } else {
      setErr(j.error ?? "Gagal memuat.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoster();
  }, [loadRoster]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => () => stopCam(), [stopCam]);

  const activate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/kiosk/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Aktivasi gagal.");
        return;
      }
      setTokenInput("");
      await loadRoster();
    } finally {
      setBusy(false);
    }
  };

  const pickEmployee = (emp: Employee) => {
    if (emp.checkedIn && emp.checkedOut) return;
    if (emp.onBreak) {
      setErr(`${emp.name} sedang istirahat — selesaikan istirahat lewat dashboard sebelum absen pulang.`);
      return;
    }
    setErr(null);
    setTarget({ emp, direction: emp.checkedIn ? "OUT" : "IN" });
    setPin("");
    setPhase("pinpad");
  };

  const submitPin = async () => {
    if (pin.length < 4) return;
    if (roster?.selfieRequired) {
      setPhase("camera");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        streamRef.current = stream;
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
        }, 50);
      } catch {
        setErr("Kamera tidak bisa diakses. Aktifkan izin kamera di browser.");
        setPhase("pinpad");
      }
      return;
    }
    await doPunch(null);
  };

  const captureAndPunch = async () => {
    const v = videoRef.current;
    let selfie: string | null = null;
    if (v && v.videoWidth) {
      const side = Math.min(v.videoWidth, v.videoHeight);
      const size = Math.min(320, side);
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, size, size);
        selfie = c.toDataURL("image/webp", 0.7);
      }
    }
    stopCam();
    await doPunch(selfie);
  };

  const doPunch = async (selfie: string | null) => {
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      const pos = await getPosition();
      const res = await fetch("/api/kiosk/punch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: target.emp.id,
          pin,
          direction: target.direction,
          lat: pos?.lat,
          lng: pos?.lng,
          accuracyM: pos?.accuracyM,
          selfie,
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Gagal.");
        setPhase("pinpad");
        return;
      }
      const late = j.status === "LATE";
      setDoneMsg({
        ok: true,
        text:
          target.direction === "IN"
            ? `${j.name} — absen masuk${late ? ` (terlambat ${j.lateMinutes} menit)` : " tepat waktu"}`
            : `${j.name} — absen pulang${j.status === "EARLY" ? " (pulang cepat)" : ""}`,
      });
      setPin("");
      setTarget(null);
      setPhase("done");
      setTimeout(async () => {
        setDoneMsg(null);
        await loadRoster();
      }, 2500);
    } finally {
      setBusy(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <Screen>
        <Loader2 className="h-8 w-8 animate-spin text-accent-teal" />
      </Screen>
    );
  }

  if (phase === "activate") {
    return (
      <Screen>
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-primary text-center">Aktifkan Perangkat Kiosk</h1>
          <p className="text-sm text-muted text-center">
            Minta Owner membuat perangkat kiosk di <b>Pengaturan Absensi</b> lalu tempel token-nya di sini.
          </p>
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Token perangkat"
            className="w-full px-3 py-3 bg-base border border-border rounded-xl text-primary text-sm font-mono"
          />
          {err && <p className="text-sm text-status-red text-center">{err}</p>}
          <button
            onClick={activate}
            disabled={busy || tokenInput.trim().length < 8}
            className="w-full h-12 rounded-xl bg-accent-teal text-white font-bold disabled:opacity-50"
          >
            {busy ? "Mengaktifkan…" : "Aktifkan"}
          </button>
        </div>
      </Screen>
    );
  }

  if (phase === "done" && doneMsg) {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-3">
          {doneMsg.ok ? (
            <CheckCircle2 className="h-16 w-16 text-status-green" />
          ) : (
            <XCircle className="h-16 w-16 text-status-red" />
          )}
          <p className="text-lg font-bold text-primary text-center">{doneMsg.text}</p>
        </div>
      </Screen>
    );
  }

  if (phase === "camera") {
    return (
      <Screen>
        <div className="w-full max-w-sm space-y-4">
          <p className="text-center text-sm font-semibold text-primary">
            Selfie {target?.direction === "IN" ? "Absen Masuk" : "Absen Pulang"} — {target?.emp.name}
          </p>
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover -scale-x-100" />
          </div>
          {err && <p className="text-sm text-status-red text-center">{err}</p>}
          <button
            onClick={captureAndPunch}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-accent-teal text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            Ambil Foto &amp; Absen
          </button>
          <button
            onClick={() => {
              stopCam();
              setPhase("grid");
              setTarget(null);
            }}
            className="w-full h-10 rounded-xl border border-border text-muted font-semibold"
          >
            Batal
          </button>
        </div>
      </Screen>
    );
  }

  if (phase === "pinpad" && target) {
    return (
      <Screen>
        <div className="w-full max-w-xs space-y-5">
          <div className="text-center">
            <p className="text-lg font-bold text-primary">{target.emp.name}</p>
            <p className="text-sm text-muted inline-flex items-center gap-1.5 mt-1">
              {target.direction === "IN" ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
              {target.direction === "IN" ? "Absen Masuk" : "Absen Pulang"} — masukkan PIN
            </p>
          </div>
          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${i < pin.length ? "bg-accent-teal" : "bg-border"}`}
              />
            ))}
          </div>
          {err && <p className="text-sm text-status-red text-center">{err}</p>}
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
              <button
                key={n}
                onClick={() => setPin((p) => (p.length < 6 ? p + n : p))}
                className="h-16 rounded-xl bg-elevated border border-border text-2xl font-bold text-primary active:bg-accent-teal/10"
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => {
                setPin("");
                setErr(null);
                setTarget(null);
                setPhase("grid");
              }}
              className="h-16 rounded-xl border border-border text-sm font-semibold text-muted"
            >
              Batal
            </button>
            <button
              onClick={() => setPin((p) => (p.length < 6 ? p + "0" : p))}
              className="h-16 rounded-xl bg-elevated border border-border text-2xl font-bold text-primary active:bg-accent-teal/10"
            >
              0
            </button>
            <button
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="h-16 rounded-xl border border-border inline-flex items-center justify-center text-muted"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>
          <button
            onClick={submitPin}
            disabled={busy || pin.length < 4}
            className="w-full h-12 rounded-xl bg-accent-teal text-white font-bold disabled:opacity-50"
          >
            {busy ? "Memproses…" : "Absen"}
          </button>
        </div>
      </Screen>
    );
  }

  // grid
  return (
    <Screen align="start">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-primary">{roster?.tenantName}</h1>
          <button onClick={loadRoster} className="text-muted inline-flex items-center gap-1 text-xs font-semibold">
            <RotateCcw className="h-3.5 w-3.5" /> Muat ulang
          </button>
        </div>
        <p className="text-xs text-muted mb-4">
          Kiosk: {roster?.device.label} · pilih nama Anda lalu masukkan PIN
        </p>

        {!roster?.kioskEnabled && (
          <p className="mb-4 rounded-xl border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-sm text-status-yellow-text">
            Absen kiosk sedang dinonaktifkan Owner. Aktifkan di Pengaturan Absensi.
          </p>
        )}
        {err && <p className="mb-4 rounded-xl border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red">{err}</p>}

        {roster && roster.employees.length === 0 ? (
          <p className="text-sm text-muted">
            Belum ada pegawai dengan PIN kiosk. Owner mengatur PIN di Pengaturan Absensi.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {roster?.employees.map((e) => {
              const done = e.checkedIn && e.checkedOut;
              return (
                <button
                  key={e.id}
                  onClick={() => pickEmployee(e)}
                  disabled={done}
                  className="rounded-2xl border border-border bg-card p-4 text-left disabled:opacity-50 hover:border-accent-teal/50 transition-colors"
                >
                  <p className="font-bold text-primary truncate">{e.name}</p>
                  <p className="text-[11px] text-muted">{e.roleLabel}</p>
                  <p className="mt-2 text-xs font-semibold">
                    {done ? (
                      <span className="text-muted">Selesai hari ini</span>
                    ) : e.onBreak ? (
                      <span className="text-status-yellow-text">Sedang istirahat</span>
                    ) : e.checkedIn ? (
                      <span className="text-status-blue">Ketuk untuk Absen Pulang</span>
                    ) : (
                      <span className="text-status-green">Ketuk untuk Absen Masuk</span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-[11px] text-muted inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Lokasi &amp; {roster?.selfieRequired ? "foto selfie " : ""}dicatat otomatis. Waktu dari server.
        </p>
      </div>
    </Screen>
  );
}

function Screen({ children, align = "center" }: { children: React.ReactNode; align?: "center" | "start" }) {
  return (
    <div
      className={`min-h-screen w-full bg-base flex flex-col items-center ${
        align === "center" ? "justify-center" : "justify-start pt-10"
      } p-6`}
    >
      {children}
    </div>
  );
}
