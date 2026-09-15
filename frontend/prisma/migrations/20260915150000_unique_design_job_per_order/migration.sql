-- A design job is the workflow container for one order. Item-level versions
-- remain in DesignVersion, so duplicate containers would make approval and
-- production readiness ambiguous. Fail safely if legacy duplicates exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DesignJob"
    GROUP BY "tenant_id", "order_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'DesignJob duplicate tenant/order rows found; reconcile before applying unique constraint';
  END IF;
END $$;

CREATE UNIQUE INDEX "DesignJob_tenant_id_order_id_key"
  ON "DesignJob"("tenant_id", "order_id");
