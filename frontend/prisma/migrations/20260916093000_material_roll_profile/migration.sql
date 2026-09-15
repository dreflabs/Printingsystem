-- Physical profile used for roll/media costing and production validation.
ALTER TABLE "Material"
  ADD COLUMN "usable_width_mm" DECIMAL(10,2),
  ADD COLUMN "effective_length" DECIMAL(18,6);
