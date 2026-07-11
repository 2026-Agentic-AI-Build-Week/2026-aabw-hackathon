import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import catalog from "../../../assets/data/kfc_catalog.json" with { type: "json" };
import { PasswordHasher } from "../src/auth/password-hasher.js";
import { normalizeEmail, normalizeVietnamPhone } from "../src/lib/normalization.js";

const prisma = new PrismaClient();
const now = new Date();
const day = 24 * 60 * 60 * 1000;

type CatalogItem = (typeof catalog.items)[number];

const passwordHasher = new PasswordHasher(process.env.AUTH_TOKEN_PEPPER ?? "development-token-pepper-change-me-00000000");

async function seedCatalog() {
  const categoryIds = new Map<string, string>();

  for (const category of catalog.categories) {
    const record = await prisma.category.upsert({
      where: { externalId: category.id },
      update: {
        name: category.name,
        slug: category.slug,
        sourceUrl: category.url,
        displayOrder: category.display_order,
        isActive: true,
      },
      create: {
        externalId: category.id,
        name: category.name,
        slug: category.slug,
        sourceUrl: category.url,
        displayOrder: category.display_order,
      },
    });
    categoryIds.set(category.id, record.id);
  }

  const activeItemExternalIds = catalog.items.map((item) => item.id);
  await prisma.menuItem.updateMany({
    where: { externalId: { notIn: activeItemExternalIds } },
    data: { isAvailable: false },
  });

  for (const item of catalog.items as CatalogItem[]) {
    const record = await prisma.menuItem.upsert({
      where: { externalId: item.id },
      update: {
        name: item.name,
        slug: item.slug,
        itemType: item.type,
        description: item.description || null,
        price: item.price,
        originalPrice: item.original_price,
        currency: item.currency,
        imageUrl: item.image_url || null,
        productUrl: item.product_url || null,
        isAvailable: item.available,
      },
      create: {
        externalId: item.id,
        name: item.name,
        slug: item.slug,
        itemType: item.type,
        description: item.description || null,
        price: item.price,
        originalPrice: item.original_price,
        currency: item.currency,
        imageUrl: item.image_url || null,
        productUrl: item.product_url || null,
        isAvailable: item.available,
      },
    });

    await prisma.menuItemCategory.deleteMany({ where: { menuItemId: record.id } });
    await prisma.menuItemCategory.createMany({
      data: item.category_ids.map((categoryExternalId) => ({
        menuItemId: record.id,
        categoryId: categoryIds.get(categoryExternalId)!,
      })),
      skipDuplicates: true,
    });
  }
}

async function seedModifiers() {
  const drinkGroup = await prisma.modifierGroup.upsert({
    where: { code: "DRINK_CHOICE" },
    update: { name: "Chọn nước", minChoices: 0, maxChoices: 1, isRequired: false },
    create: { code: "DRINK_CHOICE", name: "Chọn nước", minChoices: 0, maxChoices: 1 },
  });

  for (const [code, name] of [
    ["PEPSI", "Pepsi"],
    ["7UP", "7Up"],
    ["LIPTON", "Lipton"],
  ]) {
    await prisma.modifierOption.upsert({
      where: { groupId_code: { groupId: drinkGroup.id, code } },
      update: { name, priceDelta: 0, isAvailable: true },
      create: { groupId: drinkGroup.id, code, name, priceDelta: 0 },
    });
  }

  const comboItems = await prisma.menuItem.findMany({
    where: { itemType: "combo", isAvailable: true },
    orderBy: { externalId: "asc" },
    take: 3,
  });
  for (const [displayOrder, menuItem] of comboItems.entries()) {
    await prisma.menuItemModifierGroup.upsert({
      where: {
        menuItemId_modifierGroupId: { menuItemId: menuItem.id, modifierGroupId: drinkGroup.id },
      },
      update: { displayOrder },
      create: { menuItemId: menuItem.id, modifierGroupId: drinkGroup.id, displayOrder },
    });
  }
}

async function upsertUser(input: {
  email: string;
  phone: string;
  displayName: string;
  password: string;
  isPhoneVerified: boolean;
  status?: "ACTIVE" | "BLOCKED";
}) {
  const email = normalizeEmail(input.email);
  const phoneNormalized = normalizeVietnamPhone(input.phone);
  return prisma.user.upsert({
    where: { email },
    update: {
      email,
      phone: input.phone,
      phoneNormalized,
      displayName: input.displayName,
      passwordHash: passwordHasher.hashPassword(input.password),
      status: input.status ?? "ACTIVE",
      phoneVerifiedAt: input.isPhoneVerified ? now : null,
    },
    create: {
      email,
      phone: input.phone,
      phoneNormalized,
      displayName: input.displayName,
      passwordHash: passwordHasher.hashPassword(input.password),
      status: input.status ?? "ACTIVE",
      phoneVerifiedAt: input.isPhoneVerified ? now : null,
    },
  });
}

async function seedUsers() {
  const verifiedUser = await upsertUser({
    email: "customer1@example.com",
    phone: "0901 234 567",
    displayName: "Nguyễn An",
    password: "DemoPassword123!",
    isPhoneVerified: true,
  });
  const unverifiedUser = await upsertUser({
    email: "customer2@example.com",
    phone: "0902 345 678",
    displayName: "Trần Bình",
    password: "DemoPassword123!",
    isPhoneVerified: false,
  });
  const blockedUser = await upsertUser({
    email: "blocked@example.com",
    phone: "0903 456 789",
    displayName: "Lê Cường",
    password: "DemoPassword123!",
    isPhoneVerified: true,
    status: "BLOCKED",
  });

  await prisma.userIdentity.upsert({
    where: { channel_externalUserId: { channel: "WEB", externalUserId: "demo-web-customer-1" } },
    update: { userId: verifiedUser.id },
    create: { userId: verifiedUser.id, channel: "WEB", externalUserId: "demo-web-customer-1" },
  });
  await prisma.userIdentity.upsert({
    where: { channel_externalUserId: { channel: "MESSENGER", externalUserId: "demo-messenger-customer-1" } },
    update: { userId: verifiedUser.id },
    create: { userId: verifiedUser.id, channel: "MESSENGER", externalUserId: "demo-messenger-customer-1" },
  });

  await prisma.userAddress.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: { userId: verifiedUser.id, isDefault: true },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      userId: verifiedUser.id,
      label: "Nhà",
      recipientName: verifiedUser.displayName,
      phone: verifiedUser.phone,
      phoneNormalized: verifiedUser.phoneNormalized,
      addressLine: "123 Đường Demo",
      ward: "Phường Bến Nghé",
      district: "Quận 1",
      city: "Hồ Chí Minh",
      isDefault: true,
    },
  });

  await prisma.loyaltyAccount.upsert({
    where: { userId: verifiedUser.id },
    update: { balance: 250 },
    create: { userId: verifiedUser.id, balance: 250 },
  });
  await prisma.loyaltyTransaction.upsert({
    where: { idempotencyKey: "seed-loyalty-customer-1-opening" },
    update: { balanceAfter: 250 },
    create: {
      userId: verifiedUser.id,
      delta: 250,
      balanceAfter: 250,
      reason: "SEED_OPENING_BALANCE",
      idempotencyKey: "seed-loyalty-customer-1-opening",
    },
  });

  return { verifiedUser, unverifiedUser, blockedUser };
}

async function seedVouchers(verifiedUserId: string) {
  const definitions = [
    { name: "Giảm 20K đơn từ 100K", code: "KFC20K", startsAt: new Date(now.getTime() - day), endsAt: new Date(now.getTime() + 30 * day), minimumOrderValue: 100_000, totalQuota: 100, status: "ACTIVE" as const, discountType: "FIXED" as const, discountValue: 20_000 },
    { name: "Voucher đã hết hạn", code: "EXPIRED10", startsAt: new Date(now.getTime() - 30 * day), endsAt: new Date(now.getTime() - day), minimumOrderValue: 0, totalQuota: 100, status: "ACTIVE" as const, discountType: "FIXED" as const, discountValue: 10_000 },
    { name: "Voucher chưa hiệu lực", code: "FUTURE10", startsAt: new Date(now.getTime() + day), endsAt: new Date(now.getTime() + 30 * day), minimumOrderValue: 0, totalQuota: 100, status: "ACTIVE" as const, discountType: "FIXED" as const, discountValue: 10_000 },
    { name: "Đơn tối thiểu 500K", code: "MIN500K", startsAt: new Date(now.getTime() - day), endsAt: new Date(now.getTime() + 30 * day), minimumOrderValue: 500_000, totalQuota: 100, status: "ACTIVE" as const, discountType: "PERCENTAGE" as const, discountValue: 15 },
    { name: "Voucher đã hết quota", code: "SOLDOUT", startsAt: new Date(now.getTime() - day), endsAt: new Date(now.getTime() + 30 * day), minimumOrderValue: 0, totalQuota: 1, status: "ACTIVE" as const, discountType: "FIXED" as const, discountValue: 10_000 },
    { name: "Voucher khách hàng riêng", code: "ANONLY", startsAt: new Date(now.getTime() - day), endsAt: new Date(now.getTime() + 30 * day), minimumOrderValue: 0, totalQuota: 1, status: "ACTIVE" as const, discountType: "FIXED" as const, discountValue: 15_000 },
  ];

  for (const definition of definitions) {
    const { code, ...campaignData } = definition;
    const campaignId = `00000000-0000-4000-8000-${String(definitions.indexOf(definition) + 100).padStart(12, "0")}`;
    const campaign = await prisma.voucherCampaign.upsert({
      where: { id: campaignId },
      update: { ...campaignData, redeemedCount: code === "SOLDOUT" ? 1 : 0 },
      create: { id: campaignId, ...campaignData, redeemedCount: code === "SOLDOUT" ? 1 : 0 },
    });
    await prisma.voucherCode.upsert({
      where: { code },
      update: { campaignId: campaign.id, assignedUserId: code === "ANONLY" ? verifiedUserId : null },
      create: { campaignId: campaign.id, code, assignedUserId: code === "ANONLY" ? verifiedUserId : null },
    });
  }
}

async function seedOrder(input: {
  channel: "WEB" | "MESSENGER";
  sessionKey: string;
  orderNumber: string;
  idempotencyKey: string;
  confirmationTokenHash: string;
  status: "CREATED" | "CONFIRMED";
  historyId: string;
}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "customer1@example.com" } });
  const session = await prisma.conversationSession.upsert({
    where: { sessionKey: input.sessionKey },
    update: { userId: user.id, businessState: "ORDER_CREATED", channel: input.channel },
    create: { sessionKey: input.sessionKey, channel: input.channel, userId: user.id, businessState: "ORDER_CREATED" },
  });
  const menuItem = await prisma.menuItem.findFirstOrThrow({ where: { isAvailable: true }, orderBy: { externalId: "asc" } });
  const subtotal = menuItem.price * 2;
  const quote = await prisma.orderQuote.upsert({
    where: { confirmationTokenHash: input.confirmationTokenHash },
    update: { userId: user.id, sessionId: session.id, subtotal, total: subtotal, status: "CONSUMED" },
    create: { userId: user.id, sessionId: session.id, subtotal, total: subtotal, confirmationTokenHash: input.confirmationTokenHash, expiresAt: new Date(now.getTime() + day), status: "CONSUMED" },
  });
  await prisma.orderQuoteItem.deleteMany({ where: { quoteId: quote.id } });
  await prisma.orderQuoteItem.create({ data: { quoteId: quote.id, menuItemId: menuItem.id, itemName: menuItem.name, quantity: 2, unitPrice: menuItem.price, lineTotal: subtotal } });

  const order = await prisma.order.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: { userId: user.id, sessionId: session.id, quoteId: quote.id, subtotal, total: subtotal, channelSnapshot: input.channel, status: input.status },
    create: { orderNumber: input.orderNumber, userId: user.id, sessionId: session.id, quoteId: quote.id, subtotal, total: subtotal, idempotencyKey: input.idempotencyKey, channelSnapshot: input.channel, status: input.status },
  });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.create({ data: { orderId: order.id, menuItemId: menuItem.id, itemName: menuItem.name, quantity: 2, unitPrice: menuItem.price, lineTotal: subtotal } });
  const address = await prisma.userAddress.findFirstOrThrow({ where: { userId: user.id, isDefault: true } });
  await prisma.orderQuoteDeliveryDetail.upsert({
    where: { quoteId: quote.id },
    update: { emailSnapshot: "customer1@example.com", recipientName: address.recipientName, phoneSnapshot: address.phone, phoneNormalized: address.phoneNormalized, addressLine: address.addressLine, ward: address.ward, district: address.district, city: address.city },
    create: { quoteId: quote.id, emailSnapshot: "customer1@example.com", recipientName: address.recipientName, phoneSnapshot: address.phone, phoneNormalized: address.phoneNormalized, addressLine: address.addressLine, ward: address.ward, district: address.district, city: address.city },
  });
  await prisma.orderDeliveryDetail.upsert({
    where: { orderId: order.id },
    update: { emailSnapshot: "customer1@example.com", recipientName: address.recipientName, phoneSnapshot: address.phone, phoneNormalized: address.phoneNormalized, addressLine: address.addressLine, ward: address.ward, district: address.district, city: address.city, sourceAddressId: address.id },
    create: { orderId: order.id, emailSnapshot: "customer1@example.com", recipientName: address.recipientName, phoneSnapshot: address.phone, phoneNormalized: address.phoneNormalized, addressLine: address.addressLine, ward: address.ward, district: address.district, city: address.city, sourceAddressId: address.id },
  });
  await prisma.orderStatusHistory.upsert({
    where: { id: input.historyId },
    update: { orderId: order.id, toStatus: input.status },
    create: { id: input.historyId, orderId: order.id, toStatus: input.status, actor: "seed" },
  });
}

async function main() {
  await seedCatalog();
  await seedModifiers();
  const { verifiedUser } = await seedUsers();
  await seedVouchers(verifiedUser.id);
  await seedOrder({
    channel: "WEB",
    sessionKey: "seed-web-order-session",
    orderNumber: "KFC-DEMO-0001",
    idempotencyKey: "seed-order-web-1",
    confirmationTokenHash: "seed-order-web-confirmation-token-hash",
    status: "CREATED",
    historyId: "00000000-0000-4000-8000-000000000020",
  });
  await seedOrder({
    channel: "MESSENGER",
    sessionKey: "seed-messenger-order-session",
    orderNumber: "KFC-DEMO-0002",
    idempotencyKey: "seed-order-messenger-1",
    confirmationTokenHash: "seed-order-messenger-confirmation-token-hash",
    status: "CONFIRMED",
    historyId: "00000000-0000-4000-8000-000000000021",
  });
  console.info("Database seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
