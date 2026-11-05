# ImageView trong CVAT Tools 1.1.3

Cập nhật 1.1.3: bố cục ImageView dùng chiều cao cửa sổ qua flex layout, bỏ phép tính chiều cao theo tọa độ/cuộn trang và bỏ chiều cao tối thiểu cố định. Thanh trên, vùng ảnh và thanh tìm kiếm dưới nằm trong một màn hình. Footer bản quyền của app không hiển thị khi đang ở ImageView. Đã kiểm tra cửa sổ 1280×720, 1440×900, 1920×1080 và zoom 100%, 125%, 150%: kích thước trang bằng viewport, scrollX/scrollY bằng 0 và ô tìm kiếm không bị cắt.

Cập nhật 1.1.2: khi mở Job từ Trang chính, app tự tải ngầm toàn bộ ảnh xuống cache, kể cả chưa mở ImageView. Không có nút bắt đầu tải. Tiến độ nằm trên thanh nguồn chung. Ảnh đang xem được ưu tiên; tối đa ba request ảnh đồng thời, chỉ một tác vụ nền. Đóng/đổi Job sẽ dừng phiên tải nền. Thanh viewer phía trên thu còn khoảng 36 px; thanh dưới chỉ có tên ảnh và ô tìm kiếm, khoảng 31 px. Show Boxes nằm trên thanh công cụ.

Cập nhật 1.1.1: thanh nguồn ở ImageView thu còn khoảng 42 px; bỏ thông tin phụ và thông báo thành công khỏi vùng preview. Preview tự dùng chiều cao còn lại. Sidebar mặc định thu còn 56 px với icon/tooltip, có nút mở rộng và ghi nhớ lựa chọn. Hai tab kiểm tra giữ thanh thông tin đầy đủ.

## Luồng sử dụng đã triển khai

1. Vào Trang chính, chọn CVAT Online hoặc Offline.
2. CVAT: chọn server và Task/Job, hoặc dán link Job trên server đang chọn. Nếu chỉ có Job, app tự tìm Task tương ứng. File: mở XML hoặc ZIP.
3. Khi dữ liệu đã mở, app hiện ba tab **Box & Trùng lặp**, **ANPR biển số**, **ImageView**.
4. Các tab dùng chung dữ liệu. ImageView không có bộ chọn nguồn riêng.
5. Thanh thông tin phía trên có tải lại CVAT và đóng nguồn cho cả app. Đóng nguồn sẽ trở về Trang chính.

Ảnh sắp theo tên đầy đủ bằng cùng comparator của bản ZIP cũ. Không đánh số lại Frame ID sau khi sort. Khi ảnh đích chưa sẵn sàng, giữ ảnh đang hiển thị; chỉ đổi ảnh và box khi decode/paint hoàn tất. Giữ zoom/pan, tải đón theo hướng duyệt và giới hạn ba request ảnh đồng thời.

ZIP chỉ có ảnh vẫn mở được từ Trang chính; các chức năng annotation chỉ có dữ liệu khi ZIP có XML. XML đơn lẻ không chứa ảnh, nên tab ImageView hiển thị hướng dẫn dùng CVAT hoặc ZIP có ảnh tại Trang chính.

## Cache và kết nối

- Cache ổ đĩa CVAT mặc định 5 GB, chỉnh được 0,1–100 GB và xóa tại Settings.
- LRU, checksum, ghi file tạm rồi đổi tên; cache lỗi được tải lại. Ảnh còn hợp lệ không tự hết hạn sau 24 giờ. Định danh cache dựa trên metadata ảnh/chunk; sửa annotation không làm mất cache ảnh.
- Khi mở lại Job, app vẫn đọc thông tin/annotation và kiểm tra quyền CVAT, nhưng ảnh còn trong cache không tải lại từ mạng. Thay đổi dữ liệu ảnh tạo revision cache mới.
- Tải nền giữ các ảnh của Job đang mở để LRU không tự xóa ảnh vừa tải trong cùng đợt. Nếu Job vượt dung lượng cache đã đặt, app báo lỗi cache thay vì báo hoàn tất giả; tăng giới hạn trong Settings rồi tải lại Job để tự tiếp tục từ các ảnh đã lưu.
- Namespace cache tách theo server, token hash, Task/Job, revision và chất lượng ảnh. Không lưu PAT vào manifest/tên file.
- Mỗi phiên phải được CVAT xác thực; kiểm tra lại quyền khi lấy ảnh sau 60 giây. Lỗi 401/403 vô hiệu hóa phiên và xóa cache đĩa.
- Ảnh decode được giữ trong cửa sổ lân cận với ngân sách mục tiêu 256 MiB, cộng các buffer đang hiển thị phải giữ lại. Ảnh đơn lẻ rất lớn có thể vượt ngân sách này.
- PAT nhập mới lưu bằng Windows DPAPI theo từng server. File PAT cũ không có thông tin server được giữ nguyên; nếu không có PAT mặc định đã lưu, người dùng nhập lại PAT một lần để gắn đúng server.
- Nhớ server, Task/Job đã chọn và vị trí ảnh theo nguồn. Không lưu PAT trong localStorage.

## Kết quả kiểm chứng ngày 05/11/2026

- TypeScript và 74 kiểm thử tự động đã qua, gồm các chức năng cũ và kiểm thử mới.
- Kiểm tra tải ngầm tự động ngay tại Trang chính: Job thử 38 ảnh tải đúng 38 lần; đóng/mở lại Job không tải thêm byte ảnh từ mạng. Kiểm thử service khởi động lại cũng xác nhận dùng lại cache đĩa, kể cả sau hơn 24 giờ.
- Electron thực chạy bộ CVAT mô phỏng 5.000 ảnh, Job start khác 0 và source frame step=2.
- 400 lần chuyển ảnh hai chiều: không ghi nhận ảnh trắng hoặc lệch tên; p95 khoảng 50 ms với ảnh 320×240.
- Web gốc ở commit `bedc1e2`: cùng phép thử 400 lần cho p95 khoảng 50,2 ms. Bản tích hợp khoảng 50,3 ms; chênh lệch dưới một ms trong phép đo này.
- Kiểm tra thứ tự tên, Frame ID, box, zoom, ảnh lỗi/Retry, cache, chuyển tab giữ phiên, ZIP/XML, chọn nguồn chung và tải lại chung.
- Kiểm tra trực tiếp hai server: `10.43.2.147:8080` với Job bắt đầu frame 8.000 và `10.43.2.12:8080`. Đã mở và đối chiếu tên/ID của lần lượt 15 và 4 ảnh.

Báo cáo chi tiết và ảnh giao diện trong `build/imageview-smoke/`. Các phép kiểm tra CVAT chỉ đọc; không sửa hoặc xóa annotation.

## Giới hạn còn cần kiểm chứng thêm

- Chưa chạy endurance 30 phút hoặc benchmark toàn bộ dải ảnh độ phân giải cao. Số đo nhỏ ở trên không bảo đảm cùng độ trễ với mọi ảnh và mạng.
- Overlay hiện là Rectangle Shape như viewer gốc; chưa nội suy Track, chưa render mask/polygon.
- Chưa kiểm tra installer trên máy Windows thứ hai hoặc quy trình Microsoft Store.
- Chưa commit, push hoặc phát hành lên GitHub.

## Bản Windows

Bản Portable mới nhất tại `release/imageview-1.1.3/`, cùng appId và updater CVAT Tools hiện có. Bản bàn giao này loại module PAT mặc định khỏi gói; dùng PAT đã lưu của app hoặc nhập PAT tại Trang chính. Không cần cài Node để chạy.
