# Frontend Mobile — Messenger Chat List

Module React Native/Expo tái hiện màn hình danh sách chat Messenger từ bản export
Stitch AI. Module không phụ thuộc vào backend: dữ liệu đang là mock data để đội có
thể thay thế bằng API client khi các endpoint sẵn sàng.

## Folder structure

```text
src/frontend-mobile/
├── components/
│   ├── AvatarWithStatus.tsx  # Avatar tròn và trạng thái online/offline
│   ├── ChatListItem.tsx      # Một hàng chat, trạng thái đọc/chưa đọc
│   ├── Header.tsx            # Tiêu đề và nút camera/soạn tin
│   └── SearchBar.tsx         # Input tìm kiếm với các icon Expo
├── MessengerChatList.tsx     # Màn hình, lọc dữ liệu và FlatList
├── chatData.ts               # ChatMessage type và mock data
├── theme.ts                  # Design tokens dùng xuyên suốt module
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

## Integration

Expo đã có sẵn `@expo/vector-icons`; nếu app hiện tại chưa có Expo dependency,
cài package này trước khi import các component.

Render màn hình từ navigator hoặc root component:

```tsx
import { MessengerChatList } from './src/frontend-mobile/MessengerChatList';

export default function App() {
  return <MessengerChatList />;
}
```

Để nối backend, giữ `ChatMessage` làm DTO hiển thị. Thay `chatData` bằng hook
API trả về `ChatMessage[]`, và thay `handleChatPress` trong
`MessengerChatList.tsx` bằng điều hướng tới conversation detail theo `chat.id`.
