/**
 * Label ramah-baca untuk kode aksi audit.
 *
 * Kode aksi disimpan apa adanya di database (mis. `FINAL_AUDIT_SUBMITTED`) untuk
 * jejak forensik. Di UI, pemilik toko perlu bahasa manusia — peta ini yang
 * dipakai dashboard & halaman audit. Kode yang belum terpetakan tetap
 * ditampilkan rapi (garis bawah → spasi, Title Case), jadi tidak pernah kosong.
 */
const ACTION_LABELS: Record<string, string> = {
  // Order
  ORDER_CREATED: "Order dibuat",
  ORDER_PRICE_CORRECTED: "Harga order dikoreksi",
  ORDER_AUTO_RELEASED: "Order otomatis masuk produksi",
  ORDER_CANCELLED: "Order dibatalkan",
  ORDER_CANCELLATION_REQUESTED: "Pengajuan pembatalan",
  ORDER_CANCELLATION_DECIDED: "Keputusan pembatalan",
  PICKUP_RELEASED: "Barang diserahkan ke pelanggan",
  PAYMENT_RECEIVED: "Pembayaran diterima",
  PAYMENT_CONFIRMED: "Pembayaran dikonfirmasi",
  DISCOUNT_DECIDED: "Keputusan diskon",
  // Desain
  DESIGN_VERSION_UPLOADED: "Desain diunggah",
  DESIGN_APPROVED: "Desain disetujui",
  DESIGN_REVISION_REQUESTED: "Revisi desain diminta",
  DESIGN_JOB_TAKEN: "Job desain diambil",
  // Produksi
  PRODUCTION_STARTED: "Produksi dimulai",
  PRODUCTION_COMPLETE: "Produksi selesai",
  PRODUCTION_PAUSED: "Produksi dijeda",
  PRODUCTION_RESUMED: "Produksi dilanjutkan",
  PRODUCTION_JOB_REASSIGNED: "Job dipindah mesin/operator",
  QC_PASSED: "Lolos QC",
  QC_FAILED: "Gagal QC",
  REWORK_DECIDED: "Keputusan rework",
  FINISHING_STARTED: "Finishing dimulai",
  FINISHING_COMPLETE: "Finishing selesai",
  STORED: "Disimpan ke rak",
  IN_TRANSIT: "Dibawa ke counter",
  MATERIAL_LOW_STOCK: "Stok bahan menipis",
  // Audit & koreksi
  FINAL_AUDIT_SUBMITTED: "Audit akhir diajukan",
  FINAL_AUDIT_APPROVED: "Audit akhir disetujui",
  FINAL_AUDIT_REJECTED: "Audit akhir ditolak",
  CORRECTION_CREATED: "Koreksi dibuat",
  CORRECTION_APPROVED: "Koreksi disetujui",
  // Pegawai & absensi
  EMPLOYEE_CREATED: "Pegawai ditambahkan",
  EMPLOYEE_BASE_SALARY_SET: "Gaji pokok diubah",
  EMPLOYEE_DEACTIVATED: "Pegawai dinonaktifkan",
  EMPLOYEE_DELETED: "Pegawai dihapus",
  USER_ROLES_UPDATED: "Peran pengguna diubah",
  ATTENDANCE_CLOCK_IN: "Absen masuk",
  ATTENDANCE_CLOCK_OUT: "Absen pulang",
  ATTENDANCE_ELIGIBILITY_UPDATED: "Kewajiban absen diubah",
  ATTENDANCE_IMPORTED: "Data absensi diimpor",
  PAYROLL_PERIOD_GENERATED: "Periode gaji dibuat",
  PAYROLL_PAID: "Gaji ditandai dibayar",
  // Katalog & gudang
  PRODUCT_CREATED: "Produk cetak dibuat",
  PRODUCT_UPDATED: "Produk cetak diubah",
  RETAIL_PRODUCT_CREATED: "Barang retail dibuat",
  MATERIAL_CREATED: "Material dibuat",
  MATERIAL_RECEIVED: "Stok bahan diterima",
  MATERIAL_ADJUSTED: "Stok bahan disesuaikan",
  STORAGE_LAYOUT_SEED: "Layout rak dibuat",
  STORAGE_LOCATION_CREATE: "Lokasi rak dibuat",
  STORAGE_INCIDENT_REPORTED: "Insiden gudang dilaporkan",
  STORAGE_INCIDENT_RESOLVED: "Insiden gudang selesai",
  // Langganan & platform
  TENANT_SELF_SIGNUP: "Pendaftaran workspace",
  INVOICE_PAID: "Invoice dibayar",
  PLAN_CHANGED: "Paket diubah",
  WORKSPACE_MODE_SET: "Mode tampilan diubah",
  OWNER_OPERATIONAL_ROLES_SET: "Peran operasional Owner diatur",
  OPERATIONAL_ALERT_ACKNOWLEDGED: "Alert operasional diakui",
};

/** Kode aksi → label Indonesia; kode tak dikenal dirapikan otomatis. */
export function auditActionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  return action
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Jenis entitas → sebutan Indonesia (dipakai bila kode entitas tak tersedia). */
const ENTITY_LABELS: Record<string, string> = {
  Order: "Pesanan",
  ProductionJob: "Job produksi",
  User: "Pegawai",
  Material: "Bahan",
  Product: "Produk cetak",
  RetailProduct: "Barang retail",
  StorageLocation: "Lokasi rak",
  StorageItem: "Barang di rak",
  Customer: "Pelanggan",
  OperationalAlert: "Alert operasional",
  Tenant: "Workspace",
};

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}
