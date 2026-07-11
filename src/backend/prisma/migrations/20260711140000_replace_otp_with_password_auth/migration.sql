DROP TABLE IF EXISTS "otp_challenges";
DROP TYPE IF EXISTS "OtpStatus";

ALTER TABLE "users"
ADD COLUMN "password_hash" TEXT NOT NULL DEFAULT '!';
