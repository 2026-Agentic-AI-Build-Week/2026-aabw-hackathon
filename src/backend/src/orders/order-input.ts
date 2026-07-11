export class OrderInputError extends Error {}

export type QuoteInput = {
  sessionId: string;
  items: Array<{ menuItemId: string; quantity: number; modifiers: Array<{ modifierOptionId: string; quantity: number }> }>;
  voucherCode?: string;
  delivery: { email: string; recipientName: string; phone: string; addressLine: string; ward?: string; district?: string; city: string };
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new OrderInputError(`${field} is required.`);
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new OrderInputError(`${field} must be a positive integer.`);
  return value;
}

export function parseQuoteInput(value: unknown): QuoteInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OrderInputError("Request body must be a JSON object.");
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.items) || body.items.length === 0) throw new OrderInputError("items must contain at least one item.");
  const delivery = body.delivery;
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) throw new OrderInputError("delivery is required.");
  const deliveryValue = delivery as Record<string, unknown>;
  return {
    sessionId: requiredString(body.session_id, "session_id"),
    items: body.items.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new OrderInputError(`items[${index}] is invalid.`);
      const itemValue = item as Record<string, unknown>;
      const modifiers = itemValue.modifiers === undefined ? [] : itemValue.modifiers;
      if (!Array.isArray(modifiers)) throw new OrderInputError(`items[${index}].modifiers must be an array.`);
      return { menuItemId: requiredString(itemValue.menu_item_id, `items[${index}].menu_item_id`), quantity: positiveInteger(itemValue.quantity, `items[${index}].quantity`), modifiers: modifiers.map((modifier, modifierIndex) => {
        if (!modifier || typeof modifier !== "object" || Array.isArray(modifier)) throw new OrderInputError(`items[${index}].modifiers[${modifierIndex}] is invalid.`);
        const modifierValue = modifier as Record<string, unknown>;
        return { modifierOptionId: requiredString(modifierValue.modifier_option_id, `items[${index}].modifiers[${modifierIndex}].modifier_option_id`), quantity: positiveInteger(modifierValue.quantity, `items[${index}].modifiers[${modifierIndex}].quantity`) };
      }) };
    }),
    voucherCode: body.voucher_code === undefined ? undefined : requiredString(body.voucher_code, "voucher_code"),
    delivery: { email: requiredString(deliveryValue.email, "delivery.email"), recipientName: requiredString(deliveryValue.recipient_name, "delivery.recipient_name"), phone: requiredString(deliveryValue.phone, "delivery.phone"), addressLine: requiredString(deliveryValue.address_line, "delivery.address_line"), ward: deliveryValue.ward === undefined ? undefined : requiredString(deliveryValue.ward, "delivery.ward"), district: deliveryValue.district === undefined ? undefined : requiredString(deliveryValue.district, "delivery.district"), city: requiredString(deliveryValue.city, "delivery.city") },
  };
}
