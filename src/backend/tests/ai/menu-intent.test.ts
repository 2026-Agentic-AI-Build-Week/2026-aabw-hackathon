import { describe, expect, it } from "vitest";
import type { SafeCreatedOrder } from "../../src/ai/checkout-types.js";
import { parseMenuIntent, type MenuIntent } from "../../src/ai/menu-intent.js";

type IsOptional<Type, Key extends keyof Type> = Record<string, never> extends Pick<Type, Key> ? true : false;
type IsBroadString<Type> = string extends Type ? true : false;

const contractTypeChecks: {
  deliveryIsOptional: IsOptional<MenuIntent, "delivery">;
  confirmationPhraseIsOptional: IsOptional<MenuIntent, "confirmationPhrase">;
  orderStatusIsBroadString: IsBroadString<SafeCreatedOrder["status"]>;
} = {
  deliveryIsOptional: false,
  confirmationPhraseIsOptional: false,
  orderStatusIsBroadString: false,
};

describe("parseMenuIntent", () => {
  it("parses structured item-search intent", () => {
    expect(parseMenuIntent({ action: "SEARCH_ITEM", food_query: "chicken tender", category_query: "fried chicken", item_type: null, quantity: 5, preferences: ["spicy"], referenced_selection: "CURRENT", needs_clarification: false, clarification_question: null })).toMatchObject({ action: "SEARCH_ITEM", foodQuery: "chicken tender", quantity: 5 });
  });

  it("falls back conservatively for malformed provider output", () => {
    expect(parseMenuIntent({}, "Tenders")).toMatchObject({ action: "SEARCH_ITEM", foodQuery: "Tenders", needsClarification: false });
  });

  it("parses a structured combo exclusion preference update", () => {
    expect(parseMenuIntent({
      action: "UPDATE_PREFERENCES",
      preference_updates: {
        exclude_item_types: ["combo"],
        include_item_types: [],
      },
    })).toMatchObject({
      action: "UPDATE_PREFERENCES",
      preferenceUpdates: {
        excludeItemTypes: ["combo"],
        includeItemTypes: [],
      },
    });
  });

  it("allowlists and deduplicates provider menu preference item types", () => {
    expect(parseMenuIntent({
      action: "UPDATE_PREFERENCES",
      preference_updates: {
        exclude_item_types: ["combo", "combo", "dessert", 42],
        include_item_types: ["food", "food", "unknown", null],
      },
    })).toMatchObject({
      preferenceUpdates: {
        excludeItemTypes: ["combo"],
        includeItemTypes: ["food"],
      },
    });
  });

  it("turns malformed preference update data into an empty safe update", () => {
    expect(parseMenuIntent({
      action: "UPDATE_PREFERENCES",
      preference_updates: "exclude combo",
    })).toMatchObject({
      preferenceUpdates: {
        excludeItemTypes: [],
        includeItemTypes: [],
      },
    });
  });

  it.each(["REMOVE_DRAFT_ITEM", "VIEW_DRAFT", "COLLECT_DELIVERY", "REQUEST_QUOTE", "CONFIRM_ORDER"] as const)("accepts the %s checkout action", (action) => {
    expect(parseMenuIntent({ action })).toMatchObject({ action });
  });

  it("parses delivery details into the checkout draft contract", () => {
    expect(parseMenuIntent({
      action: "COLLECT_DELIVERY",
      delivery: {
        email: "taylor@example.com",
        recipient_name: "Taylor",
        phone: "0901234567",
        address_line: "1 Nguyen Hue",
        ward: "Ben Nghe",
        district: "District 1",
        city: "Ho Chi Minh City",
      },
    })).toMatchObject({
      action: "COLLECT_DELIVERY",
      delivery: {
        email: "taylor@example.com",
        recipientName: "Taylor",
        phone: "0901234567",
        addressLine: "1 Nguyen Hue",
        ward: "Ben Nghe",
        district: "District 1",
        city: "Ho Chi Minh City",
      },
    });
  });

  it("captures provider confirmation text as intent data without authorizing an order", () => {
    expect(parseMenuIntent({ action: "CONFIRM_ORDER", confirmation_phrase: "CONFIRM 7A2F" })).toMatchObject({
      action: "CONFIRM_ORDER",
      confirmationPhrase: "CONFIRM 7A2F",
    });
  });

  it("discards malformed delivery fields without accepting non-string values", () => {
    expect(parseMenuIntent({
      action: "COLLECT_DELIVERY",
      delivery: {
        recipient_name: 42,
        phone: ["0901234567"],
        address_line: "  ",
        city: "Ho Chi Minh City",
      },
    })).toMatchObject({
      action: "COLLECT_DELIVERY",
      delivery: { city: "Ho Chi Minh City" },
    });
  });

  it("falls back safely when the checkout action is unknown", () => {
    expect(parseMenuIntent({ action: "PLACE_ORDER_NOW" }, "Please order it")).toMatchObject({
      action: "SEARCH_ITEM",
      foodQuery: "Please order it",
      delivery: null,
      confirmationPhrase: null,
    });
  });

  it("keeps checkout contract fields required and order status constrained", () => {
    expect(contractTypeChecks).toEqual({
      deliveryIsOptional: false,
      confirmationPhraseIsOptional: false,
      orderStatusIsBroadString: false,
    });
  });
});
