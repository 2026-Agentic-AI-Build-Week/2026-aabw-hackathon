# Menu Item Stock Design

## Goal

Track finite stock for every menu item and prevent an order from being created when any requested item does not have enough stock.

## Data Model

- Add `stockQuantity Int @default(0) @map("stock_quantity")` to `MenuItem`.
- Add a database check constraint requiring `stock_quantity >= 0`.
- Existing menu items receive stock `0` during migration.
- Update seed data to assign a positive demo stock quantity so seeded items remain orderable.

## Quote Behavior

Quote creation continues to validate `isAvailable` and pricing. It does not reserve or decrement stock because quotes can expire or never be confirmed.

## Order Creation Behavior

- Stock is decremented inside the existing order-creation database transaction.
- For every quote item with a `menuItemId`, issue a conditional bulk update matching the item ID, `isAvailable = true`, and `stockQuantity >= requested quantity`.
- The update decrements `stockQuantity` by the requested quantity.
- Exactly one row must be updated for every item. Otherwise, throw `OrderError` with code `INSUFFICIENT_STOCK` and HTTP status `409`.
- Perform stock decrements before inserting the order. Any failure rolls back all previous decrements and prevents order and quote changes.
- Idempotent retries that return an existing order do not decrement stock again.

## Concurrency

The conditional database update makes the stock check and decrement atomic. Concurrent orders cannot both consume the same remaining units because only an update whose current stock is sufficient can succeed.

## Cancellation

Cancellation does not restore stock in this change. Restocking requires an explicit business rule about preparation status and is outside this scope.

## Verification

- A successful order decrements each ordered menu item's stock.
- An order with insufficient stock returns `INSUFFICIENT_STOCK` and creates no order.
- A multi-item failure rolls back decrements made for earlier items.
- An idempotent retry does not decrement stock twice.
- Prisma schema validation, TypeScript checking, and the backend test suite pass.
