import type { PrismaClient } from "@prisma/client";

export type MenuItemLookup = {
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    image_url: string | null;
    is_available: true;
    stock_quantity: number;
    modifier_groups: Array<{
      id: string;
      name: string;
      min_select: number;
      max_select: number;
      options: Array<{ id: string; name: string; price_delta: number; is_available: true }>;
    }>;
  }>;
  missing_ids: string[];
  unavailable_ids: string[];
};

export class MenuItemService {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIds(ids: string[]): Promise<MenuItemLookup> {
    const records = await this.prisma.menuItem.findMany({
      where: { id: { in: ids } },
      include: {
        modifierGroups: {
          orderBy: { displayOrder: "asc" },
          include: {
            modifierGroup: {
              include: {
                options: { where: { isAvailable: true }, orderBy: { displayOrder: "asc" } },
              },
            },
          },
        },
      },
    });
    const byId = new Map(records.map((record) => [record.id, record]));
    const items: MenuItemLookup["items"] = [];
    const missingIds: string[] = [];
    const unavailableIds: string[] = [];

    for (const id of ids) {
      const record = byId.get(id);
      if (!record) {
        missingIds.push(id);
        continue;
      }
      if (!record.isAvailable || record.stockQuantity <= 0) {
        unavailableIds.push(id);
        continue;
      }
      items.push({
        id: record.id,
        name: record.name,
        description: record.description,
        price: record.price,
        currency: record.currency,
        image_url: record.imageUrl,
        is_available: true,
        stock_quantity: record.stockQuantity,
        modifier_groups: record.modifierGroups.map((link) => ({
          id: link.modifierGroup.id,
          name: link.modifierGroup.name,
          min_select: link.modifierGroup.minChoices,
          max_select: link.modifierGroup.maxChoices,
          options: link.modifierGroup.options.map((option) => ({
            id: option.id,
            name: option.name,
            price_delta: option.priceDelta,
            is_available: true,
          })),
        })),
      });
    }

    return { items, missing_ids: missingIds, unavailable_ids: unavailableIds };
  }
}
