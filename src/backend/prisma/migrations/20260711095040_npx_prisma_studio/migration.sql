-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."Channel" AS ENUM ('WEB', 'MESSENGER');

-- CreateEnum
CREATE TYPE "public"."OtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED');

-- CreateEnum
CREATE TYPE "public"."LoyaltyAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "public"."VoucherCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "public"."VoucherCodeStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXHAUSTED');

-- CreateEnum
CREATE TYPE "public"."VoucherRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "public"."BusinessState" AS ENUM ('BROWSING', 'CART_ACTIVE', 'AUTH_PENDING', 'READY_TO_QUOTE', 'AWAITING_CONFIRMATION', 'ORDER_CREATED', 'HANDOFF');

-- CreateEnum
CREATE TYPE "public"."MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "public"."MessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "public"."QuoteStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('CREATED', 'CONFIRMED', 'PREPARING', 'DELIVERING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('COD');

-- CreateEnum
CREATE TYPE "public"."HandoffStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "source_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_items" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "original_price" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "image_url" TEXT,
    "product_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_item_categories" (
    "menu_item_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "menu_item_categories_pkey" PRIMARY KEY ("menu_item_id","category_id")
);

-- CreateTable
CREATE TABLE "public"."modifier_groups" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_choices" INTEGER NOT NULL DEFAULT 0,
    "max_choices" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."modifier_options" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_item_modifier_groups" (
    "menu_item_id" UUID NOT NULL,
    "modifier_group_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_modifier_groups_pkey" PRIMARY KEY ("menu_item_id","modifier_group_id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_normalized" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ(3),
    "phone_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "public"."Channel" NOT NULL,
    "external_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT,
    "recipient_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_normalized" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "ward" TEXT,
    "district" TEXT,
    "city" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."otp_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "phone_normalized" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "verified_at" TIMESTAMPTZ(3),
    "status" "public"."OtpStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loyalty_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."LoyaltyAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loyalty_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voucher_campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "discount_type" "public"."DiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "max_discount" INTEGER,
    "minimum_order_value" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "total_quota" INTEGER,
    "per_user_quota" INTEGER NOT NULL DEFAULT 1,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."VoucherCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "voucher_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voucher_codes" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "code" TEXT NOT NULL,
    "status" "public"."VoucherCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voucher_redemptions" (
    "id" UUID NOT NULL,
    "voucher_code_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "status" "public"."VoucherRedemptionStatus" NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reserved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_at" TIMESTAMPTZ(3),
    "released_at" TIMESTAMPTZ(3),

    CONSTRAINT "voucher_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation_sessions" (
    "id" UUID NOT NULL,
    "session_key" TEXT NOT NULL,
    "channel" "public"."Channel" NOT NULL,
    "user_id" UUID,
    "business_state" "public"."BusinessState" NOT NULL DEFAULT 'BROWSING',
    "openai_conversation_id" TEXT,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "direction" "public"."MessageDirection" NOT NULL,
    "role" "public"."MessageRole" NOT NULL,
    "redacted_content" TEXT NOT NULL,
    "external_message_id" TEXT,
    "latency_ms" INTEGER,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processed_channel_events" (
    "id" UUID NOT NULL,
    "channel" "public"."Channel" NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_channel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carts" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID,
    "status" "public"."CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "item_name_snapshot" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cart_item_modifiers" (
    "id" UUID NOT NULL,
    "cart_item_id" UUID NOT NULL,
    "modifier_option_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "price_delta" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cart_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_quotes" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "cart_version" INTEGER NOT NULL,
    "voucher_code" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "delivery_fee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "confirmation_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "public"."QuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_quote_items" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "modifier_total" INTEGER NOT NULL DEFAULT 0,
    "line_total" INTEGER NOT NULL,

    CONSTRAINT "order_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_quote_item_modifiers" (
    "id" UUID NOT NULL,
    "quote_item_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "order_quote_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'CREATED',
    "payment_method" "public"."PaymentMethod" NOT NULL DEFAULT 'COD',
    "subtotal" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "delivery_fee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "voucher_code_snapshot" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "channel_snapshot" "public"."Channel" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "item_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "modifier_total" INTEGER NOT NULL DEFAULT 0,
    "line_total" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_item_modifiers" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_delivery_details" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "source_address_id" UUID,
    "email_snapshot" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "phone_snapshot" TEXT NOT NULL,
    "phone_normalized" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "ward" TEXT,
    "district" TEXT,
    "city" TEXT NOT NULL,

    CONSTRAINT "order_delivery_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "public"."OrderStatus",
    "to_status" "public"."OrderStatus" NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."handoffs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID,
    "reason" TEXT NOT NULL,
    "status" "public"."HandoffStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to" TEXT,
    "cart_snapshot" JSONB,
    "redacted_summary" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "result_code" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_external_id_key" ON "public"."categories"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "public"."categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_display_order_idx" ON "public"."categories"("is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_external_id_key" ON "public"."menu_items"("external_id");

-- CreateIndex
CREATE INDEX "menu_items_slug_idx" ON "public"."menu_items"("slug");

-- CreateIndex
CREATE INDEX "menu_items_is_available_item_type_idx" ON "public"."menu_items"("is_available", "item_type");

-- CreateIndex
CREATE INDEX "menu_item_categories_category_id_idx" ON "public"."menu_item_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "modifier_groups_code_key" ON "public"."modifier_groups"("code");

-- CreateIndex
CREATE INDEX "modifier_options_group_id_is_available_idx" ON "public"."modifier_options"("group_id", "is_available");

-- CreateIndex
CREATE UNIQUE INDEX "modifier_options_group_id_code_key" ON "public"."modifier_options"("group_id", "code");

-- CreateIndex
CREATE INDEX "menu_item_modifier_groups_modifier_group_id_idx" ON "public"."menu_item_modifier_groups"("modifier_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_normalized_key" ON "public"."users"("phone_normalized");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "public"."users"("status");

-- CreateIndex
CREATE INDEX "user_identities_user_id_idx" ON "public"."user_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_channel_external_user_id_key" ON "public"."user_identities"("channel", "external_user_id");

-- CreateIndex
CREATE INDEX "user_addresses_user_id_is_default_idx" ON "public"."user_addresses"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_normalized_status_expires_at_idx" ON "public"."otp_challenges"("phone_normalized", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_user_id_key" ON "public"."loyalty_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_transactions_idempotency_key_key" ON "public"."loyalty_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "loyalty_transactions_user_id_created_at_idx" ON "public"."loyalty_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_transactions_order_id_idx" ON "public"."loyalty_transactions"("order_id");

-- CreateIndex
CREATE INDEX "voucher_campaigns_status_starts_at_ends_at_idx" ON "public"."voucher_campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_codes_code_key" ON "public"."voucher_codes"("code");

-- CreateIndex
CREATE INDEX "voucher_codes_campaign_id_status_idx" ON "public"."voucher_codes"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "voucher_codes_assigned_user_id_idx" ON "public"."voucher_codes"("assigned_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemptions_order_id_key" ON "public"."voucher_redemptions"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_redemptions_idempotency_key_key" ON "public"."voucher_redemptions"("idempotency_key");

-- CreateIndex
CREATE INDEX "voucher_redemptions_voucher_code_id_status_idx" ON "public"."voucher_redemptions"("voucher_code_id", "status");

-- CreateIndex
CREATE INDEX "voucher_redemptions_user_id_status_idx" ON "public"."voucher_redemptions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_sessions_session_key_key" ON "public"."conversation_sessions"("session_key");

-- CreateIndex
CREATE INDEX "conversation_sessions_channel_created_at_idx" ON "public"."conversation_sessions"("channel", "created_at");

-- CreateIndex
CREATE INDEX "conversation_sessions_business_state_last_activity_at_idx" ON "public"."conversation_sessions"("business_state", "last_activity_at");

-- CreateIndex
CREATE INDEX "conversation_sessions_user_id_idx" ON "public"."conversation_sessions"("user_id");

-- CreateIndex
CREATE INDEX "conversation_messages_session_id_created_at_idx" ON "public"."conversation_messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_session_id_external_message_id_key" ON "public"."conversation_messages"("session_id", "external_message_id");

-- CreateIndex
CREATE INDEX "processed_channel_events_processed_at_idx" ON "public"."processed_channel_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_channel_events_channel_external_event_id_key" ON "public"."processed_channel_events"("channel", "external_event_id");

-- CreateIndex
CREATE INDEX "carts_session_id_status_idx" ON "public"."carts"("session_id", "status");

-- CreateIndex
CREATE INDEX "carts_user_id_idx" ON "public"."carts"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "public"."cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_menu_item_id_idx" ON "public"."cart_items"("menu_item_id");

-- CreateIndex
CREATE INDEX "cart_item_modifiers_cart_item_id_idx" ON "public"."cart_item_modifiers"("cart_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_quotes_confirmation_token_hash_key" ON "public"."order_quotes"("confirmation_token_hash");

-- CreateIndex
CREATE INDEX "order_quotes_cart_id_status_idx" ON "public"."order_quotes"("cart_id", "status");

-- CreateIndex
CREATE INDEX "order_quotes_status_expires_at_idx" ON "public"."order_quotes"("status", "expires_at");

-- CreateIndex
CREATE INDEX "order_quote_items_quote_id_idx" ON "public"."order_quote_items"("quote_id");

-- CreateIndex
CREATE INDEX "order_quote_item_modifiers_quote_item_id_idx" ON "public"."order_quote_item_modifiers"("quote_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "public"."orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_quote_id_key" ON "public"."orders"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "public"."orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_channel_snapshot_created_at_idx" ON "public"."orders"("channel_snapshot", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "public"."orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "public"."orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_session_id_idx" ON "public"."orders"("session_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "public"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_item_modifiers_order_item_id_idx" ON "public"."order_item_modifiers"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_delivery_details_order_id_key" ON "public"."order_delivery_details"("order_id");

-- CreateIndex
CREATE INDEX "order_delivery_details_source_address_id_idx" ON "public"."order_delivery_details"("source_address_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "public"."order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "handoffs_status_created_at_idx" ON "public"."handoffs"("status", "created_at");

-- CreateIndex
CREATE INDEX "handoffs_session_id_idx" ON "public"."handoffs"("session_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "public"."audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_session_id_created_at_idx" ON "public"."audit_logs"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "public"."menu_item_categories" ADD CONSTRAINT "menu_item_categories_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_item_categories" ADD CONSTRAINT "menu_item_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."modifier_options" ADD CONSTRAINT "modifier_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voucher_codes" ADD CONSTRAINT "voucher_codes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."voucher_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voucher_codes" ADD CONSTRAINT "voucher_codes_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_voucher_code_id_fkey" FOREIGN KEY ("voucher_code_id") REFERENCES "public"."voucher_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation_sessions" ADD CONSTRAINT "conversation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation_messages" ADD CONSTRAINT "conversation_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carts" ADD CONSTRAINT "carts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_item_modifiers" ADD CONSTRAINT "cart_item_modifiers_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "public"."cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_item_modifiers" ADD CONSTRAINT "cart_item_modifiers_modifier_option_id_fkey" FOREIGN KEY ("modifier_option_id") REFERENCES "public"."modifier_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_quotes" ADD CONSTRAINT "order_quotes_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_quote_items" ADD CONSTRAINT "order_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."order_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_quote_item_modifiers" ADD CONSTRAINT "order_quote_item_modifiers_quote_item_id_fkey" FOREIGN KEY ("quote_item_id") REFERENCES "public"."order_quote_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."order_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_delivery_details" ADD CONSTRAINT "order_delivery_details_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_delivery_details" ADD CONSTRAINT "order_delivery_details_source_address_id_fkey" FOREIGN KEY ("source_address_id") REFERENCES "public"."user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."handoffs" ADD CONSTRAINT "handoffs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."handoffs" ADD CONSTRAINT "handoffs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
