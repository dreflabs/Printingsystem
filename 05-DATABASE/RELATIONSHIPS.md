# Relationships

Customer 1:N Orders
Order 1:N Order Items
Order 1:1 Design Job
Design Job 1:N Design Versions
Order 1:N Production Jobs
Production Job N:1 Machine
Production Job N:1 Operator/User
Production Job 1:N Material Movements
Production Job 1:N QC Records
Production Job 1:1 Finishing Job
Production Job 1:N Storage Items
Storage Location 1:N Storage Items
Order 1:N Payments
Order 1:1 Pickup or Delivery record
Order 1:N Notification Events
Order 1:N Audits
Audit 1:N Audit Items
All critical entities 1:N Audit Logs
