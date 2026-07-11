# Frontend Mobile — Messenger Chat Module

Module React Native/Expo cung cấp đăng nhập, danh sách hội thoại và chat realtime
với KFC Ordering Bot. Chat kết nối Socket.IO với backend để tìm món, duy trì draft,
nhận quote an toàn và xác nhận tạo đơn; mobile không tự tính giá hoặc gọi trực tiếp
REST API tạo đơn.

## Folder structure

```text
src/frontend-mobile/
├── components/
│   ├── AvatarWithStatus.tsx  # Avatar tròn và trạng thái online/offline
│   ├── ChatHeader.tsx        # Header hội thoại: back, shop, call và video
│   ├── ChatInputBar.tsx      # Nhập tin, image, mic, send/like theo draft
│   ├── ChatListItem.tsx      # Một hàng chat, trạng thái đọc/chưa đọc
│   ├── CheckoutCard.tsx      # Quote/order an toàn và confirmation phrase
│   ├── Header.tsx            # Tiêu đề và nút camera/soạn tin
│   ├── MessageBubble.tsx     # Bong bóng bot/user, avatar và message status
│   └── SearchBar.tsx         # Input tìm kiếm với các icon Expo
├── App.tsx                     # Expo application entry point
├── AGENTS.md                    # Agent context: architecture and current status
├── LoginScreen.tsx              # English login and backend auth integration
├── pages/
│   ├── ChatConversationDetail.tsx # Screen hội thoại: inverted FlatList + keyboard
│   ├── MessengerChatList.tsx      # Danh sách chat, search và FlatList
│   ├── MessengerChatModule.tsx    # Điều hướng nội bộ list và conversation
│   └── MessengerLogin.tsx         # Login UI theo Messenger, submit mock vào chat
├── chatData.ts               # DTO chat list/detail và mock data
├── hooks/useRealtimeChat.ts  # Socket lifecycle, optimistic state và checkout
├── models/chat.ts            # Typed Socket events và safe checkout DTOs
├── services/authService.ts    # Axios login + SecureStore session handling
├── services/socketService.ts  # Authenticated Socket.IO client factory
├── .env.example               # API base URL configuration template
├── theme.ts                  # Design tokens dùng xuyên suốt module
├── app.json                  # Expo application metadata
├── package.json              # Expo dependencies và scripts
├── tsconfig.json             # Strict TypeScript configuration
└── README.md                 # Hướng dẫn tích hợp và mở rộng
```

## Design tokens

`theme.ts` là nguồn duy nhất cho màu sắc, typography, spacing, radius và kích
thước layout. Components phải import `theme` trực tiếp; không đưa mã HEX,
font-size, font-weight hoặc khoảng cách mới vào các `StyleSheet` cục bộ.

- `theme.colors` chứa palette bám theo Stitch AI: primary `#005BB3`, surface
  trắng, text đậm `#191C1F`, outline `#717786` và các trạng thái.
- `theme.typography` chuẩn hóa font Inter cho title, tên chat, tin nhắn và meta.
- `theme.spacing`, `theme.radius`, `theme.layout` giữ nhịp khoảng cách và kích
  thước avatar, icon, header, search bar nhất quán.
- Token hội thoại dùng `chatBotBubble`, `chatUserBubble`, `sendButton`,
  `messageText`, `conversationName`, và `messageStatus`; không hard-code style
  mới trong components.

## Navigation

`App.tsx` hiển thị `LoginScreen.tsx` trước. Sau khi backend login thành công,
nó mở `pages/MessengerChatModule.tsx`. Module giữ `selectedChat` cục bộ và
truyền callback vào `pages/MessengerChatList.tsx`. Khi `ChatListItem.tsx` gọi
`onPress`, module render `pages/ChatConversationDetail.tsx`; `ChatHeader.tsx`
gọi `onBackPress` để quay về danh sách. Cấu trúc này không cần dependency navigator
trong hackathon và có thể thay bằng React Navigation khi app shell đã sẵn sàng.

## Integration

### Authentication API contract

Backend currently expects this login request:

```json
{
  "email": "demo@kfc.local",
  "password": "DemoPassword123!",
  "device_id": "expo-device-id"
}
```

It returns this response on success:

```json
{
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "expires_in": 900,
  "user": {
    "id": "user-id",
    "email": "demo@kfc.local",
    "phone": "+84901234567",
    "display_name": "Demo User"
  }
}
```

Copy `.env.example` to `.env` and set both `EXPO_PUBLIC_API_BASE_URL` and
`EXPO_PUBLIC_SOCKET_URL` for the current device target. `authService.ts` maps
the snake_case response to a camelCase `AuthSession`, then stores the tokens in
Expo SecureStore. `useRealtimeChat.ts` sends that access token in the Socket.IO
handshake, receives persisted history, and manages optimistic send/retry states.

Chạy module trực tiếp bằng Expo:

```bash
npm --prefix src/frontend-mobile install
npm --prefix src/frontend-mobile start
```

Sau khi Metro khởi động, quét QR bằng Expo Go hoặc nhấn `a` để mở Android.

Render màn hình từ navigator hoặc root component:

```tsx
import { MessengerChatModule } from './src/frontend-mobile/pages/MessengerChatModule';

export default function App() {
  return <MessengerChatModule />;
}
```

The KFC Ordering Bot is always pinned to the first list item. The MVP only
supports realtime text ordering. Quote and order mutations are executed by the
backend order service and surfaced through typed Socket events.

## Chat checkout lifecycle

1. The customer sends a menu request through the normal chat input.
2. The backend extracts intent, searches available menu data, and persists item
   selections in the authenticated session draft.
3. The customer supplies email, recipient name, phone, address, and city.
4. When the customer asks for checkout, the backend creates an authoritative
   quote through the existing order service.
5. `checkout_update` returns a `quote_ready` safe DTO. `CheckoutCard.tsx` renders
   line items, totals, expiry, and a phrase such as `CONFIRM 7A2F`.
6. Tapping the phrase only pre-fills `ChatInputBar.tsx`; it does not create the
   order. The customer must send the exact phrase as a regular chat message.
7. The backend validates the pending quote and phrase, creates the order
   idempotently, and emits an `order_created` safe DTO for the same card area.

Changing items, delivery details, or a voucher invalidates an existing pending
quote. Generic replies such as `yes` are not checkout authorization.

## Socket events

| Direction | Event | Mobile responsibility |
| --- | --- | --- |
| Client → server | `session_join` | Restore the authenticated session and history. |
| Client → server | `user_chat` | Send text with stable session and client message IDs. |
| Server → client | `ai_typing` | Display the current processing stage without blocking input. |
| Server → client | `ai_response` | Reconcile and append the persisted bot response. |
| Server → client | `checkout_update` | Store and render `quote_ready` or `order_created`. |
| Server → client | `chat_error` | Show a safe retryable or terminal error. |

`useRealtimeChat.ts` owns subscriptions, optimistic messages, acknowledgements,
typing state, checkout state, retries, and cleanup. UI components consume this
typed state and do not own networking logic.

## Security boundaries

- The mobile bundle contains only public backend URLs. Never add AI provider
  keys, authentication signing secrets, confirmation tokens, or idempotency keys
  to `EXPO_PUBLIC_*` variables.
- Access and refresh tokens are stored through Expo SecureStore. The access
  token authenticates the Socket.IO handshake.
- Mobile checkout models contain only safe item totals, quote expiry, the
  user-facing confirmation phrase, and public order details.
- The server keeps the real quote confirmation token and idempotency key. The AI
  and mobile UI cannot invent prices, bypass stock checks, or create an order
  without the backend confirmation workflow.

## Demo fallback

If no AI provider key is configured, the backend uses a deterministic fallback
while preserving the same session draft and checkout orchestrator. Its language
understanding is intentionally limited, so use explicit item names and clearly
label recipient name, email, phone, address, and city before sending `checkout`
or `get quote`. Configure Qwen for the intended natural-language demo quality.

## Verification

```bash
# Mobile strict TypeScript validation
npm --prefix src/frontend-mobile run typecheck

# Backend contracts, checkout orchestration, and HTTP behavior
npm --prefix src/backend run lint
npm --prefix src/backend run test

# Optional Android production-bundle smoke check
npm --prefix src/frontend-mobile exec expo export -- --platform android --output-dir /tmp/kfc-mobile-export
```

Manual acceptance: sign in, add an available item, provide all required delivery
details, request a quote, verify the quote card, send the displayed exact phrase,
and confirm that the card changes to the created-order state.

## Future voice and Agora

Voice ordering should be another transport over the existing backend
conversation workflow. A future Agora integration can stream audio and speech
turns, but it must reuse the authenticated session draft, menu intent handling,
checkout orchestrator, exact-confirmation policy, and order service. Keeping
these responsibilities server-side prevents text and voice flows from producing
different prices, stock decisions, or authorization behavior.
