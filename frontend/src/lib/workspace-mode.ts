/**
 * Tampilan Workspace tenant — SOLO / TEAM_SMALL / TEAM_FULL.
 * HANYA mengatur presentasi (navigasi + beranda). Izin selalu berbasis Role.
 */
export type WorkspaceMode = "SOLO" | "TEAM_SMALL" | "TEAM_FULL";

export const WORKSPACE_MODES: readonly WorkspaceMode[] = ["SOLO", "TEAM_SMALL", "TEAM_FULL"] as const;

export const WORKSPACE_MODE_LABEL: Record<WorkspaceMode, string> = {
  SOLO: "Solo (1 orang)",
  TEAM_SMALL: "Tim kecil",
  TEAM_FULL: "Tim per divisi",
};

/** Nilai tak dikenal / null → SOLO (tampilan paling sederhana, fail-safe). */
export function normalizeWorkspaceMode(v: unknown): WorkspaceMode {
  return v === "TEAM_FULL" || v === "TEAM_SMALL" ? v : "SOLO";
}
