export interface ChatMessage {
  id: string;
  userName: string;
  avatarUrl: string;
  lastMessage: string;
  time: string;
  isUnread: boolean;
  isOnline: boolean;
}

export const chatData: ChatMessage[] = [
  {
    id: '1',
    userName: 'Nguyễn Anh Trí',
    avatarUrl: 'https://i.pravatar.cc/160?img=12',
    lastMessage: 'Đơn Gà Rán của bạn đã sẵn sàng để xác nhận.',
    time: '17:42',
    isUnread: true,
    isOnline: true,
  },
  {
    id: '2',
    userName: 'Liên thông cao học',
    avatarUrl: 'https://i.pravatar.cc/160?img=47',
    lastMessage: 'AnhTrí đã bày tỏ cảm xúc 😆 với tin nhắn.',
    time: '17:30',
    isUnread: true,
    isOnline: false,
  },
  {
    id: '3',
    userName: 'JULY 2026 - HACKATHON',
    avatarUrl: 'https://i.pravatar.cc/160?img=5',
    lastMessage: 'Peter: https://github.com/Peter...',
    time: '17:27',
    isUnread: false,
    isOnline: false,
  },
  {
    id: '4',
    userName: 'Hoàng Thảo Quyên',
    avatarUrl: 'https://i.pravatar.cc/160?img=49',
    lastMessage: 'Bạn: oke',
    time: '17:24',
    isUnread: false,
    isOnline: true,
  },
  {
    id: '5',
    userName: '[DL] - gờ rúp liên thông',
    avatarUrl: 'https://i.pravatar.cc/160?img=33',
    lastMessage: 'Phương: tại sắp thi trắc nghiệm',
    time: '16:55',
    isUnread: false,
    isOnline: false,
  },
  {
    id: '6',
    userName: 'Minh Trần',
    avatarUrl: 'https://i.pravatar.cc/160?img=8',
    lastMessage: 'Bạn: model = "aabw-plan" mode...',
    time: '16:43',
    isUnread: false,
    isOnline: true,
  },
];
