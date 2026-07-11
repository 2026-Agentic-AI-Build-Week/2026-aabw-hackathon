export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  phone: string;
  phoneNormalized: string;
  displayName: string;
  status: "ACTIVE" | "BLOCKED" | "DELETED";
  loyalty: { balance: number; status: "ACTIVE" | "SUSPENDED" };
};

export type DeviceSession = {
  id: string;
  userId: string;
  deviceId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  upsertDeviceSession(session: DeviceSession): Promise<void>;
  findActiveDeviceSessionByRefreshHash(refreshTokenHash: string, deviceId: string, now: Date): Promise<DeviceSession | null>;
  revokeDeviceSession(userId: string, deviceId: string, now: Date): Promise<void>;
}
