import type { OrderStatus } from "@prisma/client";

export type DeliveryDraft = {
  email?: string;
  recipientName?: string;
  phone?: string;
  addressLine?: string;
  ward?: string;
  district?: string;
  city?: string;
};

export type PendingCheckout = {
  quoteId: string;
  confirmationToken: string;
  confirmationPhrase: string;
  expiresAt: string;
  idempotencyKey: string;
};

export type SafeQuoteItem = {
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  modifierTotal: number;
  lineTotal: number;
};

export type SafeQuote = {
  quoteId: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  total: number;
  currency: string;
  expiresAt: string;
  confirmationPhrase: string;
  items: SafeQuoteItem[];
};

export type SafeCreatedOrder = {
  orderId: string;
  status: OrderStatus;
  total: number;
  currency: string;
  createdAt: string;
};

export type CheckoutEvent =
  | { state: "quote_ready"; quote: SafeQuote }
  | { state: "order_created"; order: SafeCreatedOrder };
