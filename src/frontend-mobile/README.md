# Frontend Mobile — Messenger Chat Module

Module React Native/Expo tái hiện màn hình danh sách và hội thoại chi tiết từ bản
export Stitch AI. Module không phụ thuộc vào backend: dữ liệu đang là mock data để
đội có thể thay thế bằng API client khi các endpoint sẵn sàng.

## Folder structure

```text
src/frontend-mobile/
├── components/
│   ├── AvatarWithStatus.tsx  # Avatar tròn và trạng thái online/offline
│   ├── ChatHeader.tsx        # Header hội thoại: back, shop, call và video
│   ├── ChatInputBar.tsx      # Nhập tin, image, mic, send/like theo draft
│   ├── ChatListItem.tsx      # Một hàng chat, trạng thái đọc/chưa đọc
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
├── services/authService.ts    # Axios login + SecureStore session handling
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

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` for the current
device target. `authService.ts` maps the snake_case response to a camelCase
`AuthSession`, then stores the tokens in Expo SecureStore.

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

Để nối backend, giữ `ChatMessage` và `MessageDetail` làm DTO hiển thị. Thay
`chatData` bằng hook API trả về dữ liệu tương ứng, và thay state navigation trong
`MessengerChatModule.tsx` bằng route params `chat.id` của React Navigation.
