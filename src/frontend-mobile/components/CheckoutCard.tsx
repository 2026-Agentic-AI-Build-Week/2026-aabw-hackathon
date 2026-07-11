import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { CheckoutEvent, CheckoutLineItem } from '../models/chat';
import { theme } from '../theme';
import { FakeQrCode } from './FakeQrCode';

interface CheckoutCardProps {
  checkout: CheckoutEvent;
  embedded?: boolean;
  onConfirmationPhrasePress: (confirmationPhrase: string) => void;
}

export function CheckoutCard({ checkout, embedded = false, onConfirmationPhrasePress }: CheckoutCardProps) {
  const { height: viewportHeight } = useWindowDimensions();
  const cardMaximumHeight = viewportHeight * theme.layout.checkoutCardMaximumViewportRatio;

  if (checkout.state === 'order_created') {
    return <CreatedOrderCard checkout={checkout} embedded={embedded} maximumHeight={cardMaximumHeight} />;
  }

  const { quote } = checkout;

  return (
    <View accessibilityLabel="Order quote" style={[styles.card, embedded && styles.embeddedCard, !embedded && { maxHeight: cardMaximumHeight }]}>
      <Text style={styles.title}>Review your order</Text>
      <ScrollView
        contentContainerStyle={styles.itemsContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={[styles.items, { maxHeight: viewportHeight * theme.layout.checkoutItemsMaximumViewportRatio }]}
      >
        {quote.items.map((item, index) => <QuoteLineItem currency={quote.currency} item={item} key={`${item.menuItemId}-${index}`} />)}
      </ScrollView>
      <SummaryRow label="Subtotal" value={formatMoney(quote.subtotal, quote.currency)} />
      <SummaryRow label="Discount" value={formatMoney(quote.discountAmount === 0 ? 0 : -quote.discountAmount, quote.currency)} />
      <SummaryRow label="Delivery" value={formatMoney(quote.deliveryFee, quote.currency)} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatMoney(quote.total, quote.currency)}</Text>
      </View>
      <Text style={styles.expirationText}>{formatExpiry(quote.expiresAt)}</Text>
      <Text style={styles.instructionText}>Send this exact confirmation in chat to place your order.</Text>
      <Pressable
        accessibilityHint="Adds the confirmation phrase to the message input"
        accessibilityRole="button"
        onPress={() => onConfirmationPhrasePress(quote.confirmationPhrase)}
        style={styles.confirmationButton}
      >
        <Text selectable style={styles.confirmationPhrase}>{quote.confirmationPhrase}</Text>
      </Pressable>
    </View>
  );
}

interface CreatedOrderCardProps {
  checkout: CheckoutEvent;
  embedded: boolean;
  maximumHeight: number;
}

function CreatedOrderCard({ checkout, embedded, maximumHeight }: CreatedOrderCardProps) {
  if (checkout.state !== 'order_created') {
    return null;
  }

  return (
    <View accessibilityLabel="Order created" style={[styles.card, styles.createdCard, embedded && styles.embeddedCard, !embedded && { maxHeight: maximumHeight }]}>
      <Text style={styles.createdTitle}>Order created</Text>
      <Text style={styles.createdBody}>Order {checkout.order.orderId}</Text>
      <Text style={styles.createdBody}>Pay with this QR code:</Text>
      <FakeQrCode value={checkout.order.paymentQrCode} />
      <Text selectable style={styles.paymentCode}>{checkout.order.paymentQrCode}</Text>
      <SummaryRow label="Status" value={formatStatus(checkout.order.status)} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatMoney(checkout.order.total, checkout.order.currency)}</Text>
      </View>
    </View>
  );
}

function QuoteLineItem({ currency, item }: { currency: string; item: CheckoutLineItem }) {
  return (
    <View style={styles.lineItem}>
      <Text style={styles.lineItemName}>{item.quantity}× {item.itemName}</Text>
      <Text style={styles.lineItemAmount}>{formatMoney(item.lineTotal, currency)}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function formatMoney(amount: number, currency: string | undefined): string {
  return new Intl.NumberFormat(undefined, {
    currency: currency || 'VND',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

function formatExpiry(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return 'Quote expiry is unavailable.';
  }

  return `Quote expires at ${expiry.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.checkoutSurface,
    borderColor: theme.colors.checkoutBorder,
    borderRadius: theme.radius.lg,
    borderWidth: theme.spacing.xs / theme.spacing.xs,
    gap: theme.spacing.sm,
    flexShrink: 1,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
    overflow: 'hidden',
    padding: theme.spacing.lg,
  },
  createdBody: {
    color: theme.colors.textSecondary,
    ...theme.typography.checkoutBody,
  },
  createdCard: {
    backgroundColor: theme.colors.checkoutSuccessBackground,
  },
  createdTitle: {
    color: theme.colors.checkoutSuccess,
    ...theme.typography.checkoutTitle,
  },
  confirmationButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.checkoutAccent,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  confirmationPhrase: {
    color: theme.colors.chatUserText,
    ...theme.typography.checkoutCode,
  },
  expirationText: {
    color: theme.colors.textSecondary,
    ...theme.typography.checkoutBody,
  },
  embeddedCard: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  instructionText: {
    color: theme.colors.textPrimary,
    ...theme.typography.checkoutBody,
  },
  items: {
    borderBottomColor: theme.colors.checkoutBorder,
    borderBottomWidth: theme.spacing.xs / theme.spacing.xs,
    flexGrow: 0,
    flexShrink: 1,
  },
  itemsContent: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  lineItem: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  lineItemAmount: {
    color: theme.colors.textPrimary,
    ...theme.typography.checkoutBody,
  },
  lineItemName: {
    color: theme.colors.textPrimary,
    flex: 1,
    ...theme.typography.checkoutBody,
  },
  paymentCode: {
    color: theme.colors.textPrimary,
    textAlign: 'center',
    ...theme.typography.checkoutCode,
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    ...theme.typography.checkoutBody,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    ...theme.typography.checkoutBody,
  },
  title: {
    color: theme.colors.checkoutAccent,
    ...theme.typography.checkoutTitle,
  },
  totalLabel: {
    color: theme.colors.textPrimary,
    ...theme.typography.checkoutAmount,
  },
  totalRow: {
    borderTopColor: theme.colors.checkoutBorder,
    borderTopWidth: theme.spacing.xs / theme.spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
  },
  totalValue: {
    color: theme.colors.checkoutAccent,
    ...theme.typography.checkoutAmount,
  },
});
