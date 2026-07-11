import { afterEach, describe, expect, it } from "vitest";
import { createAuthApplication } from "../../src/http/app.js";
import { InMemoryAuthRepository } from "../../src/auth/in-memory-auth-repository.js";
import { createAuthTestDependencies, createDemoUser } from "./test-helpers.js";

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("auth HTTP API", () => {
  it("supports email/password login and authenticated profile lookup", async () => {
    const repository = new InMemoryAuthRepository();
    const dependencies = createAuthTestDependencies(repository);
    repository.addUser(createDemoUser(dependencies, "demo@kfc.local", "DemoPassword123!"));
    const application = await createAuthApplication(dependencies).listen(0);
    servers.push(application);

    const loginResponse = await application.request("/api/auth/login", {
      method: "POST",
      body: { email: "demo@kfc.local", password: "DemoPassword123!", device_id: "simulator" },
    });
    const login = await loginResponse.json();
    const profile = await application.request("/api/auth/me", {
      headers: { authorization: `Bearer ${login.access_token}` },
    });

    expect(loginResponse.status).toBe(200);
    expect(profile.status).toBe(200);
    expect(await profile.json()).toMatchObject({ loyalty: { balance: 0, status: "ACTIVE" } });
  });

  it("returns a stable validation error envelope", async () => {
    const application = await createAuthApplication(createAuthTestDependencies(new InMemoryAuthRepository())).listen(0);
    servers.push(application);

    const response = await application.request("/api/auth/login", { method: "POST", body: { email: "bad", password: "", device_id: "device" } });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns a 500 envelope for unexpected exceptions", async () => {
    class FailingAuthRepository extends InMemoryAuthRepository {
      override async findUserByEmail(): Promise<never> {
        throw new Error("database unavailable");
      }
    }
    const repository = new FailingAuthRepository();
    const dependencies = createAuthTestDependencies(repository);
    repository.addUser(createDemoUser(dependencies, "demo@kfc.local", "DemoPassword123!"));
    const application = await createAuthApplication(dependencies).listen(0);
    servers.push(application);

    const response = await application.request("/api/auth/login", {
      method: "POST",
      body: { email: "demo@kfc.local", password: "DemoPassword123!", device_id: "simulator" },
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });
});
