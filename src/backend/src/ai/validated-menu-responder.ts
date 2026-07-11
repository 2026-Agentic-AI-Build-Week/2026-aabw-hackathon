import type { ChatAiInput } from "./ai-client.js";
import type { MenuIntent } from "./menu-intent.js";
import type { MenuResponder } from "./ordering-agent.js";
import type { MenuSearchResult } from "./menu-search.js";

export class ValidatedMenuResponder implements MenuResponder {
  async generate(input: ChatAiInput, intent: MenuIntent, results: MenuSearchResult[]): Promise<string> {
    const vietnamese = usesVietnamese(input.text);
    if (results.length === 0) {
      const hasExclusions = intent.preferenceUpdates.excludeItemTypes.length > 0;
      return vietnamese
        ? hasExclusions
          ? "Mình không tìm thấy món phù hợp với lựa chọn hiện tại. Bạn có thể đổi loại món hoặc bỏ bớt giới hạn."
          : "Mình không tìm thấy món phù hợp đang bán trong thực đơn hiện tại. Bạn có thể mô tả món khác hoặc yêu cầu xem thực đơn."
        : hasExclusions
          ? "I could not find an item matching your current preferences. Try another type or remove a restriction."
          : "I could not find a matching item currently offered on the menu. Try another item or ask to browse the menu.";
    }

    if (intent.action === "REFINE_SELECTION" && results[0]) {
      const quantity = intent.quantity ?? 1;
      return vietnamese
        ? `Đã chọn ${quantity} ${results[0].name} (${formatPrice(results[0])}). Bạn muốn thêm món khác hay tiến hành đặt hàng?`
        : `Selected ${quantity} ${results[0].name} (${formatPrice(results[0])}). Would you like another item or proceed to checkout?`;
    }

    const options = results.slice(0, 5).map((item, index) => `${index + 1}. ${item.name} (${formatPrice(item)})`).join("\n");
    if (intent.action === "BROWSE_MENU") {
      return vietnamese
        ? `Các món đang bán để bạn tham khảo:\n${options}\nBạn có thể trả lời bằng số thứ tự hoặc tên món.`
        : `Here are available menu items:\n${options}\nReply with an item number or name.`;
    }
    return vietnamese
      ? `Mình tìm thấy các món đang bán phù hợp:\n${options}\nBạn chọn món nào và số lượng bao nhiêu?`
      : `I found these matching available items:\n${options}\nWhich item and quantity would you like?`;
  }
}

function formatPrice(item: MenuSearchResult): string {
  const amount = new Intl.NumberFormat("vi-VN").format(item.price);
  return item.currency === "VND" ? `${amount}đ` : `${amount} ${item.currency}`;
}

function usesVietnamese(text: string): boolean {
  return /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/iu.test(text)
    || /\b(?:chào|món|gà|khoai|tôm|đặt|muốn|không|có|được|đi)\b/iu.test(text);
}
