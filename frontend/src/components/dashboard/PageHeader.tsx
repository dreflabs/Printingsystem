import type { ReactNode } from "react";

/**
 * Header halaman dashboard yang responsif. Di mobile judul menumpuk di atas dan
 * grup aksi wrap di bawah (bukan didorong keluar layar seperti pola
 * `flex justify-between` polos). Tombol aksi sekunder sebaiknya ikon-saja di
 * mobile: bungkus teksnya dengan `<span className="hidden sm:inline">`.
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          {icon}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
