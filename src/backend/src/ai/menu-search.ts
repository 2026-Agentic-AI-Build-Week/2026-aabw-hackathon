import type { PrismaClient } from "@prisma/client";

export type MenuSearchResult = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
};

export interface MenuSearch {
  search(query: string): Promise<MenuSearchResult[]>;
}

const menuIntentKeywords = ["burger", "chicken", "chickens", "wing", "wings", "tender", "tenders", "combo", "drink", "pepsi", "rice", "fried", "gà", "cánh", "miếng", "nước", "cơm", "khoai", "món", "menu", "giá"];

const menuAliases: Array<{ matches: RegExp; terms: string[] }> = [
  { matches: /\btenders?\b/i, terms: ["tender", "gà rán tender"] },
  { matches: /\b(chicken )?wings?\b|cánh gà/i, terms: ["cánh gà", "gà rán", "tender"] },
  { matches: /\bchickens?\b|gà/i, terms: ["gà", "fried chicken", "tender"] },
  { matches: /\bdrinks?\b|nước/i, terms: ["pepsi", "nước"] },
];

export function shouldSearchMenu(text: string): boolean {
  const normalized = normalize(text);
  return menuIntentKeywords.some((keyword) => normalized.includes(normalize(keyword)));
}

export function buildMenuSearchTerms(query: string): string[] {
  const terms = [query.trim()];
  for (const alias of menuAliases) {
    if (alias.matches.test(query)) terms.push(...alias.terms);
  }
  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))].slice(0, 6);
}

export class PrismaMenuSearch implements MenuSearch {
  constructor(private readonly prisma: PrismaClient) {}

  async search(query: string): Promise<MenuSearchResult[]> {
    const terms = buildMenuSearchTerms(query);
    return this.prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        stockQuantity: { gt: 0 },
        OR: terms.flatMap((term) => [
          { name: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ]),
      },
      orderBy: [{ name: "asc" }],
      take: 8,
      select: { id: true, name: true, description: true, price: true, currency: true },
    });
  }
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN");
}
