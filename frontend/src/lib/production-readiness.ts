/**
 * Completeness Gate — pengganti approval Admin manual sebelum order turun ke Operator.
 *
 * Order hanya boleh auto-release ke produksi kalau SEMUA syarat wajib di bawah
 * terpenuhi. Fungsi ini murni (tanpa akses DB) supaya bisa dipanggil di dalam
 * transaksi maupun untuk menampilkan alasan "belum bisa produksi" di dashboard.
 */

export interface ReadinessItem {
  /** id OrderItem — dipakai mencocokkan file desain per item */
  id: string;
  label: string;
  productId: string | null;
  /** unit produk — kalau bukan PCS, ukuran wajib diisi */
  productUnit: string | null;
  /** mesin default produk — sumber routing job otomatis */
  defaultMachineId: string | null;
  quantity: number;
  size: string | null;
  materialId: string | null;
  unitPrice: number;
  totalPrice: number;
  /** override deadline item — dipakai auto-release untuk prioritas per job, diabaikan gate. */
  deadline?: Date | string | null;
}

export interface ReadinessInput {
  status: string;
  orderType: string;
  customerId: string | null;
  customerName: string | null;
  customerContact: string | null;
  deadline: Date | string | null;
  discount: number;
  discountApprovedBy: string | null;
  paidAmount: number;
  dpRequired: number;
  designApproved: boolean;
  /**
   * id item yang sudah punya file desain final APPROVED (file-nya sendiri, atau
   * file layout gabungan berlingkup seluruh order). Item non-retail yang tidak
   * ada di sini = desainnya belum lengkap.
   */
  designReadyItemIds: string[];
  items: ReadinessItem[];
}

/**
 * Dari daftar DesignVersion → set id item yang desainnya sudah final & APPROVED.
 * Versi `order_item_id == null` yang APPROVED dianggap menutup SEMUA item
 * (kompat data lama + file layout gabungan).
 */
export function coveredDesignItemIds(
  versions: { order_item_id: string | null; approval_status: string; file_path: string | null; file_name: string | null }[],
  itemIds: string[]
): string[] {
  const hasFile = (v: { approval_status: string; file_path: string | null; file_name: string | null }) =>
    v.approval_status === "APPROVED" && !!(v.file_path || v.file_name);
  const wholeOrder = versions.some((v) => v.order_item_id == null && hasFile(v));
  if (wholeOrder) return [...itemIds];
  const per = new Set(versions.filter((v) => v.order_item_id != null && hasFile(v)).map((v) => v.order_item_id as string));
  return itemIds.filter((id) => per.has(id));
}

export interface ReadinessResult {
  /** semua syarat wajib terpenuhi */
  ok: boolean;
  /** ok DAN setiap item punya mesin resolvable → aman dibuat job otomatis */
  autoRoutable: boolean;
  /** alasan yang menahan order, siap ditampilkan ke Admin */
  missing: string[];
}

const EPS = 1e-6;

export function checkProductionReadiness(input: ReadinessInput): ReadinessResult {
  const missing: string[] = [];

  // 1. Pembayaran / DP
  if (input.paidAmount + EPS < input.dpRequired) {
    missing.push("DP belum terpenuhi");
  }

  // 2. Desain disetujui (job-level)
  if (!input.designApproved) {
    missing.push("Desain belum disetujui");
  }

  // 4. Diskon menggantung
  if (input.discount > 0 && !input.discountApprovedBy) {
    missing.push("Diskon masih menunggu keputusan Owner");
  }

  // 5. Identitas pemesan (order PRINTING wajib punya nama customer)
  if (input.orderType === "PRINTING") {
    if (!input.customerId || !input.customerName?.trim()) {
      missing.push("Data pemesan belum lengkap (nama)");
    }
  }

  // 6. Deadline wajib (dipakai prioritas antrian operator)
  if (!input.deadline) {
    missing.push("Deadline order belum diisi");
  }

  // 7. Minimal 1 item
  if (input.items.length === 0) {
    missing.push("Order belum punya item");
  }

  // 8. Kelengkapan tiap item
  const designReady = new Set(input.designReadyItemIds);
  let allItemsRouted = input.items.length > 0;
  for (const it of input.items) {
    const gaps: string[] = [];
    if (!it.productId && !it.label.trim()) gaps.push("produk/deskripsi");
    if (!(it.quantity > 0)) gaps.push("jumlah");
    if (!it.materialId) gaps.push("bahan");
    if (!(it.unitPrice > 0) || !(it.totalPrice > 0)) gaps.push("harga");
    if ((it.productUnit ?? "PCS") !== "PCS" && !it.size?.trim()) gaps.push("ukuran");
    if (gaps.length > 0) {
      missing.push(`Item "${it.label || "(tanpa nama)"}" belum lengkap: ${gaps.join(", ")}`);
    }

    // File desain per item (hanya cek kalau job desain sudah APPROVED — biar
    // pesan "Desain belum disetujui" tidak dobel dengan yang di atas).
    if (input.designApproved && !designReady.has(it.id)) {
      missing.push(`Item "${it.label || "(tanpa nama)"}" — file desain final belum ada`);
    }

    if (!it.defaultMachineId) {
      allItemsRouted = false;
    }
  }

  const ok = missing.length === 0;
  const autoRoutable = ok && allItemsRouted;
  if (ok && !allItemsRouted) {
    missing.push("Sebagian item belum punya mesin default — assign manual dulu");
  }

  return { ok, autoRoutable, missing };
}
