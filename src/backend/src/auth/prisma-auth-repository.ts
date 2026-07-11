import type { PrismaClient } from "@prisma/client";
import type { AuthRepository, AuthUser, DeviceSession } from "./auth-repository.js";

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { loyaltyAccount: true } });
    return user ? this.toAuthUser(user) : null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { loyaltyAccount: true } });
    return user ? this.toAuthUser(user) : null;
  }

  async upsertDeviceSession(session: DeviceSession): Promise<void> {
    await this.prisma.authDeviceSession.upsert({
      where: { userId_deviceId: { userId: session.userId, deviceId: session.deviceId } },
      update: { refreshTokenHash: session.refreshTokenHash, expiresAt: session.expiresAt, revokedAt: null },
      create: session,
    });
  }

  async findActiveDeviceSessionByRefreshHash(refreshTokenHash: string, deviceId: string, now: Date): Promise<DeviceSession | null> {
    return this.prisma.authDeviceSession.findFirst({ where: { refreshTokenHash, deviceId, revokedAt: null, expiresAt: { gt: now } } });
  }

  async revokeDeviceSession(userId: string, deviceId: string, now: Date): Promise<void> {
    await this.prisma.authDeviceSession.updateMany({ where: { userId, deviceId, revokedAt: null }, data: { revokedAt: now } });
  }

  private toAuthUser(user: { id: string; email: string; passwordHash: string; phone: string; phoneNormalized: string; displayName: string; status: AuthUser["status"]; loyaltyAccount: { balance: number; status: AuthUser["loyalty"]["status"] } | null }): AuthUser {
    return { id: user.id, email: user.email, passwordHash: user.passwordHash, phone: user.phone, phoneNormalized: user.phoneNormalized, displayName: user.displayName, status: user.status, loyalty: { balance: user.loyaltyAccount?.balance ?? 0, status: user.loyaltyAccount?.status ?? "ACTIVE" } };
  }
}
