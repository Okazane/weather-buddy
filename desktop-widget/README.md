# 🖥️ WeatherBuddy Windows Desktop Widget (Bạn đồng hành Màn hình Máy tính)

**WeatherBuddy Desktop Widget** hiển thị nhân vật Chibi 3D (**Cậu bé Mây** & **Cô bé Nắng**) ngay tại 4 góc màn hình máy tính Windows của bạn, tự động đổi 5 hành động thư giãn mỗi 5 phút và bật đứng dậy báo trang phục thời tiết khi bạn chạm vào.

---

## 🚀 3 Cách Mở Widget lên Màn hình Windows

### Cách 1: Nhấn đúp chuột vào `WeatherBuddy-Desktop.bat` (Nhanh nhất · Không cần cài đặt)
- Nhấn đúp vào tệp **`WeatherBuddy-Desktop.bat`**.
- Tập lệnh PowerShell `Launch-Desktop-Widget.ps1` sẽ tự động đo độ phân giải màn hình thực tế của bạn (`.NET System.Windows.Forms.Screen`) và mở cửa sổ Widget gọn gàng ngay tại **Góc phải dưới** màn hình!
- Tùy chỉnh tham số dòng lệnh:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\Launch-Desktop-Widget.ps1 -Corner BottomRight -Size Standard -Gender female
  ```
  - `-Corner`: `BottomRight` | `TopRight` | `BottomLeft` | `TopLeft`
  - `-Size`: `Standard` (`380×540`) | `Compact` (`300×420`)
  - `-Gender`: `male` (*Cậu bé Mây*) | `female` (*Cô bé Nắng*)

### Cách 2: Tạo biểu tượng ngoài Màn hình Desktop & Tự khởi động cùng Windows
Chạy lệnh sau trong PowerShell để tạo shortcut **`WeatherBuddy Widget`** trên Desktop:
```powershell
powershell -ExecutionPolicy Bypass -File .\Install-Shortcut.ps1 -Corner BottomRight -Size Standard -RunAtStartup
```

### Cách 3: Chạy qua Electron (Frameless + Always-on-Top)
Nếu máy tính đã cài Node.js, bạn có thể mở chế độ cửa sổ không viền luôn nổi (`alwaysOnTop: true`) bằng lệnh:
```bash
npx electron desktop-widget/electron-main.cjs
```

---

## 🔒 Bảo mật & Quyền riêng tư
- **Không gắn cứng API Key**: Mặc định sử dụng **Open-Meteo Free** hoàn toàn miễn phí.
- **Hardened Electron Sandbox**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, chặn hoàn toàn điều hướng ra trang web bên ngoài.
