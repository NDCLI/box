# Microsoft Store submission — CVAT Box Counter & Duplicate Inspector

Sao chép các phần dưới đây vào Partner Center. Thay các giá trị trong ngoặc vuông trước khi gửi.

## Product details

**Tên ứng dụng**

CVAT Box Counter & Duplicate Inspector

**Danh mục**

Developer tools

**Giá**

Free

**Short description**

Kiểm tra annotation CVAT cục bộ: đếm bounding box, loại trừ Frame Skip, phát hiện box trùng và xem ảnh Frame theo Job.

**Description**

CVAT Box Counter & Duplicate Inspector giúp đội annotation kiểm tra dữ liệu CVAT nhanh và riêng tư trên Windows.

Ứng dụng đọc annotation từ file XML hoặc ZIP CVAT ngay trên máy. Khi làm việc với CVAT nội bộ, người dùng có thể chọn Task và Job để tải annotation và xem ảnh Frame trực tiếp từ server CVAT trong mạng công ty.

Các tính năng chính

Đếm bounding box theo khoảng Frame.

Loại trừ nhãn `_excl` và `_exclude` theo từng box.

Nhận diện Frame Skip bằng `_skip` hoặc `frame_skip`.

Bỏ qua Frame Skip khi quét box trùng lặp.

Phát hiện box trùng theo IoU hoặc sai lệch pixel.

Mở một Job hoặc cả Task từ CVAT. Tải lại annotation ngay trong màn hình kết quả. Khi đóng Job/Task, danh sách đã tải được giữ trong phiên làm việc để chọn dữ liệu khác.

Xem ảnh Frame và overlay bounding box tại vị trí lỗi.

Xử lý XML, ZIP và dữ liệu annotation cục bộ trên thiết bị.

Ứng dụng không yêu cầu tài khoản của nhà phát hành. Kết nối CVAT là tùy chọn và chỉ hoạt động khi máy người dùng có quyền truy cập vào server CVAT của tổ chức.

**Search terms**

CVAT, annotation, bounding box, computer vision, object detection, dataset QA, duplicate inspector

**Additional system requirements**

Windows 10 version 1809 hoặc mới hơn, 64-bit.

Tính năng CVAT trực tiếp cần kết nối đến server CVAT của tổ chức qua mạng LAN hoặc VPN.

## Features

Sao chép từng dòng dưới đây vào trường Features; Partner Center sẽ tự hiển thị dạng danh sách.

Đếm bounding box trong annotation CVAT XML và ZIP.

Lọc Frame và loại trừ nhãn theo quy tắc QA.

Phát hiện bounding box trùng lặp bằng IoU hoặc pixel tolerance.

Chọn Task và Job CVAT để kiểm tra annotation theo phạm vi nhỏ.

Preview ảnh Frame cùng bounding box overlay.

Xử lý dữ liệu cục bộ, không tải XML hoặc ZIP lên máy chủ của nhà phát hành.

## Store listing assets

Chuẩn bị ít nhất một screenshot Desktop; nên dùng bốn ảnh sau:

1. Màn hình nhập XML/ZIP CVAT.
2. Màn hình cấu hình Frame Skip và thống kê box.
3. Danh sách duplicate boxes.
4. Preview ảnh Frame với bounding box overlay.

Dùng ảnh không có PAT, dữ liệu khách hàng, tên nội bộ hoặc địa chỉ IP nội bộ.

## Certification notes

```text
Purpose
CVAT Box Counter & Duplicate Inspector is a Windows desktop quality-assurance tool for CVAT annotations. It counts bounding boxes, detects duplicate boxes, and previews frame images.

Network capability
The app declares privateNetworkClientServer to connect to a CVAT server configured by the user on a private network or VPN. runFullTrust is required for the Electron Win32 application and Windows-protected local credential storage. The app makes outbound read requests and does not host a server.

Credentials and privacy
CVAT access is optional. This build includes a default read-only token for the organization's server; users can override it with their own token. The default token is an application resource. Manually entered tokens are stored locally using Windows data protection. Credentials are sent to the configured CVAT server for authentication. XML/ZIP annotations are processed locally. This Store build disables PostHog analytics.

Test instructions
The core functionality can be tested without an account: launch the app and load a CVAT XML or ZIP annotation file from the local device. Verify box counts, frame filters, duplicate detection, and preview overlay.

The direct CVAT feature requires a private organization server and is therefore unavailable to external certification devices. It is optional and does not block the offline XML/ZIP workflow.

No account is required for the offline XML/ZIP workflow. The private organization server is not publicly accessible and the default token is not a public review account. If live CVAT verification is required, contact the support address for an accessible test environment. Open either a Job or a whole Task, then use "Tải lại Job" or "Tải lại Task" inside the results view to refresh annotations. Closing returns to the loaded Task/Job choices for this app session.
```

## Partner Center checklist

- Reserve the app name before creating the submission.
- Use the Partner Center identity and publisher values listed below in the AppX configuration.
- Upload a Store logo and at least one Desktop screenshot.
- Complete age ratings.
- Add a valid HTTPS support URL and privacy policy URL.
- Explain `privateNetworkClientServer` using the certification note above.
- Upload the AppX package, review the capability declaration, then submit for certification.

## Product identity đã xác nhận

| Trường | Giá trị |
| --- | --- |
| Package/Identity/Name | Hoakim.CVATBoxAudit |
| Package/Identity/Publisher | CN=06970FBF-6DEA-4FD9-BB5E-DCC0D8D933EB |
| Package/Properties/PublisherDisplayName | Hoakim |

Bản Store giữ token mặc định theo lựa chọn của nhà phát hành và cho phép nhập token riêng. Token mặc định trong gói khác với token nhập tay được mã hóa bằng Windows. Điền thông tin này trung thực trong phần certification/privacy.

## Build command

Chạy trong PowerShell:

```powershell
$env:STORE_IDENTITY_NAME = 'Hoakim.CVATBoxAudit'
$env:STORE_PUBLISHER = 'CN=06970FBF-6DEA-4FD9-BB5E-DCC0D8D933EB'
$env:STORE_PUBLISHER_DISPLAY_NAME = 'Hoakim'
npm run desktop:store
```

Output là **AppX x64** trong `release/store/`, không phải MSIXUPLOAD. Script giữ token đã tạo nếu không đặt lại `CVAT_DEFAULT_PAT`, tắt PostHog cho bản Store, tạo icon, dọn `release/`, build renderer mới rồi đóng gói.

Logo listing tạo sẵn: `desktop/generated/store-assets/StoreListingLogo-300.png`. Bạn tự chụp screenshot. Điền email hỗ trợ, URL hỗ trợ HTTPS và đăng chính sách quyền riêng tư lên trang HTTPS công khai trước khi gửi. Ảnh/logo dùng kích thước theo trường tương ứng của Partner Center.

## What's new — sao chép

Hỗ trợ kiểm tra CVAT XML/ZIP; thống kê Frame Skip và nhãn loại trừ; phát hiện box trùng; preview ảnh; mở từng Job hoặc cả Task; tải lại annotation ngay trong màn hình kết quả và giữ danh sách Task/Job trong phiên làm việc.

## Sample và kiểm tra trước khi gửi

Dùng `store-review-sample.xml` trong thư mục tài liệu để test offline, hoặc cung cấp cho reviewer qua link truy cập được. Với cấu hình mặc định: Duplicate = 1, tổng sau loại trừ = 3. Exclude = 2 khi bật bỏ qua Frame Skip và = 4 ở chế độ đếm tất cả; tổng sau trừ vẫn = 3. Sample XML không có ảnh raster nên preview hiển thị nền mô phỏng.

Hoàn tất bảng hỏi Age ratings theo chức năng thực tế. Gói chưa được kiểm tra bằng Windows App Certification Kit hoặc duyệt bởi Microsoft thì không coi là đã đạt chứng nhận. Cần kiểm tra cài/chạy trước khi gửi.

Microsoft Store nhận AppX và không yêu cầu bạn mua chứng chỉ CA để nộp gói này; Store ký lại sau khi duyệt. Cài thử gói chưa ký ngoài Store là quy trình riêng.

Nguồn: [Microsoft — yêu cầu gói và identity](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements), [thông tin cần cung cấp cho reviewer](https://learn.microsoft.com/uk-ua/windows/apps/publish/publish-your-app/msix/resolve-submission-errors).
