import { lazy, Suspense, useState, useCallback, useRef, useEffect } from 'react';

// Hooks
import { useFileProcessor } from './hooks/useFileProcessor';
import { useDuplicateDetection } from './hooks/useDuplicateDetection';
import { useFrameImage, type CvatFrameSource } from './hooks/useFrameImage';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import StatusBanners from './components/StatusBanners';
import UploadZone from './components/UploadZone';
import FileInfoBar from './components/FileInfoBar';
import ConfigPanel from './components/ConfigPanel';
import StatsGrid from './components/StatsGrid';
import DuplicateList from './components/DuplicateList';

const PreviewModal = lazy(() => import('./components/PreviewModal'));

// Utils
import { removeDuplicatesFromXML, generateCSVReport } from './utils/parser';
import { deleteCvatJobShapes, loadCvatJobDataset, loadCvatTaskDataset } from './utils/cvatApi';
import type { DuplicateGroup } from './types';

export default function App() {
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
      localStorage.setItem("excludeLabels", JSON.stringify(labels));
    } catch { }
  }, []);

  // ── Manual images mapping ──
  const [manualImages, setManualImages] = useState<Record<string, string>>({});
  const [cvatFrameSource, setCvatFrameSource] = useState<CvatFrameSource | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isRefreshingJob, setIsRefreshingJob] = useState(false);
  const refreshRequest = useRef(0);
  const restorePreviewFrameRef = useRef<string | null>(null);

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

  const isDesktopJob = Boolean(cvatFrameSource?.jobId && fp.dataset?.source === 'cvat' && fp.dataset.cvatContext?.jobId);

  const handleDeleteGroups = useCallback(async (groups: DuplicateGroup[], source: 'list' | 'preview' = 'list') => {
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
    const message = `Job #${cvatFrameSource.jobId}\nFrame: ${frames.join(', ')}\nSẽ xóa ${uniqueDelete.length} Shape.\n\nTiếp tục?`;
    if (!window.confirm(message)) return;
    fp.setError(null);
    fp.setSuccessMsg(null);
    try {
      const result = await deleteCvatJobShapes(
        cvatFrameSource.connection,
        cvatFrameSource.taskId,
        cvatFrameSource.jobId,
        uniqueDelete,
        uniqueKeep,
      );
      restorePreviewFrameRef.current = detection.selectedFrameData?.id ?? null;
      try {
        const refreshed = await loadCvatJobDataset(cvatFrameSource.connection, cvatFrameSource.taskId, cvatFrameSource.jobId);
        fp.loadDataset(refreshed);
        fp.setSuccessMsg(`Đã xác minh xóa ${result.deletedShapeIds.length} Shape trên CVAT. Bản sao đã lưu tại ${result.backupPath}${source === 'preview' ? ' (nhóm đang xem).' : '.'}`);
      } catch (refreshError) {
        restorePreviewFrameRef.current = null;
        fp.setError(`Đã xác minh xóa ${result.deletedShapeIds.length} Shape trên CVAT nhưng chưa tải lại được giao diện: ${refreshError instanceof Error ? refreshError.message : 'lỗi mạng'}. Hãy bấm Tải lại Job.`);
      }
    } catch (err) {
      fp.setError(err instanceof Error ? err.message : 'Không thể xóa Shape trên CVAT.');
    }
  }, [cvatFrameSource, detection.selectionByBoxId, fp, isDesktopJob]);

  // ── Extended reset (clean up manual images too) ──
  const handleReset = useCallback(() => {
    refreshRequest.current++;
    setIsRefreshingJob(false);
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

  // ── Download cleaned XML ──
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

  // ── Download CSV report ──
  const handleDownloadCSVReport = useCallback(() => {
    if (detection.duplicateGroups.length === 0) return;
    try {
      const csvContent = generateCSVReport(detection.duplicateGroups);
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
  }, [fp, detection]);

  // Preserve download utilities for future UI integration
  void handleDownloadCleanedXML;
  void handleDownloadCSVReport;

  // ── Render ──
  return (
    <div className="app-shell dark-theme min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      <Header />

      <main className="app-main flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Upload Zone (shown when no dataset loaded) */}
        <div hidden={Boolean(fp.dataset)}>
          <UploadZone
            isDragging={fp.isDragging}
            fileInputRef={fp.fileInputRef}
            onUploadClick={fp.handleUploadClick}
            onFileChange={fp.handleFileChange}
            onDragOver={fp.handleDragOver}
            onDragLeave={fp.handleDragLeave}
            onDrop={fp.handleDrop}
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
          successMsg={fp.successMsg}
          onDismissError={() => fp.setError(null)}
          onDismissSuccess={() => fp.setSuccessMsg(null)}
        />

        {/* Main application interface */}
        {fp.dataset && (
          <div className="space-y-6">
            <FileInfoBar
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
              onOpenBackupFolder={isDesktopJob ? () => void window.cvatDesktop?.openBackupFolder?.() : undefined}
            />

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

            <StatsGrid stats={detection.stats} />

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
              onDeleteSelected={() => void handleDeleteGroups(detection.duplicateGroups.filter(group =>
                detection.selectedGroupIds.includes(group.id) ||
                group.boxes.some(box => detection.selectionByBoxId[box.id] === 'delete')
              ))}
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
        )}
      </main>

      {/* Preview Modal */}
      {isPreviewOpen && detection.selectedGroup && detection.selectedFrameData && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/80 text-sm font-semibold text-slate-200">
            Đang mở trình xem ảnh…
          </div>
        }>
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
            onDelete={() => void handleDeleteGroups([detection.selectedGroup!], 'preview')}
            onClose={() => { setIsPreviewOpen(false); detection.setSelectedGroupId(null); }}
          />
        </Suspense>
      )}

      <Footer />
    </div>
  );
}
