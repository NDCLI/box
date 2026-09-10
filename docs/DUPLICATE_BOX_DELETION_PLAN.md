# Kế hoạch xóa box trùng qua CVAT trên desktop

Trạng thái: kế hoạch đã thống nhất, chưa triển khai tính năng.

## Mục tiêu và phạm vi

Thêm khả năng xóa nhiều box trùng trong ứng dụng desktop, sử dụng kết nối API CVAT hiện có. Người dùng quyết định box đúng cần giữ dựa trên ảnh đối tượng. Không mặc định box lớn hơn, nhỏ hơn hoặc vẽ trước là đúng.

Chỉ hỗ trợ Shape có ID server trong giai đoạn này. Box lặp vị trí ở các frame khác nhau không tự động được coi là trùng; xét các box chồng nhau trong cùng frame. Track và dữ liệu ZIP không có ID server không được xóa qua tính năng này.

## 1. Giữ thông tin annotation gốc

- Lưu server, Task/Job ID, shape ID, frame, label, tọa độ và loại Shape/Track khi tải dữ liệu.
- Bảo toàn ánh xạ tới annotation server trong kết quả phát hiện trùng và Preview.
- Dùng kết nối CVAT sẵn có; không thêm token vào tài liệu, source hoặc log.

## 2. Chọn giữ/xóa trong danh sách kết quả

- Cho chọn nhiều cặp hoặc nhóm trùng theo label và phạm vi frame.
- Mỗi nhóm cần có lựa chọn rõ box giữ lại và box sẽ xóa.
- Chặn lựa chọn xóa hết các box trong một nhóm trùng; xử lý ID lặp khi một box thuộc nhiều cặp để tránh gửi xóa nhiều lần hoặc xóa box đang được chọn giữ.
- Đồng bộ lựa chọn giữ/xóa giữa danh sách và Preview để có thể kiểm tra từng nhóm rồi xóa hàng loạt.

## 3. Chọn box đúng ngay trong Preview

- Hiển thị hai box bằng màu khác nhau, đánh dấu A/B; cho bật/tắt từng box để xem độ khớp với đối tượng.
- Cho bấm trực tiếp vào box hoặc chọn A/B ở bảng bên cạnh. Bảng lựa chọn phải dùng được khi hai box gần như chồng khít.
- Box được chọn giữ có dấu hiệu rõ ràng; box sẽ xóa hiển thị nét đứt hoặc màu cảnh báo.
- Thêm nút “Giữ box đã chọn, xóa box còn lại”. Chưa chọn box giữ thì chưa cho xóa.
- Nhóm có hơn hai box cho chọn rõ từng box giữ/xóa.
- Sau khi server xác nhận xóa, cập nhật Preview, danh sách và thống kê; giữ nguyên frame và mức zoom. Khi nhóm không còn trùng, vẫn hiển thị kết quả vừa xử lý và cho chuyển sang nhóm tiếp theo.

## 4. Thao tác xóa chỉ trên desktop

- Thêm nút “Xóa box đã chọn”; trước khi thực hiện hiển thị Job, phạm vi frame và tổng số box sẽ xóa.
- Thực hiện yêu cầu CVAT qua Electron, kiểm tra giới hạn desktop ở cả giao diện và cầu nối xử lý yêu cầu.
- Phạm vi mỗi yêu cầu khóa theo server, Job, frame và shape ID. Không ghi đè toàn bộ annotations.
- Dùng PATCH annotations với action=delete, chỉ chứa các Shape đã chọn và đủ dữ liệu theo schema server.

## 5. Kiểm tra dữ liệu chung trước khi xóa

- Đọc lại annotations và đối chiếu ID, label, frame, tọa độ của box xóa cùng box giữ.
- Yêu cầu tải lại nếu dữ liệu mục tiêu thay đổi, box giữ biến mất hoặc nhóm không còn khớp với lựa chọn đã xem.
- Không xem lần đọc trước khi xóa là khóa đồng thời: kiểm tra khả năng kiểm soát phiên bản của server và xử lý xung đột nếu được hỗ trợ.
- Lưu bản sao đầy đủ các Shape sắp xóa kèm server/Job/frame để có dữ liệu phục hồi; không lưu token trong bản sao. Việc khôi phục là thao tác riêng và có thể sinh ID mới.

## 6. Xác minh và phản hồi kết quả

- GET lại sau PATCH để xác nhận ID đã xóa không còn và các box chọn giữ vẫn tồn tại.
- Nếu mất kết nối sau khi gửi, xác minh trạng thái server trước khi thử lại; không báo xóa thành công chỉ từ ý định của client.
- Chỉ cập nhật trạng thái hoàn tất khi xác minh được kết quả, hiển thị rõ thành công hoặc phần cần tải lại.
- Thông báo thao tác đã lưu trực tiếp trên CVAT. Người đang mở Job cần tải lại dữ liệu sau khi bảo toàn thay đổi chưa lưu của họ.

## 7. Kiểm thử và bàn giao

- Kiểm tra một cặp, nhiều cặp, nhóm hơn hai box và các cặp dùng chung shape ID.
- Kiểm tra chọn A/B trong Preview khi chồng khít; đồng bộ với danh sách; giữ frame/zoom sau xóa.
- Kiểm tra phạm vi label/frame/Job, Shape và Track, dữ liệu ZIP, dữ liệu thay đổi bởi người khác, thiếu quyền và mất kết nối sau PATCH.
- Xác nhận yêu cầu chỉ xóa các ID đã chọn, không làm mất box giữ hoặc annotations ngoài phạm vi.
- Chạy kiểm tra phù hợp, build bản desktop để người dùng test. Kiểm thử xóa thật chỉ trên dữ liệu thử được chỉ định.

## Điều kiện hoàn thành

Người dùng có thể chọn box đúng trong danh sách hoặc Preview, xóa một hoặc nhiều box trùng trên desktop, và xem kết quả đã được xác minh trên server. Tính năng bảo toàn box giữ, các annotation ngoài lựa chọn và dữ liệu phục hồi cho các box đã xóa.
