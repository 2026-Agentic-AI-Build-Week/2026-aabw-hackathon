import type { MenuSearchResult } from "./menu-search.js";

export type SuggestionResolution =
  | { kind: "match"; suggestion: MenuSearchResult }
  | { kind: "ambiguous"; suggestions: MenuSearchResult[] }
  | { kind: "none" };

const ordinalPattern = /^(?:(?:so|mon)\s+)?([1-9]\d*)$/u;
const conversationalSuffixPattern = /\s+(?:di|nhe|nha|please)$/u;
const quantityPrefixPattern = /^\d+\s+(?:(?:cai|phan|suat|mon)\s+)?/u;

export function resolveSuggestion(text: string, suggestions: readonly MenuSearchResult[]): SuggestionResolution {
  const ordinal = readOrdinal(text);
  if (ordinal !== null) {
    const suggestion = suggestions[ordinal];
    return suggestion ? { kind: "match", suggestion } : { kind: "none" };
  }

  const query = normalizeSelectionText(text);
  if (!query) {
    return { kind: "none" };
  }

  for (const matches of [
    suggestions.filter((suggestion) => matchesExact(query, suggestion)),
    suggestions.filter((suggestion) => matchesContainment(query, suggestion)),
    suggestions.filter((suggestion) => matchesTokenSubset(query, suggestion)),
  ]) {
    if (matches.length === 1) {
      return { kind: "match", suggestion: matches[0] };
    }
    if (matches.length > 1) {
      return { kind: "ambiguous", suggestions: matches };
    }
  }
  return { kind: "none" };
}

export function normalizeSelectionText(text: string): string {
  let normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/giu, "d")
    .toLocaleLowerCase("vi-VN")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

  while (conversationalSuffixPattern.test(normalized)) {
    normalized = normalized.replace(conversationalSuffixPattern, "").trim();
  }
  return normalized.replace(quantityPrefixPattern, "").trim();
}

function readOrdinal(text: string): number | null {
  const match = ordinalPattern.exec(normalizeSelectionText(text));
  if (!match?.[1]) {
    return null;
  }
  return Number(match[1]) - 1;
}

function matchesExact(query: string, suggestion: MenuSearchResult): boolean {
  const normalizedName = normalizeSelectionText(suggestion.name);
  const normalizedSlug = normalizeSelectionText(suggestion.slug);

  return query === normalizedName || query === normalizedSlug;
}

function matchesContainment(query: string, suggestion: MenuSearchResult): boolean {
  const normalizedName = normalizeSelectionText(suggestion.name);
  const normalizedSlug = normalizeSelectionText(suggestion.slug);

  return query.includes(normalizedName) || query.includes(normalizedSlug);
}

function matchesTokenSubset(query: string, suggestion: MenuSearchResult): boolean {
  const normalizedName = normalizeSelectionText(suggestion.name);
  const normalizedSlug = normalizeSelectionText(suggestion.slug);

  const suggestionTokens = new Set(`${normalizedName} ${normalizedSlug}`.split(" ").filter(Boolean));
  const queryTokens = [...new Set(query.split(" ").filter(Boolean))];
  return queryTokens.length > 0 && queryTokens.every((token) => suggestionTokens.has(token));
}
