import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Locale = 'en' | 'vi';

const STORAGE_KEY = 'cvat-tools-locale';

const english: Record<string, string> = {
  'Kiểm tra annotation nhanh, trực quan và bảo mật': 'Fast, visual, and secure annotation checks',
  'Đang đọc và xử lý tệp dữ liệu...': 'Reading and processing the data file...',
  'Quá trình này có thể mất vài giây tùy thuộc vào dung lượng file.': 'This may take a few seconds depending on the file size.',
  'Đã xảy ra lỗi': 'Something went wrong',
  'Nguồn dữ liệu': 'Data source',
  'Chọn nguồn dữ liệu để kiểm tra box trùng, rà soát nhãn và xem thống kê.': 'Choose a data source to inspect duplicate boxes, review labels, and view statistics.',
  'Bắt đầu từ file annotation': 'Start with an annotation file',
  'Chọn file XML hoặc ZIP': 'Choose an XML or ZIP file',
  'Hoặc kéo thả file vào đây': 'Or drag and drop a file here',
  'File được phân tích ngay trên trình duyệt, không rời khỏi thiết bị.': 'Files are analyzed in your browser and never leave your device.',
  'Tính năng chính': 'Key features',
  'Xử lý hoàn toàn cục bộ': 'Processed entirely on your device',
  'Tìm box trùng và sai nhãn': 'Find duplicate boxes and label issues',
  'Có kết quả trong vài giây': 'Results in seconds',
  'Đọc trực tiếp từ CVAT': 'Read directly from CVAT',
  'Mở một Job hoặc cả Task để kiểm tra annotation từ CVAT.': 'Open a Job or an entire Task to inspect annotations from CVAT.',
  'Server CVAT mặc định': 'Default CVAT server',
  'URL tùy chỉnh': 'Custom URL',
  'Hoặc nhập URL tùy chỉnh:': 'Or enter a custom URL:',
  'Personal Access Token (đọc và xóa Shape trong Job)': 'Personal Access Token (read and delete Job Shapes)',
  'Dán token CVAT': 'Paste CVAT token',
  'PAT được mã hóa theo tài khoản Windows trên thiết bị này; không lưu trong mã nguồn hoặc Vercel.': 'The PAT is encrypted for this Windows account and is not stored in source code or Vercel.',
  'Đang dùng PAT mặc định của bản app. Nhập PAT vào ô trên để ghi đè.': 'Using this app build’s default PAT. Enter a PAT above to override it.',
  'Kết nối CVAT chỉ dùng trong app Windows.': 'CVAT connection is available only in the Windows app.',
  'Đang khôi phục PAT đã lưu…': 'Restoring saved PAT…',
  'Lấy danh sách Task': 'Get Task list',
  'Nhập Task ID': 'Enter Task ID',
  'Lấy danh sách hoặc nhập Job ID': 'Get the list or enter a Job ID',
  'Mở Job': 'Open Job',
  'Mở Task': 'Open Task',
  'Cấu hình Kiểm tra & Loại trừ Box': 'Inspection and box exclusion settings',
  'Xóa bộ lọc vùng frame': 'Clear frame-range filter',
  'Nhập tên nhãn (Vd: _corrupt) và Enter...': 'Enter a label name (for example, _corrupt) and press Enter…',
  'Bỏ qua box trong Frame Skip': 'Exclude boxes in Skip frames',
  'Đếm tất cả box': 'Count all boxes',
  'Cấu hình quét trùng lặp (Thử cả 2 tiêu chí để tránh bỏ sót)': 'Duplicate scan settings (try both criteria to avoid missing matches)',
  'TIÊU CHÍ SO KHỚP TỌA ĐỘ': 'COORDINATE MATCH CRITERIA',
  'Chỉ số IoU (Mức chồng đè)': 'IoU score (overlap)',
  'Sai lệch pixel (Cạnh trùng)': 'Pixel tolerance (matching edges)',
  'MỨC SAI LỆCH TOẠ ĐỘ CHO PHÉP (PIXEL)': 'ALLOWED COORDINATE TOLERANCE (PIXELS)',
  'Khớp Tuyệt Đối': 'Exact match',
  'Sai lệch 10px': '10 px tolerance',
  'HỆ SỐ TRÙNG NHAU TỐI THIỂU (IoU)': 'MINIMUM OVERLAP RATIO (IoU)',
  'Cài đặt nhãn': 'Label settings',
  'Chỉ tính trùng khi cùng Nhãn (Label)': 'Only match duplicates with the same label',
  'Cùng toạ độ & cùng nhãn': 'Same coordinates and label',
  'Trùng toạ độ kể cả khác nhãn': 'Same coordinates even with different labels',
  'Box Bị Loại Trừ': 'Excluded boxes',
  'Box Trùng Lặp': 'Duplicate boxes',
  'Tổng Số Box': 'Total boxes',
  'Tổng số Frame': 'Total frames',
  'Kiểu CVAT:': 'CVAT type:',
  'Bộ sưu tập ảnh (Images)': 'Image collection',
  'Chuỗi khung hình video (Tracks)': 'Video frame sequence (Tracks)',
  'Tên nhiệm vụ:': 'Task name:',
  'Chọn file XML:': 'Choose XML file:',
  'Đang tải lại…': 'Refreshing…',
  'Mở thư mục backup': 'Open backup folder',
  'Đóng file': 'Close file',
  'Danh sách trùng lặp': 'Duplicate list',
  'Lọc từ': 'Filtered from',
  'Xóa box đã chọn': 'Delete selected boxes',
  'Tìm theo tên ảnh hoặc ID frame...': 'Search by image name or frame ID…',
  'LỌC THEO NHÃN (LABELS)': 'FILTER BY LABEL',
  'Chọn tất cả': 'Select all',
  'box trùng': 'duplicate boxes',
  'Chọn box xóa:': 'Select boxes to delete:',
  'Cuộn chuột để zoom vào cạnh box': 'Use the mouse wheel to zoom near the box edge',
  'Đang tải ảnh frame…': 'Loading frame image…',
  'Không có ảnh, chỉ hiển thị khung tọa độ': 'No image available; showing coordinate boxes only',
  'Cuộn để zoom cạnh box · Chưa chọn = giữ · Đỏ = xóa': 'Scroll to zoom near the box · Unselected = keep · Red = delete',
  'Đặt lại': 'Reset',
  'Mở kiểm tra chi tiết': 'Open detailed review',
  'Bỏ xóa': 'Keep',
  'Xóa': 'Delete',
  'Không tìm thấy trùng lặp nào': 'No duplicates found',
  'Không có kết quả khớp với bộ lọc tìm kiếm và nhãn của bạn.': 'No results match your search and label filters.',
  'Không có lỗi trùng lặp nào được phát hiện trong file dữ liệu này!': 'No duplicate issues were found in this data file.',
  'Di chuyển đến vị trí lỗi trên ảnh': 'Move to the issue location in the image',
  'Đến vị trí lỗi': 'Go to issue',
  'Kéo về trái để zoom siêu gần sát đối tượng nhỏ (giảm khoảng đệm)': 'Drag left to zoom very close to small objects (reduce padding)',
  'Khoảng cách lề bao quanh đối tượng (px). Càng nhỏ thì zoom càng cận!': 'Padding around the object (px). Smaller values zoom closer.',
  'Đóng Preview': 'Close preview',
  'Kích thước:': 'Size:',
  'Đã tải ảnh thực tế': 'Actual image loaded',
  'Chỉ có file XML (Vẽ mô phỏng)': 'XML only (simulated drawing)',
  'Mặc định giữ; chỉ chọn box cần xóa': 'Keep by default; select only boxes to delete',
  'Hiện': 'Show',
  'Ẩn': 'Hide',
  'Đang tải ảnh...': 'Loading image...',
  'Chọn một tệp trùng lặp bên trái': 'Select a duplicate entry on the left',
  'Nhấp chọn bất kỳ cặp trùng lặp nào trong danh mục bên trái để soi tọa độ cận cảnh trực quan.': 'Select any duplicate group on the left to inspect its coordinates up close.',
  'Đang mở trình xem ảnh…': 'Opening image viewer…',
  'Tiếng Việt': 'Vietnamese',
  'English': 'English',
  'Ngôn ngữ': 'Language',
  'Chọn hoặc kéo thả tệp CVAT XML hay ZIP': 'Choose or drag and drop a CVAT XML or ZIP file',
  '2. Các Nhãn loại trừ khỏi tổng số đếm': '2. Labels excluded from the total count',
  'Đã nhập:': 'Entered:',
  'ký tự': 'characters',
  'Tải lại': 'Refresh',
  'Đóng': 'Close',
  'Sẽ xóa': 'Will delete',
  'Tiếp tục?': 'Continue?',
  '(nhóm đang xem).': '(current group).',
  'lỗi mạng': 'network error',
  'Job': 'Job',
  'Task': 'Task',
  'Xóa box chỉ dùng được khi mở một Job CVAT trên bản desktop.': 'Box deletion is available only for an open CVAT Job in the desktop app.',
  'Hãy chọn box sẽ xóa trước.': 'Select boxes to delete first.',
  'Không thể xóa Shape trên CVAT.': 'Unable to delete Shapes in CVAT.',
  'Không thể tải lại annotation từ CVAT.': 'Unable to reload annotations from CVAT.',
  'Bạn phải chọn ít nhất một nhãn để lọc.': 'Select at least one label to filter.',
  'Đã tạo và tải xuống báo cáo trùng lặp dạng CSV thành công!': 'The duplicate CSV report was created and downloaded.',
  'Không thể lưu PAT đã mã hóa.': 'Unable to save the encrypted PAT.',
  'Task này không có Job nào mà token có quyền đọc.': 'This Task has no Jobs that this token can read.',
  'Nhập URL CVAT và Personal Access Token trước.': 'Enter a CVAT URL and Personal Access Token first.',
  'Không tìm thấy Task nào mà token có quyền đọc.': 'No Tasks were found that this token can read.',
  'Không thể kết nối tới CVAT. Kiểm tra cấu hình Vercel hoặc CORS.': 'Unable to connect to CVAT. Check the Vercel or CORS configuration.',
  'Không thể tải danh sách Job từ CVAT.': 'Unable to load the Job list from CVAT.',
  'Chọn Task hợp lệ.': 'Choose a valid Task.',
  'Chọn Task và Job hợp lệ.': 'Choose a valid Task and Job.',
  'Không thể tải annotation từ CVAT.': 'Unable to load annotations from CVAT.',
  'URL CVAT phải bắt đầu bằng http:// hoặc https://.': 'The CVAT URL must start with http:// or https://.',
  'PAT không hợp lệ, đã hết hạn hoặc không có quyền đọc/xóa CVAT.': 'The PAT is invalid, expired, or lacks CVAT read/delete permissions.',
  'Xóa annotation CVAT chỉ được phép trên bản desktop.': 'CVAT annotation deletion is allowed only in the desktop app.',
  'Token không có quyền đọc hoặc xóa dữ liệu CVAT này.': 'The token cannot read or delete this CVAT data.',
  'Yêu cầu CVAT không được hỗ trợ.': 'The CVAT request is not supported.',
  'Hãy chạy tính năng này trong app Windows.': 'Run this feature in the Windows app.',
  'Bản desktop hiện không hỗ trợ lưu bản sao phục hồi.': 'This desktop build does not support saving recovery backups.',
  'Chưa chọn box nào để xóa.': 'No boxes are selected for deletion.',
  'Chỉ được xóa Shape có ID server từ một CVAT Job; Track và dữ liệu ZIP không được hỗ trợ.': 'Only Shapes with server IDs from a CVAT Job can be deleted; Tracks and ZIP data are not supported.',
  'Một Shape đang vừa được chọn giữ vừa được chọn xóa. Hãy kiểm tra lại lựa chọn.': 'A Shape is selected both to keep and delete. Check the selection again.',
  'Không thể đọc file XML trong ZIP.': 'Unable to read the XML file in the ZIP archive.',
  'Không thể đọc tệp XML này.': 'Unable to read this XML file.',
  'Không tìm thấy tệp tin XML nào trong tệp ZIP đã tải lên.': 'No XML files were found in the uploaded ZIP archive.',
  'Định dạng tệp không được hỗ trợ. Vui lòng tải lên tệp .XML hoặc .ZIP.': 'Unsupported file format. Upload an .XML or .ZIP file.',
  'Lỗi không xác định khi tải tệp lên.': 'An unknown error occurred while uploading the file.',
  'Không thể tải ảnh từ CVAT.': 'Unable to load the image from CVAT.',
  'Windows không hỗ trợ mã hóa token trên thiết bị này.': 'Windows does not support token encryption on this device.',
  'URL CVAT không hợp lệ.': 'Invalid CVAT URL.',
  'Task ID không hợp lệ.': 'Invalid Task ID.',
  'Thiếu URL CVAT hoặc token.': 'CVAT URL or token is missing.',
  'Phương thức CVAT không được phép.': 'The CVAT method is not allowed.',
  'Chỉ cho phép PATCH xóa Shape trong Job.': 'Only PATCH deletion of Job Shapes is allowed.',
  'Endpoint xóa Shape chỉ nhận PATCH.': 'The Shape deletion endpoint accepts only PATCH.',
  'Dữ liệu backup không hợp lệ.': 'Invalid backup data.',
};

const vietnamese: Record<string, string> = {
  'First ID': 'ID đầu tiên', 'Last ID': 'ID cuối cùng', '(Exclude)': '(Loại trừ)',
  '(Duplicate)': '(Trùng lặp)', '(Total Box)': '(Tổng box)', 'frames': 'khung hình',
  'Frame Skip': 'Frame Skip', '(Passed Frame)': '(Frame được bỏ qua)',
  'CVAT Online': 'CVAT trực tuyến', 'Offline': 'Ngoại tuyến', 'ZIP archive': 'Tệp nén ZIP',
  'Fast, visual, and secure annotation checks': 'Kiểm tra annotation nhanh, trực quan và bảo mật',
  'Language': 'Ngôn ngữ',
  'Built using React 19 + TypeScript + zip.js + Tailwind CSS': 'Xây dựng bằng React 19 + TypeScript + zip.js + Tailwind CSS',
};

function translateDynamic(source: string): string {
  if (english[source]) return english[source];
  const translated = Object.entries(english)
    .sort(([a], [b]) => b.length - a.length)
    .reduce((value, [vietnamese, valueInEnglish]) => value.replaceAll(vietnamese, valueInEnglish), source);
  return translated
    .replace(/^Start: /, 'Start: ')
    .replace(/^End: /, 'End: ')
    .replace(/^(\d+(?:\.\d+)?) px \(Trùng khớp 100%\)$/, '$1 px (100% match)')
    .replace(/^(\d+)% trùng nhau$/, '$1% overlap')
    .replace(/^Tải lại (Job|Task)$/, 'Refresh $1')
    .replace(/^Đóng (Job|Task)$/, 'Close $1')
    .replace(/^Chọn nhóm Frame (.+)$/, 'Select Frame $1 group')
    .replace(/^Box ([A-Z]): bỏ đánh dấu xóa$/, 'Box $1: keep')
    .replace(/^Box ([A-Z]): đánh dấu xóa$/, 'Box $1: mark for deletion')
    .replace(/^Không thể xóa hết box trong nhóm Frame (.+)\.$/, 'Cannot delete every box in Frame $1 group.')
    .replace(/^Nhóm Frame (.+) có Track; tính năng xóa Track chưa được hỗ trợ\.$/, 'Frame $1 group contains a Track; Track deletion is not supported.')
    .replace(/^Không thể tải ảnh Frame (.+) từ CVAT \((.+)\)\.$/, 'Unable to load Frame $1 image from CVAT ($2).')
    .replace(/^CVAT trả về lỗi (\d+)\.$/, 'CVAT returned error $1.')
    .replace(/^CVAT trả về lỗi (\d+): (.+)$/, 'CVAT returned error $1: $2')
    .replace(/^Đã tải annotation của (.+) từ CVAT\.$/, 'Loaded annotations for $1 from CVAT.')
    .replace(/^Lỗi khi phân tích XML: (.+)$/, 'XML parsing error: $1')
    .replace(/^Lỗi khi tải file XML\.?(.*)$/, 'XML loading error.$1')
    .replace(/^Lỗi khi tạo file XML đã làm sạch: (.+)$/, 'Error creating cleaned XML: $1')
    .replace(/^Lỗi khi xuất báo cáo CSV: (.+)$/, 'CSV export error: $1')
    .replace(/^Đã tạo và tải xuống file XML đã làm sạch \(đã xóa (\d+) box trùng lặp\)!$/, 'The cleaned XML was created and downloaded ($1 duplicate boxes removed).')
    .replace(/^Đã xác minh xóa (\d+) Shape trên CVAT\. Bản sao đã lưu tại (.+)$/, 'Verified deletion of $1 Shapes in CVAT. Backup saved at $2')
    .replace(/^Đã xác minh xóa (\d+) Shape trên CVAT nhưng chưa tải lại được giao diện: (.+)\. Hãy bấm Tải lại Job\.$/, 'Verified deletion of $1 Shapes in CVAT, but the interface could not be reloaded: $2. Select Refresh Job.')
    .replace(/^1\. Lọc theo vùng Frame \(Giới hạn: (.+) - (.+)\)$/, '1. Filter by frame range (limits: $1–$2)')
    .replace(/^Sẽ xóa (\d+) Shape\.$/, 'Will delete $1 Shapes.')
    .replace(/^Tiếp tục\?$/, 'Continue?')
    .replace(/^API báo lỗi nhưng GET sau đó chưa xác nhận đầy đủ: (.+)$/, 'The API reported an error and the following GET did not fully verify it: $1')
    .replace(/^chưa xóa: (.+)$/, 'not deleted: $1')
    .replace(/^box giữ đã mất: (.+)$/, 'kept boxes missing: $1')
    .replace(/^box giữ đã thay đổi$/, 'kept boxes changed')
    .replace(/^Dữ liệu Shape #(\d+) đã thay đổi trên CVAT\. Hãy tải lại Job trước khi xóa\.$/, 'Shape #$1 changed in CVAT. Reload the Job before deleting.')
    .replace(/^Không thể xác minh thao tác xóa \((.+)\)\. Hãy tải lại Job; không tự gửi lại lệnh\.$/, 'Unable to verify the deletion ($1). Reload the Job; the request was not retried.');
}

export function translate(source: string, locale: Locale): string {
  return locale === 'en' ? translateDynamic(source) : (vietnamese[source] ?? source);
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (source: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'vi' ? 'vi' : 'en'; } catch { return 'en'; }
  });
  const textSources = useRef(new WeakMap<Text, string>());
  const attrSources = useRef(new WeakMap<Element, Map<string, string>>());
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { }
  }, []);
  const translatePage = useCallback((reconcileReactUpdates: boolean) => {
    const root = document.getElementById('root');
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const previous = textSources.current.get(node);
      const current = node.nodeValue ?? '';
      const original = reconcileReactUpdates && previous !== undefined && current !== translate(previous, locale)
        ? current
        : (previous ?? current);
      textSources.current.set(node, original);
      const value = translate(original, locale);
      if (node.nodeValue !== value) node.nodeValue = value;
    }
    root.querySelectorAll('[title], [placeholder], [aria-label], [alt]').forEach((element) => {
      const saved = attrSources.current.get(element) ?? new Map<string, string>();
      attrSources.current.set(element, saved);
      for (const name of ['title', 'placeholder', 'aria-label', 'alt']) {
        if (!element.hasAttribute(name)) continue;
        const current = element.getAttribute(name) ?? '';
        const previous = saved.get(name);
        const original = reconcileReactUpdates && previous !== undefined && current !== translate(previous, locale)
          ? current
          : (previous ?? current);
        saved.set(name, original);
        const value = translate(original, locale);
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
      }
    });
  }, [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'en' ? 'CVAT Tools' : 'Công cụ CVAT';
    translatePage(false);
    const root = document.getElementById('root');
    if (!root) return;
    const observer = new MutationObserver(() => translatePage(true));
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label', 'alt'] });
    return () => observer.disconnect();
  }, [locale, translatePage]);
  const value = useMemo(() => ({ locale, setLocale, t: (source: string) => translate(source, locale) }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}
