import { describe, expect, it } from "vitest";
import { AuthError, AuthService } from "../../src/auth/auth-service.js";
import { InMemoryAuthRepository } from "../../src/auth/in-memory-auth-repository.js";
import { createAuthTestDependencies, createDemoUser } from "./test-helpers.js";

describe("AuthService", () => {
  it("authenticates an active user with email and password", async () => {
    const repository = new InMemoryAuthRepository();
    const dependencies = createAuthTestDependencies(repository);
    repository.addUser(createDemoUser(dependencies, "demo@kfc.local", "DemoPassword123!"));
    const service = new AuthService(dependencies);

    const login = await service.login("  DEMO@KFC.LOCAL ", "DemoPassword123!", "iphone-15");

    expect(login.user).toMatchObject({ email: "demo@kfc.local", display_name: "Demo User" });
    expect(login.access_token).toBeTypeOf("string");
    expect(login.refresh_token).toBeTypeOf("string");
  });

  it("rejects an invalid email or password without revealing which one failed", async () => {
    const repository = new InMemoryAuthRepository();
    const dependencies = createAuthTestDependencies(repository);
    repository.addUser(createDemoUser(dependencies, "demo@kfc.local", "DemoPassword123!"));
    const service = new AuthService(dependencies);

    await expect(service.login("demo@kfc.local", "wrong-password", "device")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(service.login("missing@kfc.local", "DemoPassword123!", "device")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("rotates refresh tokens and revokes the device session on logout", async () => {
    const repository = new InMemoryAuthRepository();
    const dependencies = createAuthTestDependencies(repository);
    repository.addUser(createDemoUser(dependencies, "demo@kfc.local", "DemoPassword123!"));
    const service = new AuthService(dependencies);
    const login = await service.login("demo@kfc.local", "DemoPassword123!", "android-demo");
    const refreshed = await service.refresh(login.refresh_token, "android-demo");
    const principal = dependencies.tokens.verifyAccessToken(login.access_token, new Date("2026-07-11T12:00:00.000Z"));

    expect(refreshed.refresh_token).not.toBe(login.refresh_token);
    await service.logout(principal);
    await expect(service.refresh(refreshed.refresh_token, "android-demo")).rejects.toMatchObject({ code: "INVALID_REFRESH_TOKEN" });
  });

  it("rejects blocked users even with a correct password", async () => {
    const repository = new InMemoryAuthRepository();
    const dependencies = createAuthTestDependencies(repository);
    repository.addUser(createDemoUser(dependencies, "blocked@kfc.local", "DemoPassword123!", "BLOCKED"));

    await expect(new AuthService(dependencies).login("blocked@kfc.local", "DemoPassword123!", "device")).rejects.toMatchObject({ code: "USER_UNAVAILABLE" });
  });
});
