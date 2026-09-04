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

Các file `.exe` được tạo trong thư mục `release/`. Bản phát hành hiện chưa được ký mã nên Windows SmartScreen có thể hiển thị cảnh báo.

## Kiểm tra mã nguồn

```bash
npm run lint
npm test
npm run build
npm run desktop:build
```
