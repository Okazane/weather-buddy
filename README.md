# WeatherBuddy v3 — Chibi NPC & Thời Tiết Đa Nền Tảng (Web, Extension, Windows PC, iOS & Android)

Ứng dụng thời tiết cá nhân hóa với hai nhân vật 3D Vinyl Chibi (**👦 Nam: Cậu bé Mây** & **👧 Nữ: Cô bé Nắng**) kết hợp **Chế độ Chibi NPC tự động đổi 5 hoạt động ngẫu nhiên mỗi 5 phút** (`Đọc sách`, `Chơi với mèo`, `Chơi với cún`, `Xem điện thoại`, `Nghe nhạc`) và **chạm để đứng dậy báo thời tiết**, đi kèm **Full-Stack Backend Server (Cổng 8787)**, **Web Analytics Dashboard**, **Chrome/Edge Extension (Tab Mới & Popup)**, **Windows Desktop Screen Widget**, cùng **iPhone WidgetKit & Android Jetpack Glance**.

---

## Tính năng nổi bật (v3)

1. **Chibi NPC Tự Động (5 Hành Động / 5 Phút) & Tương Tác Đứng Dậy**:
   - Khi ở trạng thái nghỉ, nhân vật hoạt động tự nhiên như một NPC với 5 hành động ngẫu nhiên (`reading_book`, `petting_cat`, `petting_puppy`, `scrolling_phone`, `listening_music`) tự động xoay vòng mỗi **5 phút** (kèm nút đổi nhanh ở góc sân khấu).
   - **Khi chạm vào nhân vật**: Chibi thực hiện chuyển động bật đứng dậy sang đúng một trong **7 trang phục thời tiết** (`clear_night` cho ban đêm quang đãng không kính râm/UV, `pleasant_sunny`, `hot_sunny`, `light_rain_umbrella`, `storm_raincoat`, `chilly_cozy`, `freezing_puffer`) trong 8.5 giây rồi nhẹ nhàng ngồi xuống trở lại.

2. **Định Vị GPS Chính Xác Cao (`enableHighAccuracy: true`) & Reverse Geocoding Tiếng Việt**:
   - Nút **1 chạm `📍 Vị trí hiện tại`** ngay trên thanh điều khiển đầu trang xác định tọa độ chính xác tới 5 chữ số thập phân và tự động phân giải tên Quận/Phường & Thành phố tiếng Việt.
   - Hỗ trợ chọn nhanh 6 thành phố Việt Nam (`Hà Nội`, `TP. Hồ Chí Minh`, `Đà Lạt`, `Đà Nẵng`, `Sa Pa`, `Cần Thơ`).

3. **Bảo Mật End-to-End & Khóa API Cá Nhân Mặc Định Để Trống**:
   - Tất cả ô nhập khóa API (`Google Weather API`, `Tomorrow.io`, `WeatherAPI.com`) đều **để trống hoàn toàn mặc định** (tự động sử dụng `Open-Meteo Free + US AQI`, làm mới mỗi **15 phút**).
   - Người dùng có thể tự dán khóa API riêng trong mục **Cài đặt** (hỗ trợ ẩn/hiện mật khẩu và xóa khóa 1 chạm).
   - Backend tích hợp `server/security.mjs`: HTTP Security Headers (`CSP`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`), chống CSRF (`X-WeatherBuddy-Client`), giới hạn tần suất (Rate Limiting), ẩn khóa bí mật (Secret Redaction) và băm `SHA-256` bộ đệm.

4. **Trung Tâm Tính Năng & Cài Đặt Đa Nền Tảng (`🧩 Tiện ích & Cài đặt`)**:
   - Bảng tùy chỉnh trực quan cho phép chọn vị trí neo trên màn hình máy tính (`Góc phải dưới`, `Góc phải trên`, `Góc trái dưới`, `Góc trái trên`), kích thước (`300×420` hoặc `380×540`), bật/tắt từng module, tải gói `.zip` và bấm mở trực tiếp Widget nổi lên màn hình Windows.

---

## Khởi chạy nhanh (Web, Full-Stack Backend & Kiểm thử)

```bash
# 1. Cài đặt phụ thuộc
npm install --legacy-peer-deps

# 2. Kiểm tra kiểu TypeScript và bộ kiểm thử (Rule Engine + Backend + Security Audit)
npm run typecheck
npm test

# 3. Chạy giao diện Web tương tác (Expo Web - cổng 8081)
npm run web

# 4. Chạy Backend API & Static Server (cổng 8787)
npm run server

# 5. Xuất bản tĩnh Web (dist/) kèm gói tải về và khởi chạy Full-Stack trên cổng 8787
npm run fullstack
```

---

## Hướng dẫn cài đặt trên từng nền tảng

### 1. Extension Trình duyệt (Chrome / Edge / Brave / Cốc Cốc - Manifest V3)
- Tải file `/downloads/weather-buddy-extension.zip` từ tab **🧩 Tiện ích & Cài đặt** (hoặc dùng trực tiếp thư mục `browser-extension/`).
- Mở `chrome://extensions` hoặc `edge://extensions` -> bật **Developer mode (Chế độ nhà phát triển)** -> nhấn **Load unpacked (Tải tiện ích đã giải nén)** -> chọn thư mục `browser-extension/`.

### 2. Widget Nổi Màn hình Máy tính (Windows Desktop)
- Bấm nút **🚀 Mở ngay Widget lên Màn hình Windows** trong tab **🧩 Tiện ích & Cài đặt**, hoặc chạy trực tiếp:
  ```powershell
  powershell -ExecutionPolicy Bypass -File desktop-widget/Launch-Desktop-Widget.ps1 -Corner BottomRight -Size Standard -Gender female
  ```
- Chạy `desktop-widget/Install-Shortcut.ps1` để tạo biểu tượng ngoài màn hình Desktop Windows.

### 3. Native Widget trên iPhone (WidgetKit) & Android (Jetpack Glance)
```bash
npx expo prebuild
npx expo run:ios
# hoặc
npx expo run:android
```
- **iOS WidgetKit**: `native-widgets/ios/WeatherBuddyWidget.swift` (App Group `group.com.weatherbuddy.shared`).
- **Android Jetpack Glance**: `native-widgets/android/WeatherBuddyGlanceWidget.kt` (`weather_buddy_widget_prefs`, đồng bộ nền mỗi 15 phút qua `WorkManager`).
