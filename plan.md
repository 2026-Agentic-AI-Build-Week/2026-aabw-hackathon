# Pipeline MVP Conversational Ordering in 24 Hours

## 1. Mục tiêu và kiến trúc

Build an English-first MVP that lets customers order through the React Native
mobile app, with Messenger as an optional secondary channel:

- Tìm món, hỏi giá, tùy chọn món.
- Thêm, sửa, xóa và xem giỏ hàng.
- Đăng nhập bằng số điện thoại và OTP giả lập.
- Tra cứu điểm loyalty.
- Kiểm tra và áp dụng voucher.
- Xác nhận rồi tạo đơn trong mock OMS.
- Chuyển sang nhân viên khi bot không xử lý được.
- Theo dõi đơn hàng, hội thoại, handoff và success metrics trên trang `/ops`.

Luồng xử lý chuẩn:

```text
React Native Mobile App / Messenger
        ↓
Channel Adapter → Normalize + Deduplicate
        ↓
Conversation State + Business State
        ↓
OpenAI Responses API → Function Calls
        ↓
Validated Business Tools
        ↓
Mock Menu / Loyalty / Voucher / OMS
        ↓
Response Renderer → Mobile App / Messenger
        ↓
Metrics + Audit Log + Handoff Queue
```

Không để LLM tự tính giá, quyết định voucher, sửa điểm hay trực tiếp tạo dữ liệu. Model chỉ hiểu ý định và gọi tool; business service xác thực và thực thi.

## 2. Công nghệ và thành phần

- Backend: Python 3.12, FastAPI, Pydantic, SQLAlchemy/SQLModel và Alembic.
- Customer chat app: React Native, TypeScript, and Expo under `src/frontend-mobile/`.
- Operations dashboard: React, TypeScript, and Vite. It is internal tooling only,
  not a customer chat channel.
- Database: SQLite cho local/demo; hỗ trợ `DATABASE_URL` để đổi sang PostgreSQL khi có cloud.
- AI: OpenAI Responses API với strict function schemas. Mặc định `gpt-5.6-luna`; fallback lần lượt `gpt-5.4-mini`, `gpt-4.1-mini` nếu tài khoản không có model mặc định. OpenAI hiện hỗ trợ function calling và conversation state qua Responses API. [Function calling](https://developers.openai.com/api/docs/guides/function-calling), [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state), [Models](https://developers.openai.com/api/docs/models).
- Deploy: one public HTTPS backend plus an Expo development build or Expo Go
  client connected to the backend. If cloud deployment is not selected by hour
  4, use an HTTPS tunnel and keep the React Native app as the guaranteed demo
  channel.
- Messenger chạy Development Mode với Page/tester của đội; không phụ thuộc App Review trong 24 giờ.
- Không dùng Redis, vector database, RAG framework hoặc message broker trong MVP.

Trạng thái nghiệp vụ:

```text
BROWSING → CART_ACTIVE → AUTH_PENDING → READY_TO_QUOTE
→ AWAITING_CONFIRMATION → ORDER_CREATED
                         ↘ HANDOFF
```

Backend, không phải prompt, chịu trách nhiệm kiểm tra điều kiện chuyển trạng thái.

## 3. Interface và business tools

### Channel API

- `GET /webhooks/meta`: xác minh webhook challenge.
- `POST /webhooks/meta`: kiểm tra `X-Hub-Signature-256`, lưu event ID, trả HTTP 200 sớm rồi xử lý background.
- `POST /api/chat`: the React Native app sends `{session_id, message}` and receives
  `{message, cart, quick_replies, state}`.
- `GET /health`: kiểm tra database, OpenAI và cấu hình channel.
- `GET /api/ops/metrics`: số phiên, đơn, voucher, loyalty, lỗi và độ trễ.
- `GET/PATCH /api/ops/handoffs`: xem và cập nhật hàng đợi chuyển nhân viên.

### Tool schemas cho model

- `search_menu(query, category)`
- `get_menu_item(item_id)`
- `update_cart(action, item_id, quantity, modifiers)`
- `view_cart()`
- `request_otp(phone)`
- `verify_otp(phone, otp)`
- `get_loyalty_points()`
- `list_available_vouchers()`
- `apply_voucher(code)`
- `set_delivery_details(name, phone, address)`
- `quote_order()`
- `create_order(confirmation_token, idempotency_key)`
- `request_handoff(reason)`

Tất cả tool trả về structured result gồm `success`, `code`, `message` và `data`. Tool không ném lỗi kỹ thuật trực tiếp vào hội thoại.

### Adapter nghiệp vụ

Định nghĩa các port thay thế mock bằng API thật sau hackathon:

- `CatalogPort`
- `IdentityPort`
- `LoyaltyPort`
- `VoucherPort`
- `OrderManagementPort`
- `HandoffPort`

Mock service cung cấp menu, modifier, hồ sơ khách hàng, voucher, điểm loyalty và đơn hàng bằng seed data. `create_order` bắt buộc có quote còn hiệu lực, xác nhận rõ ràng của người dùng và idempotency key; replay webhook không được tạo đơn thứ hai.

### Conversation rules

- All customer-facing copy, prompts, quick replies, errors, demo scripts, and
  test utterances are implemented in English.
- Understand natural English menu requests, common abbreviations, misspellings,
  and approximate item names.
- Nếu có nhiều món phù hợp, bot hỏi lại thay vì tự chọn.
- Mọi giá, giảm giá, điểm và tổng tiền phải xuất phát từ tool result.
- Trước khi tạo đơn, bot hiển thị món, số lượng, giá, voucher, tổng tiền, người nhận và địa chỉ rồi yêu cầu xác nhận rõ ràng.
- OTP demo chỉ hoạt động trong môi trường non-production; không ghi OTP hoặc số điện thoại đầy đủ vào log.
- Handoff khi người dùng yêu cầu, hai lần liên tiếp không hiểu, tool nghiệp vụ lỗi hoặc yêu cầu nằm ngoài phạm vi.

## 4. Kế hoạch 24 giờ cho 6 người

### Giờ 0–2: khóa contract và loại bỏ blocker

- Người 1: tech lead, khởi tạo monorepo, conventions, environment contract và integration branch.
- Người 2: tạo OpenAI preflight, prompt, tool schemas và một tool-call smoke test.
- Người 3: thiết kế state machine, business ports và seed data.
- Người 4: tạo Meta app/Page/tester, token, webhook verification.
- Người 5: dựng React Native/Expo chat app.
- Người 6: tạo test matrix, demo script và bộ utterance tiếng Anh.
- Checkpoint giờ 2: một request chat phải gọi được ít nhất một mock tool; mobile app phải gửi được message.

### Giờ 2–8: xây các lát cắt độc lập

- AI engineer: tool loop, conversation state, giới hạn tối đa 5 tool calls mỗi turn và fallback khi model lỗi.
- Business engineer: menu, cart, pricing, voucher, loyalty, OTP và mock OMS.
- Channel engineer: Messenger verification, signature, event normalization, deduplication và Send API.
- Mobile engineer: React Native chat list/conversation screens, cart summary,
  quick replies, and loading/error states.
- Ops engineer: persistence, structured logging, `/ops`, metrics và handoff queue.
- QA engineer: unit tests, contract tests và golden conversations.
- Checkpoint giờ 8: mobile app hoàn tất luồng tìm món → thêm giỏ → báo giá.

### Giờ 8–14: tích hợp end-to-end

- Hoàn thiện OTP, loyalty, voucher, delivery details, confirmation token và tạo đơn.
- Nối Messenger vào cùng application service mà mobile app đang dùng.
- Thêm handoff summary gồm lý do, trạng thái giỏ hàng và transcript đã che PII.
- Deploy public HTTPS hoặc kích hoạt tunnel.
- Checkpoint giờ 14: mobile app phải tạo được mã đơn; Messenger phải nhận và
  phản hồi ít nhất một hội thoại nếu Meta setup thành công.

### Giờ 14–20: đánh giá và hardening

- Chạy bộ tối thiểu 60 utterances tiếng Anh cho menu, cart, voucher, loyalty, OTP, confirmation và handoff.
- Sửa lỗi tool selection, argument extraction, item ambiguity và mất state.
- Kiểm tra webhook replay, OpenAI timeout, voucher hết hạn, OTP sai, cart rỗng và tạo đơn hai lần.
- Hoàn thiện metrics dashboard và dữ liệu demo.
- Chỉ bắt đầu voice-note transcription sau khi toàn bộ critical path đạt acceptance criteria.

### Giờ 20–24: đóng băng và diễn tập

- Giờ 20–22: chạy full regression trên URL deploy và hai tài khoản/test session độc lập.
- Giờ 22: feature freeze; chỉ sửa lỗi làm hỏng demo.
- Giờ 22–23: diễn tập demo chính, demo lỗi và handoff.
- Giờ 23–24: backup database seed, environment checklist, video/screenshot fallback và bản trình bày kiến trúc.

## 5. Kiểm thử và tiêu chí nghiệm thu

### Kịch bản bắt buộc

- Search for menu items using natural English, abbreviations, misspellings, and approximate names.
- Món không tồn tại hoặc có nhiều kết quả.
- Thêm, đổi số lượng, modifier và xóa món.
- Voucher hợp lệ, không hợp lệ, hết hạn và không đủ điều kiện.
- OTP đúng, sai và yêu cầu loyalty trước khi xác minh.
- Quote được tính lại sau khi giỏ hàng thay đổi.
- Tạo đơn chỉ sau xác nhận rõ ràng.
- Replay cùng webhook hoặc idempotency key chỉ tạo một đơn.
- OpenAI hoặc mock API timeout dẫn đến retry an toàn/handoff.
- Người dùng yêu cầu nhân viên giữa chừng mà không mất giỏ hàng.

### Success metrics

- Order completion: số phiên tạo đơn thành công / số phiên đã thêm món, mục tiêu ≥ 80% trên scripted runs.
- Voucher application correctness: 100% trên deterministic test cases.
- Loyalty inquiry success: 100% sau OTP hợp lệ.
- Tool-selection accuracy: ≥ 90% trên bộ 60 utterances.
- Critical slot accuracy: ≥ 85% cho item, quantity, voucher code và phone.
- Duplicate order rate: 0% khi replay event.
- P95 end-to-end response time: dưới 8 giây trên 30 lượt demo.
- Báo cáo `order_count` và `completion_rate` tách theo `mobile` và `messenger`.

## 6. Bảo mật và giới hạn MVP

- Secrets chỉ nằm trong environment variables; không commit API key, page token hoặc app secret.
- Bắt buộc kiểm tra chữ ký webhook, rate limit theo session và giới hạn kích thước input.
- Che số điện thoại, địa chỉ, token và OTP trong log.
- Prompt injection không thể vượt qua tool whitelist và validation của backend.
- Thanh toán thật, Zalo, API KFC thật, production HA, store release, và App Review nằm ngoài MVP.
- Checkout dùng phương thức thanh toán giả lập/COD và tạo đơn mock.
- Voice là stretch goal: chỉ nhận voice note, chuyển thành text rồi đưa qua pipeline hiện hữu; không xây voice agent riêng.
- React Native mobile app là demo channel bắt buộc. Nếu Messenger chưa sẵn sàng
  trước giờ 14, tiếp tục demo hoàn toàn trên mobile app; kiến trúc và application
  core không thay đổi.
