import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthApplication } from "../../src/http/app.js";
import { InMemoryAuthRepository } from "../../src/auth/in-memory-auth-repository.js";
import { createAuthTestDependencies } from "../auth/test-helpers.js";

const availableId = "11111111-1111-4111-8111-111111111111";
const unavailableId = "22222222-2222-4222-8222-222222222222";
const missingId = "33333333-3333-4333-8333-333333333333";
const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function createTestContext(menuItems: unknown[]) {
  const dependencies = createAuthTestDependencies(new InMemoryAuthRepository());
  const findMany = vi.fn(async () => menuItems);
  const prisma = { menuItem: { findMany } };
  const accessToken = dependencies.tokens.issueTokens(
    { userId: "user-1", deviceId: "device-1" },
    dependencies.now?.() ?? new Date("2026-07-11T12:00:00.000Z"),
  ).accessToken;
  return { dependencies, prisma, findMany, authorization: `Bearer ${accessToken}` };
}

describe("menu item HTTP API", () => {
  it("returns available menu items in requested order and classifies unresolved IDs", async () => {
    const context = createTestContext([
      {
        id: unavailableId,
        name: "Unavailable item",
        description: null,
        price: 40_000,
        currency: "VND",
        imageUrl: null,
        isAvailable: false,
        stockQuantity: 10,
        modifierGroups: [],
      },
      {
        id: availableId,
        name: "Burger Zinger",
        description: "Spicy chicken burger",
        price: 55_000,
        currency: "VND",
        imageUrl: "/assets/zinger.jpg",
        isAvailable: true,
        stockQuantity: 20,
        modifierGroups: [
          {
            displayOrder: 0,
            modifierGroup: {
              id: "44444444-4444-4444-8444-444444444444",
              name: "Choose a drink",
              minChoices: 1,
              maxChoices: 1,
              options: [
                { id: "55555555-5555-4555-8555-555555555555", name: "Pepsi", priceDelta: 0, isAvailable: true, displayOrder: 0 },
                { id: "66666666-6666-4666-8666-666666666666", name: "Hidden drink", priceDelta: 0, isAvailable: false, displayOrder: 1 },
              ],
            },
          },
        ],
      },
    ]);
    const application = await createAuthApplication(context.dependencies, context.prisma as never).listen(0);
    servers.push(application);

    const response = await application.request(`/api/menu-items?ids=${availableId},${unavailableId},${missingId},${availableId}`, {
      headers: { authorization: context.authorization },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: availableId,
          name: "Burger Zinger",
          description: "Spicy chicken burger",
          price: 55_000,
          currency: "VND",
          image_url: "/assets/zinger.jpg",
          is_available: true,
          stock_quantity: 20,
          modifier_groups: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              name: "Choose a drink",
              min_select: 1,
              max_select: 1,
              options: [{ id: "55555555-5555-4555-8555-555555555555", name: "Pepsi", price_delta: 0, is_available: true }],
            },
          ],
        },
      ],
      missing_ids: [missingId],
      unavailable_ids: [unavailableId],
    });
    expect(context.findMany).toHaveBeenCalledTimes(1);
    expect(context.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [availableId, unavailableId, missingId] } } }));
  });

  it.each([
    ["missing ids", "/api/menu-items"],
    ["empty id", `/api/menu-items?ids=${availableId},`],
    ["invalid UUID", "/api/menu-items?ids=not-a-uuid"],
    ["more than 100 IDs", `/api/menu-items?ids=${Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`).join(",")}`],
  ])("returns validation error for %s", async (_name, path) => {
    const context = createTestContext([]);
    const application = await createAuthApplication(context.dependencies, context.prisma as never).listen(0);
    servers.push(application);

    const response = await application.request(path, { headers: { authorization: context.authorization } });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(context.findMany).not.toHaveBeenCalled();
  });

  it("requires a valid access token", async () => {
    const context = createTestContext([]);
    const application = await createAuthApplication(context.dependencies, context.prisma as never).listen(0);
    servers.push(application);

    const response = await application.request(`/api/menu-items?ids=${availableId}`);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(context.findMany).not.toHaveBeenCalled();
  });
});
