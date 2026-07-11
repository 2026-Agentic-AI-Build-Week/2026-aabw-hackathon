# Frontend Mobile Agent Guide

## Scope

These instructions apply to `src/frontend-mobile/` and all of its descendants.
The directory is a standalone React Native/Expo application for the KFC
Conversational Ordering MVP. Its package metadata and lockfile are intentionally
committed; generated Expo state and dependencies are ignored at the repository
root.

## Current implementation

- **Runtime:** Expo SDK 54, React Native 0.81, React 19, TypeScript strict mode.
- **Entry point:** `App.tsx` renders `LoginScreen.tsx` first.
- **Authentication:** `LoginScreen.tsx` validates email/password, calls
  `services/authService.ts`, and stores access/refresh tokens plus a device ID
  in Expo SecureStore. Configure `EXPO_PUBLIC_API_BASE_URL` from `.env`.
- **Chat list:** Searchable mock Messenger-style list in
  `pages/MessengerChatList.tsx`.
- **Conversation:** `pages/ChatConversationDetail.tsx` uses an inverted
  `FlatList`, `KeyboardAvoidingView`, responsive Android system-bar padding, and
  optimistic messages, and the authenticated Socket.IO chat hook.
- **Navigation:** `pages/MessengerChatModule.tsx` uses local state for the
  list/detail transition. React Navigation is not installed yet.
- **Data:** `chatData.ts` provides the pinned Bot list fixture. Realtime DTOs
  live in `models/chat.ts`; `hooks/useRealtimeChat.ts` owns socket state.

## Directory map

```text
src/frontend-mobile/
├── App.tsx                 # Expo root; mock login gate
├── LoginScreen.tsx         # English email/password login and API submit flow
├── pages/                  # Route-level screens and flow coordinator
├── components/             # Reusable presentational chat components
├── services/               # Typed API services and secure session persistence
├── chatData.ts             # UI DTOs and mock fixtures
├── theme.ts                # Only source for visual tokens
├── app.json                # Expo application configuration
├── package.json            # Local commands and dependencies
└── README.md               # Developer-facing integration overview
```

## Implementation rules

- Import `theme` in every styled UI component. Do not add raw colors, font sizes,
  spacing, radius values, or fixed UI dimensions to a component `StyleSheet`.
  Extend `theme.ts` first.
- Keep screens in `pages/`, reusable display units in `components/`, and API/data
  mapping outside presentation components.
- Use `@expo/vector-icons` for icons. Keep user-facing UI text in English unless
  a product requirement explicitly changes the locale.
- Preserve the Android status-bar and footer inset logic in `utils/systemInsets.ts`;
  it prevents system bars from blocking touch targets on edge-to-edge devices.
- Keep `FlatList` data stable and use `inverted` for the conversation so the most
  recent message remains at the bottom.

## Verification

Run these commands from the repository root:

```bash
npm --prefix src/frontend-mobile run typecheck
npm --prefix src/frontend-mobile start -- --clear
```

For a physical device in Expo Go with LAN mode, use the same Wi-Fi network as the
development machine. Use `--tunnel` when LAN discovery is unavailable.

## Next integration steps

1. Restore a stored session during app bootstrap and refresh expired access tokens.
2. Add Authorization interceptors to authenticated API clients.
3. Replace the remaining list fixtures with a conversation-list API.
4. Swap local navigation state for React Navigation routes and route params.
5. Implement attach-image, microphone, call, and video button actions.
