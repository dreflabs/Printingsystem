import { ImageResponse } from "next/og";

export const alt = "Print Pilot — Software Manajemen Percetakan & Kasir Produksi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B1120",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#0492B2",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#F8FAFC" }}>
            Print Pilot.id
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: "#F8FAFC", lineHeight: 1.1, maxWidth: 940 }}>
            Semua pesanan cetak tercatat, terpantau, tepat waktu
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#94A3B8", maxWidth: 880 }}>
            Kasir & order, kanban produksi, stok bahan otomatis, notifikasi WhatsApp.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {["Uji coba gratis 14 hari", "Tanpa kartu kredit", "100% berbasis cloud"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                fontSize: 22,
                color: "#CBD5E1",
                border: "1px solid #1E293B",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
