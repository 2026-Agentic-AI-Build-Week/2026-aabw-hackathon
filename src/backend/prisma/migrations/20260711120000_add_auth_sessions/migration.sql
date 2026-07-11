CREATE TABLE "auth_device_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "auth_device_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_device_sessions_user_id_device_id_key" ON "auth_device_sessions"("user_id", "device_id");
CREATE INDEX "auth_device_sessions_refresh_token_hash_idx" ON "auth_device_sessions"("refresh_token_hash");
CREATE INDEX "auth_device_sessions_expires_at_idx" ON "auth_device_sessions"("expires_at");
ALTER TABLE "auth_device_sessions" ADD CONSTRAINT "auth_device_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
