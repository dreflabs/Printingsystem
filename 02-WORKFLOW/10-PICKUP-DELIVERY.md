# Pickup

READY_FOR_PICKUP
-> Customer arrives
-> Search/scan Job QR
-> Verify customer/receiver
-> Verify payment
-> Verify quantity
-> Release
-> PICKED_UP
-> Audit log

## Release protection

Only Admin may perform the final release to the customer. Admin must not release an order if:
- order is not ready;
- payment condition is not satisfied;
- quantity does not match;
- required approval is missing.

Any override requires authorized admin/owner approval and creates an audit log.

## Detail

For the full step-by-step scan sequence (verify order → confirm barang di counter → final release), see `02-WORKFLOW/13-QR-SCAN-FLOW.md` (SCAN 8–10).
