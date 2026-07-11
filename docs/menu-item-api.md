# Menu Item Read API Specification

## Purpose

This API lets an authenticated AI assistant or client resolve multiple candidate menu-item IDs before creating an order quote.

The response is advisory. `POST /api/order-quotes` remains responsible for authoritative item, price, availability, and modifier validation. `POST /api/orders` rechecks and decrements stock atomically.

## Authentication

The endpoint requires a valid user access token:

```http
Authorization: Bearer <access_token>
```

## Read Menu Items

### `GET /api/menu-items`

Reads multiple menu items using one database query and classifies every requested ID as available, unavailable, or missing.

### Query parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `ids` | Yes | Comma-separated list containing at most 100 distinct menu-item UUIDs. |

Rules:

- Whitespace around each ID is ignored.
- Duplicate IDs are removed while preserving their first requested position.
- Empty values are invalid, including a trailing comma.
- Every value must be a UUID.
- Returned `items`, `missing_ids`, and `unavailable_ids` follow the de-duplicated request order within their respective arrays.

### Example request

```http
GET /api/menu-items?ids=b76ec12a-3718-4fc2-b3ae-008ed299ca19,b9d22478-0084-46e0-9a66-54a3dd4c867f
Authorization: Bearer <access_token>
```

### Success response

Status: `200 OK`

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
  "missing_ids": [],
  "unavailable_ids": [
    "b9d22478-0084-46e0-9a66-54a3dd4c867f"
  ]
}
```

### Response fields

| Field | Type | Description |
| --- | --- | --- |
| `items` | array | Existing items where `is_available` is true and `stock_quantity` is greater than zero. |
| `items[].id` | UUID | Internal menu-item identifier accepted by the quote API. |
| `items[].name` | string | Current catalog item name. |
| `items[].description` | string or null | Current catalog description. |
| `items[].price` | integer | Current unit price in the smallest whole VND denomination used by the system. |
| `items[].currency` | string | Catalog currency; currently `VND`. |
| `items[].image_url` | string or null | Catalog image URL or asset path. |
| `items[].is_available` | boolean | Always `true` for returned items. |
| `items[].stock_quantity` | integer | Current stock snapshot; the API does not reserve this quantity. |
| `items[].modifier_groups` | array | Modifier groups linked to the menu item. |
| `modifier_groups[].min_select` | integer | Minimum number of options required by the group. |
| `modifier_groups[].max_select` | integer | Maximum number of options accepted by the group. |
| `modifier_groups[].options` | array | Currently available modifier options only. |
| `options[].price_delta` | integer | Amount added to the item price when the option is selected. |
| `missing_ids` | UUID array | Requested IDs that do not exist. |
| `unavailable_ids` | UUID array | Existing items that are disabled or have zero stock. |

## Errors

All errors use this envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ids must contain UUID values."
  }
}
```

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `ids` is missing, contains an empty or invalid UUID value, or contains more than 100 distinct IDs. |
| `401` | `UNAUTHORIZED` | The access token is missing, invalid, or expired. |
| `404` | `NOT_FOUND` | The route is unavailable because catalog dependencies were not configured. |

## Behavioral Notes

- The endpoint is read-only and never changes or reserves stock.
- A successful lookup does not guarantee later quote or order creation because catalog availability and stock may change.
- Clients must use returned `id` and modifier option `id` values when calling `POST /api/order-quotes`.
- Clients should stop quote creation when any required item appears in `missing_ids` or `unavailable_ids`.
