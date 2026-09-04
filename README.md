# CVAT Box Counter & Duplicate Inspector

Ứng dụng web dùng để đọc annotation CVAT, thống kê bounding box và phát hiện các box trùng lặp theo tọa độ hoặc IoU.

## Chạy trên máy local

Yêu cầu: Node.js.

```bash
npm install
npm run dev
```

Ứng dụng mặc định chạy tại `http://localhost:3000`.

## Chạy ứng dụng Windows

Yêu cầu: Windows x64 và Node.js.

```bash
npm install
npm run desktop:dev
```

Tạo bản renderer desktop hoặc đóng gói cả Setup và Portable:

```bash
npm run desktop:build
npm run desktop:dist
```

Các file `.exe` được tạo trong thư mục `release/windows/`. Bản phát hành hiện chưa được ký mã nên Windows SmartScreen có thể hiển thị cảnh báo.

## Đọc trực tiếp từ CVAT

Ngoài XML/ZIP, màn hình mở file có thể kết nối trực tiếp tới CVAT bằng URL server, Personal Access Token (PAT) chỉ đọc và Task ID. Token chỉ giữ trong bộ nhớ của phiên đang mở, không được lưu vào source hay localStorage.

Kết nối trực tiếp cần CVAT cho phép CORS từ địa chỉ chạy ứng dụng. Nếu CVAT chặn CORS, cấu hình CORS trên CVAT rồi thử lại.

## Kiểm tra mã nguồn

```bash
npm run lint
npm test
npm run build
npm run desktop:build
```
