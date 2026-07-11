# Kế hoạch thiết kế database KFC Conversational Ordering

## Tóm tắt

- Dùng SQLAlchemy/SQLModel + Alembic, chạy SQLite cho demo và tương thích PostgreSQL qua `DATABASE_URL`.
- Import 8 danh mục và 94 món từ `assets/data/kfc_catalog.json`; voucher và modifier được seed riêng vì dữ liệu hiện tại chưa có.
- Thiết kế bao phủ toàn bộ luồng trong `plan.md`: session → giỏ hàng → OTP → loyalty → voucher → quote → xác nhận → order.
- Giá tiền lưu bằng số nguyên VND; mọi order, voucher và thông tin giao hàng đều có snapshot để lịch sử không thay đổi khi catalog hoặc user được cập nhật.
- Dùng UUID dạng chuỗi cho khóa nội bộ; giữ `external_id` từ catalog và ID Messenger để tích hợp.

## Các bảng chính

### Catalog

- `categories`: `id`, `external_id`, `name`, `slug`, `source_url`, `display_order`, `is_active`, timestamps.
- `menu_items`: `id`, `external_id`, `name`, `slug`, `item_type`, `description`, `price`, `original_price`, `currency`, `image_url`, `product_url`, `is_available`, timestamps.
- `menu_item_categories`: khóa ghép `menu_item_id + category_id`; dù dữ liệu hiện tại mỗi món chỉ có một nhóm, cấu trúc vẫn hỗ trợ nhiều nhóm.
- `modifier_groups`: nhóm tùy chọn như “Chọn nước”, với `min_choices`, `max_choices`, `is_required`.
- `modifier_options`: lựa chọn cụ thể, `name`, `price_delta`, `is_available`, `display_order`.
- `menu_item_modifier_groups`: liên kết món với nhóm tùy chọn để hỗ trợ `update_cart(..., modifiers)` trong `plan.md`.
- Import catalog theo `external_id` bằng upsert; không xóa cứng món mất khỏi JSON mà chuyển `is_available = false`.

### User, OTP và loyalty

- `users`: `id`, `phone_normalized`, `display_name`, `status`, `phone_verified_at`, timestamps; `phone_normalized` là duy nhất.
- `user_identities`: liên kết user với `channel` (`web`, `messenger`) và `external_user_id`; unique trên `channel + external_user_id`.
- `user_addresses`: nhiều địa chỉ cho một user, gồm người nhận, số điện thoại, địa chỉ, `is_default`, timestamps.
- `otp_challenges`: `user_id` hoặc số điện thoại chuẩn hóa, `otp_hash`, `expires_at`, `attempt_count`, `max_attempts`, `verified_at`, `status`; không lưu OTP plaintext.
- `loyalty_accounts`: mỗi user một tài khoản, gồm `balance`, `status`, `updated_at`.
- `loyalty_transactions`: ledger cộng/trừ điểm với `delta`, `balance_after`, `reason`, `order_id`, `idempotency_key`, timestamps.
- Chỉ trả loyalty sau khi session đã xác thực OTP; các giá trị nhạy cảm phải được che trong application log.

### Voucher

- `voucher_campaigns`: định nghĩa chương trình gồm `name`, `discount_type` (`fixed`, `percentage`), `discount_value`, `max_discount`, `minimum_order_value`, thời gian hiệu lực, tổng quota, quota mỗi user, trạng thái.
- `voucher_codes`: mã thực tế gồm `campaign_id`, `code`, `assigned_user_id` nullable, `status`, `starts_at`, `expires_at`; `code` là duy nhất và được chuẩn hóa uppercase.
- `voucher_redemptions`: lịch sử giữ/dùng voucher gồm `voucher_code_id`, `user_id`, `order_id`, `status` (`reserved`, `redeemed`, `released`), `discount_amount`, `idempotency_key`, timestamps.
- Voucher chung có `assigned_user_id = null`; voucher cá nhân chỉ dùng được bởi user tương ứng.
- Business service kiểm tra thời hạn, trạng thái, minimum order, quota và giới hạn mỗi user; LLM không tự quyết định mức giảm.
- Seed tối thiểu voucher hợp lệ, hết hạn, chưa bắt đầu, không đủ minimum order và đã hết quota để đáp ứng test matrix.

### Session, cart và quote

- `conversation_sessions`: `session_key`, `channel`, `user_id` nullable, `business_state`, `openai_conversation_id`, `last_activity_at`, timestamps.
- `conversation_messages`: `session_id`, `direction`, `role`, nội dung đã che PII, `external_message_id`, `latency_ms`, `error_code`, timestamps.
- `processed_channel_events`: `channel`, `external_event_id`, `payload_hash`, `processed_at`; unique để chống xử lý webhook lặp.
- `carts`: một cart active cho mỗi session, gồm `user_id`, `status`, `version`, timestamps.
- `cart_items`: `cart_id`, `menu_item_id`, `quantity`, `unit_price`, `item_name_snapshot`, timestamps.
- `cart_item_modifiers`: `cart_item_id`, `modifier_option_id`, `name_snapshot`, `price_delta`, `quantity`.
- `order_quotes`: snapshot báo giá gồm `cart_id`, `cart_version`, subtotal, discount, delivery fee, total, currency, voucher code, `expires_at`, `confirmation_token_hash`, `status`.
- `order_quote_items`: snapshot món và modifier tại thời điểm báo giá.
- Mọi thay đổi cart tăng `carts.version` và làm quote cũ hết hiệu lực; `create_order` chỉ nhận quote còn hạn và khớp cart version.

### Order

- `orders`: `order_number`, `user_id`, `session_id`, `quote_id`, `status`, `payment_method = COD`, subtotal, discount, delivery fee, total, currency, voucher snapshot, `idempotency_key`, timestamps.
- `order_items`: snapshot `menu_item_id`, tên món, số lượng, đơn giá, modifier total và line total.
- `order_item_modifiers`: snapshot tên tùy chọn, giá cộng thêm và số lượng.
- `order_delivery_details`: quan hệ 1–1 với order, lưu snapshot tên người nhận, điện thoại và địa chỉ; có thể giữ `source_address_id` để biết địa chỉ nguồn.
- `order_status_history`: lưu mọi lần đổi trạng thái cùng actor, lý do và thời điểm.
- Unique `orders.idempotency_key` và `orders.quote_id` bảo đảm một quote hoặc webhook replay không tạo hai đơn.
- Trong cùng transaction tạo order: khóa/kiểm tra quote, tạo snapshot, redeem voucher, cập nhật loyalty nếu cần, đánh dấu cart converted và quote consumed.

### Ops và handoff

- `handoffs`: `session_id`, `user_id`, `reason`, `status`, `assigned_to`, `cart_snapshot_json`, `summary`, timestamps.
- `audit_logs`: `session_id`, `user_id`, `action`, `entity_type`, `entity_id`, `result_code`, metadata đã che PII, timestamps.
- Metrics trên `/api/ops/metrics` được tổng hợp từ session, order, redemption, handoff và message thay vì tạo bảng counter riêng trong MVP.
- Thêm index theo `created_at`, `channel`, `status`, `session_id` để phục vụ dashboard và báo cáo completion rate theo Messenger/web.

## Quan hệ và ràng buộc

- `users` 1–N `user_addresses`, `conversation_sessions`, `orders`, `voucher_redemptions`, `loyalty_transactions`.
- `conversation_sessions` 1–N `conversation_messages`, `carts`, `orders`, `handoffs`.
- Chỉ một `cart` có trạng thái `active` cho mỗi session; thực thi bằng application transaction, kèm partial unique index trên PostgreSQL nếu triển khai cloud.
- `price`, `discount`, `total`, loyalty point và quantity phải không âm; `original_price` nullable và không nhỏ hơn `price`.
- Order total phải thỏa `subtotal + delivery_fee - discount = total`, với `discount <= subtotal + delivery_fee`.
- Dùng timezone-aware UTC cho toàn bộ timestamps; API chuyển đổi múi giờ chỉ ở lớp hiển thị.
- SQLite bật foreign keys; PostgreSQL dùng transaction và row lock khi redeem voucher hoặc tạo order.

## Trình tự triển khai

1. Khởi tạo manifest Python, cấu hình database và Alembic; document `make run`, `make test`, `make lint`.
2. Tạo migration catalog, user/identity, OTP và loyalty.
3. Tạo migration voucher campaign/code/redemption.
4. Tạo migration session, message, processed event, cart và quote.
5. Tạo migration order, order snapshots, status history, handoff và audit.
6. Viết importer idempotent cho `kfc_catalog.json` và seed dữ liệu user, loyalty, voucher demo.
7. Xây repository/service theo các port `CatalogPort`, `IdentityPort`, `LoyaltyPort`, `VoucherPort`, `OrderManagementPort`, `HandoffPort`.
8. Đảm bảo pricing, voucher validation, quote và order creation chỉ chạy trong business service, không đặt trong prompt hoặc route.
9. Cập nhật `README.md` và `AGENTS.md` khi thêm cấu trúc `src/`, `tests/`, migrations và entry point.

## Test plan

- Import catalog hai lần không nhân đôi 8 category hoặc 94 menu item.
- Tìm món theo category, slug, tên có dấu và không dấu; không trả món `is_available = false`.
- Tạo user qua web/Messenger, chuẩn hóa số điện thoại và liên kết nhiều channel identity.
- OTP đúng, sai, hết hạn, vượt số lần thử; database không chứa OTP plaintext.
- Thêm, cập nhật, xóa cart item và modifier; quote cũ bị vô hiệu khi cart thay đổi.
- Voucher hợp lệ, hết hạn, chưa bắt đầu, sai user, không đủ minimum, hết quota và dùng vượt giới hạn.
- Hai transaction cùng redeem voucher quota cuối chỉ có một transaction thành công.
- Quote tính đúng subtotal, modifier, discount, delivery fee và total bằng số nguyên VND.
- Không tạo order khi cart rỗng, quote hết hạn, confirmation token sai hoặc chưa xác nhận.
- Replay cùng `idempotency_key`, `quote_id` hoặc webhook event chỉ trả lại order cũ, không tạo order thứ hai.
- Order vẫn giữ đúng tên, giá, voucher và địa chỉ sau khi catalog, campaign hoặc user address thay đổi.
- Loyalty chỉ xem được sau OTP; ledger và balance luôn khớp sau transaction.
- Handoff giữ session, cart snapshot và transcript đã che PII.
- Metrics trả đúng `order_count`, `completion_rate`, voucher usage và handoff count theo `web`/`messenger`.

## Giả định mặc định

- Chọn mô hình voucher `campaign + code + redemption`, hỗ trợ cả mã chung và mã cá nhân.
- Chọn loyalty `balance + transaction ledger` để audit và dễ thay bằng LoyaltyPort thật.
- User có nhiều địa chỉ; order luôn lưu delivery snapshot độc lập.
- MVP chỉ hỗ trợ COD/mock payment, chưa cần bảng payment transaction.
- Mỗi order áp dụng tối đa một voucher, phù hợp tool `apply_voucher(code)` hiện tại.
- Không xóa cứng dữ liệu nghiệp vụ; dùng status, `is_active` và `is_available`.
- Transcript và audit chỉ lưu dữ liệu đã che PII; payload webhook đầy đủ không được persist mặc định.
