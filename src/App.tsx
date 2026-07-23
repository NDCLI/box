import { useState, useCallback } from 'react';

// Hooks
import { useFileProcessor } from './hooks/useFileProcessor';
import { useDuplicateDetection } from './hooks/useDuplicateDetection';
import { useFrameImage } from './hooks/useFrameImage';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import StatusBanners from './components/StatusBanners';
import UploadZone from './components/UploadZone';
import FileInfoBar from './components/FileInfoBar';
import ConfigPanel from './components/ConfigPanel';
import StatsGrid from './components/StatsGrid';
import DuplicateList from './components/DuplicateList';
import PreviewModal from './components/PreviewModal';

// Utils
import { removeDuplicatesFromXML, generateCSVReport } from './utils/parser';

export default function App() {
  // ── Exclude labels (persisted to localStorage) ──
  const [excludeLabels, setExcludeLabels] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('excludeLabels');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const saveExcludeLabels = useCallback((labels: string[]) => {
    setExcludeLabels(labels);
    try {
      localStorage.setItem("excludeLabels", JSON.stringify(labels));
    } catch { }
  }, []);

  // ── Manual images mapping ──
  const [manualImages, setManualImages] = useState<Record<string, string>>({});

  // ── Visualizer settings ──
  const [customZoomPadding, setCustomZoomPadding] = useState<number>(60);

  // ── File processing hook ──
  const fp = useFileProcessor({
    onDatasetParsed: (parsed) => {
      detection.setSelectedLabels(parsed.labels);
      detection.setSelectedGroupId(null);
      detection.setCurrentPage(1);
    },
  });

  // ── Duplicate detection hook ──
  const detection = useDuplicateDetection({
    dataset: fp.dataset,
    excludeLabels,
  });

  // ── Frame image loading hook ──
  const frameImage = useFrameImage({
    selectedFrameData: detection.selectedFrameData,
    zipEntries: fp.zipEntries,
    manualImages,
  });

  // ── Extended reset (clean up manual images too) ──
  const handleReset = useCallback(() => {
    fp.resetState();
    setManualImages((prev) => {
      Object.values(prev).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      return {};
    });
  }, [fp]);

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
    <div className="dark-theme min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Upload Zone (shown when no dataset loaded) */}
        {!fp.dataset && (
          <UploadZone
            isDragging={fp.isDragging}
            fileInputRef={fp.fileInputRef}
            onUploadClick={fp.handleUploadClick}
            onFileChange={fp.handleFileChange}
            onDragOver={fp.handleDragOver}
            onDragLeave={fp.handleDragLeave}
            onDrop={fp.handleDrop}
          />
        )}

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
            />

            <ConfigPanel
              frameRange={detection.frameRange}
              frameRangeStart={detection.frameRangeStart}
              frameRangeEnd={detection.frameRangeEnd}
              onFrameRangeStartChange={(v) => detection.setFrameRangeStart(v)}
              onFrameRangeEndChange={(v) => detection.setFrameRangeEnd(v)}
              excludeLabels={excludeLabels}
              onSaveExcludeLabels={saveExcludeLabels}
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
              onSelectGroup={(id) => detection.setSelectedGroupId(id)}
              currentPage={detection.currentPage}
              totalPages={detection.totalPages}
              onPageChange={(p) => detection.setCurrentPage(p)}
              itemsPerPage={detection.itemsPerPage}
              settings={detection.settings}
            />
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {detection.selectedGroup && detection.selectedFrameData && (
        <PreviewModal
          selectedGroup={detection.selectedGroup}
          selectedFrameData={detection.selectedFrameData}
          dataset={fp.dataset!}
          duplicateGroups={detection.duplicateGroups}
          currentImageSrc={frameImage.currentImageSrc}
          imageLoading={frameImage.imageLoading}
          customZoomPadding={customZoomPadding}
          onCustomZoomPaddingChange={setCustomZoomPadding}
          onClose={() => detection.setSelectedGroupId(null)}
        />
      )}

      <Footer />
    </div>
  );
}
