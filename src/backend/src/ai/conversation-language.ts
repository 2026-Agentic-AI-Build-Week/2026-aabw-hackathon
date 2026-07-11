export type ConversationLanguage = "vi" | "en";

const vietnameseSignal = /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]|\b(?:tôi|mình|muốn|không|món|đặt|xem)\b/iu;
const englishSignal = /\b(?:hi|hello|hey|i|want|show|menu|please|order)\b/iu;
const greetingOnly = /^(?:hi|hello|hey|chào|xin chào|chào bạn)[!,.\s]*$/iu;

export function detectInitialConversationLanguage(text: string): ConversationLanguage {
  if (vietnameseSignal.test(text)) return "vi";
  if (englishSignal.test(text)) return "en";
  return "vi";
}

export function isGreetingOnly(text: string): boolean {
  return greetingOnly.test(text.trim());
}
