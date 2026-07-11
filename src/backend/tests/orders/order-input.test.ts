import { describe, expect, it } from "vitest";
import { OrderInputError, parseQuoteInput } from "../../src/orders/order-input.js";

describe("parseQuoteInput", () => {
  it("accepts catalog item identifiers and delivery details", () => {
    expect(parseQuoteInput({
      session_id: "session-1",
      items: [{ menu_item_id: "item-1", quantity: 2, modifiers: [{ modifier_option_id: "option-1", quantity: 1 }] }],
      delivery: { email: "customer@example.com", recipient_name: "Customer", phone: "0901234567", address_line: "1 KFC Street", city: "Ho Chi Minh City" },
    })).toMatchObject({ sessionId: "session-1", items: [{ menuItemId: "item-1", quantity: 2 }] });
  });

  it("rejects an empty item list", () => {
    expect(() => parseQuoteInput({
      session_id: "session-1",
      items: [],
      delivery: { email: "customer@example.com", recipient_name: "Customer", phone: "0901234567", address_line: "1 KFC Street", city: "Ho Chi Minh City" },
    })).toThrow(OrderInputError);
  });
});
