# Chính sách quyền riêng tư — CVAT Box Counter & Duplicate Inspector

Ngày hiệu lực: [NGÀY THÁNG NĂM]

CVAT Box Counter & Duplicate Inspector là ứng dụng kiểm tra annotation CVAT trên Windows, do Hoakim phát hành. Chính sách này áp dụng cho bản Store được build với PostHog tắt.

## Dữ liệu được xử lý

Ứng dụng xử lý file XML, ZIP, annotation và ảnh Frame mà người dùng chọn. Dữ liệu này được xử lý cục bộ trên thiết bị.

Khi dùng kết nối CVAT, ứng dụng gửi yêu cầu trực tiếp từ thiết bị đến server do người dùng hoặc tổ chức chỉ định. Server nhận token xác thực, mã Task/Job/Frame được yêu cầu và thông tin kết nối như địa chỉ IP. Việc lưu nhật ký phía CVAT phụ thuộc chính sách của đơn vị vận hành server. Ứng dụng chỉ gửi yêu cầu đọc annotation/ảnh, không sửa dữ liệu trên server.

## Token CVAT

Ứng dụng có kèm token mặc định của tổ chức trong gói, dùng khi người dùng không nhập token riêng. Token mặc định không được mã hóa theo tài khoản Windows của từng người dùng. Người quản lý CVAT có thể thu hồi token này.

Token nhập tay được ưu tiên thay token mặc định, mã hóa bằng cơ chế bảo vệ dữ liệu Windows và lưu theo tài khoản Windows. Nút "Xóa PAT đã lưu" xóa token nhập tay đã lưu; không xóa token mặc định trong gói. Thông tin xác thực được gửi đến server CVAT được cấu hình để thực hiện yêu cầu người dùng.

Ứng dụng lưu cục bộ một số thiết lập như nhãn loại trừ. Danh sách Task/Job được giữ trong bộ nhớ phiên làm việc, không tự đồng bộ liên tục.

## Dữ liệu không thu thập

Ứng dụng không yêu cầu tài khoản riêng của nhà phát hành, không bán dữ liệu và không có quảng cáo. Quy trình build Store tắt PostHog; bản này không gửi analytics từ ứng dụng. File XML/ZIP không được ứng dụng tải lên dịch vụ phân tích. Microsoft Store và server CVAT có thể xử lý dữ liệu theo chính sách riêng của các đơn vị vận hành.

## Liên hệ

Nếu có câu hỏi về quyền riêng tư, liên hệ: [EMAIL HỖ TRỢ] hoặc [URL HỖ TRỢ HTTPS].
