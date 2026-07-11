export interface ChatMessage {
  id: string;
  userName: string;
  avatarUrl: string;
  lastMessage: string;
  time: string;
  isUnread: boolean;
  isOnline: boolean;
}

export type MessageSender = 'user' | 'bot';
export type MessageStatus = 'sent' | 'delivered' | 'seen';

export interface MessageDetail {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: string;
  status: MessageStatus;
}

export const kfcBotProfile = {
  avatarUrl: 'https://i.pravatar.cc/160?img=12',
  name: 'KFC Ordering Assistant',
  status: 'Active now',
} as const;

// Chronological order allows API results to replace this fixture directly.
export const conversationMessages: MessageDetail[] = [
  {
    id: 'message-1',
    text: 'Hi! Welcome to KFC. What would you like to order today?',
    sender: 'bot',
    timestamp: '4:20 PM',
    status: 'seen',
  },
  {
    id: 'message-2',
    text: 'I would like a Zinger Burger meal, please.',
    sender: 'user',
    timestamp: '4:21 PM',
    status: 'seen',
  },
  {
    id: 'message-3',
    text: 'Great choice. Would you like to upgrade your drink to a large Pepsi for $0.50?',
    sender: 'bot',
    timestamp: '4:21 PM',
    status: 'seen',
  },
  {
    id: 'message-4',
    text: 'Yes, please add the large Pepsi.',
    sender: 'user',
    timestamp: '4:22 PM',
    status: 'delivered',
  },
  {
    id: 'message-5',
    text: 'Done. Your Zinger Burger meal with a large Pepsi is $7.50. Shall I add it to your cart?',
    sender: 'bot',
    timestamp: '4:22 PM',
    status: 'delivered',
  },
];

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
