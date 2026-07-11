# Pipeline MVP Conversational Ordering Mobile-first trong 24 giờ

## 1. Mục tiêu và kiến trúc

Xây dựng Mobile App tiếng Việt cho phép khách hàng:

- Tìm món, hỏi giá và tùy chọn món bằng text hoặc voice note.
- Thêm, sửa, xóa và xem giỏ hàng.
- Đăng nhập bằng số điện thoại và OTP giả lập để nhận JWT.
- Tra cứu điểm loyalty, kiểm tra và áp dụng voucher.
- Xác nhận rồi tạo đơn trong mock OMS.
- Xem, theo dõi và hủy đơn của chính mình.
- Chuyển sang nhân viên khi bot không xử lý được.

Luồng xử lý chuẩn:

```text
React Native Mobile App
        ↓
JWT-protected REST API
(Auth / Orders / Chat)
        ↓
Application Services + Conversation State + Business State
        ↓
OpenAI Responses API → Strict Function Calls
        ↓
Validated Business Tools
        ↓
Mock Catalog / Identity / Loyalty / Voucher / OMS / Handoff
        ↓
Structured Mobile Response + Audit Log
```

`POST /api/chat` chỉ hoạt động với access JWT. Mobile App tạo và lưu `session_id` theo thiết bị; backend liên kết session với user đã xác thực.

Không để LLM tự tính giá, quyết định voucher, sửa điểm hay trực tiếp tạo dữ liệu. Model chỉ hiểu ý định và gọi tool; application service xác thực, kiểm tra quyền sở hữu và thực thi.

Trạng thái nghiệp vụ:

```text
BROWSING → CART_ACTIVE → AUTH_PENDING → READY_TO_QUOTE
→ AWAITING_CONFIRMATION → ORDER_CREATED
                         ↘ HANDOFF
```

Backend, không phải prompt hay REST controller, chịu trách nhiệm kiểm tra điều kiện chuyển trạng thái, quote còn hiệu lực, xác nhận và idempotency.

## 2. Công nghệ và thành phần

- Mobile: React Native, Expo, TypeScript, Expo Router, Zustand hoặc Context + reducer, Expo SecureStore cho token, AsyncStorage cho `session_id` và UI cache, Expo AV/Audio cho voice recording.
- Backend: TypeScript, REST API validation, Prisma ORM và PostgreSQL.
- Auth: OTP giả lập trong non-production, access JWT ngắn hạn và refresh token có thể thu hồi theo `device_id`.
- AI: OpenAI Responses API với strict function schemas. Mặc định `gpt-5.6-luna`; fallback lần lượt `gpt-5.4-mini`, `gpt-4.1-mini` nếu tài khoản không có model mặc định. Voice note dùng OpenAI Whisper/Audio Transcriptions để chuyển thành text trước khi vào pipeline LLM.
- Deploy: một backend HTTPS public và Mobile App chạy Expo Go, development build hoặc Android/iOS build.
- Không dùng Redis, vector database, RAG framework hoặc message broker trong MVP.

Mobile App render response động gồm message, quick replies, Cart Card và Order Status. App không tự tính giá, giảm giá hoặc trạng thái nghiệp vụ.

## 3. Interface và business tools

### Auth API

- `POST /api/auth/otp/request` nhận `{phone}`; chuẩn hóa số điện thoại, tạo hoặc tái sử dụng OTP challenge và trả `{challenge_id, expires_at}`.
- `POST /api/auth/otp/verify` nhận `{challenge_id, otp, device_id}`; xác minh OTP, tạo hoặc cập nhật user-device session và trả `{access_token, refresh_token, expires_in, user}`.
- `POST /api/auth/refresh` nhận `{refresh_token, device_id}`; xoay refresh token và trả access/refresh token mới.
- `POST /api/auth/logout` yêu cầu JWT; thu hồi refresh token của thiết bị hiện tại.
- `GET /api/auth/me` yêu cầu JWT; trả hồ sơ người dùng và trạng thái loyalty cơ bản.
- OTP chỉ xuất hiện trong response mock/development có cờ môi trường rõ ràng; không ghi OTP, refresh token hoặc số điện thoại đầy đủ vào log.

### Order CRUD API

- `POST /api/orders` yêu cầu JWT, nhận `{quote_id, confirmation_token, idempotency_key}`; chỉ tạo order khi quote thuộc user, còn hiệu lực và đã được xác nhận.
- `GET /api/orders` yêu cầu JWT; trả danh sách order của user hiện tại, hỗ trợ phân trang và lọc trạng thái.
- `GET /api/orders/{order_id}` yêu cầu JWT; chỉ trả order thuộc user hiện tại.
- `PATCH /api/orders/{order_id}` yêu cầu JWT; Mobile App chỉ được cập nhật yêu cầu hủy đơn khi trạng thái cho phép, không được sửa món, giá, voucher hoặc delivery details sau khi order được tạo.
- `DELETE /api/orders/{order_id}` không xóa dữ liệu vật lý; ánh xạ thành cùng use case hủy đơn để giữ audit trail và trạng thái `CANCELLED`.
- `PATCH /api/admin/orders/{order_id}/status` dành cho admin/service role; chỉ cho phép chuyển trạng thái hợp lệ `CREATED → CONFIRMED → PREPARING → DELIVERING → COMPLETED`, hoặc `CANCELLED` khi policy cho phép.
- Cả REST API và Chat tool dùng chung `OrderManagementPort`; không tạo hai implementation tạo đơn độc lập.

### Chat API

- `POST /api/chat` yêu cầu JWT, nhận:

```json
{
  "session_id": "uuid",
  "message": "Cho tôi 2 phần gà",
  "voice_base64": "optional-base64-audio",
  "idempotency_key": "uuid"
}
```

- `message` hoặc `voice_base64` là bắt buộc. Nếu có voice, backend kiểm tra format và dung lượng, transcription sang text tiếng Việt, sau đó chạy cùng pipeline như text.
- Response trả:

```json
{
  "message": "Đã thêm 2 phần gà vào giỏ.",
  "transcript": "Cho tôi 2 phần gà",
  "cart": {},
  "quick_replies": [],
  "order_status": null,
  "state": "CART_ACTIVE"
}
```

- `session_id` phải thuộc user JWT hiện tại; retry cùng `idempotency_key` trả kết quả trước đó và không lặp side effect.
- Giữ `GET /health`, `GET /api/ops/metrics`, `GET/PATCH /api/ops/handoffs`; `/health` kiểm tra database, OpenAI Chat, OpenAI transcription và JWT configuration.

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

Tất cả tool trả về structured result gồm `success`, `code`, `message` và `data`. Tool không ném lỗi kỹ thuật trực tiếp vào hội thoại. `request_otp` và `verify_otp` dùng chung Auth application service; token không được đưa vào transcript.

### Adapter nghiệp vụ

Định nghĩa các port thay thế mock bằng API thật sau hackathon:

- `CatalogPort`
- `IdentityPort`
- `LoyaltyPort`
- `VoucherPort`
- `OrderManagementPort`
- `HandoffPort`
- `SpeechToTextPort`

Mock service cung cấp menu, modifier, hồ sơ khách hàng, voucher, điểm loyalty, transcription và đơn hàng bằng seed data. `create_order` bắt buộc có quote còn hiệu lực, xác nhận rõ ràng của người dùng và idempotency key; REST API và chat retry không được tạo đơn thứ hai.

### Quy tắc hội thoại

- Ưu tiên tiếng Việt tự nhiên; hiểu tên món gần đúng, viết tắt và không dấu.
- Nếu có nhiều món phù hợp, bot hỏi lại thay vì tự chọn.
- Mọi giá, giảm giá, điểm và tổng tiền phải xuất phát từ tool result.
- Trước khi tạo đơn, bot hiển thị món, số lượng, giá, voucher, tổng tiền, người nhận và địa chỉ rồi yêu cầu xác nhận rõ ràng.
- OTP demo chỉ hoạt động trong môi trường non-production; không ghi OTP hoặc số điện thoại đầy đủ vào log.
- Handoff khi người dùng yêu cầu nhân viên, model không chọn được tool phù hợp, lỗi ngoại vi lặp lại hoặc confidence thấp sau một câu hỏi làm rõ.
- Khi voice transcription thất bại, bot yêu cầu gửi lại bằng text hoặc voice; không làm mất giỏ hàng hoặc conversation state.

## 4. Kế hoạch 24 giờ cho 6 người

### Giờ 0–2: khóa API contract và Mobile shell

- Người 1: khóa State Machine, tool schemas, response model Chat và shared application-service boundaries.
- Người 2: khóa schema/contract Auth JWT + OTP và persistence cho user-device refresh session.
- Người 3: khóa Order CRUD contract, ownership policy, idempotency và transition policy.
- Người 4 — Mobile UI Developer: dựng Chat UI, message list, text composer, Quick Reply, Cart Card và Order Status trên simulator/thiết bị.
- Người 5 — Mobile Core Developer: tạo Expo app shell, session/token storage abstraction, API client, login flow và smoke call.
- Người 6: database/migration, API contract fixtures, structured logging và integration support.
- **Checkpoint giờ 2:** Chat layout render được trên simulator/thiết bị thật; app hoàn thành smoke call đến backend; Auth, Order và Chat contracts được đội thống nhất.

### Giờ 2–8: xây các lát cắt độc lập

- Người 1: OpenAI orchestration, strict function calling, cart/quote conversation flow và tool error mapping.
- Người 2: OTP request/verify, JWT refresh/logout/me, refresh-token revocation và mock identity/loyalty.
- Người 3: create/list/detail/cancel Order API, admin status update, quote validation và idempotency.
- Người 4: hoàn thiện native dynamic components, trạng thái loading/error/empty và màn hình order history/detail.
- Người 5: state management, protected navigation, token refresh, chat retry, audio permission/recording/base64 upload.
- Người 6: mock catalog/voucher/OMS, observability, API integration support và demo data.
- **Checkpoint giờ 8:** Đăng nhập OTP, gửi text chat, thêm món, xem Cart Card và xem order list đã hoạt động trên Mobile.

### Giờ 8–14: tích hợp end-to-end

- Nối mobile login với JWT-protected Chat và Order APIs.
- Hoàn thiện loyalty, voucher, delivery details, quote, confirmation token, tạo order từ chat và đọc chi tiết order qua REST.
- Tích hợp Whisper transcription cho voice note; voice và text cùng dùng conversation pipeline/state.
- Nối Mobile Cart Card với data API trả về và order status với `GET /api/orders/{order_id}`.
- **Checkpoint giờ 14:** Mobile App gửi được text và voice, hiển thị transcript/cart trực quan, tạo order sau xác nhận và xem trạng thái order của user.

### Giờ 14–20: hardening và diễn tập nghiệp vụ

- Xử lý refresh token hết hạn, logout, token không hợp lệ, session không thuộc user, retry Chat/Order và mất mạng.
- Kiểm tra audio permission bị từ chối, file voice không hợp lệ hoặc quá lớn, transcription timeout và fallback text.
- Kiểm tra quote hết hạn, duplicate `idempotency_key`, user truy cập order người khác, order transition sai và hủy order không hợp lệ.
- Hoàn thiện handoff summary, audit log đã che PII, dữ liệu demo và admin status endpoint.

### Giờ 20–24: đóng băng và demo

- Chạy regression trên Android và iOS mục tiêu với hai user/device độc lập.
- Giờ 22: feature freeze; chỉ sửa lỗi làm hỏng login, chat, voice, cart, order hoặc demo.
- Diễn tập luồng đăng nhập → text/voice order → voucher → xác nhận → theo dõi/hủy đơn; chuẩn bị build/simulator recording fallback.
