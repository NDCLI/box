# Kế hoạch tích hợp ImageView vào CVAT Tools desktop

Ngày: 05/11/2026. Trạng thái: đã triển khai bản tích hợp 1.1.0; kết quả và giới hạn kiểm chứng ở `IMAGEVIEW_IMPLEMENTATION.md`.

## 1. Mục tiêu và yêu cầu đã chốt

Tích hợp ImageView thành một tab trong CVAT Tools, dùng trực tiếp nguồn ảnh CVAT và tiếp tục hỗ trợ mở ZIP như bản web.

Các yêu cầu bắt buộc:

1. Giữ trải nghiệm viewer của web: Next/Previous mượt, không trắng hình, không nhấp nháy khi đổi ảnh đã sẵn sàng.
2. Giữ zoom/pan khi chuyển ảnh theo hành vi hiện có; khi đang fit thì căn ảnh mới theo cơ chế fit hiện có.
3. Ảnh và annotation luôn thuộc cùng một frame. Không hiển thị box của ảnh mới lên ảnh cũ trong lúc tải.
4. **Thứ tự duyệt ảnh từ CVAT phải theo tên, giống luồng mở file ZIP hiện tại**, không theo thứ tự API trả về hoặc Frame ID.
5. Dùng chung app, cấu hình kết nối CVAT, cách lưu PAT và hệ thống cập nhật của CVAT Tools.
6. Có cache RAM và cache ổ đĩa có giới hạn, tải đón theo hướng duyệt và dọn dữ liệu khi cần.
7. Theo yêu cầu bổ sung: chỉ có **một Trang chính chọn nguồn dữ liệu dùng chung**. Khi mở dữ liệu mới hiện ba tab Box, ANPR và ImageView. Không chọn nguồn riêng trong từng tab; tải lại và đóng nguồn ở thanh chung.

Với ảnh chưa được tải mà mạng chậm, giữ ảnh hiện tại và báo đang tải ảnh đích. Không cam kết độ trễ bằng không cho cache miss; không đổi sang nền trắng để chờ.

## 2. Cơ sở mã nguồn đã kiểm tra

### ImageView

- Repository: https://github.com/NDCLI/imageview, nhánh `main`.
- Thư mục local: `D:\Box\views`.
- Tại thời điểm kiểm tra, sau `git fetch origin main`, HEAD và origin/main cùng là `bedc1e2a130a68808d1a58a77a2ed809a168c8ad`.
- Local có xóa `DESKTOP_MIGRATION_PLAN.md`, Git đánh dấu sửa `package.json` và `src/main.jsx` nhưng diff nội dung chưa thể hiện thay đổi, cùng `token.txt` chưa được theo dõi. Không ghi đè hoặc đưa các thay đổi này vào phần tích hợp.
- Stack: SolidJS + Vite; ZIP worker và cơ chế tải lười.
- `src/pages/ViewerPage.jsx`: double buffer, decode ảnh trước khi đổi, chờ paint, cửa sổ tải đón 8 ảnh phía trước và 2 ảnh phía sau.
- `src/pages/MainPage.jsx`: danh sách ZIP sắp bằng `a.name.localeCompare(b.name)`.
- `src/workers/zip.worker.js`: có cache nóng và cache preview bằng OPFS khi môi trường hỗ trợ.
- `src/lib/annotations.js`: xử lý box và tra cứu metadata XML.
- Tài liệu desktop cũ có nhắc backend LAN, nhưng cây mã nguồn main đã kiểm tra không có thư mục `server`. Không mặc định các module LAN đó tồn tại hoặc tái sử dụng được.

### CVAT Tools

- Thư mục: `D:\Box\boxct`, remote `NDCLI/box`, nhánh local `main`.
- Khi kiểm tra: phiên bản `1.0.16`, HEAD `fa2ab29d64286c0c4a8743f710723064d00eabde`.
- Stack: React + TypeScript + Vite, đã có Electron.
- `desktop/main.cjs` và `desktop/preload.cjs`: kết nối CVAT qua IPC, lưu PAT mã hóa, updater và backup.
- `src/utils/cvatApi.ts`: đọc Task/Job, label, metadata, annotation và ảnh.
- `src/components/CvatConnectPanel.tsx`: giao diện kết nối hiện nằm riêng trong chức năng đếm box.
- Adapter hiện tại chủ yếu phục vụ box; không coi đây là lớp biểu diễn đầy đủ mọi loại annotation hoặc track nội suy.

## 3. Kiến trúc tích hợp

### Giữ lõi SolidJS, dùng React làm vỏ tab

Không viết lại viewer sang React trong đợt đầu vì cần bảo toàn cơ chế chuyển ảnh đã có.

- Tách viewer SolidJS thành module có `mount(element, options)` và hàm `dispose()`.
- Build module SolidJS bằng cấu hình Vite riêng thành bundle cục bộ, gồm worker và CSS cần thiết.
- Component React tạo vùng chứa, mount viewer khi mở tab và dispose khi đóng phiên. Không để React và Solid cùng quản lý một cây DOM.
- CSS được giới hạn trong vùng viewer; không mang reset toàn cục của web app vào CVAT Tools.
- Không chạy thêm một app Electron hay một web server LAN. Không phụ thuộc website ImageView bên ngoài.
- Không mang service worker hoặc analytics của web vào module desktop.

Luồng dữ liệu:

```text
CVAT Tools / tab ImageView
    └─ Viewer SolidJS được đóng gói cục bộ
         └─ ImageSource chung
              ├─ ZIP source → ZIP worker hiện có
              └─ CVAT source → preload / IPC được giới hạn
                                   └─ Frame service Electron
                                        ├─ cache ổ đĩa
                                        └─ CVAT API
```

Phase thử nghiệm đầu tiên phải xác minh build hai framework, worker và CSS hoạt động trong bản Electron đóng gói. Nếu không đạt, đánh giá lại phương án kỹ thuật trước khi thay lõi viewer.

### Giao diện ImageSource

Định nghĩa contract TypeScript dùng chung cho hai nguồn:

```ts
interface ImageRecord {
  key: string;
  name: string;
  frameId?: number;
  width: number;
  height: number;
}

interface ImageSource {
  listImages(signal?: AbortSignal): Promise<ImageRecord[]>;
  getImage(key: string, options: {
    signal?: AbortSignal;
    priority: 'visible' | 'prefetch';
    quality: 'preview' | 'original';
  }): Promise<Blob>;
  getAnnotations(key: string): Promise<unknown>;
  dispose(): void;
}
```

Đây là contract đề xuất; kiểu annotation sẽ được cụ thể hóa trong bước thiết kế adapter. `AbortSignal` được xử lý trong renderer, truyền request ID và lệnh cancel riêng qua IPC, không truyền trực tiếp AbortSignal qua IPC.

## 4. Sắp ảnh theo tên và giữ đúng frame

### Quy tắc bắt buộc

- CVAT và ZIP dùng cùng một hàm sắp xếp theo tên đầy đủ, giữ cách so sánh `name.localeCompare()` của bản ZIP hiện tại.
- Không tự đổi sang natural sort. Ví dụ `1.jpg`, `2.jpg`, `10.jpg` phải ra cùng kết quả với ZIP trong cùng môi trường; không áp đặt một thứ tự mới.
- Sắp metadata trước khi mở viewer. Next/Previous, tìm kiếm, thanh vị trí và tải đón đều dùng danh sách đã sắp.
- Không sắp theo thứ tự request hoàn thành. Tải song song vẫn được phép để giữ tốc độ.
- Khi tên bằng nhau, giữ thứ tự đầu vào ổn định. Key riêng phải phân biệt ảnh trùng tên.
- Không dùng basename làm định danh: `camera1/a.jpg` và `camera2/a.jpg` là hai ảnh khác nhau.
- Ảnh thiếu tên: hiển thị tên dự phòng có Frame ID và thông báo trường hợp thiếu metadata. Không suy đoán tên thật từ vị trí trong mảng.

### Tách index hiển thị và Frame ID

Mỗi record giữ riêng `key`, `name` và Frame ID CVAT gốc. Sắp xếp chỉ đổi vị trí record; không đánh số lại Frame ID.

Ví dụ metadata là `frame 0 → b.jpg`, `frame 1 → a.jpg`: viewer hiển thị `a.jpg` trước nhưng request ảnh và annotation vẫn dùng frame 1.

Phải xác minh mapping với Job bắt đầu khác 0, Task có frame step/start frame, excluded/deleted frames và filename trùng nhau. Không mặc định `meta.frames[index]` luôn tương ứng Frame ID tuyệt đối `index`.

## 5. Pipeline chuyển ảnh mượt

Giữ các hành vi của viewer cũ và mở rộng sang nguồn CVAT:

1. Xác định ảnh đích trong danh sách đã sắp tên.
2. Ưu tiên ảnh đích trước các request tải đón.
3. Lấy Blob từ cache RAM, cache đĩa hoặc CVAT.
4. Decode ảnh; đưa vào buffer không hoạt động và chờ sẵn sàng hiển thị.
5. Đổi buffer, thông tin ảnh và annotation cùng một lần commit.
6. Giữ zoom/pan theo hành vi cũ; cập nhật fit khi phù hợp.

Dùng session ID và request generation để loại phản hồi cũ khi người dùng đổi nguồn, đổi Job hoặc tua nhanh. Khi decode thất bại, giữ ảnh hiện tại và cho phép thử lại; không coi ảnh lỗi là đã sẵn sàng.

Tải đón ban đầu kế thừa 8 trước / 2 sau, nhưng điều chỉnh theo hướng duyệt. Giới hạn request mạng đồng thời ban đầu là 3 để đo thử, không phải giá trị cố định cuối cùng. Chuyển hướng liên tục không tạo request trùng hoặc để hàng đợi cũ chặn ảnh đang cần xem.

Thông tin ảnh đang hiển thị và trạng thái đang tải ảnh đích phải rõ ràng. Không đổi footer/box sang ảnh đích trước khi hình tương ứng xuất hiện.

## 6. Cache desktop

### RAM

- Cache Blob và cache ảnh đã decode là hai lớp có chi phí khác nhau.
- Giữ ảnh đang hiển thị, buffer kế tiếp và các ảnh lân cận trong ngân sách bộ nhớ.
- Ước lượng ảnh decode theo kích thước pixel; không chỉ dựa vào dung lượng JPEG/PNG.
- Thu hồi Object URL và tài nguyên ảnh khi bị loại, đổi nguồn hoặc đóng viewer.
- Không loại tài nguyên đang dùng ở buffer hiển thị.

### Ổ đĩa

- Frame service chạy trong Electron, ghi dưới thư mục cache của app; không ghi trong thư mục cài đặt.
- Đề xuất mặc định ban đầu: 5 GB, cho phép người dùng chỉnh dung lượng và xóa cache. Chốt lại sau đo đạc trên máy thực tế.
- Áp dụng LRU, giới hạn dung lượng, ghi file tạm rồi đổi tên để tránh cache bị hỏng khi app đóng đột ngột.
- Cache key gồm server, phạm vi tài khoản/quyền, Task/Job, Frame ID, chất lượng ảnh và revision nếu có.
- Không đưa PAT vào tên file hoặc manifest. Không dùng cache cũ để vượt qua lỗi mất quyền đọc.
- Đăng xuất, đổi tài khoản hoặc đổi quyền phải vô hiệu hóa phiên/cache tương ứng; có thao tác xóa cache thủ công.
- Cache metadata/annotation tách khỏi ảnh. Reload Job phải đọc lại annotation và kiểm tra tính hợp lệ của danh sách ảnh.
- Nếu không có revision ảnh đáng tin cậy, có chính sách hết hạn và tùy chọn buộc tải lại; không coi Frame ID là bảo đảm ảnh không đổi mãi mãi.
- Không tải toàn bộ Job mặc định. Bản đầu chỉ cache theo nhu cầu và tải đón; chế độ tải sẵn cả Job để offline nằm ngoài phạm vi ban đầu.

Cache ổ đĩa giúp giảm tải lại qua mạng. Cache ảnh đã decode mới quyết định độ trễ hiển thị; phải đo cả hai.

## 7. Kết nối và giao diện

- Thêm tab `ImageView` cùng nhóm với chức năng đếm box, ANPR và Settings.
- Chọn nguồn CVAT hoặc file XML/ZIP tại Trang chính của app, không đặt bộ chọn nguồn trong ImageView.
- CVAT: chọn server, chọn Task/Job hoặc dán link Job tại Trang chính; dùng kết nối/PAT chung.
- Mở dữ liệu xong mới hiện ba tab Box & Trùng lặp, ANPR biển số và ImageView. Thanh thông tin nguồn, tải lại và đóng dùng chung cho ba tab.
- Bổ sung service kết nối dùng chung thay vì sao chép state của CvatConnectPanel sang viewer.
- Luồng xem chỉ yêu cầu quyền đọc; không thêm chức năng sửa/xóa annotation trong ImageView.
- Bản đầu giữ overlay rectangle giống viewer cũ. Polygon, mask và track nội suy đầy đủ không nằm trong phạm vi ban đầu; không diễn giải box bao mask thành mask gốc.
- Khôi phục phiên lưu server/Task/Job/frame và trạng thái xem cần thiết, không lưu token vào localStorage hoặc viewer state.
- Giữ tìm tên ảnh, tìm Frame ID, phím tắt và zoom/pan của web; listener chỉ hoạt động khi viewer có focus, không chặn thao tác nhập liệu của tab khác.
- Cửa sổ viewer riêng là bước sau; bản đầu ưu tiên viewer nằm trong tab. Không sao chép nguyên cơ chế window.open/BroadcastChannel của web nếu không còn cần thiết.

## 8. Lộ trình triển khai

| Giai đoạn | Công việc | Điều kiện hoàn tất |
|---|---|---|
| 0. Chốt baseline | Ghi nhận hành vi web ở commit đã nêu, kiểm tra sort và pipeline; đo cùng bộ ảnh | Có bộ tình huống so sánh và số đo baseline |
| 1. Nhúng viewer | Build Solid module riêng, mount/dispose trong tab React, giữ ZIP worker và viewer cũ | ZIP trong desktop đúng thứ tự, không lỗi asset/worker/CSS, độ mượt không giảm |
| 2. Nguồn CVAT | ImageSource, connection dùng chung, mapping metadata/Frame ID, sort theo tên | Mở Job thật, đúng ảnh/box/thứ tự; không cần export ZIP |
| 3. Pipeline và cache | Scheduler, deduplicate, hủy request, cache RAM/đĩa, đồng bộ hai buffer | Tua hai chiều ổn định; cache có giới hạn và được dọn đúng |
| 4. Hoàn thiện UX | Lỗi mạng/PAT, reload Job, Settings cache, khôi phục phiên, VI/EN | Không lẫn phiên, không lộ token, lỗi không làm trắng viewer |
| 5. Kiểm chứng và đóng gói | Regression CVAT Tools, benchmark, build Portable/Setup hiện có | Dùng được trên máy không cài Node; đạt tiêu chí dưới đây |

Ước lượng sơ bộ: 7–12 ngày làm việc, gồm tích hợp và kiểm chứng, chưa gồm các chức năng ngoài phạm vi. Cập nhật ước lượng sau giai đoạn 1 và thử mapping trên CVAT thực tế.

## 9. Kiểm thử và tiêu chí nghiệm thu

### Đúng thứ tự và đúng dữ liệu

- Cùng bộ tên ảnh từ ZIP và CVAT cho cùng thứ tự duyệt.
- Bao gồm tên số không zero-pad, zero-pad, chữ hoa/thường, Unicode, đường dẫn con và trùng basename.
- Sau sort, Next/Previous, tìm kiếm và tải đón dùng đúng record; ảnh và annotation dùng Frame ID gốc.
- Kiểm tra Job start khác 0, Task có frame step và frame bị loại.

### Độ mượt

- So sánh bản web baseline và desktop trên cùng máy, cùng ảnh và cùng thao tác; tách cache lạnh và cache nóng.
- Tua liên tục ít nhất 200 lượt mỗi chiều, đảo chiều nhanh và tìm/nhảy xa.
- Không xuất hiện frame trắng, nhấp nháy, ảnh/box lệch nhau hoặc zoom/pan tự reset ngoài hành vi baseline.
- Mục tiêu ban đầu với ảnh đã decode và buffer sẵn sàng: độ trễ từ thao tác đến đổi ảnh p95 không quá 50 ms trên máy thử, đồng thời không chậm hơn baseline. Đây là mục tiêu cần đo, chưa phải kết quả đã đạt.
- Với cache miss, giữ ảnh cũ, hiển thị trạng thái chờ và chỉ commit ảnh đúng khi sẵn sàng.
- Đo độ trễ hiển thị, dropped frames, thời gian decode, cache hit, RAM và dung lượng đĩa; không chỉ kiểm tra request mạng nhanh.

### Độ bền và regression

- Chạy Job ít nhất 5.000 ảnh trong 30 phút; RAM không tăng vô hạn, cache đĩa tuân thủ giới hạn.
- Đổi tab, đổi server/Job khi request đang chạy, đóng/mở viewer và restart app.
- Mất mạng, 401/403, ảnh lỗi, disk full và cache file hỏng có thông báo; không treo hoặc tự gửi lặp vô hạn.
- Chức năng đếm box, xóa box có backup, ANPR, Settings và updater hiện có tiếp tục hoạt động.
- Chạy lint, test hiện có, test mới tập trung vào sort/mapping/scheduler/cache và build desktop. Kiểm tra GUI thực tế bắt buộc cho tiêu chí mượt.

## 10. Phạm vi bàn giao

- Module ImageView tích hợp trong CVAT Tools.
- Nguồn CVAT trực tiếp và ZIP qua cùng contract.
- Sort theo tên giống luồng file, mapping frame chính xác.
- Pipeline chuyển ảnh giữ hành vi web, cache RAM và ổ đĩa có giới hạn.
- Tài liệu sử dụng và kết quả đo so với baseline.
- Portable/Setup sử dụng pipeline phát hành hiện có; không tạo appId hay updater ImageView riêng.

Chưa triển khai trong kế hoạch này: sửa annotation từ viewer, overlay mọi loại hình học, tải offline toàn bộ Job, đồng bộ ghi ngược CVAT, cửa sổ so sánh nhiều ảnh mới và thay đổi quy trình Microsoft Store.
