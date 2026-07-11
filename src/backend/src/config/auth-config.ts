export type AuthConfig = { accessTokenSecret: string; refreshTokenSecret: string; tokenPepper: string; accessTokenTtlSeconds: number; refreshTokenTtlSeconds: number };
export function loadAuthConfig(environment = process.env): AuthConfig {
  const isProduction = environment.NODE_ENV === "production";
  const required = (name: string, fallback: string) => { const value = environment[name] ?? (!isProduction ? fallback : undefined); if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters.`); return value; };
  return { accessTokenSecret: required("AUTH_ACCESS_TOKEN_SECRET", "development-access-token-secret-change-me-000"), refreshTokenSecret: required("AUTH_REFRESH_TOKEN_SECRET", "development-refresh-token-secret-change-me-000"), tokenPepper: required("AUTH_TOKEN_PEPPER", "development-token-pepper-change-me-00000000"), accessTokenTtlSeconds: Number(environment.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? 900), refreshTokenTtlSeconds: Number(environment.AUTH_REFRESH_TOKEN_TTL_SECONDS ?? 2_592_000) };
}
