# Barcode / QR Module

## Purpose

Create a single scannable identity for each official Production Job / finished order.

Recommended primary identifier:
JOB ID + QR Code.

## QR usage points

1. Production job identification
2. Finishing completion
3. Label verification
4. Storage placement
5. Storage lookup
6. Customer pickup/release
7. Audit history

## Label content

- company name
- QR code
- Job ID
- Order ID
- customer name
- product
- quantity

## Storage QR

Every storage location has a unique QR code.

Example:
LOCATION: RAK-A-02

## Scan behavior

When a user scans a Job QR, the system must:
- identify the job;
- check user permission;
- show only permitted information;
- show current status;
- show current storage location if available;
- provide only actions allowed for the current workflow state.

## Anti-abuse
A scan must never automatically grant permission to release goods. Authorization still applies.
