import { Prisma, type PrismaClient } from "@prisma/client";
import { sanitizeMenuItemTypes, type MenuItemType } from "./menu-intent.js";

export type MenuBrowseOptions = { excludedItemTypes?: MenuItemType[] };
export type MenuSearchInput = { query: string; categoryQuery?: string | null; itemType?: string | null; categoryIds?: string[]; excludedItemTypes?: MenuItemType[]; limit?: number };
export type MenuSearchResult = { id: string; name: string; slug: string; itemType: string; description: string | null; price: number; currency: string; categories: string[]; score: number };
export type CategorySearchResult = { id: string; name: string; slug: string; score: number };
export interface MenuSearch { browse(limit?: number, options?: MenuBrowseOptions): Promise<MenuSearchResult[]>; search(input: string | MenuSearchInput): Promise<MenuSearchResult[]>; searchCategories(query: string): Promise<CategorySearchResult[]>; }

const menuIntentKeywords = ["burger", "chicken", "chickens", "wing", "wings", "tender", "tenders", "combo", "drink", "pepsi", "rice", "fried", "gà", "cánh", "miếng", "nước", "cơm", "khoai", "món", "menu", "giá"];
const menuAliases: Array<{ matches: RegExp; terms: string[] }> = [
  { matches: /\btenders?\b/i, terms: ["tender", "gà rán tender"] },
  { matches: /\b(chicken )?wings?\b|cánh gà/i, terms: ["cánh gà", "gà rán", "tender"] },
  { matches: /\bchickens?\b|gà/i, terms: ["gà", "fried chicken", "tender"] },
  { matches: /\bdrinks?\b|nước/i, terms: ["pepsi", "nước"] },
];

export function shouldSearchMenu(text: string): boolean { const normalized = normalize(text); return menuIntentKeywords.some((keyword) => normalized.includes(normalize(keyword))); }
export function buildMenuSearchTerms(query: string): string[] { const terms = [query.trim()]; for (const alias of menuAliases) if (alias.matches.test(query)) terms.push(...alias.terms); return [...new Set(terms.map((term) => term.trim()).filter(Boolean))].slice(0, 6); }

type MenuRow = Omit<MenuSearchResult, "categories" | "score"> & { categories: string[] | null; score: number };

export class PrismaMenuSearch implements MenuSearch {
  constructor(private readonly prisma: PrismaClient) {}

  async browse(limit = 8, options: MenuBrowseOptions = {}): Promise<MenuSearchResult[]> {
    const exclusionFilter = buildItemTypeExclusion(options.excludedItemTypes);
    const rows = await this.prisma.$queryRaw<MenuRow[]>(Prisma.sql`
      SELECT mi.id, mi.name, mi.slug, mi.item_type AS "itemType", mi.description, mi.price, mi.currency,
        COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), ARRAY[]::text[]) AS categories,
        0::float8 AS score
      FROM menu_items mi
      LEFT JOIN menu_item_categories mic ON mic.menu_item_id = mi.id
      LEFT JOIN categories c ON c.id = mic.category_id AND c.is_active = true
      WHERE mi.is_available = true AND mi.stock_quantity > 0
        ${exclusionFilter}
      GROUP BY mi.id ORDER BY mi.item_type ASC, mi.price ASC, mi.name ASC LIMIT ${Math.max(1, Math.min(limit, 20))}
    `);
    return rows.map((row) => ({ ...row, categories: row.categories ?? [], score: Number(row.score) }));
  }

  async search(inputValue: string | MenuSearchInput): Promise<MenuSearchResult[]> {
    const input = typeof inputValue === "string" ? { query: inputValue } : inputValue;
    const query = buildMenuSearchTerms(input.query).join(" OR ");
    const limit = Math.max(1, Math.min(input.limit ?? 8, 20));
    const itemTypeFilter = input.itemType ? Prisma.sql`AND mi.item_type = ${input.itemType}` : Prisma.empty;
    const exclusionFilter = buildItemTypeExclusion(input.excludedItemTypes);
    const categoryClause = input.categoryIds?.length ? Prisma.sql`OR mic.category_id IN (${Prisma.join(input.categoryIds.map((categoryId) => Prisma.sql`${categoryId}::uuid`))})` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<MenuRow[]>(Prisma.sql`
      WITH requested AS (SELECT websearch_to_tsquery('simple', immutable_unaccent(${query})) AS query)
      SELECT mi.id, mi.name, mi.slug, mi.item_type AS "itemType", mi.description, mi.price, mi.currency,
        COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), ARRAY[]::text[]) AS categories,
        GREATEST(ts_rank_cd(mi.search_vector, requested.query), similarity(immutable_unaccent(mi.name), immutable_unaccent(${input.query})))::float8 AS score
      FROM menu_items mi CROSS JOIN requested
      LEFT JOIN menu_item_categories mic ON mic.menu_item_id = mi.id
      LEFT JOIN categories c ON c.id = mic.category_id AND c.is_active = true
      WHERE mi.is_available = true AND mi.stock_quantity > 0
        AND (mi.search_vector @@ requested.query OR similarity(immutable_unaccent(mi.name), immutable_unaccent(${input.query})) > 0.2 ${categoryClause})
        ${itemTypeFilter}
        ${exclusionFilter}
      GROUP BY mi.id, requested.query ORDER BY score DESC, mi.name ASC LIMIT ${limit}
    `);
    return rows.map((row) => ({ ...row, categories: row.categories ?? [], score: Number(row.score) }));
  }

  async searchCategories(query: string): Promise<CategorySearchResult[]> {
    return this.prisma.$queryRaw<CategorySearchResult[]>(Prisma.sql`
      WITH requested AS (SELECT websearch_to_tsquery('simple', immutable_unaccent(${query})) AS query)
      SELECT c.id, c.name, c.slug,
        GREATEST(ts_rank_cd(c.search_vector, requested.query), similarity(immutable_unaccent(c.name), immutable_unaccent(${query})))::float8 AS score
      FROM categories c CROSS JOIN requested
      WHERE c.is_active = true AND (c.search_vector @@ requested.query OR similarity(immutable_unaccent(c.name), immutable_unaccent(${query})) > 0.2)
      ORDER BY score DESC, c.display_order ASC LIMIT 5
    `);
  }
}

function buildItemTypeExclusion(values: readonly string[] | undefined): Prisma.Sql {
  const excludedItemTypes = sanitizeMenuItemTypes(values);
  return excludedItemTypes.length > 0
    ? Prisma.sql`AND mi.item_type NOT IN (${Prisma.join(excludedItemTypes)})`
    : Prisma.empty;
}

function normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN"); }
