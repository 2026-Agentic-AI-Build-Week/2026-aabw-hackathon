# Hướng dẫn chạy local: Database đến Backend

Tài liệu này hướng dẫn chạy PostgreSQL, Prisma migration, seed dữ liệu demo và
TypeScript backend trên máy local.

## 1. Yêu cầu

- Docker Desktop với Docker Compose v2.
- Node.js 22 LTS và npm. Không khuyến nghị Node.js 25 cho stack Prisma hiện tại.

Kiểm tra môi trường:

```bash
docker compose version
node --version
npm --version
```

## 2. Tạo cấu hình local

Chạy từ thư mục gốc repository:

```bash
cp src/backend/.env.example src/backend/.env
```

`src/backend/.env` chứa thông tin kết nối PostgreSQL và các secret local cho
JWT/password hashing. Không commit file này.

## 3. Khởi động PostgreSQL

Chạy từ thư mục gốc repository:

```bash
docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml up -d
```

Kiểm tra database đã healthy:

```bash
docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml ps
docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml logs -f postgres
```

Nhấn `Ctrl+C` để thoát khỏi màn hình log; container vẫn tiếp tục chạy.

## 4. Cài dependency và chuẩn bị Prisma

Chuyển vào backend:

```bash
cd src/backend
npm ci
npm run db:generate
```

`npm run db:generate` là bắt buộc sau `npm ci` hoặc sau khi Prisma schema thay
đổi. Nếu bỏ qua bước này, backend có thể báo lỗi `@prisma/client did not initialize yet`.

## 5. Apply migration và seed dữ liệu demo

Vẫn ở `src/backend`:

```bash
npm run db:migrate
npm run db:seed
```

`db:migrate` apply tất cả migration đã commit. `db:seed` import menu/demo data
và tạo tài khoản để đăng nhập. Có thể chạy lại seed khi cần đồng bộ lại dữ liệu
demo.

Nếu database local cũ được tạo trước khi auth email/mật khẩu được thêm vào,
hai lệnh trên là bắt buộc để apply migration `replace_otp_with_password_auth`
và cập nhật password hash cho user demo.

## 6. Chạy backend

```bash
npm run dev
```

Backend chạy tại:

```text
http://localhost:3000
```

Giữ terminal này mở trong lúc phát triển. `tsx watch` tự restart khi source
TypeScript thay đổi.

## 7. Smoke test đăng nhập

Sau khi seed thành công, dùng tài khoản:

```text
Email: customer1@example.com
Password: DemoPassword123!
```

Mở terminal khác và chạy:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email":"customer1@example.com",
    "password":"DemoPassword123!",
    "device_id":"local-device"
  }'
```

Response trả `access_token` và `refresh_token`. Dùng access token để kiểm tra
profile:

```bash
curl http://localhost:3000/api/auth/me \
  -H 'Authorization: Bearer ACCESS_TOKEN'
```

Thay `ACCESS_TOKEN` bằng giá trị thực từ response login.

## 8. Lệnh hữu ích

Chạy từ `src/backend`:

```bash
npm run lint             # TypeScript + Prisma schema validation
npm test                 # Chạy test suite
npm run db:migrate:dev   # Tạo migration mới trong quá trình phát triển schema
npm run db:reset         # Reset database, apply migrations, seed lại
```

Chạy từ thư mục gốc repository:

```bash
docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml down     # dừng database
docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml down -v  # dừng và xóa toàn bộ dữ liệu local
```

## 9. Xử lý lỗi thường gặp

| Lỗi | Cách xử lý |
| --- | --- |
| `@prisma/client did not initialize yet` | Chạy `npm run db:generate`, rồi chạy lại `npm run dev`. |
| Không kết nối được database | Kiểm tra Docker bằng `docker compose ... ps` và logs PostgreSQL. |
| Login bị `INVALID_CREDENTIALS` | Chạy `npm run db:migrate && npm run db:seed`, sau đó dùng đúng tài khoản demo. |
| Port 5432 đang được dùng | Đổi `POSTGRES_PORT` và port trong `DATABASE_URL` tại `src/backend/.env`, sau đó restart Docker Compose. |
| Prisma Client không khớp schema | Chạy `npm run db:generate`; nếu vừa thêm schema mới, chạy tiếp `npm run db:migrate`. |
