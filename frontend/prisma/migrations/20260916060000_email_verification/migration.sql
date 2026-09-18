-- Existing accounts were created before email verification existed; preserve
-- their access while requiring verification for new self-serve signups.
ALTER TABLE "User" ADD COLUMN "email_verified_at" TIMESTAMP(3);
UPDATE "User" SET "email_verified_at" = COALESCE("updated_at", CURRENT_TIMESTAMP)
WHERE "email_verified_at" IS NULL;

CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationToken_token_hash_key" ON "EmailVerificationToken"("token_hash");
CREATE INDEX "EmailVerificationToken_user_id_idx" ON "EmailVerificationToken"("user_id");
CREATE INDEX "EmailVerificationToken_expires_at_idx" ON "EmailVerificationToken"("expires_at");
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
