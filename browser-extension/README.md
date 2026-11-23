# 🌐 WeatherBuddy Browser Extension (Manifest V3 — Chrome / Edge / Brave / Cốc Cốc)

Tiện ích mở rộng trình duyệt **WeatherBuddy v3** mang nhân vật Chibi 3D (**Cậu bé Mây** & **Cô bé Nắng**) lên **Tab Mới (`newtab.html`)**, **Popup Thanh công cụ (`popup.html`)**, và **Trung tâm Tính năng & Cài đặt (`options.html`)**.

---

## ✨ Tính năng nổi bật

1. **Living Chibi NPC Tự hành (5 Hoạt động xoay vòng mỗi 5 phút)**:
   - Mặc định nhân vật ở trạng thái thư giãn ấm cúng: 📖 *Đọc sách*, 🐾 *Chơi với mèo*, 🐶 *Chơi với cún*, ✨ *Xem điện thoại*, 🎵 *Nghe nhạc*.
   - **Tương tác Đứng dậy xem Thời tiết**: Chạm vào nhân vật để Chibi bật đứng dậy trong **8.5 giây** với trang phục đúng theo thời tiết thực (`clear_night` ban đêm không kính râm, `pleasant_sunny`, `hot_sunny`, `light_rain_umbrella`, `storm_raincoat`, `chilly_cozy`, `freezing_puffer`).
2. **Huy hiệu Nhiệt độ trên Thanh công cụ (`background.js`)**:
   - Tự động cập nhật mỗi **15 phút** qua `chrome.alarms`, hiển thị nhiệt độ trực tiếp (ví dụ `27°`) trên biểu tượng tiện ích.
3. **Tab Mới Thông minh (`newtab.html`)**:
   - Đồng hồ lớn `HH:MM` (tabular numerals), thanh tìm kiếm Google / DuckDuckGo, nút **📍 Vị trí hiện tại** (GPS độ chính xác cao + tên Quận/Thành phố tiếng Việt), 6 thành phố Việt Nam cài sẵn, và dải dự báo 12 giờ.
4. **Bảo mật & Không gắn cứng API Key**:
   - Tuân thủ nghiêm ngặt Manifest V3 CSP (`script-src 'self'; object-src 'none'; base-uri 'self'`).
   - 100% ô nhập API Key để trống mặc định, tự động sử dụng **Open-Meteo Free**.

---

## 🚀 Hướng dẫn cài đặt lên Chrome / Edge / Brave / Cốc Cốc

1. Nếu bạn tải file `weather-buddy-extension.zip`, hãy **giải nén** ra một thư mục (hoặc trỏ trực tiếp tới thư mục `browser-extension/` trong dự án).
2. Mở trình duyệt và truy cập trang quản lý Extension:
   - **Chrome / Cốc Cốc**: `chrome://extensions`
   - **Microsoft Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên.
4. Nhấn nút **Tải tiện ích đã giải nén (Load unpacked)** và chọn thư mục `browser-extension`.
5. Ghim biểu tượng **WeatherBuddy** lên thanh công cụ và mở một **Tab mới** để trải nghiệm!
