# WeatherBuddy Rust Native Suite (`rust/`)

Không gian làm việc Cargo (`Cargo Workspace`, Rust Edition 2021, `v3.1.0`) cung cấp bộ nền tảng hiệu năng cao bằng Rust thuần cho **WeatherBuddy**, thay thế tương thích 1:1 toàn bộ lớp Electron Desktop Widget, máy chủ Node.js HTTP và chuỗi công cụ xử lý ảnh 3D Python/SciPy + PowerShell.

---

## 1. Kiến trúc Workspace (4 Crate)

```text
rust/
├── Cargo.toml                  # Cấu hình Cargo Workspace & phiên bản phụ thuộc dùng chung
├── weather-buddy-core/         # Thư viện lõi: cây quyết định trang phục thời tiết, chủ đề bầu trời & máy trạng thái NPC
├── weather-buddy-server/       # Máy chủ HTTP Axum + Tokio (127.0.0.1:8787), bộ đệm DashMap 15 phút & định vị Windows GPS
├── weather-buddy-tauri/        # Ứng dụng Windows Desktop Widget & khay hệ thống (Tauri v2 + nhúng sẵn Axum trong tiến trình)
└── weather-buddy-packer/       # Công cụ CLI đa nhân (Rayon + image + zip): kiểm định sprite, tách nền 3D & đóng gói PC Suite
```

---

## 2. Ưu thế Hiệu năng Thực tế (RAM · CPU · Dung lượng Thực thi)

| Thành phần | Triển khai cũ (JS / Electron / Python) | Triển khai Rust Native (`rust/`) | Cải thiện thực tế |
| :--- | :--- | :--- | :--- |
| **Desktop Widget & Khay hệ thống** (`weather-buddy-tauri`) | Electron / Chromium rời (`~250 MB` RAM, gói `~140 MB`) | **Tauri v2 + WebView2** nhúng trực tiếp `weather-buddy-server` (`~28–32 MB` RAM, tệp `.exe` `~6 MB`) | **Giảm ~88% RAM**, nhỏ hơn **>20×**, không cần bật Node.js thủ công |
| **Backend API & Dashboard Server** (`weather-buddy-server`) | Node.js V8 (`~65–90 MB` RAM, đơn luồng sự kiện) | **Axum + Tokio + DashMap** (`~8–14 MB` RAM, đa luồng không khóa, `< 0.5%` CPU khi nghỉ) | **Giảm ~82% RAM**, độ trễ đọc bộ đệm `< 45 µs`, định vị phần cứng Windows trực tiếp |
| **Xử lý Sprite 3D & Đóng gói `.zip`** (`weather-buddy-packer`) | Python (`SciPy` + `Pillow`) + PowerShell `Compress-Archive` (`~4.5–8.0s`) | **Rayon** đa nhân + `image` + `zip` Deflate thuần Rust (`~180–320 ms` cho cả 2 gói `.zip`) | Xử lý ảnh 3D **nhanh hơn ~15×**, nén `.zip` **nhanh hơn 15–20×**, chuẩn đường dẫn `/` đa nền tảng |

---

## 3. Chi tiết Từng Crate

### 3.1. `weather-buddy-core` (Thư viện Quy tắc Thời tiết & NPC Dùng chung)
Thư viện nền không phụ thuộc I/O mạng, đảm bảo hợp đồng JSON `camelCase` khớp 1:1 với TypeScript (`src/core/`):
- **Cây quyết định nhân vật (`evaluate_character_decision`)**: Phân tích nhiệt độ cảm nhận, lượng mưa, sức gió, chỉ số UV, AQI Hoa Kỳ và giờ địa phương theo múi giờ thực để chọn chính xác 1 trong 7 trang phục (`pleasant_sunny`, `hot_sunny`, `clear_night`, `light_rain_umbrella`, `storm_raincoat`, `chilly_cozy`, `freezing_puffer`) và 7 chủ đề bầu trời (`dawn`, `day_sunny`, `day_cloudy`, `day_rain`, `sunset`, `rain_storm`, `night`).
- **Bảo toàn ngữ cảnh ngày/đêm**: Ban đêm quang đãng (kể cả đêm ấm tại TP.HCM) luôn dùng `clear_night` (không đeo kính râm hay cảnh báo UV); mưa ban ngày giữ bầu trời `day_rain` sáng dịu thay vì tối đen.
- **Máy trạng thái NPC & Thành phố mẫu**: Chu kỳ xoay vòng 5 hoạt động ngẫu nhiên mỗi 5 phút (`reading_book`, `petting_cat`, `petting_puppy`, `scrolling_phone`, `listening_music`) và danh sách 6 thành phố Việt Nam (`Hà Nội`, `TP. Hồ Chí Minh`, `Đà Lạt`, `Đà Nẵng`, `Sa Pa`, `Cần Thơ`).

### 3.2. `weather-buddy-server` (Máy chủ Axum Hiệu năng cao & Định vị Windows)
Thay thế trực tiếp `server/index.mjs` trên cổng `127.0.0.1:8787` (vừa là tệp thực thi độc lập, vừa xuất hàm `spawn_background_server` để nhúng thẳng vào Tauri):
- **Đầy đủ các điểm cuối HTTP**:
  - `GET /api/health`, `GET /api/security/status`, `GET /api/dashboard/overview`
  - `GET` & `POST /api/weather`: Kết hợp `Open-Meteo + US AQI` mặc định (không lưu cứng bất kỳ khóa API nào trên máy chủ) cùng khóa tùy chọn của người dùng cho `Google Weather`, `Tomorrow.io`, `WeatherAPI.com`. Bộ đệm `DashMap` 15 phút được cô lập bằng mã băm `HMAC-SHA256` kèm muối ngẫu nhiên theo phiên.
  - `GET /api/auto-locate`: Trên Windows, ưu tiên truy vấn phần cứng Wi-Fi/GPS qua `Windows::Devices::Geolocation::Geolocator` (giới hạn chờ `2.5s`), tự động chuyển tiếp mượt mà sang chuỗi dự phòng IP (`ipwho.is` -> `BigDataCloud` -> `GeoJS`) kèm chuẩn hóa tên tỉnh/thành tiếng Việt.
  - `GET /api/reverse-geocode`, `GET|POST|DELETE /api/widget-sync`, `GET /api/pc-suite/status`, `POST /api/pc-widget/launch` và phục vụ tệp tĩnh cho `dist/`, `/downloads/`, `/extension-preview/`, `/desktop-widget-preview/`.
- ** Gia cố bảo mật**: Bảo vệ CSRF (`X-WeatherBuddy-Client`), giới hạn tần suất theo IP, giới hạn kích thước gói tin `16 KB`, chống leo thang thư mục (`Path Traversal`), tự động che khóa nhạy cảm trong nhật ký và gắn đầy đủ tiêu đề bảo mật HTTP (`CSP`, `X-Frame-Options: DENY`, `nosniff`).

### 3.3. `weather-buddy-tauri` (Tauri v2 Windows Desktop Widget & System Tray)
Ứng dụng máy tính siêu nhẹ thay thế hoàn toàn Electron:
- **Tự khởi chạy máy chủ nội bộ**: Trong pha `.setup(...)`, ứng dụng tự kiểm tra cổng `8787` và khởi chạy `weather_buddy_server::spawn_background_server` ngay trong tiến trình nếu cổng chưa mở.
- **Hai chế độ cửa sổ**:
  - `companion-widget`: Cửa sổ nổi không viền (`decorations: false`), nền trong suốt, luôn nổi trên cùng (`alwaysOnTop`), ẩn khỏi thanh tác vụ, hỗ trợ 2 kích thước `Gọn nhẹ (300×420)` và `Tiêu chuẩn (380×540)`.
  - `main`: Bảng điều khiển phân tích thời tiết đầy đủ (`1280×860`), mở theo yêu cầu từ khay hệ thống.
- **Neo góc đa màn hình chuẩn DPI (`window_position.rs`) & Khay hệ thống tiếng Việt (`tray.rs`)**: Tính toán chính xác vùng làm việc (`Work Area`) có tính tỷ lệ DPI cho 4 góc màn hình (cách lề `16px`), đổi nhanh nhân vật Nam/Nữ, làm mới thời tiết và tự khởi động cùng Windows (`tauri-plugin-autostart` + `tauri-plugin-single-instance`).

### 3.4. `weather-buddy-packer` (Xử lý Ảnh 3D Đa Nhân & Đóng gói PC Suite CLI)
Công cụ dòng lệnh tăng tốc bằng `rayon` trên toàn bộ nhân CPU với 3 lệnh con:
1. **`audit-sprites`**: Quét song song toàn bộ 24 tệp PNG nhân vật/NPC (`768×768`) trong `assets/characters/` và các tệp thú cưng (`256×256`) trong `assets/characters/companions/`, kiểm tra định dạng `RGBA8`, tổng alpha viền ngoài bằng `0` (`border_alpha_sum == 0`, không cắt lẹm mép), độ đồng nhất mốc đỉnh đầu/đế giày (`Crown`/`Sole`) và tỷ lệ viền trắng `< 0.5%`, xuất bảng báo cáo trực quan hoặc JSON.
2. **`remaster`**: Thuật toán Rust thuần tách nền phòng chụp `#FFFFFF`, khử nhiễm trắng biên bán trong suốt `C = clamp((rgb - (1 - a) * 255) / max(a, 0.18), 0, 255)`, lọc thành phần liên thông lớn nhất (loại bỏ chi tiết thừa trôi nổi), tự động nhận diện tâm đồng tử hai mắt và căn chỉnh về khung chuẩn `768×768` (`Eye Y = 296`, `IPD = 114`, `Sole Y = 692`) mà không cần Python/SciPy/Pillow.
3. **`pack-suite`**: Thay thế 1:1 cho `scripts/pack-pc-suite.mjs` — đồng bộ 24 sprite nhân vật + thú cưng sang `browser-extension/` và `desktop-widget/`, đồng bộ `styles.css` & `weather-npc-app.js`, xác thực `manifest.json` (Manifest V3 & CSP), đồng thời nén song song `weather-buddy-extension.zip` và `weather-buddy-desktop-widget.zip` vào `public/downloads/` (và `dist/downloads/` khi có `dist/`) bằng thuật toán Deflate.

---

## 4. Các Lệnh `cargo` Một Dòng (Chạy từ thư mục `rust/`)

```bash
# Kiểm tra biên dịch toàn bộ 4 crate trong workspace
cargo check --workspace

# Chạy toàn bộ bộ kiểm thử đơn vị & tích hợp (Core + Server + Packer)
cargo test -p weather-buddy-core -p weather-buddy-server -p weather-buddy-packer

# 1. Khởi chạy máy chủ Backend Axum độc lập tại http://127.0.0.1:8787
cargo run --release -p weather-buddy-server -- --host 127.0.0.1 --port 8787

# 2. Kiểm định song song đa nhân toàn bộ 24+2 tệp PNG nhân vật & thú cưng 3D
cargo run --release -p weather-buddy-packer -- audit-sprites

# 3. Tách nền #FFFFFF & căn chỉnh mốc giải phẫu 768x768 cho ảnh render 3D mới
cargo run --release -p weather-buddy-packer -- remaster --input raw_render.jpg --output ../assets/characters/female_pleasant_sunny.png

# 4. Đồng bộ tài nguyên & đóng gói song song 2 tệp .zip cho Extension và Desktop Widget
cargo run --release -p weather-buddy-packer -- pack-suite --audit-first

# 5. Chạy trực tiếp ứng dụng Windows Desktop Widget & System Tray (Tauri v2)
cargo run -p weather-buddy-tauri

# 6. Biên dịch toàn bộ tệp thực thi tối ưu hóa (.exe) ở chế độ Release
cargo build --release --workspace
```
