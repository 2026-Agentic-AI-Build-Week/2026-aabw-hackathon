import { randomBytes, randomUUID } from "node:crypto";
import type { CheckoutEvent, DeliveryDraft, SafeCreatedOrder, SafeQuote } from "./checkout-types.js";
import { withPendingCheckout, type OrderDraft } from "./order-draft.js";
import type { QuoteInput } from "../orders/order-input.js";
import { OrderError, type OrderService } from "../orders/order-service.js";
import { confirmationPhrasesMatch } from "./checkout-confirmation.js";

type QuoteResponseSource = Awaited<ReturnType<OrderService["createQuote"]>>;
type QuoteItemSource = QuoteResponseSource["items"][number];
type QuoteResponse = Omit<QuoteResponseSource, "items"> & {
  items: Array<Pick<QuoteItemSource, "menuItemId" | "itemName" | "quantity" | "unitPrice" | "modifierTotal" | "lineTotal">>;
};
type CreatedOrderResponse = Awaited<ReturnType<OrderService["createOrder"]>>;
type SafeOrderSource = Pick<CreatedOrderResponse["order"], "id" | "status" | "total" | "currency" | "createdAt">;

export type OrderServicePort = {
  createQuote(...args: Parameters<OrderService["createQuote"]>): Promise<QuoteResponse>;
  createOrder(...args: Parameters<OrderService["createOrder"]>): Promise<{ order: SafeOrderSource; created: CreatedOrderResponse["created"] }>;
};

export type CheckoutServiceErrorCode =
  | "ITEM_UNAVAILABLE"
  | "MODIFIER_INVALID"
  | "VOUCHER_INVALID"
  | "SESSION_EXPIRED"
  | "QUOTE_EXPIRED"
  | "INSUFFICIENT_STOCK";

export class CheckoutServiceError extends Error {
  constructor(public readonly code: CheckoutServiceErrorCode) {
    super(code);
    this.name = "CheckoutServiceError";
  }
}

export type CheckoutGenerators = {
  confirmationPhrase(): string;
  idempotencyKey(): string;
};

const secureGenerators: CheckoutGenerators = {
  confirmationPhrase: () => `CONFIRM ${randomBytes(2).toString("hex").toUpperCase()}`,
  idempotencyKey: () => randomUUID(),
};

type DeliveryField = "email" | "recipientName" | "phone" | "addressLine" | "city";

export type CheckoutErrorCode =
  | "EMPTY_CART"
  | "DELIVERY_INCOMPLETE"
  | "ITEM_UNAVAILABLE"
  | "MODIFIER_INVALID"
  | "VOUCHER_INVALID"
  | "ORDER_VALIDATION_FAILED"
  | "SESSION_EXPIRED"
  | "NO_PENDING_QUOTE"
  | "CONFIRMATION_MISMATCH"
  | "QUOTE_EXPIRED"
  | "INSUFFICIENT_STOCK"
  | "CHECKOUT_FAILED";

export type CheckoutResult = {
  draft: OrderDraft;
  event?: CheckoutEvent;
  errorCode?: CheckoutErrorCode;
  message?: string;
  missingFields?: DeliveryField[];
};

const requiredDeliveryFields: DeliveryField[] = ["email", "recipientName", "phone", "addressLine", "city"];

export class CheckoutOrchestrator {
  constructor(
    private readonly orderService: OrderServicePort,
    private readonly now = () => new Date(),
    private readonly generators: CheckoutGenerators = secureGenerators,
  ) {}

  async requestQuote(userId: string, sessionId: string, draft: OrderDraft): Promise<CheckoutResult> {
    if (draft.items.length === 0) {
      return failure(draft, "EMPTY_CART", "Add at least one item before requesting a quote.");
    }

    const missingFields = findMissingDeliveryFields(draft.delivery);
    if (missingFields.length > 0) {
      return {
        ...failure(draft, "DELIVERY_INCOMPLETE", `Please provide the missing delivery details: ${missingFields.join(", ")}.`),
        missingFields,
      };
    }

    try {
      const quote = await this.orderService.createQuote(userId, toQuoteInput(sessionId, draft, draft.delivery!));
      const confirmationPhrase = this.generators.confirmationPhrase();
      const pendingCheckout = {
        quoteId: quote.quote_id,
        confirmationToken: quote.confirmation_token,
        confirmationPhrase,
        expiresAt: quote.expires_at,
        idempotencyKey: this.generators.idempotencyKey(),
      };
      const safeQuote: SafeQuote = {
        quoteId: quote.quote_id,
        subtotal: quote.subtotal,
        discountAmount: quote.discount_amount,
        deliveryFee: quote.delivery_fee,
        total: quote.total,
        currency: quote.currency,
        expiresAt: quote.expires_at,
        confirmationPhrase,
        items: quote.items.map((item) => ({
          menuItemId: requireMenuItemId(item.menuItemId),
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          modifierTotal: item.modifierTotal,
          lineTotal: item.lineTotal,
        })),
      };

      return {
        draft: withPendingCheckout(draft, pendingCheckout),
        event: { state: "quote_ready", quote: safeQuote },
      };
    } catch (error) {
      return translateOrderFailure(draft, error);
    }
  }

  async confirmOrder(userId: string, draft: OrderDraft, confirmationPhrase: string): Promise<CheckoutResult> {
    const pendingCheckout = draft.pendingCheckout;
    if (!pendingCheckout) {
      return failure(draft, "NO_PENDING_QUOTE", "Request an order quote before confirming your order.");
    }
    if (!confirmationPhrasesMatch(confirmationPhrase, pendingCheckout.confirmationPhrase)) {
      return failure(draft, "CONFIRMATION_MISMATCH", `Enter ${pendingCheckout.confirmationPhrase} exactly to confirm this order.`);
    }
    if (!isValidFutureTimestamp(pendingCheckout.expiresAt, this.now())) {
      return failure(draft, "QUOTE_EXPIRED", "This quote has expired. Request a new quote before confirming.");
    }

    try {
      const result = await this.orderService.createOrder(
        userId,
        pendingCheckout.quoteId,
        pendingCheckout.confirmationToken,
        pendingCheckout.idempotencyKey,
      );
      const safeOrder: SafeCreatedOrder = {
        orderId: result.order.id,
        status: result.order.status,
        total: result.order.total,
        currency: result.order.currency,
        createdAt: result.order.createdAt.toISOString(),
      };
      return {
        draft: withPendingCheckout(draft, null),
        event: { state: "order_created", order: safeOrder },
      };
    } catch (error) {
      return translateOrderFailure(draft, error);
    }
  }
}

function findMissingDeliveryFields(delivery: DeliveryDraft | null | undefined): DeliveryField[] {
  return requiredDeliveryFields.filter((field) => !delivery?.[field]?.trim());
}

function toQuoteInput(sessionId: string, draft: OrderDraft, delivery: DeliveryDraft): QuoteInput {
  return {
    sessionId,
    items: draft.items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity, modifiers: [] })),
    ...(draft.voucherCode ? { voucherCode: draft.voucherCode } : {}),
    delivery: {
      email: delivery.email!,
      recipientName: delivery.recipientName!,
      phone: delivery.phone!,
      addressLine: delivery.addressLine!,
      ...(delivery.ward ? { ward: delivery.ward } : {}),
      ...(delivery.district ? { district: delivery.district } : {}),
      city: delivery.city!,
    },
  };
}

function isValidFutureTimestamp(value: string, now: Date): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}

function requireMenuItemId(menuItemId: string | null): string {
  if (!menuItemId) throw new Error("Quote item is missing its menu item identifier.");
  return menuItemId;
}

function failure(draft: OrderDraft, errorCode: CheckoutErrorCode, message: string): CheckoutResult {
  return { draft, errorCode, message };
}

function translateOrderFailure(draft: OrderDraft, error: unknown): CheckoutResult {
  if (error instanceof CheckoutServiceError) {
    return translateStableServiceFailure(draft, error.code);
  }
  if (!(error instanceof OrderError)) {
    return failure(draft, "CHECKOUT_FAILED", "The order service is temporarily unavailable. Please try again.");
  }

  if (error.code === "SESSION_NOT_FOUND") {
    return failure(draft, "SESSION_EXPIRED", "Your chat session expired. Start a new conversation and try again.");
  }
  if (error.code === "QUOTE_EXPIRED" || error.code === "QUOTE_NOT_FOUND" || error.code === "QUOTE_CONSUMED") {
    return failure(draft, "QUOTE_EXPIRED", "This quote is no longer valid. Request a new quote before confirming.");
  }
  if (error.code === "INSUFFICIENT_STOCK") {
    return failure(draft, "INSUFFICIENT_STOCK", "Some items no longer have enough stock. Update the cart and request a new quote.");
  }
  if (error.code === "VALIDATION_ERROR") {
    return failure(draft, "ORDER_VALIDATION_FAILED", "The order details are no longer valid. Review the cart, options, and voucher before trying again.");
  }
  return failure(draft, "CHECKOUT_FAILED", "The order could not be processed. Please review the order and try again.");
}

function translateStableServiceFailure(draft: OrderDraft, code: CheckoutServiceErrorCode): CheckoutResult {
  switch (code) {
    case "ITEM_UNAVAILABLE":
      return failure(draft, code, "A selected menu item is unavailable. Update the cart and try again.");
    case "MODIFIER_INVALID":
      return failure(draft, code, "A selected option is no longer valid. Update the item and request another quote.");
    case "VOUCHER_INVALID":
      return failure(draft, code, "The voucher cannot be applied. Remove it or try another voucher.");
    case "SESSION_EXPIRED":
      return failure(draft, code, "Your chat session expired. Start a new conversation and try again.");
    case "QUOTE_EXPIRED":
      return failure(draft, code, "This quote is no longer valid. Request a new quote before confirming.");
    case "INSUFFICIENT_STOCK":
      return failure(draft, code, "Some items no longer have enough stock. Update the cart and request a new quote.");
  }
}
