import { randomUUID } from "node:crypto";
import { normalizeEmail } from "../lib/normalization.js";
import type { AuthRepository, AuthUser } from "./auth-repository.js";
import type { PasswordHasher } from "./password-hasher.js";
import type { AuthPrincipal, TokenService } from "./token-service.js";

export class AuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode = 401) { super(message); }
}

export type AuthServiceDependencies = {
  repository: AuthRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  now?: () => Date;
  generateId?: () => string;
};

export class AuthService {
  private readonly now: () => Date;
  private readonly generateId: () => string;

  constructor(private readonly dependencies: AuthServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.generateId = dependencies.generateId ?? randomUUID;
  }

  async login(emailInput: string, password: string, deviceId: string) {
    this.validateDeviceId(deviceId);
    let email: string;
    try { email = normalizeEmail(emailInput); } catch { throw new AuthError("VALIDATION_ERROR", "email must be valid.", 400); }
    if (!password) throw new AuthError("VALIDATION_ERROR", "password is required.", 400);
    const user = await this.dependencies.repository.findUserByEmail(email);
    if (!user || !this.dependencies.hasher.matchesPassword(password, user.passwordHash)) throw new AuthError("INVALID_CREDENTIALS", "Email or password is invalid.");
    if (user.status !== "ACTIVE") throw new AuthError("USER_UNAVAILABLE", "User is unavailable.", 403);
    return this.issueSession(user, deviceId, this.now());
  }

  async refresh(refreshToken: string, deviceId: string) {
    this.validateDeviceId(deviceId);
    const now = this.now();
    let principal: AuthPrincipal;
    try { principal = this.dependencies.tokens.verifyRefreshToken(refreshToken, now); } catch { throw new AuthError("INVALID_REFRESH_TOKEN", "Refresh token is invalid."); }
    if (principal.deviceId !== deviceId) throw new AuthError("INVALID_REFRESH_TOKEN", "Refresh token is invalid.");
    const session = await this.dependencies.repository.findActiveDeviceSessionByRefreshHash(this.dependencies.hasher.hash(refreshToken), deviceId, now);
    if (!session || session.userId !== principal.userId) throw new AuthError("INVALID_REFRESH_TOKEN", "Refresh token is invalid.");
    const user = await this.requireActiveUser(principal.userId);
    return this.issueSession(user, deviceId, now);
  }

  async logout(principal: AuthPrincipal): Promise<void> { await this.dependencies.repository.revokeDeviceSession(principal.userId, principal.deviceId, this.now()); }
  authenticateAccessToken(token: string): AuthPrincipal { return this.dependencies.tokens.verifyAccessToken(token, this.now()); }
  async me(principal: AuthPrincipal) {
    const user = await this.requireActiveUser(principal.userId);
    return { ...this.toPublicUser(user), loyalty: user.loyalty };
  }

  private async issueSession(user: AuthUser, deviceId: string, now: Date) {
    const issued = this.dependencies.tokens.issueTokens({ userId: user.id, deviceId }, now);
    await this.dependencies.repository.upsertDeviceSession({ id: this.generateId(), userId: user.id, deviceId, refreshTokenHash: this.dependencies.hasher.hash(issued.refreshToken), expiresAt: issued.refreshExpiresAt, revokedAt: null });
    return { access_token: issued.accessToken, refresh_token: issued.refreshToken, expires_in: issued.expiresIn, user: this.toPublicUser(user) };
  }

  private async requireActiveUser(userId: string): Promise<AuthUser> {
    const user = await this.dependencies.repository.findUserById(userId);
    if (!user || user.status !== "ACTIVE") throw new AuthError("USER_UNAVAILABLE", "User is unavailable.", 403);
    return user;
  }

  private validateDeviceId(deviceId: string): void {
    if (!deviceId || deviceId.length > 255) throw new AuthError("VALIDATION_ERROR", "device_id is required.", 400);
  }

  private toPublicUser(user: AuthUser) { return { id: user.id, email: user.email, phone: user.phone, display_name: user.displayName }; }
}
