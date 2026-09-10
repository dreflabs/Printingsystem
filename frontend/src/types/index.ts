/**
 * Barrel tipe bersama frontend ⇄ backend.
 *
 * - Bentuk baris DB: pakai tipe hasil generate Prisma (`import type { Order } from "@/types"`).
 * - String union di bawah: nilai status yang dipakai State Machine. Sumber
 *   kebenaran ada di `02-WORKFLOW/` + `02-WORKFLOW/13-QR-SCAN-FLOW.md`.
 *   Prisma menyimpannya sebagai `String`, jadi union ini yang menjaga tipe.
 */

export type {
  Tenant,
  User,
  Role,
  Customer,
  Product,
  RetailProduct,
  Material,
  Machine,
  Order,
  OrderItem,
  Payment,
  DesignJob,
  DesignVersion,
  ProductionJob,
  QcRecord,
  FinishingJob,
  StorageLocation,
  StorageItem,
  PickupRecord,
  Audit,
  AuditItem,
  AuditLog,
  Correction,
  NotificationEvent,
  DeadlineAlert,
} from "@prisma/client";

export * from "./actions";

// Kontrak input/output Server Action (sumber: file action masing-masing)
export type {
  RetailCartLine,
  ProcessRetailOrderInput,
  ProcessRetailOrderResult,
} from "@/actions/pos";
export type {
  PrintingOrderItemInput,
  CreatePrintingOrderInput,
  CreatePrintingOrderResult,
  AddPaymentInput,
  AddPaymentResult,
} from "@/actions/orders";
export type {
  UploadDesignVersionInput,
  ProductionAssignment,
} from "@/actions/design";
export type {
  ScanAction,
  MaterialUsageInput,
  FinishProductionInput,
  SubmitQCInput,
} from "@/actions/production";
export type { ReleaseOrderInput } from "@/actions/storage";
export type {
  FinalAuditItemInput,
  SubmitFinalAuditInput,
  CreateCorrectionInput,
} from "@/actions/audit";

/** `Order.order_type` */
export type OrderType = "PRINTING" | "RETAIL";

/**
 * `Order.status` — daftar kanonis di `@/lib/order-status`
 * (lihat `09-TECHNICAL/STATUS-MACHINE.md`). Status order sengaja "kasar";
 * sub-state detail hidup di record anak.
 */
export type { OrderStatus } from "@/lib/order-status";

/** `Payment.status` — lihat komentar di schema.prisma. */
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "WAIVED";

/** status lunas/DP yang ditampilkan di UI kasir & scan. */
export type OrderPaymentState = "UNPAID" | "DP" | "PAID";

/** `DesignVersion.approval_status` */
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

/** `StorageItem.status` */
export type StorageItemStatus = "STORED" | "IN_TRANSIT" | "RELEASED" | "INCIDENT";

/** Hasil Final Audit (11-FINAL-AUDIT-CLOSING.md). */
export type AuditResult = "GREEN" | "YELLOW" | "RED";

/** Role slug yang dipakai RBAC middleware & seed. */
export type RoleName = "owner" | "admin" | "designer_sales" | "operator" | "gudang";
