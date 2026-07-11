# Negative Menu Preferences Design

## Goal

Handle messages such as `Tôi không ăn combo` as persistent session preferences instead of literal menu searches. The bot must remember the exclusion, ask what non-combo category the customer wants, apply the exclusion to every later browse/search operation, and allow the customer to reverse it explicitly.

## User Experience

- `Tôi không ăn combo` stores `combo` as an excluded item type for the current conversation session.
- The immediate response is deterministic: `Mình đã ghi nhớ bạn không muốn combo. Bạn muốn xem món lẻ loại nào: burger, gà, cơm hay món ăn kèm?`
- The preference survives Socket reconnects because it is stored in `ConversationSession.draftState`.
- Later browse and search results exclude combo items even if the model omits the preference from a later intent.
- `Cho tôi xem combo lại` removes `combo` from the exclusion list.
- Preference changes preserve selected draft items but invalidate any pending checkout quote.
- If exclusions leave no matching products, the bot states that no products match the current preference; it must not claim that products are sold out.

## Intent Contract

Add the `UPDATE_PREFERENCES` action and a structured update payload:

```ts
type MenuPreferenceUpdates = {
  excludeItemTypes: MenuItemType[];
  includeItemTypes: MenuItemType[];
};
```

The provider schema uses `preference_updates.exclude_item_types` and `preference_updates.include_item_types`. Parsing accepts only allowlisted values and removes duplicates. The initial MVP allowlist is `combo`, `food`, and `drink`.

## Session State

Extend `OrderDraft` with:

```ts
menuPreferences: {
  excludedItemTypes: MenuItemType[];
};
```

The draft parser defaults missing or malformed data to an empty exclusion list, preserving compatibility with existing sessions. Applying a preference update removes included types first, then adds excluded types. The transition sets `pendingCheckout` to `null`, keeps selected items and delivery data, and does not modify suggestions unless a later menu operation replaces them.

## Ordering Agent Flow

1. Load the current draft.
2. Extract the structured intent.
3. For `UPDATE_PREFERENCES`, apply and save the draft transition without calling menu search.
4. Return a deterministic acknowledgement and category question.
5. For `BROWSE_MENU` and `SEARCH_ITEM`, pass the persisted exclusions to the menu search port.
6. Keep ordinal selection behavior unchanged because it operates on already validated suggestions.

## Menu Search Enforcement

Extend the search port:

```ts
browse(limit?: number, options?: { excludedItemTypes?: MenuItemType[] }): Promise<MenuSearchResult[]>;
search(input: MenuSearchInput & { excludedItemTypes?: MenuItemType[] }): Promise<MenuSearchResult[]>;
```

The Prisma adapter builds the exclusion clause only from allowlisted item types and applies `mi.item_type NOT IN (...)` to both browse and search SQL. This backend enforcement prevents the LLM from reintroducing excluded product types.

## Error Handling

- Malformed provider preference data becomes an empty update rather than reaching SQL.
- Unknown item types are discarded before persistence and query construction.
- An empty update produces a clarification response and does not save state.
- Empty search results are described as no matches under the active preference, not as stock exhaustion.

## Regression Coverage

1. Parse `UPDATE_PREFERENCES` with a combo exclusion.
2. Reject unknown and duplicated item types.
3. Persist and restore structured exclusions.
4. Preference transition preserves items and invalidates pending checkout.
5. Preference-only messages do not execute menu search.
6. Later browse/search calls receive the persisted exclusion.
7. Re-including combo removes the exclusion.
8. Prisma browse/search generate exclusion clauses from safe item types only.
9. Empty filtered results do not produce a sold-out statement.

