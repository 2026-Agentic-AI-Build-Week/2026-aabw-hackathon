import type { AuthRepository, AuthUser } from "../../src/auth/auth-repository.js";
import { PasswordHasher } from "../../src/auth/password-hasher.js";
import { TokenService } from "../../src/auth/token-service.js";
import type { AuthServiceDependencies } from "../../src/auth/auth-service.js";

export function createAuthTestDependencies(repository: AuthRepository): AuthServiceDependencies {
  let sequence = 0;
  return {
    repository,
    hasher: new PasswordHasher("test-pepper"),
    tokens: new TokenService("test-access-secret-at-least-32-characters", "test-refresh-secret-at-least-32-characters", 300, 3600),
    now: () => new Date("2026-07-11T12:00:00.000Z"),
    generateId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  };
}

export function createDemoUser(dependencies: AuthServiceDependencies, email: string, password: string, status: AuthUser["status"] = "ACTIVE"): AuthUser {
  return { id: crypto.randomUUID(), email, passwordHash: dependencies.hasher.hashPassword(password), phone: "+84901234567", phoneNormalized: "+84901234567", displayName: "Demo User", status, loyalty: { balance: 0, status: "ACTIVE" } };
}
