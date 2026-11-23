# Chính sách & Kiến trúc Bảo mật — WeatherBuddy v3.0 (`SECURITY.md`)

Tài liệu này mô tả kiến trúc phòng thủ nhiều lớp (**Defense-in-Depth**) áp dụng xuyên suốt Backend Node.js (`server/`), Giao diện Web/Mobile (`src/`), Tiện ích Mở rộng Trình duyệt (`browser-extension/`), và Widget Màn hình Máy tính (`desktop-widget/`).

---

## 1. Quản lý Khóa API & Chống Rò rỉ Bí mật (Zero Secret Persistence)

1. **Mặc định rỗng 100% (`""`)**:
   - Toàn bộ mã nguồn (`src/`, `server/`, `browser-extension/`, `desktop-widget/`) và tệp cấu hình (`.env`, `.env.example`) **không chứa bất kỳ khóa API cứng (hardcoded key) nào**.
   - Khi người dùng không nhập khóa riêng, hệ thống tự động sử dụng **Open-Meteo Free + US AQI** hoàn toàn miễn phí.
2. **Truyền khóa tạm thời theo từng yêu cầu (Transient Per-Request Headers)**:
   - Giao diện gửi khóa API của người dùng qua HTTP headers riêng (`X-Google-Api-Key`, `X-Tomorrow-Api-Key`, `X-Weatherapi-Key`).
   - Máy chủ chỉ giữ khóa trong phạm vi xử lý yêu cầu hiện tại để gọi API thời tiết phía trên (upstream) và **không bao giờ lưu khóa xuống đĩa** (`server/.runtime/telemetry.json` và `server/.runtime/widget_sync.json` chỉ lưu dữ liệu thời tiết ẩn danh đã qua bộ lọc schema).
3. **Cô lập bộ nhớ đệm bằng HMAC-SHA256 có muối (Salted SHA-256 Cache Isolation)**:
   - Khóa bộ nhớ đệm 15 phút được băm bằng `HMAC-SHA256` với khóa muối ngẫu nhiên 32-byte (`crypto.randomBytes(32)`) sinh mới mỗi lần khởi động tiến trình. Chuỗi khóa API gốc không bao giờ xuất hiện trong khóa `Map` trên RAM.
4. **Tự động che giấu bí mật trong thông báo lỗi (`redactSecrets`)**:
   - Mọi thông báo lỗi từ upstream trước khi trả về client hoặc ghi log đều đi qua bộ lọc `redactSecrets()` trong `server/security.mjs`, tự động xóa các tham số `(?|&)(key|apikey|api_key|token|secret)=...`, khóa Google `AIza...`, Bearer token và giá trị khóa tạm thời của yêu cầu.

---

## 2. Bảo vệ HTTP Headers, CORS & Chống Tấn công Web (CSP / CSRF)

1. **HTTP Security Headers bắt buộc trên mọi phản hồi**:
   - `X-Content-Type-Options: nosniff` — Chặn trình duyệt tự suy đoán MIME type.
   - `X-Frame-Options: DENY` & `frame-ancestors 'none'` — Chặn nhúng iframe (Clickjacking).
   - `Referrer-Policy: no-referrer` — Không rò rỉ URL nội bộ sang trang bên thứ ba.
   - `Permissions-Policy: camera=(), microphone=(), payment=(), geolocation=(self)` — Khóa các quyền phần cứng nhạy cảm không sử dụng.
   - `Cross-Origin-Resource-Policy`: `cross-origin` cho `/api/*` (phục vụ Localhost Web & Extension) và `same-origin` cho tài nguyên HTML/tĩnh.
   - `Content-Security-Policy` chặt chẽ trên mọi phản hồi HTML (`object-src 'none'; base-uri 'self'; frame-ancestors 'none'`).
2. **Danh sách trắng CORS nghiêm ngặt (`evaluateCorsOrigin`)**:
   - Chỉ chấp nhận `http://localhost:*`, `http://127.0.0.1:*`, `chrome-extension://*` (cùng `moz-extension://*` / `safari-web-extension://*`), hoặc danh sách cấu hình rõ ràng qua biến môi trường `ALLOWED_ORIGINS`.
   - Mọi yêu cầu thay đổi trạng thái (`POST`, `DELETE`) mang `Origin` lạ đều bị từ chối ngay lập tức với mã `403 Forbidden`.
3. **Bảo vệ Kép Loopback + Anti-CSRF trên `/api/pc-widget/launch`**:
   - Kiểm tra địa chỉ socket nguồn bắt buộc là loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`).
   - Bắt buộc có custom header `X-WeatherBuddy-Client: weatherbuddy-ui` (ngăn chặn hoàn toàn tấn công Simple-Request CSRF từ trang web độc hại nhắm vào `localhost:8787`).
   - Xác thực tham số `corner`, `size`, `gender` bằng tập hợp hằng số cho phép (`Set` allowlist) và gọi `child_process.spawn('powershell.exe', args, { shell: false })` — **tuyệt đối không nối chuỗi lệnh shell (Zero Command Injection)**.

---

## 3. Chống Quá tải, Giới hạn Kích thước & Chống Leo thang Thư mục

1. **Giới hạn Tốc độ Cửa sổ Trượt theo IP (`SlidingWindowRateLimiter`)**:
   - `/api/weather`: tối đa **60 yêu cầu / phút / IP**.
   - `/api/pc-widget/launch`: tối đa **10 yêu cầu / phút / IP**.
   - Các endpoint API khác: tối đa **120 yêu cầu / phút / IP**.
   - Phản hồi luôn kèm `X-RateLimit-Limit`, `X-RateLimit-Remaining`, và trả `429 Too Many Requests` + `Retry-After` khi vượt ngưỡng.
2. **Giới hạn Body JSON `<= 16 KB` (`413 Payload Too Large`)**:
   - Kiểm tra cả `Content-Length` lẫn tổng byte luồng đọc thực tế để ngăn tấn công làm đầy bộ nhớ.
3. **Giới hạn Thời gian Chờ Upstream (`AbortSignal.timeout(10_000)`)**:
   - Mọi kết nối ra ngoài tới dịch vụ thời tiết / định vị đều tự động hủy sau 10 giây nếu máy chủ đích phản hồi treo.
4. **Chống Path Traversal & Bảo vệ Tệp Ẩn (`isSuspiciousStaticPath` + `path.resolve`)**:
   - Chặn ngay từ URL thô mọi biến thể `..`, `%2e%2e`, `\`, byte rỗng `\0`, và các tệp cấu hình ẩn như `/.env`, `/.git` với mã `403 Forbidden`, kết hợp kiểm tra biên thư mục `path.relative(distDir, candidatePath)`.

---

## 4. Kiểm thử Bảo mật Tự động

Chạy toàn bộ bộ kiểm thử bảo mật và kiểm tra rò rỉ khóa trên toàn kho mã:

```bash
node --test tests/securityAudit.mjs
node --test tests/backendServer.mjs
```

Trạng thái bảo mật trực tiếp của máy chủ có thể được kiểm tra bất kỳ lúc nào qua endpoint không nhạy cảm:
`GET http://localhost:8787/api/security/status`.
