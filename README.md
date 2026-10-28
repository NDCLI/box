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

### Cập nhật bản Portable

Bản Portable đầy đủ có thể kèm PAT mặc định. Khi chạy lần đầu, ứng dụng lưu PAT vào Windows Credential Encryption (DPAPI) trong thư mục dữ liệu người dùng. Các bản vá Portable phát hành trên GitHub không chứa PAT; updater kiểm tra GitHub Releases, xác minh SHA-256, rồi thay file Portable và khởi động lại ứng dụng. Mỗi máy cần cài bản đầy đủ có updater một lần; sau đó có thể cập nhật bằng các bản vá.

Để phát hành một bản vá, tăng phiên bản trong `package.json` và `package-lock.json`, commit/push mã nguồn, rồi đẩy tag tương ứng, ví dụ `v1.0.5`. GitHub Actions sẽ build Portable không PAT và tạo GitHub Release kèm checksum. Không đẩy `token.txt`, `access_tokens.csv`, hoặc bản Portable đầy đủ lên repo công khai.

Tạo bản renderer desktop hoặc đóng gói cả Setup và Portable:

```bash
npm run desktop:build
npm run desktop:dist
```

Để đóng gói PAT mặc định (vẫn cho phép người dùng nhập PAT khác), đặt biến môi trường trước khi chạy lệnh trên. PAT sẽ nằm trong bản Windows đã đóng gói, vì vậy chỉ dùng token read-only có thể thu hồi.

```powershell
$env:CVAT_DEFAULT_PAT = 'PAT-CVAT-CUA-BAN'
npm run desktop:dist
Remove-Item Env:CVAT_DEFAULT_PAT
```

Để tạo gói Microsoft Store có PAT mặc định trong cùng cửa sổ PowerShell:

```powershell
$env:CVAT_DEFAULT_PAT = 'PAT-CVAT-CUA-BAN'
npm run desktop:store
Remove-Item Env:CVAT_DEFAULT_PAT
```

Gói MSIX/MSIXUPLOAD được xuất vào `release/windows/`. Trước khi nộp Partner Center, reserve tên ứng dụng và cập nhật Identity Name/Publisher theo giá trị Partner Center cấp.

Các file `.exe` được tạo trong thư mục `release/windows/`. Bản phát hành hiện chưa được ký mã nên Windows SmartScreen có thể hiển thị cảnh báo.

## Đọc trực tiếp từ CVAT

Ngoài XML/ZIP, màn hình mở file có thể kết nối trực tiếp tới CVAT bằng Task ID. Khi deploy trên Vercel, đặt `CVAT_BASE_URL` và `CVAT_PAT` trong Project Settings; hai biến này không dùng tiền tố `VITE_`, chỉ được Vercel Function đọc và không đi xuống trình duyệt. Proxy chỉ cho phép đọc Task, annotation và ảnh Frame.

Chế độ `Dán PAT tạm thời` vẫn dành cho chạy local/Desktop; token chỉ giữ trong bộ nhớ phiên. Kết nối trực tiếp cần CVAT cho phép CORS từ địa chỉ chạy ứng dụng.

## Kiểm tra mã nguồn

```bash
npm run lint
npm test
npm run build
npm run desktop:build
```
