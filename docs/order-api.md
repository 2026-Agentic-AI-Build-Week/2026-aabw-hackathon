# Order API Specification

## Purpose

This API supports an AI ordering assistant. The assistant resolves natural-language requests into catalog identifiers, creates a time-limited quote, asks the customer to confirm it, and then creates one immutable order from that quote.

`Cart` is not part of the public or persisted ordering workflow. Prices, item names, modifiers, and delivery details are snapshotted by the server when a quote is created.

## Authentication

Every endpoint requires a user access token:

```http
Authorization: Bearer <access_token>
```

The authenticated user owns every quote and order. Clients must not send `user_id`.

## Ordering Workflow

```text
AI resolves user language to candidate menu_item_id values
  -> GET /api/menu-items?ids=<id1>,<id2>
  -> validate available menu items and modifier_option_id values
  -> POST /api/order-quotes
  -> show quote total to customer
  -> customer confirms
  -> POST /api/orders
  -> GET/PATCH/DELETE /api/orders as needed
```

The catalog lookup endpoint is advisory only. `POST /api/order-quotes` remains the authoritative validation of menu-item availability, pricing, and modifier ownership; `POST /api/orders` atomically rechecks and decrements stock.

## Common Errors

Error responses use this envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "items must contain at least one item."
  }
}
```

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing or invalid input, unavailable item/modifier, invalid voucher, or invalid query parameter. |
| `401` | `UNAUTHORIZED` | Access token is missing or invalid. |
| `404` | `SESSION_NOT_FOUND` | The session does not belong to the authenticated user. |
| `404` | `QUOTE_NOT_FOUND` | Quote is absent or belongs to another user. |
| `404` | `ORDER_NOT_FOUND` | Order is absent or belongs to another user. |
| `409` | `QUOTE_EXPIRED` | Quote is expired or no longer active. |
| `409` | `QUOTE_CONSUMED` | Quote has already created an order. |
| `409` | `INVALID_CONFIRMATION_TOKEN` | Quote confirmation token does not match. |
| `409` | `IDEMPOTENCY_CONFLICT` | The idempotency key was used for another user or quote. |
| `409` | `INSUFFICIENT_STOCK` | At least one quoted menu item no longer has enough stock. |
| `409` | `ORDER_NOT_EDITABLE` | Delivery cannot be changed in the current status. |
| `409` | `ORDER_NOT_CANCELLABLE` | Order cannot be cancelled in the current status. |

## Read Menu Items

### `GET /api/menu-items?ids={menu_item_id_1},{menu_item_id_2}`

Returns up to 100 requested menu items in the same de-duplicated order as the `ids` query parameter. It requires a user access token and is intended for checking candidate order items before quote creation.

`ids` is required, must be a comma-separated list of non-empty UUIDs, and may contain at most 100 distinct IDs. Invalid query values return `400 VALIDATION_ERROR`.

- `items` contains only menu items that are enabled and have positive stock.
- `missing_ids` contains requested UUIDs that do not exist.
- `unavailable_ids` contains existing items that are disabled or out of stock.
- Each returned item includes only available modifier options.

### Response body

```json
{
  "items": [
    {
      "id": "b76ec12a-3718-4fc2-b3ae-008ed299ca19",
      "name": "Burger Zinger",
      "description": "Spicy chicken burger",
      "price": 55000,
      "currency": "VND",
      "image_url": "/assets/zinger.jpg",
      "is_available": true,
      "stock_quantity": 20,
      "modifier_groups": [
        {
          "id": "fc262fbc-2b79-4bfe-991f-bd0462d11e26",
          "name": "Choose a drink",
          "min_select": 1,
          "max_select": 1,
          "options": [
            {
              "id": "419b0c35-4db4-40ba-9d58-6a0bc5754eb8",
              "name": "Pepsi",
              "price_delta": 0,
              "is_available": true
            }
          ]
        }
      ]
    }
  ],
  "missing_ids": ["6fb13c9a-1d3d-42f5-a214-6626e37a6288"],
  "unavailable_ids": ["b9d22478-0084-46e0-9a66-54a3dd4c867f"]
}
```

## Create Quote

### `POST /api/order-quotes`

Creates an `ACTIVE` quote that expires after 15 minutes. The server loads the catalog prices and validates that every modifier belongs to the selected menu item.

### Request body

```json
{
  "session_id": "e0bc0f51-3c65-4224-9125-b699e4aece18",
  "items": [
    {
      "menu_item_id": "b76ec12a-3718-4fc2-b3ae-008ed299ca19",
      "quantity": 2,
      "modifiers": [
        {
          "modifier_option_id": "fc262fbc-2b79-4bfe-991f-bd0462d11e26",
          "quantity": 1
        }
      ]
    }
  ],
  "voucher_code": "WELCOME10",
  "delivery": {
    "email": "customer@example.com",
    "recipient_name": "Nguyen Van A",
    "phone": "0901234567",
    "address_line": "123 Nguyen Hue",
    "ward": "Ben Nghe",
    "district": "District 1",
    "city": "Ho Chi Minh City"
  }
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `session_id` | Yes | Must be an existing conversation session owned by the JWT user. |
| `items` | Yes | Non-empty array. |
| `items[].menu_item_id` | Yes | Available catalog menu item UUID. |
| `items[].quantity` | Yes | Positive integer. |
| `items[].modifiers` | No | Array; defaults to `[]`. |
| `items[].modifiers[].modifier_option_id` | Yes | Available option that belongs to the selected item. |
| `items[].modifiers[].quantity` | Yes | Positive integer. |
| `voucher_code` | No | Must be active, eligible, unexpired, and meet campaign minimum order value. |
| `delivery` | Yes | Contains all delivery fields below. |
| `delivery.email`, `recipient_name`, `phone`, `address_line`, `city` | Yes | Non-empty strings; email and Vietnamese phone are normalized/validated. |
| `delivery.ward`, `delivery.district` | No | Non-empty strings when supplied. |

### Response — `201 Created`

```json
{
  "quote_id": "d97c64ac-f9a1-4590-94b9-d222331ffd3f",
  "subtotal": 180000,
  "discount_amount": 18000,
  "delivery_fee": 0,
  "total": 162000,
  "currency": "VND",
  "expires_at": "2026-07-11T14:15:00.000Z",
  "confirmation_token": "opaque-token-returned-once",
  "items": [
    {
      "menuItemId": "b76ec12a-3718-4fc2-b3ae-008ed299ca19",
      "itemName": "Hot Wings",
      "quantity": 2,
      "unitPrice": 90000,
      "modifierTotal": 0,
      "lineTotal": 180000,
      "modifiers": []
    }
  ]
}
```

Store `confirmation_token` only until the customer explicitly confirms. It is not stored or returned by order read endpoints.

## Confirm and Create Order

### `POST /api/orders`

Consumes exactly one active quote, atomically validates and decrements menu-item stock, and copies its financial, item, modifier, and delivery snapshots into an immutable order. Quote creation does not reserve stock.

### Headers

```http
Idempotency-Key: <non-empty-client-generated-key>
```

Use one stable key for a user confirmation attempt. Retrying the identical request returns the previously created order instead of creating a duplicate.

### Request body

```json
{
  "quote_id": "d97c64ac-f9a1-4590-94b9-d222331ffd3f",
  "confirmation_token": "opaque-token-returned-once"
}
```

### Response

- `201 Created` when a new order is created.
- `200 OK` when the same idempotency key returns the already-created order.

The returned Order uses the database field names, for example:

```json
{
  "id": "bff4a4ce-8593-4d43-bf79-10ea8993734f",
  "orderNumber": "KFC-20260711-A13F7D20",
  "status": "CREATED",
  "subtotal": 180000,
  "discountAmount": 18000,
  "deliveryFee": 0,
  "total": 162000,
  "currency": "VND",
  "items": [],
  "deliveryDetail": {},
  "statusHistory": []
}
```

## List Orders

### `GET /api/orders`

Lists only orders owned by the JWT user, sorted newest first.

### Query parameters

| Parameter | Default | Rules |
| --- | --- | --- |
| `page` | `1` | Positive integer. |
| `page_size` | `20` | Positive integer from `1` to `100`. |
| `status` | — | One of `CREATED`, `CONFIRMED`, `PREPARING`, `DELIVERING`, `COMPLETED`, `CANCELLED`. |

### Response — `200 OK`

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 0,
    "total_pages": 0
  }
}
```

## Get Order Detail

### `GET /api/orders/{order_id}`

Returns a full order, including item modifiers, delivery detail, and chronological status history. An order belonging to another user returns `404 ORDER_NOT_FOUND`.

### Response — `200 OK`

Returns the same complete Order object as `POST /api/orders`.

## Update Delivery

### `PATCH /api/orders/{order_id}/delivery`

Only works while the Order status is `CREATED`. Items, totals, vouchers, payment method, quote, and status cannot be changed by this endpoint.

### Request body

```json
{
  "delivery": {
    "email": "customer@example.com",
    "recipient_name": "Nguyen Van A",
    "phone": "0901234567",
    "address_line": "456 Le Loi",
    "ward": "Ben Nghe",
    "district": "District 1",
    "city": "Ho Chi Minh City"
  }
}
```

All required delivery fields follow the same validation as quote creation. Returns the complete updated Order with `200 OK`.

## Cancel Order

### `DELETE /api/orders/{order_id}`

Cancels without physical deletion. It succeeds only from `CREATED` or `CONFIRMED` and adds an `OrderStatusHistory` entry.

### Optional request body

```json
{
  "reason": "Customer changed their mind"
}
```

### Response — `200 OK`

Returns the complete Order with `status: "CANCELLED"`. Repeating the request for an already-cancelled order returns its current representation without adding duplicate history.

## Status Lifecycle

```text
CREATED -> CONFIRMED -> PREPARING -> DELIVERING -> COMPLETED
CREATED -> CANCELLED
CONFIRMED -> CANCELLED
```

The AI/customer API does not advance processing statuses. Those transitions are reserved for fulfillment or back-office services.
