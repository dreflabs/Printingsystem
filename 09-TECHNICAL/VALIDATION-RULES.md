# Validation Rules

- Quantities > 0.
- Prices >= 0.
- Required IDs must exist.
- Production requires approved design and valid Job ID.
- Material OUT requires Job ID.
- Waste requires quantity and reason.
- QC PASS required before finishing/storage.
- Storage requires valid Job ID + valid Location ID.
- READY_FOR_PICKUP requires successful storage confirmation.
- Pickup/release requires payment condition and authorization.
- Final Audit required before close.
- RED audit blocks close.
- CLOSED records cannot be silently edited.
- READY_FOR_PICKUP notification can trigger only after storage confirmation.
- Duplicate notification events are prevented unless authorized resend.
