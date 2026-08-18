# Finishing Workflow

Finishing is the controlled handoff from production to finished-goods storage.

## Required flow

QC PASS
-> FINISHING
-> PACKING
-> SCAN JOB QR/BARCODE
-> PRINT/VERIFY LABEL
-> SCAN STORAGE LOCATION
-> READY_FOR_PICKUP / READY_FOR_DELIVERY
-> AUTOMATIC CUSTOMER NOTIFICATION

## Finishing operator must record
- Job ID
- operator
- quantity
- start time
- completion time
- notes
- QR/barcode scan
- label verification

## Important rule
Finishing completion alone does NOT make an order ready for pickup.

The job must be successfully stored in a registered storage location first.

## Label
Recommended label:
- company name
- QR Code
- Job ID
- Order ID
- customer name
- short product description
- quantity

## WhatsApp trigger
After successful storage scan, the system may automatically trigger the customer notification workflow.

Do not send the "ready for pickup" message before the job has a valid storage location.
