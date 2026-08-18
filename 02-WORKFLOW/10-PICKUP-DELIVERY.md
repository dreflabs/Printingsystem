# Pickup & Delivery Workflow

## Pickup

READY_FOR_PICKUP
-> Customer arrives
-> Search/scan Job QR
-> Verify customer/receiver
-> Verify payment
-> Verify quantity
-> Release
-> PICKED_UP
-> Audit log

## Delivery

READY_FOR_DELIVERY
-> Verify payment/authorization
-> Pack
-> Record courier/tracking
-> Dispatch
-> DELIVERED

## Release protection
The warehouse/release user must not release an order if:
- order is not ready;
- payment condition is not satisfied;
- quantity does not match;
- required approval is missing.

Any override requires authorized supervisor/owner approval and creates an audit log.
