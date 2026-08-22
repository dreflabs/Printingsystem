> [!IMPORTANT]
> Fitur QR Code sudah direalisasikan sebagai **Fitur Inti (Fase 1)**. Silakan rujuk dokumen operasional resmi: `02-WORKFLOW/13-QR-SCAN-FLOW.md`.

# QR / Barcode Integration

QR is recommended as the primary scan format because it can carry a Job ID and work well with phone cameras.

## Job QR
Generated for each Production Job / finished order.

Used at:
- production
- finishing
- storage
- pickup
- audit

## Storage QR
Each rack/slot/location gets a unique QR.

## Important
QR is an identifier, not an authorization mechanism. User permissions are always checked server-side.
