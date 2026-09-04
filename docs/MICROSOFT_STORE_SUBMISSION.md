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

Chọn Task và Job từ CVAT để chỉ kiểm tra phạm vi cần thiết.

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
The app declares privateNetworkClientServer only to connect to a CVAT server configured by the user on a private home/work network or VPN. It does not listen for incoming connections and does not use this capability for advertising, analytics, or unrelated network access.

Credentials and privacy
CVAT access is optional. A user may enter a read-only CVAT Personal Access Token for their own organization. Tokens are stored only on the local device using Windows data protection and are not sent to the publisher. XML/ZIP annotations are processed locally.

Test instructions
The core functionality can be tested without an account: launch the app and load a CVAT XML or ZIP annotation file from the local device. Verify box counts, frame filters, duplicate detection, and preview overlay.

The direct CVAT feature requires a private organization server and is therefore unavailable to external certification devices. It is optional and does not block the offline XML/ZIP workflow.

No test account is required.
```

## Partner Center checklist

- Reserve the app name before creating the submission.
- Use the Partner Center identity and publisher values in the MSIX configuration; do not invent them locally.
- Upload a Store logo and at least one Desktop screenshot.
- Complete age ratings.
- Add a valid HTTPS support URL and privacy policy URL.
- Explain `privateNetworkClientServer` using the certification note above.
- Upload the MSIX package, review the capability declaration, then submit for certification.

## MSIX build prerequisites

The final MSIX must use the Identity Name and Publisher provided by Partner Center. It must also include Store logo assets. Do not submit a package with an embedded shared CVAT PAT: a Store package is public and that token can be extracted. Keep the embedded-token option for internal Setup/Portable distributions only.
