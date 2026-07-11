# Menu Item Stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store finite stock for menu items and atomically decrement it when an order is created.

**Architecture:** `MenuItem` gains a non-negative `stockQuantity` database field whose default is zero. `OrderService.createOrder` conditionally updates each quote item's stock inside its existing interactive Prisma transaction; a failed conditional update raises `INSUFFICIENT_STOCK` and rolls back all prior updates and order writes. Seed data assigns stock only when creating menu items, so reseeding does not overwrite stock adjusted outside the seed process.

**Tech Stack:** PostgreSQL 16, Prisma 6, TypeScript, Vitest 3.

---

## File Structure

- Modify: `src/backend/prisma/schema.prisma` — define `MenuItem.stockQuantity`.
- Create: `src/backend/prisma/migrations/20260711220000_add_menu_item_stock/migration.sql` — add and constrain the database column.
- Modify: `src/backend/prisma/seed.ts` — provide initial stock for newly seeded catalog items without resetting existing stock.
- Modify: `src/backend/src/orders/order-service.ts` — atomically decrement stock while creating an order.
- Create: `src/backend/tests/orders/order-service.test.ts` — verify stock decrement, insufficient stock rollback, and idempotency behavior.

### Task 1: Define and migrate menu-item stock

**Files:**
- Modify: `src/backend/prisma/schema.prisma:116-134`
- Create: `src/backend/prisma/migrations/20260711220000_add_menu_item_stock/migration.sql`

- [ ] **Step 1: Add the Prisma field**

Insert the following field directly after `isAvailable` in `MenuItem`:

```prisma
  stockQuantity          Int                       @default(0) @map("stock_quantity")
```

- [ ] **Step 2: Add the SQL migration**

Create the migration with this complete SQL:

```sql
ALTER TABLE "menu_items"
ADD COLUMN "stock_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "menu_items"
ADD CONSTRAINT "menu_items_stock_quantity_nonnegative"
CHECK ("stock_quantity" >= 0);
```

- [ ] **Step 3: Validate the schema**

Run: `npm --prefix src/backend run lint`

Expected: TypeScript and `prisma validate` complete with exit code 0.

### Task 2: Preserve stock when seeding catalog data

**Files:**
- Modify: `src/backend/prisma/seed.ts:48-75`

- [ ] **Step 1: Add stock only to the creation path**

Add `stockQuantity: item.available ? 100 : 0` to the `create` data object for `prisma.menuItem.upsert`. Do not add it to the `update` object, so repeated seeding updates catalog metadata and availability without replenishing stock unexpectedly.

The relevant creation tail becomes:

```ts
        imageUrl: item.image_url || null,
        productUrl: item.product_url || null,
        isAvailable: item.available,
        stockQuantity: item.available ? 100 : 0,
```

- [ ] **Step 2: Regenerate the Prisma client**

Run: `npm --prefix src/backend run db:generate`

Expected: Prisma Client generation completes successfully.

### Task 3: Write order-stock tests first

**Files:**
- Create: `src/backend/tests/orders/order-service.test.ts`

- [ ] **Step 1: Add a reusable in-memory Prisma transaction mock**

Create test helpers with a mutable `stockByMenuItemId` map and methods for the service's required calls. The conditional `menuItem.updateMany` mock must return `{ count: 1 }` only when its `where` has a matching ID, `isAvailable: true`, and enough remaining stock; otherwise return `{ count: 0 }`.

```ts
const updateMany = vi.fn(async ({ where, data }) => {
  const menuItemId = where.id as string;
  const requiredQuantity = (where.stockQuantity as { gte: number }).gte;
  const currentStock = stockByMenuItemId.get(menuItemId);
  if (where.isAvailable !== true || currentStock === undefined || currentStock < requiredQuantity) return { count: 0 };
  stockByMenuItemId.set(menuItemId, currentStock - (data.stockQuantity as { decrement: number }).decrement);
  return { count: 1 };
});
```

- [ ] **Step 2: Add the successful decrement test**

Set stock for `item-1` to `3`, return an active quote containing quantity `2`, and assert `createOrder` returns `created: true`, the map contains `1`, and `updateMany` receives:

```ts
{
  where: { id: "item-1", isAvailable: true, stockQuantity: { gte: 2 } },
  data: { stockQuantity: { decrement: 2 } },
}
```

- [ ] **Step 3: Add the insufficient-stock rollback test**

Use a two-item quote with initial stock `{ "item-1": 3, "item-2": 1 }` and requested quantities `2` and `2`. Make the mocked interactive transaction restore a copied stock map if its callback rejects. Assert rejection matches `OrderError` code `INSUFFICIENT_STOCK`, both map values remain `3` and `1`, `order.create` is not called, and `orderQuote.update` is not called.

- [ ] **Step 4: Add the idempotency test**

Configure `order.findUnique` to return an existing order for the same user and quote. Assert `createOrder` returns `created: false`, leaves stock unchanged, and never calls `$transaction` or `menuItem.updateMany`.

- [ ] **Step 5: Run the focused tests to establish failure**

Run: `npm --prefix src/backend test -- tests/orders/order-service.test.ts`

Expected: FAIL because `OrderService` has not yet called `menuItem.updateMany` or raised `INSUFFICIENT_STOCK`.

### Task 4: Atomically decrement stock during order creation

**Files:**
- Modify: `src/backend/src/orders/order-service.ts:58-74`

- [ ] **Step 1: Add the conditional stock decrement loop**

After quote validation and before `transaction.order.create`, add this loop:

```ts
      for (const item of quote.items) {
        if (!item.menuItemId) continue;
        const result = await transaction.menuItem.updateMany({
          where: { id: item.menuItemId, isAvailable: true, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (result.count !== 1) throw new OrderError("INSUFFICIENT_STOCK", "A menu item does not have enough stock.", 409);
      }
```

This runs before order insertion so a later insufficient item aborts the full interactive transaction and restores earlier decrements.

- [ ] **Step 2: Run the focused order-service tests**

Run: `npm --prefix src/backend test -- tests/orders/order-service.test.ts`

Expected: PASS with all stock success, rollback, and idempotency assertions passing.

### Task 5: Apply and verify end-to-end backend checks

**Files:**
- Modify: `docs/order-api.md` only if it claims all available items are immediately orderable; otherwise no documentation change is required because no endpoint contract is added.

- [ ] **Step 1: Inspect existing API wording**

Run: `rg -n -i "available|quote|stock|inventory" docs/order-api.md`

Expected: If the document says availability alone guarantees orderability, amend it to state final stock validation occurs when confirming an order; otherwise leave it unchanged.

- [ ] **Step 2: Apply the migration locally**

Run: `docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml up -d && npm --prefix src/backend run db:migrate:dev`

Expected: PostgreSQL starts and the new migration applies successfully.

- [ ] **Step 3: Seed the database**

Run: `npm --prefix src/backend run db:seed`

Expected: Seed completes and newly created available menu items have stock `100`.

- [ ] **Step 4: Run full static checks and tests**

Run: `npm --prefix src/backend run lint && npm --prefix src/backend test`

Expected: Both commands exit with code 0.

- [ ] **Step 5: Review the final diff**

Run: `git diff --check && git status --short`

Expected: No whitespace errors; only the schema, migration, seed, service, test, and necessary documentation/plan files appear.
