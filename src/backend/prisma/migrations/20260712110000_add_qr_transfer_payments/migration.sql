ALTER TYPE "PaymentMethod" ADD VALUE 'QR_TRANSFER';

ALTER TABLE "orders"
  ADD COLUMN "payment_qr_code" TEXT,
  ADD COLUMN "paid_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "orders_payment_qr_code_key" ON "orders"("payment_qr_code");
