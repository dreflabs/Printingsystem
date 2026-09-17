import type { Actor } from "@/lib/actor";

/**
 * Katalog permission server-side. Role tetap menjadi template akses; action
 * baru sebaiknya memanggil can() agar aturan tidak tersebar dalam string role.
 */
export const PERMISSIONS = [
  "order.view_scoped", "order.view_all", "order.create", "order.edit_draft", "order.edit_pre_production",
  "customer.create", "customer.view_contact", "customer.update",
  "quote.edit_price", "discount.request", "discount.approve", "payment.view_detail", "payment.receive",
  "payment.confirm", "payment.refund_request", "payment.refund_approve", "pickup.release", "pickup.release_override",
  "design.upload", "design.approve_walkin", "design.approve_online", "design.request_revision",
  "production.assign", "production.reassign", "production.execute", "production.input_material", "production.submit_waste", "production.rework_decide",
  "material.view", "material.receive", "material.adjust", "material.stocktake", "material.stocktake_approve",
  "purchase.view", "purchase.create", "purchase.receive",
  "operations.alerts.view", "operations.alerts.acknowledge",
  "qc.submit", "finishing.execute", "storage.configure", "storage.store", "storage.move_to_counter", "storage.report_incident", "storage.resolve_incident",
  "audit.submit", "audit.approve", "correction.create_operational", "correction.create_financial", "correction.approve",
  "user.view", "user.create", "user.update_role", "user.deactivate", "user.reset_password",
  "attendance.self", "attendance.view", "attendance.import", "attendance.report", "attendance.settings.read", "attendance.configure", "payroll.view", "payroll.manage", "report.view_operational", "report.view_financial", "report.export", "shop.configure",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_OPERATIONAL = new Set<Permission>(PERMISSIONS);
const MUTATING = new Set<Permission>([
  "order.create", "order.edit_draft", "order.edit_pre_production", "customer.create", "customer.update", "quote.edit_price",
  "discount.request", "discount.approve", "payment.receive", "payment.confirm", "payment.refund_request", "payment.refund_approve",
  "pickup.release", "pickup.release_override", "design.upload", "design.approve_walkin", "design.approve_online", "design.request_revision",
  "production.assign", "production.reassign", "production.execute", "production.input_material", "production.submit_waste", "production.rework_decide",
  "material.receive", "material.adjust", "material.stocktake", "material.stocktake_approve",
  "purchase.create", "purchase.receive",
  "operations.alerts.acknowledge",
  "qc.submit", "finishing.execute", "storage.configure", "storage.store", "storage.move_to_counter", "storage.report_incident", "storage.resolve_incident", "audit.submit", "audit.approve",
  "correction.create_operational", "correction.create_financial", "correction.approve", "user.create", "user.update_role", "user.deactivate",
  "user.reset_password", "attendance.self", "attendance.import", "attendance.configure", "payroll.manage", "shop.configure",
]);

const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  owner: ALL_OPERATIONAL,
  admin: new Set<Permission>([
    "order.view_all", "order.create", "order.edit_draft", "order.edit_pre_production", "customer.create", "customer.view_contact", "customer.update",
    "discount.request", "payment.view_detail", "payment.receive", "payment.confirm", "payment.refund_request", "pickup.release",
    "design.upload", "design.approve_online", "design.request_revision", "production.assign", "production.reassign", "qc.submit", "storage.configure", "storage.report_incident", "storage.resolve_incident",
    "material.view", "material.stocktake_approve", "purchase.view", "purchase.create", "purchase.receive", "operations.alerts.view", "operations.alerts.acknowledge", "audit.submit", "correction.create_operational", "report.view_operational", "report.view_financial", "report.export", "attendance.self", "attendance.view", "attendance.import", "attendance.report", "attendance.settings.read",
    // Admin melihat payroll tanpa nominal (status & jumlah pegawai saja) —
    // redaksi nominalnya ditegakkan di actions/payroll.ts, bukan di sini.
    "payroll.view",
  ]),
  designer_sales: new Set<Permission>([
    "order.view_scoped", "order.create", "order.edit_draft", "customer.create", "design.upload", "design.approve_walkin", "design.request_revision", "attendance.self",
  ]),
  operator: new Set<Permission>([
    "order.view_scoped", "production.execute", "production.input_material", "production.submit_waste", "material.view", "attendance.self",
  ]),
  gudang: new Set<Permission>([
    "order.view_scoped", "material.view", "material.receive", "material.stocktake", "purchase.view", "purchase.receive", "operations.alerts.view", "qc.submit", "finishing.execute", "storage.store", "storage.move_to_counter", "storage.report_incident", "attendance.self",
  ]),
};

/** Permission efektif dari seluruh role user. SUPPORT impersonation bersifat read-only. */
export function can(actor: Actor, permission: Permission): boolean {
  if (actor.readOnly && MUTATING.has(permission)) return false;
  return actor.roles.some((role) => ROLE_PERMISSIONS[role]?.has(permission));
}

export function canAny(actor: Actor, ...permissions: Permission[]): boolean {
  return permissions.some((permission) => can(actor, permission));
}

export function permissionsForRoles(roles: string[]): Permission[] {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) result.add(permission);
  }
  return [...result];
}
