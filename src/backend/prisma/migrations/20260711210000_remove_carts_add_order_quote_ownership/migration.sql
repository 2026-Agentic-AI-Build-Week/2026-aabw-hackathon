ALTER TABLE "order_quotes" ADD COLUMN "user_id" UUID;
ALTER TABLE "order_quotes" ADD COLUMN "session_id" UUID;

UPDATE "order_quotes" q
SET "user_id" = o."user_id", "session_id" = o."session_id"
FROM "orders" o
WHERE o."quote_id" = q."id";

UPDATE "order_quotes" q
SET "user_id" = c."user_id", "session_id" = c."session_id"
FROM "carts" c
WHERE q."cart_id" = c."id" AND q."session_id" IS NULL;

DELETE FROM "order_quotes" WHERE "user_id" IS NULL OR "session_id" IS NULL;

ALTER TABLE "order_quotes" DROP CONSTRAINT "order_quotes_cart_id_fkey";
DROP INDEX IF EXISTS "order_quotes_cart_id_status_idx";
ALTER TABLE "order_quotes" DROP COLUMN "cart_id", DROP COLUMN "cart_version";
ALTER TABLE "order_quotes" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "order_quotes" ALTER COLUMN "session_id" SET NOT NULL;

ALTER TABLE "order_quotes" ADD CONSTRAINT "order_quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_quotes" ADD CONSTRAINT "order_quotes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "conversation_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "order_quotes_user_id_status_idx" ON "order_quotes"("user_id", "status");
CREATE INDEX "order_quotes_session_id_idx" ON "order_quotes"("session_id");

CREATE TABLE "order_quote_delivery_details" (
  "id" UUID NOT NULL,
  "quote_id" UUID NOT NULL,
  "email_snapshot" TEXT NOT NULL,
  "recipient_name" TEXT NOT NULL,
  "phone_snapshot" TEXT NOT NULL,
  "phone_normalized" TEXT NOT NULL,
  "address_line" TEXT NOT NULL,
  "ward" TEXT,
  "district" TEXT,
  "city" TEXT NOT NULL,
  CONSTRAINT "order_quote_delivery_details_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "order_quote_delivery_details_quote_id_key" ON "order_quote_delivery_details"("quote_id");
ALTER TABLE "order_quote_delivery_details" ADD CONSTRAINT "order_quote_delivery_details_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "order_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "cart_item_modifiers";
DROP TABLE "cart_items";
DROP TABLE "carts";
DROP TYPE "CartStatus";
