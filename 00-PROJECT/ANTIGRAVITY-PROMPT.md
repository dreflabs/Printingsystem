# Antigravity Master Prompt

Build the Printing Workflow System using all documents in this repository as the source of truth.

This is not merely a POS application. It is an operational control system for a printing business.

Primary workflow:
CUSTOMER -> DESIGNER/SALES -> ORDER -> DESIGN -> CUSTOMER APPROVAL -> PAYMENT -> PRODUCTION -> MATERIAL CONTROL -> QC -> FINISHING -> STORAGE -> PICKUP/DELIVERY -> FINAL AUDIT -> CLOSED

Critical rules:
1. Designer/Sales can be the direct entry point for customers.
2. Designer/Sales may create orders and designs.
3. Designer/Sales cannot silently control company payment, material issue, warehouse release, or final closing.
4. Every production action requires a valid Job ID.
5. Every material movement must be traceable.
6. Every finished job must have a storage location.
7. Final Audit is mandatory before CLOSED.
8. RED audit blocks closing.
9. CLOSED records cannot be silently edited/deleted.
10. Critical actions require audit logs.

Implement role-based access, server-side authorization, relational database, validation, audit trail, reporting, responsive UI, QR-ready workflows, and exportable reports.

Read all files before implementation. Do not invent business rules that conflict with these documents.
