-- Tampilan Workspace: SOLO / TEAM_SMALL / TEAM_FULL.
-- Hanya mengatur presentasi (navigasi + beranda), bukan izin — izin tetap
-- berbasis Role/UserRole. Default SOLO agar tenant baru & tenant lama
-- ber-1-orang langsung dapat tampilan paling sederhana. Tenant lama yang
-- sudah punya staf disesuaikan lewat prisma/backfill-workspace-mode.mjs.
ALTER TABLE "Tenant" ADD COLUMN "workspace_mode" TEXT NOT NULL DEFAULT 'SOLO';
