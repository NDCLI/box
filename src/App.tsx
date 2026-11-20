import { lazy, Suspense, useState, useCallback, useRef, useEffect } from 'react';

// Hooks
import { useFileProcessor } from './hooks/useFileProcessor';
import { useDuplicateDetection } from './hooks/useDuplicateDetection';
import { useFrameImage, type CvatFrameSource } from './hooks/useFrameImage';
import { useJobImageCache } from './hooks/useJobImageCache';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import StatusBanners from './components/StatusBanners';
import UploadZone from './components/UploadZone';
import FileInfoBar from './components/FileInfoBar';
import ConfigPanel from './components/ConfigPanel';
import StatsGrid from './components/StatsGrid';
import DuplicateList from './components/DuplicateList';
import ConfirmDialog, { type DeleteConfirmationState } from './components/ui/ConfirmDialog';

const PreviewModal = lazy(() => import('./components/PreviewModal'));
const ImageViewProject = lazy(() => import('./components/ImageViewProject'));

// Utils
import { removeDuplicatesFromXML, generateCSVReport } from './utils/parser';
import { deleteCvatJobShapes, loadCvatJobDataset, loadCvatTaskDataset } from './utils/cvatApi';
import type { CVATBox, DuplicateGroup } from './types';
import { useLocale } from './i18n/LocaleProvider';
import { AnprProject } from './components/AnprProject';
import { DpmSsegProject } from './components/DpmSsegProject';
import { LayoutDashboard, CarFront, Settings, Images, House, ChevronsLeft, ChevronsRight, ScanSearch, Download } from 'lucide-react';
import SettingsPanel from './components/SettingsPanel';
import { createCvatSource, createZipSource } from './imageview/sources';

interface PendingDeletePayload {
  confirmation: DeleteConfirmationState;
  deleteBoxes: CVATBox[];
  keepBoxes: CVATBox[];
}

export default function App() {
  const { locale } = useLocale();
  const [project, setProject] = useState<'count' | 'anpr' | 'dpm' | 'imageview' | 'settings'>('count');
  const [imageViewVisited, setImageViewVisited] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<string | null>(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ percent: number; phase: 'download' | 'prepare' | 'restart' }>({ percent: 0, phase: 'download' });
  useEffect(() => window.cvatDesktop?.onUpdateProgress?.(setUpdateProgress), []);
  const [updateError, setUpdateError] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('cvat-sidebar-collapsed') !== 'false'; } catch { return true; }
  });

  // ── Exclude labels (persisted to localStorage) ──
  const [excludeLabels, setExcludeLabels] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('excludeLabels');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [skipFrameFilterEnabled, setSkipFrameFilterEnabled] = useState(true);

  const saveExcludeLabels = useCallback((labels: string[]) => {
    setExcludeLabels(labels);
    try {
      localStorage.setItem('excludeLabels', JSON.stringify(labels));
    } catch { }
  }, []);

  // ── Manual images mapping & active CVAT session ──
  const [manualImages, setManualImages] = useState<Record<string, string>>({});
  const [cvatFrameSource, setCvatFrameSource] = useState<CvatFrameSource | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isRefreshingJob, setIsRefreshingJob] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeletePayload | null>(null);
  const [isDeletingShapes, setIsDeletingShapes] = useState(false);
  const refreshRequest = useRef(0);
  const restorePreviewFrameRef = useRef<string | null>(null);

  useEffect(() => window.cvatDesktop?.onUpdateAvailable?.(({ version }) => {
    setAvailableUpdate(version);
    setUpdateError('');
  }), []);

  const installAvailableUpdate = async () => {
    setInstallingUpdate(true);
    setUpdateProgress({ percent: 0, phase: 'download' });
    setUpdateError('');
    try {
      const result = await window.cvatDesktop?.installUpdate?.();
      if (result?.message) throw new Error(result.message);
      if (result?.available === false) {
        setAvailableUpdate(null);
        setInstallingUpdate(false);
      }
    } catch (error) {
      setInstallingUpdate(false);
      setUpdateError(error instanceof Error ? error.message : 'Không cài được bản cập nhật.');
    }
  };

  // ── Visualizer settings ──
  const [customZoomPadding, setCustomZoomPadding] = useState<number>(60);

  // ── File processing hook ──
  const fp = useFileProcessor({
    onDatasetParsed: (parsed) => {
      detection.setSelectedLabels(parsed.labels);
      if (!restorePreviewFrameRef.current) detection.setSelectedGroupId(null);
      detection.setCurrentPage(1);
    },
  });

  // ── Duplicate detection hook ──
  const jobImageCache = useJobImageCache(fp.dataset, cvatFrameSource);

  const detection = useDuplicateDetection({
    dataset: fp.dataset,
    excludeLabels,
    skipFrameFilterEnabled,
  });

  // ── Frame image loading hook ──
  const frameImage = useFrameImage({
    selectedFrameData: detection.selectedFrameData,
    zipEntries: fp.zipEntries,
    manualImages,
    cvatFrameSource,
  });

  useEffect(() => {
    const frameId = restorePreviewFrameRef.current;
    if (!frameId || !fp.dataset) return;
    const group = detection.duplicateGroups.find(candidate => candidate.frameId === frameId);
    if (group) {
      detection.setSelectedGroupId(group.id);
      restorePreviewFrameRef.current = null;
    }
  }, [detection.duplicateGroups, fp.dataset]);

  // ── Global desktop keyboard shortcuts ──
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('cvat-sidebar-collapsed', String(next)); } catch { /* Optional preference. */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;

      const key = event.key.toLowerCase();
      if (key === 'b') {
        event.preventDefault();
        toggleSidebar();
      } else if (event.key === ',') {
        event.preventDefault();
        setProject((curr) => (curr === 'settings' ? 'count' : 'settings'));
      } else if (fp.dataset) {
        if (key === '1') { event.preventDefault(); setProject('count'); }
        else if (key === '2') { event.preventDefault(); setProject('anpr'); }
        else if (key === '3') { event.preventDefault(); setProject('dpm'); }
        else if (key === '4') { event.preventDefault(); setImageViewVisited(true); setProject('imageview'); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fp.dataset, toggleSidebar]);

  const isDesktopJob = Boolean(cvatFrameSource?.jobId && fp.dataset?.source === 'cvat' && fp.dataset.cvatContext?.jobId);

  const handleDeleteGroups = useCallback((groups: DuplicateGroup[], source: 'list' | 'preview' = 'list') => {
    if (!isDesktopJob || !cvatFrameSource?.jobId || !fp.dataset?.cvatContext) {
      fp.setError('Xóa box chỉ dùng được khi mở một Job CVAT trên bản desktop.');
      return;
    }
    const deleteBoxes = groups.flatMap(group => group.boxes.filter(box => detection.selectionByBoxId[box.id] === 'delete'));
    // An unselected box is kept by default. Only explicitly marked boxes are deleted.
    const keepBoxes = groups.flatMap(group => group.boxes.filter(box => detection.selectionByBoxId[box.id] !== 'delete'));
    for (const group of groups) {
      const groupDelete = group.boxes.filter(box => detection.selectionByBoxId[box.id] === 'delete');
      if (groupDelete.length === group.boxes.length) {
        fp.setError(`Không thể xóa hết box trong nhóm Frame ${group.frameId}.`);
        return;
      }
      if (group.boxes.some(box => box.annotationKind === 'track') && groupDelete.length > 0) {
        fp.setError(`Nhóm Frame ${group.frameId} có Track; tính năng xóa Track chưa được hỗ trợ.`);
        return;
      }
    }
    const uniqueDelete = [...new Map(deleteBoxes.filter(box => Number.isInteger(box.serverShapeId)).map(box => [box.serverShapeId!, box])).values()];
    const uniqueKeep = [...new Map(keepBoxes.filter(box => Number.isInteger(box.serverShapeId)).map(box => [box.serverShapeId!, box])).values()];
    if (uniqueDelete.length === 0) {
      fp.setError('Hãy chọn box sẽ xóa trước.');
      return;
    }
    const frames = [...new Set(groups.map(group => group.frameId))].sort((a, b) => Number(a) - Number(b));
    setPendingDelete({
      confirmation: {
        jobId: cvatFrameSource.jobId,
        frames,
        deleteCount: uniqueDelete.length,
        keepCount: uniqueKeep.length,
        source,
      },
      deleteBoxes: uniqueDelete,
      keepBoxes: uniqueKeep,
    });
  }, [cvatFrameSource, detection.selectionByBoxId, fp, isDesktopJob]);

  const executeConfirmedDelete = useCallback(async () => {
    if (!pendingDelete || !cvatFrameSource?.jobId) return;
    const { confirmation, deleteBoxes, keepBoxes } = pendingDelete;
    setIsDeletingShapes(true);
    fp.setError(null);
    fp.setSuccessMsg(null);
    try {
      const result = await deleteCvatJobShapes(
        cvatFrameSource.connection,
        cvatFrameSource.taskId,
        cvatFrameSource.jobId,
        deleteBoxes,
        keepBoxes,
      );
      restorePreviewFrameRef.current = detection.selectedFrameData?.id ?? null;
      setPendingDelete(null);
      try {
        const refreshed = await loadCvatJobDataset(cvatFrameSource.connection, cvatFrameSource.taskId, cvatFrameSource.jobId);
        fp.loadDataset(refreshed);
        fp.setSuccessMsg(`Đã xác minh xóa ${result.deletedShapeIds.length} Shape trên CVAT. Bản sao đã lưu tại ${result.backupPath}${confirmation.source === 'preview' ? ' (nhóm đang xem).' : '.'}`);
      } catch (refreshError) {
        restorePreviewFrameRef.current = null;
        fp.setError(`Đã xác minh xóa ${result.deletedShapeIds.length} Shape trên CVAT nhưng chưa tải lại được giao diện: ${refreshError instanceof Error ? refreshError.message : 'lỗi mạng'}. Hãy bấm Tải lại Job.`);
      }
    } catch (err) {
      setPendingDelete(null);
      fp.setError(err instanceof Error ? err.message : 'Không thể xóa Shape trên CVAT.');
    } finally {
      setIsDeletingShapes(false);
    }
  }, [cvatFrameSource, detection.selectedFrameData?.id, fp, pendingDelete]);

  // ── Extended reset (clean up manual images too) ──
  const handleReset = useCallback(() => {
    refreshRequest.current++;
    setProject('count');
    setImageViewVisited(false);
    setIsRefreshingJob(false);
    setPendingDelete(null);
    fp.resetState();
    setCvatFrameSource(null);
    setIsPreviewOpen(false);
    setManualImages((prev) => {
      Object.values(prev).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      return {};
    });
    restorePreviewFrameRef.current = null;
  }, [fp]);

  const handleRefreshJob = async () => {
    if (!cvatFrameSource || isRefreshingJob) return;
    const requestId = ++refreshRequest.current;
    const { connection, taskId, jobId } = cvatFrameSource;
    setIsRefreshingJob(true);
    fp.setError(null);
    fp.setSuccessMsg(null);
    try {
      const dataset = jobId
        ? await loadCvatJobDataset(connection, taskId, jobId)
        : await loadCvatTaskDataset(connection, taskId);
      if (refreshRequest.current !== requestId) return;
      fp.loadDataset(dataset);
    } catch (err) {
      if (refreshRequest.current === requestId) {
        fp.setError(err instanceof Error ? err.message : 'Không thể tải lại annotation từ CVAT.');
      }
    } finally {
      if (refreshRequest.current === requestId) setIsRefreshingJob(false);
    }
  };

  // ── Label filter handlers ──
  const handleLabelToggle = useCallback((label: string) => {
    if (detection.selectedLabels.includes(label)) {
      if (detection.selectedLabels.length > 1) {
        detection.setSelectedLabels(detection.selectedLabels.filter(l => l !== label));
      } else {
        fp.setError('Bạn phải chọn ít nhất một nhãn để lọc.');
      }
    } else {
      detection.setSelectedLabels([...detection.selectedLabels, label]);
      fp.setError(null);
    }
  }, [detection, fp]);

  const handleSelectAllLabels = useCallback(() => {
    if (!fp.dataset) return;
    detection.setSelectedLabels(fp.dataset.labels);
  }, [fp.dataset, detection]);

  // ── Download cleaned XML (preserved) ──
  const handleDownloadCleanedXML = useCallback(() => {
    if (!fp.dataset || !fp.xmlContent) return;
    try {
      const cleanedXml = removeDuplicatesFromXML(fp.xmlContent, fp.dataset, detection.duplicateGroups);
      const blob = new Blob([cleanedXml], { type: 'text/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const baseName = fp.xmlFilename.substring(0, fp.xmlFilename.lastIndexOf('.')) || fp.xmlFilename;
      link.setAttribute('download', `${baseName}_cleaned.xml`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      fp.setSuccessMsg(`Đã tạo và tải xuống file XML đã làm sạch (đã xóa ${detection.stats.totalDuplicates} box trùng lặp)!`);
    } catch (err: any) {
      fp.setError('Lỗi khi tạo file XML đã làm sạch: ' + err.message);
    }
  }, [fp, detection]);

  // ── Download CSV report (preserved) ──
  const handleDownloadCSVReport = useCallback(() => {
    if (detection.duplicateGroups.length === 0) return;
    try {
      const csvContent = generateCSVReport(detection.duplicateGroups, locale);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const baseName = fp.xmlFilename.substring(0, fp.xmlFilename.lastIndexOf('.')) || fp.xmlFilename;
      link.setAttribute('download', `${baseName}_duplicate_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      fp.setSuccessMsg('Đã tạo và tải xuống báo cáo trùng lặp dạng CSV thành công!');
    } catch (err: any) {
      fp.setError('Lỗi khi xuất báo cáo CSV: ' + err.message);
    }
  }, [fp, detection, locale]);

  // Preserve download utilities without altering existing business behavior
  void handleDownloadCleanedXML;
  void handleDownloadCSVReport;

  const createSharedViewerSource = useCallback(async () => {
    if (cvatFrameSource && fp.dataset?.source === 'cvat') {
      return createCvatSource(cvatFrameSource.connection, cvatFrameSource.taskId, cvatFrameSource.jobId, fp.dataset.viewerPayload);
    }
    if (fp.file?.name.toLowerCase().endsWith('.zip')) return createZipSource(fp.file, fp.dataset || undefined);
    throw new Error(locale === 'vi' ? 'File XML chỉ có annotation, không chứa ảnh. Hãy chọn nguồn CVAT hoặc ZIP có ảnh tại Trang chính.' : 'XML contains annotations only. Choose CVAT or a ZIP with images on Home.');
  }, [cvatFrameSource, fp.dataset, fp.file, locale]);

  // Preview modal prev/next navigation across filtered duplicate groups
  const selectedGroupIndex = detection.selectedGroup
    ? detection.filteredDuplicateGroups.findIndex((g) => g.id === detection.selectedGroup!.id)
    : -1;

  const handleNavigatePreview = useCallback((direction: -1 | 1) => {
    if (selectedGroupIndex < 0) return;
    const nextIndex = selectedGroupIndex + direction;
    const target = detection.filteredDuplicateGroups[nextIndex];
    if (target) detection.setSelectedGroupId(target.id);
  }, [detection, selectedGroupIndex]);

  const duplicateBadge = detection.duplicateGroups.length > 0
    ? (detection.duplicateGroups.length > 999 ? '999+' : String(detection.duplicateGroups.length))
    : undefined;

  // ── Render ──
  return (
    <div className={`app-shell ${project === 'imageview' ? 'is-preview' : ''}`}>
      <Header dataset={fp.dataset} cvatFrameSource={cvatFrameSource} activeProject={project} />

      {availableUpdate && (
        <div
          className="fixed right-4 top-14 z-[120] flex max-w-md items-center gap-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--bg-surface)] px-4 py-3 text-xs shadow-[var(--shadow-popover)]"
          role="status"
          aria-live="polite"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--status-info-subtle)] text-[var(--status-info)]">
            <Download className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--text-primary)]">
              {locale === 'vi' ? `Có bản cập nhật CVAT Tools ${availableUpdate}` : `CVAT Tools ${availableUpdate} is available`}
            </p>
            {installingUpdate ? (
              <>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  {updateProgress.phase === 'restart'
                    ? (locale === 'vi' ? 'Đang khởi động lại…' : 'Restarting…')
                    : updateProgress.phase === 'prepare'
                      ? (locale === 'vi' ? 'Đang kiểm tra và chuẩn bị bản vá…' : 'Verifying and preparing update…')
                      : `${locale === 'vi' ? 'Đang tải' : 'Downloading'} ${updateProgress.percent}%`}
                </p>
                <progress
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                  aria-label={locale === 'vi' ? 'Tiến trình tải bản cập nhật' : 'Update download progress'}
                  max={100}
                  value={updateProgress.percent}
                />
              </>
            ) : (
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                {updateError || (locale === 'vi' ? 'Bạn có thể cập nhật ngay hoặc để sau.' : 'Update now or do it later.')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button disabled={installingUpdate} onClick={() => void installAvailableUpdate()} className="dt-btn dt-btn-primary dt-btn-sm">
              {locale === 'vi' ? 'Cập nhật' : 'Update'}
            </button>
            <button disabled={installingUpdate} onClick={() => { setAvailableUpdate(null); setUpdateError(''); }} className="dt-btn dt-btn-secondary dt-btn-sm">
              {locale === 'vi' ? 'Để sau' : 'Later'}
            </button>
          </div>
        </div>
      )}

      <div className="workspace-shell">
        <nav className={`project-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`} aria-label="Projects">
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            title={sidebarCollapsed ? 'Mở rộng thanh bên (Ctrl+B)' : 'Thu gọn thanh bên (Ctrl+B)'}
            aria-expanded={!sidebarCollapsed}
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? <ChevronsRight /> : <ChevronsLeft />}
            <span>{locale === 'vi' ? 'Thu gọn' : 'Collapse'}</span>
          </button>

          {!fp.dataset ? (
            <>
              <div className="project-sidebar-group-label">{locale === 'vi' ? 'Nguồn dữ liệu' : 'Data Source'}</div>
              <button
                type="button"
                title={locale === 'vi' ? 'Trang chính' : 'Home'}
                className={project !== 'settings' ? 'active' : ''}
                onClick={() => setProject('count')}
              >
                <House />
                <span>{locale === 'vi' ? 'Trang chính' : 'Home'}</span>
              </button>
            </>
          ) : (
            <>
              <div className="project-sidebar-group-label">{locale === 'vi' ? 'Công cụ QA' : 'QA Workspace'}</div>
              <button
                type="button"
                title="Box & Trùng lặp (Ctrl+1)"
                data-badge={duplicateBadge}
                className={project === 'count' ? 'active' : ''}
                onClick={() => setProject('count')}
              >
                <LayoutDashboard />
                <span>Box &amp; Trùng lặp</span>
              </button>
              <button
                type="button"
                title="ANPR biển số (Ctrl+2)"
                className={project === 'anpr' ? 'active' : ''}
                onClick={() => setProject('anpr')}
              >
                <CarFront />
                <span>ANPR biển số</span>
              </button>
              <button
                type="button"
                title="DPM / SSEG (Ctrl+3)"
                className={project === 'dpm' ? 'active' : ''}
                onClick={() => setProject('dpm')}
              >
                <ScanSearch />
                <span>DPM / SSEG</span>
              </button>
              <button
                type="button"
                title="ImageView (Ctrl+4)"
                className={project === 'imageview' ? 'active' : ''}
                onClick={() => { setImageViewVisited(true); setProject('imageview'); }}
              >
                <Images />
                <span>ImageView</span>
              </button>
            </>
          )}

          <div className="project-sidebar-spacer" />

          <div className="project-sidebar-group-label">{locale === 'vi' ? 'Hệ thống' : 'System'}</div>
          <button
            type="button"
            title={locale === 'vi' ? 'Cài đặt (Ctrl+,)' : 'Settings (Ctrl+,)'}
            data-dot={availableUpdate ? 'update' : undefined}
            className={project === 'settings' ? 'active' : ''}
            onClick={() => setProject(project === 'settings' ? 'count' : 'settings')}
          >
            <Settings />
            <span>{locale === 'vi' ? 'Cài đặt' : 'Settings'}</span>
          </button>
        </nav>

        <main className={`app-main ${project === 'imageview' ? 'app-main-preview' : ''}`}>
          {/* Upload Zone (kept mounted via hidden so CVAT task/job lists survive close) */}
          <div hidden={Boolean(fp.dataset) || project === 'settings'} data-testid="shared-source" className="w-full">
            <UploadZone
              isDragging={fp.isDragging}
              fileInputRef={fp.fileInputRef}
              onUploadClick={fp.handleUploadClick}
              onFileChange={(event) => { setCvatFrameSource(null); void fp.handleFileChange(event); }}
              onDragOver={fp.handleDragOver}
              onDragLeave={fp.handleDragLeave}
              onDrop={(event) => { setCvatFrameSource(null); void fp.handleDrop(event); }}
              onCvatDatasetLoaded={(dataset, connection, taskId, jobId) => {
                setCvatFrameSource({ connection, taskId, jobId });
                fp.loadDataset(dataset);
              }}
            />
          </div>

          {/* Status banners */}
          <StatusBanners
            isLoading={fp.isLoading}
            error={fp.error}
            successMsg={project === 'imageview' ? null : fp.successMsg}
            onDismissError={() => fp.setError(null)}
            onDismissSuccess={() => fp.setSuccessMsg(null)}
          />

          {fp.dataset && project !== 'settings' && (
            <FileInfoBar
              jobImageCache={jobImageCache}
              compact={project === 'imageview'}
              file={fp.file}
              dataset={fp.dataset}
              zipEntries={fp.zipEntries}
              xmlFilesInZip={fp.xmlFilesInZip}
              selectedXmlPath={fp.selectedXmlPath}
              onXmlPathChange={fp.handleXmlPathChange}
              onClose={handleReset}
              onRefreshJob={cvatFrameSource ? handleRefreshJob : undefined}
              cvatScope={cvatFrameSource?.jobId ? 'Job' : 'Task'}
              isRefreshingJob={isRefreshingJob}
              onOpenBackupFolder={project === 'count' && isDesktopJob ? () => void window.cvatDesktop?.openBackupFolder?.() : undefined}
            />
          )}

          {fp.dataset && imageViewVisited && (
            <div className="imageview-pane" hidden={project !== 'imageview'}>
              <Suspense fallback={<p className="text-xs text-[var(--text-secondary)]">Đang mở ImageView…</p>}>
                <ImageViewProject createSource={createSharedViewerSource} />
              </Suspense>
            </div>
          )}

          {project === 'imageview' ? null : project === 'settings' ? (
            <SettingsPanel />
          ) : project === 'anpr' ? (
            <AnprProject locale={locale} dataset={fp.dataset} />
          ) : project === 'dpm' ? (
            <DpmSsegProject
              locale={locale}
              dataset={fp.dataset}
              zipEntries={fp.zipEntries}
              manualImages={manualImages}
              cvatFrameSource={cvatFrameSource}
            />
          ) : (
            fp.dataset && project === 'count' && (
              <div className="flex flex-col gap-3">
                <StatsGrid stats={detection.stats} />

                <ConfigPanel
                  frameRange={detection.frameRange}
                  frameRangeStart={detection.frameRangeStart}
                  frameRangeEnd={detection.frameRangeEnd}
                  onFrameRangeStartChange={(v) => detection.setFrameRangeStart(v)}
                  onFrameRangeEndChange={(v) => detection.setFrameRangeEnd(v)}
                  excludeLabels={excludeLabels}
                  onSaveExcludeLabels={saveExcludeLabels}
                  skipFrameFilterEnabled={skipFrameFilterEnabled}
                  onSkipFrameFilterEnabledChange={setSkipFrameFilterEnabled}
                  settings={detection.settings}
                  onSettingsChange={detection.setSettings}
                />

                <DuplicateList
                  dataset={fp.dataset}
                  duplicateGroups={detection.duplicateGroups}
                  filteredDuplicateGroups={detection.filteredDuplicateGroups}
                  baseFilteredGroups={detection.baseFilteredGroups}
                  paginatedGroups={detection.paginatedGroups}
                  searchTerm={detection.searchTerm}
                  onSearchTermChange={(v) => detection.setSearchTerm(v)}
                  selectedLabels={detection.selectedLabels}
                  onLabelToggle={handleLabelToggle}
                  onSelectAllLabels={handleSelectAllLabels}
                  selectedGroupId={detection.selectedGroupId}
                  onSelectGroup={(id) => { setIsPreviewOpen(false); detection.setSelectedGroupId(id); }}
                  selectedGroupIds={detection.selectedGroupIds}
                  onToggleGroup={(id) => detection.setSelectedGroupIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id])}
                  selectionByBoxId={detection.selectionByBoxId}
                  onBoxSelection={detection.setBoxSelection}
                  onDeleteSelected={() => handleDeleteGroups(detection.duplicateGroups.filter(group =>
                    detection.selectedGroupIds.includes(group.id) ||
                    group.boxes.some(box => detection.selectionByBoxId[box.id] === 'delete')
                  ))}
                  onDeleteGroup={(group) => handleDeleteGroups([group], 'list')}
                  canDelete={isDesktopJob}
                  currentPage={detection.currentPage}
                  totalPages={detection.totalPages}
                  onPageChange={(p) => detection.setCurrentPage(p)}
                  itemsPerPage={detection.itemsPerPage}
                  settings={detection.settings}
                  quickReviewGroup={detection.selectedGroup}
                  quickReviewFrameData={detection.selectedFrameData}
                  quickReviewImageSrc={frameImage.currentImageSrc}
                  quickReviewImageLoading={frameImage.imageLoading}
                  quickReviewImageError={frameImage.imageError}
                  quickReviewImageDimensions={frameImage.imageDimensions}
                  onOpenPreview={() => setIsPreviewOpen(true)}
                />
              </div>
            )
          )}
        </main>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && detection.selectedGroup && detection.selectedFrameData && (
        <Suspense
          fallback={
            <div className="dt-modal-backdrop fixed inset-0 z-[100] grid place-items-center text-xs font-semibold text-[var(--text-primary)]">
              Đang mở trình xem ảnh…
            </div>
          }
        >
          <PreviewModal
            selectedGroup={detection.selectedGroup}
            selectedFrameData={detection.selectedFrameData}
            dataset={fp.dataset!}
            duplicateGroups={detection.duplicateGroups}
            currentImageSrc={frameImage.currentImageSrc}
            imageLoading={frameImage.imageLoading}
            imageError={frameImage.imageError}
            imageDimensions={frameImage.imageDimensions}
            customZoomPadding={customZoomPadding}
            onCustomZoomPaddingChange={setCustomZoomPadding}
            selectionByBoxId={detection.selectionByBoxId}
            onBoxSelection={detection.setBoxSelection}
            canDelete={isDesktopJob}
            onDelete={() => handleDeleteGroups([detection.selectedGroup!], 'preview')}
            onPrevGroup={selectedGroupIndex > 0 ? () => handleNavigatePreview(-1) : undefined}
            onNextGroup={
              selectedGroupIndex >= 0 && selectedGroupIndex < detection.filteredDuplicateGroups.length - 1
                ? () => handleNavigatePreview(1)
                : undefined
            }
            groupPosition={selectedGroupIndex >= 0 ? { index: selectedGroupIndex + 1, total: detection.filteredDuplicateGroups.length } : undefined}
            onClose={() => { setIsPreviewOpen(false); detection.setSelectedGroupId(null); }}
          />
        </Suspense>
      )}

      {/* Desktop Destructive Confirmation Dialog */}
      <ConfirmDialog
        confirmation={pendingDelete?.confirmation ?? null}
        locale={locale}
        isSubmitting={isDeletingShapes}
        onCancel={() => { if (!isDeletingShapes) setPendingDelete(null); }}
        onConfirm={() => void executeConfirmedDelete()}
      />

      {project !== 'imageview' && <Footer dataset={fp.dataset} totalDuplicates={detection.stats.totalDuplicates} />}
    </div>
  );
}
