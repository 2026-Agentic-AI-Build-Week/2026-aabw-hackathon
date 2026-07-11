import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AuthPrincipal = { userId: string; deviceId: string };

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export class TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
    private readonly accessTtlSeconds: number,
    private readonly refreshTtlSeconds: number,
  ) {}

  issueTokens(principal: AuthPrincipal, now: Date): { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresAt: Date } {
    const accessToken = this.sign({ sub: principal.userId, did: principal.deviceId, exp: Math.floor(now.getTime() / 1000) + this.accessTtlSeconds }, this.accessSecret);
    const refreshToken = this.sign({ sub: principal.userId, did: principal.deviceId, exp: Math.floor(now.getTime() / 1000) + this.refreshTtlSeconds, jti: randomBytes(24).toString("base64url") }, this.refreshSecret);
    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds, refreshExpiresAt: new Date(now.getTime() + this.refreshTtlSeconds * 1000) };
  }

  verifyAccessToken(token: string, now = new Date()): AuthPrincipal {
    return this.verify(token, this.accessSecret, now);
  }

  verifyRefreshToken(token: string, now = new Date()): AuthPrincipal {
    return this.verify(token, this.refreshSecret, now);
  }

  private sign(payload: Record<string, unknown>, secret: string): string {
    const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = encode(JSON.stringify(payload));
    return `${header}.${body}.${this.signature(`${header}.${body}`, secret)}`;
  }

  private verify(token: string, secret: string, now: Date): AuthPrincipal {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature || !this.equal(signature, this.signature(`${header}.${payload}`, secret))) throw new Error("Invalid token");
    const parsedHeader = JSON.parse(decode(header)) as { alg?: string; typ?: string };
    if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") throw new Error("Invalid token");
    const parsed = JSON.parse(decode(payload)) as { sub?: string; did?: string; exp?: number };
    if (!parsed.sub || !parsed.did || !parsed.exp || parsed.exp <= Math.floor(now.getTime() / 1000)) throw new Error("Expired token");
    return { userId: parsed.sub, deviceId: parsed.did };
  }

  private signature(value: string, secret: string): string {
    return createHmac("sha256", secret).update(value).digest("base64url");
  }

  private equal(left: string, right: string): boolean {
    const first = Buffer.from(left);
    const second = Buffer.from(right);
    return first.length === second.length && timingSafeEqual(first, second);
  }
}
