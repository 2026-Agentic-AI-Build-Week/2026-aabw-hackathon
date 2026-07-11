import type { AuthRepository, AuthUser, DeviceSession } from "./auth-repository.js";

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUser>();
  private readonly usersByEmail = new Map<string, string>();
  private readonly sessions = new Map<string, DeviceSession>();

  addUser(user: AuthUser) { this.users.set(user.id, user); this.usersByEmail.set(user.email, user.id); }
  async findUserByEmail(email: string) { const id = this.usersByEmail.get(email); return id ? this.users.get(id) ?? null : null; }
  async findUserById(id: string) { return this.users.get(id) ?? null; }
  async upsertDeviceSession(session: DeviceSession) { this.sessions.set(`${session.userId}:${session.deviceId}`, session); }
  async findActiveDeviceSessionByRefreshHash(hash: string, deviceId: string, now: Date) { return [...this.sessions.values()].find((item) => item.refreshTokenHash === hash && item.deviceId === deviceId && !item.revokedAt && item.expiresAt > now) ?? null; }
  async revokeDeviceSession(userId: string, deviceId: string, now: Date) { const key = `${userId}:${deviceId}`; const session = this.sessions.get(key); if (session) this.sessions.set(key, { ...session, revokedAt: now }); }
}
