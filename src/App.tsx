import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileCheck,
  Layers,
  AlertTriangle,
  Trash2,
  Settings,
  Search,
  Download,
  RefreshCw,
  FileUp,
  X,
  ChevronRight,
  ChevronLeft,
  Sliders,
  Maximize2,
  Minimize2,
  Grid,
  Eye,
  HelpCircle,
  Info,
  Sparkles,
  CheckCircle,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { parseCVATXML, detectDuplicates, removeDuplicatesFromXML, generateCSVReport } from './utils/parser';
import { CVATDataset, DuplicateGroup, DetectionSettings, CVATBox } from './types';

export default function App() {
  // File uploading states
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ZIP specific states
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [xmlFilesInZip, setXmlFilesInZip] = useState<string[]>([]);
  const [selectedXmlPath, setSelectedXmlPath] = useState<string>('');

  // Image states from ZIP
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageOpacity, setImageOpacity] = useState<number>(0.85); // Option to control brightness/opacity of image overlay

  // CVAT Dataset states
  const [xmlContent, setXmlContent] = useState<string>('');
  const [xmlFilename, setXmlFilename] = useState<string>('');
  const [dataset, setDataset] = useState<CVATDataset | null>(null);

  // Settings state
  const [settings, setSettings] = useState<DetectionSettings>({
    matchLabelOnly: true,
    tolerancePx: 0.0,
    overlapThreshold: 100.0,
    useIoU: true
  });

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'duplicates'>('all');

  // Frame range filter
  const [frameRangeStart, setFrameRangeStart] = useState<string>('');
  const [frameRangeEnd, setFrameRangeEnd] = useState<string>('');

  // Exclude labels configuration
  const [excludeLabels, setExcludeLabels] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('excludeLabels');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [showExcludePanel, setShowExcludePanel] = useState(false);
  const [newExcludeLabel, setNewExcludeLabel] = useState("");

  const saveExcludeLabels = (labels: string[]) => {
    setExcludeLabels(labels);
    try {
      localStorage.setItem("excludeLabels", JSON.stringify(labels));
    } catch { }
  };

  // Visualizer settings
  const [zoomToDuplicates, setZoomToDuplicates] = useState(true);
  const [customZoomPadding, setCustomZoomPadding] = useState<number>(60); // padding around duplicates (px)
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);

  // Pagination for duplicate groups list
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Cleanup feedback
  const [isCleaning, setIsCleaning] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger file browser
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Reset all state when new file starts uploading
  const resetState = () => {
    setFile(null);
    setError(null);
    setSuccessMsg(null);
    setZipInstance(null);
    setXmlFilesInZip([]);
    setSelectedXmlPath('');
    setXmlContent('');
    setXmlFilename('');
    setDataset(null);
    setSelectedGroupId(null);
    setSearchTerm('');
    setSelectedLabels([]);
    setCurrentPage(1);

    // Revoke image URL to avoid memory leaks
    if (currentImageSrc) {
      URL.revokeObjectURL(currentImageSrc);
    }
    setCurrentImageSrc(null);
  };

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processUploadedFile(e.target.files[0]);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // Main file processor
  const processUploadedFile = async (uploadedFile: File) => {
    resetState();
    setFile(uploadedFile);
    setIsLoading(true);

    try {
      const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
      if (extension === 'zip') {
        // Load ZIP file
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(uploadedFile);
        setZipInstance(loadedZip);

        // Find all XML files
        const xmlPaths: string[] = [];
        loadedZip.forEach((relativePath) => {
          if (relativePath.toLowerCase().endsWith('.xml') && !relativePath.startsWith('__MACOSX/')) {
            xmlPaths.push(relativePath);
          }
        });

        if (xmlPaths.length === 0) {
          throw new Error('Không tìm thấy tệp tin XML nào trong tệp ZIP đã tải lên.');
        }

        setXmlFilesInZip(xmlPaths);
        // Default to the first XML found (commonly annotations.xml)
        const defaultXml = xmlPaths.find(p => p.toLowerCase().includes('annotation')) || xmlPaths[0];
        setSelectedXmlPath(defaultXml);

        // Extract XML content
        const content = await loadedZip.file(defaultXml)!.async('string');
        setXmlContent(content);
        setXmlFilename(defaultXml.split('/').pop() || defaultXml);
      } else if (extension === 'xml') {
        // Load XML file directly
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setXmlContent(content);
          setXmlFilename(uploadedFile.name);
        };
        reader.onerror = () => {
          setError('Không thể đọc tệp XML này.');
          setIsLoading(false);
        };
        reader.readAsText(uploadedFile);
      } else {
        throw new Error('Định dạng tệp không được hỗ trợ. Vui lòng tải lên tệp .XML hoặc .ZIP.');
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi xử lý tệp.');
      setIsLoading(false);
    }
  };

  // Parse XML content when it becomes available
  useEffect(() => {
    if (!xmlContent) return;

    try {
      setIsLoading(true);
      const parsedDataset = parseCVATXML(xmlContent, xmlFilename);
      setDataset(parsedDataset);
      // Initialize selected labels to all labels
      setSelectedLabels(parsedDataset.labels);
      setSuccessMsg(`Tải và phân tích dữ liệu thành công! Tìm thấy ${parsedDataset.frames.length} khung hình.`);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi phân tích cú pháp tệp XML CVAT.');
      setDataset(null);
    } finally {
      setIsLoading(false);
    }
  }, [xmlContent, xmlFilename]);

  // Auto-hide success notification after 5s
  useEffect(() => {
    if (!successMsg) return;
    const timer = window.setTimeout(() => setSuccessMsg(null), 5000);
    return () => window.clearTimeout(timer);
  }, [successMsg]);

  // Auto-fill Start/End input khi load file mới
  useEffect(() => {
    if (!dataset) return;
    const ids = dataset.frames.map(f => parseInt(f.id, 10)).filter(id => !isNaN(id));
    const minF = ids.length ? Math.min(...ids) : 0;
    const maxF = ids.length ? Math.max(...ids) : 0;
    setFrameRangeStart(minF.toString());
    setFrameRangeEnd(maxF.toString());
  }, [dataset]);

  // Handle changing selected XML from ZIP
  const handleXmlPathChange = async (path: string) => {
    if (!zipInstance) return;
    try {
      setIsLoading(true);
      setSelectedXmlPath(path);
      const content = await zipInstance.file(path)!.async('string');
      setXmlContent(content);
      setXmlFilename(path.split('/').pop() || path);
      setSelectedGroupId(null);
      setCurrentPage(1);
    } catch (err: any) {
      setError('Lỗi khi trích xuất file XML đã chọn từ tệp ZIP.');
      setIsLoading(false);
    }
  };

  // Calculate duplicates dynamically based on dataset and settings
  const duplicateGroups = useMemo(() => {
    if (!dataset) return [];
    return detectDuplicates(dataset, settings);
  }, [dataset, settings]);

  // Reset page when duplicates change or search filters update
  useEffect(() => {
    setCurrentPage(1);
    setSelectedGroupId(null);
  }, [searchTerm, selectedLabels, settings, frameRangeStart, frameRangeEnd]);

  // Extract statistics
  const stats = useMemo(() => {
    if (!dataset) {
      return {
        totalFrames: 0, totalBoxes: 0, totalDuplicates: 0, affectedFramesCount: 0, duplicatePercent: 0,
        firstBoxId: "—", lastBoxId: "—", labelBreakdown: [] as { label: string, count: number }[],
        totalValidBoxes: 0, excludeCount: 0, framesWithSkipCount: 0, finalCount: 0,
        frameRange: { min: 0, max: 0 }
      };
    }

    const ids = dataset.frames.map(f => parseInt(f.id, 10)).filter(id => !isNaN(id));
    const minDatasetFrame = ids.length ? Math.min(...ids) : 0;
    const maxDatasetFrame = ids.length ? Math.max(...ids) : 0;

    const sVal = frameRangeStart ? parseInt(frameRangeStart, 10) : minDatasetFrame;
    const eVal = frameRangeEnd ? parseInt(frameRangeEnd, 10) : maxDatasetFrame;
    const clampedStart = Math.max(minDatasetFrame, Math.min(sVal, maxDatasetFrame));
    const clampedEnd = Math.max(clampedStart, Math.min(eVal, maxDatasetFrame));

    const filteredFrames = dataset.frames.filter(img => {
      const id = parseInt(img.id, 10);
      return !isNaN(id) && id >= clampedStart && id <= clampedEnd;
    });

    const totalFrames = filteredFrames.length;
    let totalBoxes = 0;

    let minBoxId = Infinity;
    let maxBoxId = -Infinity;
    const labelCounts: Record<string, number> = {};

    let excludeCount = 0;
    let framesWithSkipCount = 0;
    const excludeSet = new Set(excludeLabels.map(x => x.toLowerCase()));

    filteredFrames.forEach(f => {
      totalBoxes += f.boxes.length;

      let frameHasSkip = f.boxes.length === 0; // frameNoBox
      let framePass = false;
      let frameSkipLabelCount = 0;
      let frameExtraExclude = 0;
      let exclBoxes = 0;

      f.boxes.forEach(b => {
        const id = parseInt(b.id, 10);
        if (!isNaN(id)) {
          if (id < minBoxId) minBoxId = id;
          if (id > maxBoxId) maxBoxId = id;
        }
        labelCounts[b.label] = (labelCounts[b.label] || 0) + 1;

        const lbl = b.label.toLowerCase();
        if (lbl === '_excl_area') exclBoxes++;
        if (excludeSet.has(lbl)) frameExtraExclude++;
        if (lbl.includes('skip')) frameSkipLabelCount++;

        const hasPassAttr = b.attributes.some(a => a.name.toLowerCase() === 'pass' && ['true', '1', 'yes', 'y', 'on'].includes(a.value.trim().toLowerCase()));
        if (hasPassAttr) framePass = true;
      });

      excludeCount += exclBoxes + frameExtraExclude;
      if (framePass) {
        excludeCount += f.boxes.length; // whole frame skipped
        frameHasSkip = true;
      } else {
        excludeCount += frameSkipLabelCount;
      }

      if (frameHasSkip || frameSkipLabelCount > 0) {
        framesWithSkipCount++;
      }
    });

    const firstBoxId = minBoxId === Infinity ? "—" : String(minBoxId);
    const lastBoxId = maxBoxId === -Infinity ? "—" : String(maxBoxId);

    const labelBreakdown = Object.entries(labelCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    // Count duplicate boxes (total boxes in groups minus 1 per group, which is kept)
    // Only count duplicates for filtered frames
    const relevantDuplicates = duplicateGroups.filter(g => {
      const frameId = parseInt(g.frameId, 10);
      return !isNaN(frameId) && frameId >= clampedStart && frameId <= clampedEnd;
    });

    const totalDuplicates = relevantDuplicates.reduce((sum, g) => sum + (g.boxes.length - 1), 0);
    const affectedFramesCount = new Set(relevantDuplicates.map(g => g.frameId)).size;
    const duplicatePercent = totalBoxes > 0 ? (totalDuplicates / totalBoxes) * 100 : 0;
    const finalCount = Math.max(0, totalBoxes - excludeCount);

    return {
      totalFrames,
      totalBoxes,
      totalDuplicates,
      affectedFramesCount,
      duplicatePercent: Math.round(duplicatePercent * 100) / 100,
      firstBoxId,
      lastBoxId,
      labelBreakdown,
      excludeCount,
      framesWithSkipCount,
      finalCount,
      totalValidBoxes: Math.max(0, totalBoxes - totalDuplicates),
      frameRange: { min: minDatasetFrame, max: maxDatasetFrame }
    };
  }, [dataset, duplicateGroups, frameRangeStart, frameRangeEnd, excludeLabels]);

  // Tính phạm vi frame (min/max) từ dataset
  const frameRange = useMemo(() => {
    if (!dataset || dataset.frames.length === 0) return { min: 0, max: 0 };
    const ids = dataset.frames.map(f => parseInt(f.id, 10)).filter(n => !isNaN(n));
    return { min: Math.min(...ids), max: Math.max(...ids) };
  }, [dataset]);

  // Filter duplicate groups based on search term and labels
  const filteredDuplicateGroups = useMemo(() => {
    return duplicateGroups.filter(group => {
      // Search matches frame name/id
      const matchesSearch = group.frameName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.frameId.toString().includes(searchTerm);

      // Label filter matches if any box in the group has a selected label
      const hasSelectedLabel = group.boxes.some(box => selectedLabels.includes(box.label));

      // Frame range filter
      const frameNum = parseInt(group.frameId, 10);
      const startOk = frameRangeStart === '' || isNaN(parseInt(frameRangeStart, 10)) || frameNum >= parseInt(frameRangeStart, 10);
      const endOk = frameRangeEnd === '' || isNaN(parseInt(frameRangeEnd, 10)) || frameNum <= parseInt(frameRangeEnd, 10);

      return matchesSearch && hasSelectedLabel && startOk && endOk;
    });
  }, [duplicateGroups, searchTerm, selectedLabels, frameRangeStart, frameRangeEnd]);

  // Paginated duplicate groups
  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDuplicateGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDuplicateGroups, currentPage]);

  const totalPages = Math.ceil(filteredDuplicateGroups.length / itemsPerPage);

  // Selected group data
  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return duplicateGroups.find(g => g.id === selectedGroupId) || null;
  }, [selectedGroupId, duplicateGroups]);

  // Frame details for selected group
  const selectedFrameData = useMemo(() => {
    if (!selectedGroup || !dataset) return null;
    return dataset.frames.find(f => f.id === selectedGroup.frameId) || null;
  }, [selectedGroup, dataset]);

  // Find image helper in zip
  const findImageInZip = (zip: JSZip, frameName: string): string | null => {
    const targetBaseName = frameName.split('/').pop()?.toLowerCase();
    if (!targetBaseName) return null;

    let matchedPath: string | null = null;
    zip.forEach((relativePath, fileObj) => {
      if (fileObj.dir) return;

      const ext = relativePath.split('.').pop()?.toLowerCase();
      if (ext && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff'].includes(ext)) {
        const currentBaseName = relativePath.split('/').pop()?.toLowerCase();
        if (currentBaseName === targetBaseName || relativePath.toLowerCase() === frameName.toLowerCase()) {
          matchedPath = relativePath;
        }
      }
    });
    return matchedPath;
  };

  // Effect to load frame image from ZIP when active frame changes
  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    const loadFrameImage = async () => {
      if (!selectedFrameData || !zipInstance) {
        setCurrentImageSrc(null);
        return;
      }

      setImageLoading(true);
      try {
        const imgPath = findImageInZip(zipInstance, selectedFrameData.name);
        if (imgPath) {
          const fileInZip = zipInstance.file(imgPath);
          if (fileInZip) {
            const blob = await fileInZip.async('blob');
            if (active) {
              localUrl = URL.createObjectURL(blob);
              setCurrentImageSrc(localUrl);
            }
          } else {
            if (active) setCurrentImageSrc(null);
          }
        } else {
          if (active) setCurrentImageSrc(null);
        }
      } catch (err) {
        console.error("Lỗi khi đọc file ảnh từ tệp ZIP:", err);
        if (active) setCurrentImageSrc(null);
      } finally {
        if (active) setImageLoading(false);
      }
    };

    loadFrameImage();

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [selectedFrameData, zipInstance]);

  // Toggle label filter
  const handleLabelToggle = (label: string) => {
    if (selectedLabels.includes(label)) {
      if (selectedLabels.length > 1) {
        setSelectedLabels(selectedLabels.filter(l => l !== label));
      } else {
        // Must select at least one
        setSuccessMsg(null);
        setError('Bạn phải chọn ít nhất một nhãn để lọc.');
      }
    } else {
      setSelectedLabels([...selectedLabels, label]);
      setError(null);
    }
  };

  // Quick select all / none labels
  const handleSelectAllLabels = () => {
    if (!dataset) return;
    setSelectedLabels(dataset.labels);
  };

  // Download cleaned XML
  const handleDownloadCleanedXML = () => {
    if (!dataset || !xmlContent) return;

    try {
      setIsCleaning(true);
      const cleanedXml = removeDuplicatesFromXML(xmlContent, dataset, duplicateGroups);

      const blob = new Blob([cleanedXml], { type: 'text/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Output filename suffix with _cleaned
      const origName = xmlFilename;
      const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;
      link.setAttribute('download', `${baseName}_cleaned.xml`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg(`Đã tạo và tải xuống file XML đã làm sạch (đã xóa ${stats.totalDuplicates} box trùng lặp)!`);
    } catch (err: any) {
      setError('Lỗi khi tạo file XML đã làm sạch: ' + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  // Download cleaned ZIP
  const handleDownloadCleanedZIP = async () => {
    if (!zipInstance || !dataset || !xmlContent || !selectedXmlPath) return;

    try {
      setIsCleaning(true);
      const cleanedXml = removeDuplicatesFromXML(xmlContent, dataset, duplicateGroups);

      // Update XML inside ZIP
      zipInstance.file(selectedXmlPath, cleanedXml);

      // Generate new ZIP
      const contentBlob = await zipInstance.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(contentBlob);
      const link = document.createElement('a');
      link.href = url;

      const origZipName = file?.name || 'dataset.zip';
      const baseName = origZipName.substring(0, origZipName.lastIndexOf('.')) || origZipName;
      link.setAttribute('download', `${baseName}_cleaned.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg(`Đã cập nhật file XML trong ZIP và tải xuống file ZIP đã làm sạch thành công!`);
    } catch (err: any) {
      setError('Lỗi khi tạo file ZIP đã làm sạch: ' + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  // Download CSV report
  const handleDownloadCSVReport = () => {
    if (duplicateGroups.length === 0) return;

    try {
      const csvContent = generateCSVReport(duplicateGroups);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const origName = xmlFilename;
      const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;
      link.setAttribute('download', `${baseName}_duplicate_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg('Đã tạo và tải xuống báo cáo trùng lặp dạng CSV thành công!');
    } catch (err: any) {
      setError('Lỗi khi xuất báo cáo CSV: ' + err.message);
    }
  };

  // Auto-scroll logic helper for selected frame bounding box
  const getZoomViewBox = () => {
    if (!selectedGroup || !selectedFrameData) return '0 0 1920 1080';

    const { width: frameWidth, height: frameHeight } = selectedFrameData;
    const { boxes } = selectedGroup;

    if (boxes.length === 0) return `0 0 ${frameWidth} ${frameHeight}`;

    // Get min/max bounds of the boxes in the group
    const minX = Math.min(...boxes.map(b => b.xtl));
    const minY = Math.min(...boxes.map(b => b.ytl));
    const maxX = Math.max(...boxes.map(b => b.xbr));
    const maxY = Math.max(...boxes.map(b => b.ybr));

    const w = maxX - minX;
    const h = maxY - minY;

    // Add visual breathing room (padding) around the duplicates, using user-defined padding
    const padding = customZoomPadding;

    const zoomX = Math.max(0, minX - padding);
    const zoomY = Math.max(0, minY - padding);
    const zoomW = Math.min(frameWidth - zoomX, w + padding * 2);
    const zoomH = Math.min(frameHeight - zoomY, h + padding * 2);

    return `${zoomX} ${zoomY} ${zoomW} ${zoomH}`;
  };

  return (
    <div className="dark-theme min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 shadow-lg shadow-cyan-500/25 ring-1 ring-white/20 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75),transparent_34%)]" />
              <svg viewBox="0 0 44 44" className="relative w-full h-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.35)]" aria-hidden="true">
                <path d="M22 8 35 14.5 22 21 9 14.5 22 8Z" fill="#f8fafc" opacity="0.96" />
                <path d="M9 14.5 22 21v14L9 28.5v-14Z" fill="#67e8f9" />
                <path d="M35 14.5 22 21v14l13-6.5v-14Z" fill="#a78bfa" />
                <path d="M14 14.5 22 10.5l8 4-8 4-8-4Z" fill="#0f172a" opacity="0.9" />
                <path d="M13 24.5 22 29l9-4.5" fill="none" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
                <path d="M13 19.5 22 24l9-4.5" fill="none" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">CVAT Box Counter & Duplicate Inspector</h1>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold tracking-tight">
              <span style={{ color: '#4285F4' }}>G</span>
              <span style={{ color: '#EA4335' }}>o</span>
              <span style={{ color: '#FBBC05' }}>o</span>
              <span style={{ color: '#34A853' }}>g</span>
              <span style={{ color: '#EA4335' }}>l</span>
              <span style={{ color: '#4285F4' }}>e</span>
              <span style={{ color: '#000' }}> AI </span>
              <span style={{ color: '#4285F4' }}>S</span>
              <span style={{ color: '#EA4335' }}>t</span>
              <span style={{ color: '#FBBC05' }}>u</span>
              <span style={{ color: '#34A853' }}>d</span>
              <span style={{ color: '#EA4335' }}>i</span>
              <span style={{ color: '#4285F4' }}>o</span>
            </h2>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Upload Zone & Guide */}
        {!dataset && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Left side: Upload card */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col justify-between min-h-[420px]">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Tải tệp dữ liệu lên</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Chọn hoặc kéo thả file XML/ZIP xuất từ CVAT để thống kê số box, lọc theo Frame Range, tính Exclude Labels, Frame Skip và kiểm tra Duplicate Boxes.
                </p>
              </div>

              {/* Drop area */}
              <div
                id="upload-dropzone"
                onClick={handleUploadClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group ${isDragging
                  ? 'border-red-500 bg-red-50/40 scale-[0.99]'
                  : 'border-slate-300 hover:border-red-400 hover:bg-slate-50/50'
                  }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xml,.zip"
                  className="hidden"
                />

                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-4 group-hover:scale-110 transition-transform duration-200">
                  <FileUp className="w-8 h-8" />
                </div>

                <span className="text-base font-semibold text-slate-800 mb-1 group-hover:text-red-500">
                  Kéo thả tệp XML hoặc ZIP vào đây
                </span>
                <span className="text-xs text-slate-400">
                  Hoặc click để chọn từ thiết bị (Hỗ trợ XML đơn hoặc ZIP gói đầy đủ)
                </span>

                <div className="mt-6 flex space-x-3 text-xs text-slate-400">
                  <span className="flex items-center"><FileCode className="w-3.5 h-3.5 mr-1" /> CVAT XML</span>
                  <span className="border-r border-slate-200"></span>
                  <span className="flex items-center"><FileArchive className="w-3.5 h-3.5 mr-1" /> ZIP File</span>
                </div>
              </div>

              <div className="mt-6 text-xs text-slate-400 flex items-start space-x-2 bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Bảo mật:</strong> Tệp tin của bạn được phân tích cục bộ hoàn toàn trên trình duyệt của bạn bằng JavaScript. Không có dữ liệu hình ảnh hay chú thích nào được tải lên máy chủ ngoài.
                </span>
              </div>
            </div>

            {/* Right side: Instructions and info */}
            <div className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-8 flex flex-col justify-between shadow-xl shadow-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-20 -translate-y-20 w-80 h-80 bg-red-500/10 rounded-full blur-3xl"></div>

              <div>
                <div className="inline-flex items-center space-x-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-6">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Box Audit Toolkit</span>
                </div>

                <h3 className="text-xl font-bold tracking-tight mb-4">Tính năng chính</h3>

                <ul className="space-y-4 text-sm text-slate-300">
                  <li className="flex items-start space-x-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs font-bold text-red-400 shrink-0 mt-0.5">1</span>
                    <span><strong>Parse CVAT XML/ZIP:</strong> Đọc annotations từ định dạng Images hoặc Tracks.</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs font-bold text-red-400 shrink-0 mt-0.5">2</span>
                    <span><strong>Box Counting:</strong> Tính số lượng Bounding Box theo Frame Range, Exclude Labels, Frame Skip và Passed frame.</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs font-bold text-red-400 shrink-0 mt-0.5">3</span>
                    <span><strong>Duplicate Inspector:</strong> Quét Duplicate Boxes theo Pixel Match hoặc IoU, có tuỳ chọn chỉ tính trùng khi cùng Label.</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs font-bold text-red-400 shrink-0 mt-0.5">4</span>
                    <span><strong>Visual Debug:</strong> Hiển thị ảnh/SVG đầy đủ, zoom vào vùng lỗi và lọc nhanh theo Frame, Label để kiểm tra annotation trực quan.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
                <span>Audit Mode v3.0</span>
                <span>CVAT XML / ZIP Support</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Global loading state */}
        {isLoading && (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center justify-center shadow-xs">
            <RefreshCw className="w-10 h-10 text-red-500 animate-spin mb-4" />
            <h4 className="text-lg font-semibold text-slate-800">Đang đọc và xử lý tệp dữ liệu...</h4>
            <p className="text-sm text-slate-500 mt-1">Quá trình này có thể mất vài giây tùy thuộc vào dung lượng file.</p>
          </div>
        )}

        {/* Global Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3 text-rose-800"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">
              <h5 className="font-bold text-rose-900">Đã xảy ra lỗi</h5>
              <p className="text-sm mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* Global Success message */}
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start space-x-3 text-emerald-800"
          >
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 text-sm font-medium">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* Main Application Interface */}
        {dataset && (
          <div className="space-y-6">

            {/* File Info Bar & ZIP XML Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-red-50 rounded-xl text-red-500">
                  {zipInstance ? <FileArchive className="w-6 h-6" /> : <FileCode className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 break-all">{file?.name}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-medium shrink-0">
                      {(file ? file.size / 1024 / 1024 : 0).toFixed(2)} MB
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kiểu CVAT: <strong className="text-slate-700">{dataset.type === 'images' ? 'Bộ sưu tập ảnh (Images)' : 'Chuỗi khung hình video (Tracks)'}</strong>
                    {dataset.taskName && <> | Tên nhiệm vụ: <strong className="text-slate-700">{dataset.taskName}</strong></>}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 self-end md:self-auto">
                {/* XML file selector if inside ZIP */}
                {zipInstance && xmlFilesInZip.length > 1 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-500 shrink-0">Chọn file XML:</span>
                    <select
                      value={selectedXmlPath}
                      onChange={(e) => handleXmlPathChange(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                    >
                      {xmlFilesInZip.map(path => (
                        <option key={path} value={path}>
                          {path.length > 40 ? '...' + path.slice(-37) : path}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={resetState}
                  className="inline-flex items-center space-x-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Đóng file</span>
                </button>
              </div>
            </div>

            {/* Global Config: Frame Range & Exclude */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center space-x-2 text-slate-800 pb-3 border-b border-slate-100">
                <Settings className="w-5 h-5 text-slate-500" />
                <h3 className="font-bold">Cấu hình Kiểm tra & Loại trừ Box</h3>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* Frame Range Filter */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">1. Lọc theo vùng Frame (Giới hạn: {frameRange.min} - {frameRange.max})</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="number"
                        min={frameRange.min}
                        max={frameRange.max}
                        placeholder={`Start: ${frameRange.min}`}
                        value={frameRangeStart}
                        onChange={(e) => setFrameRangeStart(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all font-mono"
                      />
                    </div>
                    <span className="text-slate-400 font-black">→</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        min={frameRange.min}
                        max={frameRange.max}
                        placeholder={`End: ${frameRange.max}`}
                        value={frameRangeEnd}
                        onChange={(e) => setFrameRangeEnd(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all font-mono"
                      />
                    </div>
                    {(frameRangeStart !== '' || frameRangeEnd !== '') && (
                      <button
                        onClick={() => { setFrameRangeStart(''); setFrameRangeEnd(''); }}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Xóa bộ lọc vùng frame"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Exclude Labels Config */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">2. Các Nhãn loại trừ khỏi tổng số đếm</span>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap gap-2 items-center min-h-[46px]">
                    {excludeLabels.map(lbl => (
                      <span key={lbl} className="inline-flex items-center space-x-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                        <span>{lbl}</span>
                        <button onClick={() => saveExcludeLabels(excludeLabels.filter(x => x !== lbl))} className="hover:text-red-900"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                    <div className="flex-1 flex min-w-[150px]">
                      <input
                        type="text"
                        placeholder="Nhập tên nhãn (Vd: _corrupt) và Enter..."
                        value={newExcludeLabel}
                        onChange={e => setNewExcludeLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newExcludeLabel.trim()) {
                            if (!excludeLabels.includes(newExcludeLabel.trim())) {
                              saveExcludeLabels([...excludeLabels, newExcludeLabel.trim()]);
                            }
                            setNewExcludeLabel('');
                          }
                        }}
                        className="w-full bg-transparent border-none text-sm font-medium focus:ring-0 p-0 text-slate-700 placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">

              <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 shadow-xs border-l-4 border-l-blue-500 flex flex-col justify-center">
                <span className="text-xs font-bold text-blue-700 block uppercase tracking-wider">First ID</span>
                <div className="mt-1">
                  <span className="text-2xl font-black text-blue-700 font-mono">{stats.firstBoxId}</span>
                </div>
              </div>

              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 shadow-xs border-l-4 border-l-amber-500 flex flex-col justify-center">
                <span className="text-xs font-bold text-amber-700 block uppercase tracking-wider">Last ID</span>
                <div className="mt-1">
                  <span className="text-2xl font-black text-amber-700 font-mono">{stats.lastBoxId}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs border-l-4 border-l-red-500 flex flex-col justify-center">
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Box Bị Loại Trừ</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-2xl font-black text-red-600">{stats.excludeCount}</span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap leading-none">(Exclude)</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-center">
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Box Trùng Lặp</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-2xl font-black text-rose-500">{stats.totalDuplicates}</span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap leading-none">(Duplicate)</span>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-xs border-l-4 border-l-emerald-500 flex flex-col justify-center">
                <span className="text-xs font-bold text-emerald-700 block uppercase tracking-wider">Tổng Số Box</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-2xl font-black text-emerald-600">{stats.finalCount}</span>
                  <span className="text-[9px] text-emerald-600 font-bold whitespace-nowrap leading-none">(Total Box)</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-center">
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Tổng số Frame</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-2xl font-black text-slate-900">{stats.totalFrames}</span>
                  <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap leading-none">frames</span>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl p-4 shadow-xs text-white flex flex-col justify-center">
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Frame Skip</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-2xl font-black text-red-400">{stats.framesWithSkipCount}</span>
                  <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap leading-none">(Passed Frame)</span>
                </div>
              </div>
            </div>

            {/* Config & Audit Tool Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center space-x-2 text-slate-800 pb-3 border-b border-slate-100">
                <Settings className="w-5 h-5 text-slate-500" />
                <h3 className="font-bold">Cấu hình quét trùng lặp</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Match Mode Selector */}
                <div className="lg:col-span-4 space-y-3">
                  <span className="text-xs font-bold text-slate-500 block">TIÊU CHÍ SO KHỚP TỌA ĐỘ</span>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setSettings({ ...settings, useIoU: true })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${settings.useIoU
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      Chỉ số IoU (Mức chồng đè)
                    </button>
                    <button
                      onClick={() => setSettings({ ...settings, useIoU: false })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${!settings.useIoU
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      Sai lệch pixel (Cạnh trùng)
                    </button>
                  </div>
                </div>

                {/* Sliders for tolerance */}
                <div className="lg:col-span-5 space-y-3">
                  {!settings.useIoU ? (
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-slate-500">
                          MỨC SAI LỆCH TOẠ ĐỘ CHO PHÉP (PIXEL)
                        </span>
                        <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                          {settings.tolerancePx === 0 ? '0.0 px (Trùng khớp 100%)' : `${settings.tolerancePx.toFixed(1)} px`}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-slate-400">Khớp Tuyệt Đối</span>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={settings.tolerancePx}
                          onChange={(e) => setSettings({ ...settings, tolerancePx: parseFloat(e.target.value) })}
                          className="flex-1 accent-red-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-400">Sai lệch 10px</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-slate-500">
                          HỆ SỐ TRÙNG NHAU TỐI THIỂU (IoU)
                        </span>
                        <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                          {settings.overlapThreshold}% trùng nhau
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-slate-400">50% Overlap</span>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          step="1"
                          value={settings.overlapThreshold}
                          onChange={(e) => setSettings({ ...settings, overlapThreshold: parseInt(e.target.value, 10) })}
                          className="flex-1 accent-red-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-400">100% </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Match Label Option */}
                <div className="lg:col-span-3 pt-4 lg:pt-1 space-y-2">
                  <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Cài đặt nhãn</span>
                  <label className="flex items-center space-x-3 cursor-pointer group bg-slate-50 p-2.5 rounded-xl border border-slate-150 hover:bg-slate-100/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.matchLabelOnly}
                      onChange={(e) => setSettings({ ...settings, matchLabelOnly: e.target.checked })}
                      className="w-4.5 h-4.5 accent-red-500 cursor-pointer rounded-sm"
                    />
                    <div className="text-xs font-semibold text-slate-700">
                      Chỉ tính trùng khi cùng Nhãn (Label)
                      <span className="block font-normal text-slate-400 text-[10px] mt-0.5">
                        {settings.matchLabelOnly ? 'Cùng toạ độ & cùng nhãn' : 'Trùng toạ độ kể cả khác nhãn'}
                      </span>
                    </div>
                  </label>
                </div>

              </div>
            </div>

            {/* Layout Workspaces: Left List vs Right Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

              {/* Left Column: Duplicate Groups Directory */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col min-h-[600px]">

                {/* Search and Filters Header */}
                <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                      <span>Danh sách trùng lặp ({filteredDuplicateGroups.length})</span>
                      {filteredDuplicateGroups.length !== duplicateGroups.length && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-normal">
                          Lọc từ {duplicateGroups.length}
                        </span>
                      )}
                    </h3>
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên ảnh hoặc ID frame..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Labels filter badges */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 tracking-wider">
                      <span>LỌC THEO NHÃN (LABELS)</span>
                      <button onClick={handleSelectAllLabels} className="text-red-500 hover:text-red-600 transition-colors">
                        Chọn tất cả
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto pr-1">
                      {dataset.labels.map(label => {
                        const isSelected = selectedLabels.includes(label);
                        const countInDuplicates = duplicateGroups.filter(g => g.boxes.some(b => b.label === label)).length;

                        if (countInDuplicates === 0) return null; // Only show labels that actually have duplicates

                        return (
                          <button
                            key={label}
                            onClick={() => handleLabelToggle(label)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center space-x-1 border transition-all ${isSelected
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                              }`}
                          >
                            <span>{label}</span>
                            <span className={`rounded-full px-1 py-0.2 text-[8px] ${isSelected ? 'bg-red-200/55' : 'bg-slate-200 text-slate-500'}`}>
                              {countInDuplicates}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
                  <AnimatePresence mode="popLayout">
                    {paginatedGroups.length > 0 ? (
                      paginatedGroups.map((group, index) => {
                        const isSelected = selectedGroupId === group.id;
                        const absoluteIndex = (currentPage - 1) * itemsPerPage + index + 1;

                        return (
                          <motion.div
                            key={group.id}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -5 }}
                            onClick={() => setSelectedGroupId(group.id)}
                            className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${isSelected
                              ? 'bg-red-50/50 border-l-4 border-l-red-500'
                              : 'hover:bg-slate-50/60'
                              }`}
                          >
                            <div className="min-w-0 pr-3">
                              {/* Tiêu đề chính: Frame ID to rõ */}
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] font-bold text-slate-400 font-mono">
                                  #{absoluteIndex}
                                </span>
                                <span className="text-sm font-extrabold text-slate-900">
                                  Frame {group.frameId}
                                </span>
                                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                                  {group.boxes.length} box trùng
                                </span>
                              </div>

                              {/* Tên ảnh phụ + IoU + nhãn */}
                              <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1">
                                <span className="text-[11px] text-slate-500 truncate max-w-[200px]" title={group.frameName}>
                                  📁 {group.frameName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  IoU: {group.overlapPercentage}%
                                </span>
                                <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                  {Array.from(new Set(group.boxes.map(b => b.label))).join(', ')}
                                </span>
                              </div>

                              {/* Chi tiết toạ độ box */}
                              <div className="mt-1.5 space-y-0.5">
                                {group.boxes.some(b => b.trackId) && (
                                  <span className="text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded inline-block mb-0.5">
                                    Tracks: {Array.from(new Set(group.boxes.filter(b => b.trackId).map(b => b.trackId))).join(', ')}
                                  </span>
                                )}
                                <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                                  {group.boxes.slice(0, 2).map((box, bIdx) => (
                                    <span key={box.id} className="block truncate">
                                      <span className={bIdx === 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                                        {bIdx === 0 ? '✓ giữ' : '✗ xoá'}
                                      </span>
                                      {' '}{box.label}: [{box.xtl.toFixed(1)}, {box.ytl.toFixed(1)}, {box.xbr.toFixed(1)}, {box.ybr.toFixed(1)}]
                                    </span>
                                  ))}
                                  {group.boxes.length > 2 && (
                                    <span className="text-slate-400 font-semibold">...+{group.boxes.length - 2} box khác</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isSelected ? 'translate-x-1 text-red-500' : ''
                              }`} />
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="py-20 text-center flex flex-col items-center justify-center p-6 text-slate-400">
                        <FileCheck className="w-12 h-12 text-slate-300 mb-3" />
                        <h4 className="font-bold text-sm text-slate-700">Không tìm thấy trùng lặp nào</h4>
                        <p className="text-xs text-slate-400 max-w-xs mt-1">
                          {duplicateGroups.length > 0
                            ? 'Không có kết quả khớp với bộ lọc tìm kiếm và nhãn của bạn.'
                            : 'Không có lỗi trùng lặp nào được phát hiện trong file dữ liệu này!'
                          }
                        </p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pagination footer */}
                {totalPages > 1 && (
                  <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 rounded-b-3xl">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="text-[11px] font-bold text-slate-500 font-mono">
                      Trang {currentPage} / {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Visual Inspector & Comparison table */}
              <div className="lg:col-span-7 flex flex-col min-h-[600px] gap-6">

                {/* SVG Visual Canvas Box */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col flex-1 overflow-hidden">

                  {/* Canvas header controls */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4.5 h-4.5 text-slate-500" />
                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                        {selectedFrameData
                          ? `Trực quan hoá: ${selectedFrameData.name}`
                          : 'Bộ Trực Quan Hộp Bounding Box'
                        }
                      </h3>
                    </div>

                    {selectedFrameData && (
                      <div className="flex items-center space-x-2">
                        {/* Image opacity control if image is loaded */}
                        {currentImageSrc && (
                          <div className="flex items-center space-x-1.5 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 mr-1">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                            <input
                              type="range"
                              min="0.1"
                              max="1.0"
                              step="0.05"
                              value={imageOpacity}
                              onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
                              className="w-12 sm:w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                              title="Điều chỉnh độ sáng/độ mờ của ảnh nền"
                            />
                            <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 w-7 text-right">
                              {Math.round(imageOpacity * 100)}%
                            </span>
                          </div>
                        )}

                        {/* Show Grid toggle */}
                        <button
                          onClick={() => setShowGrid(!showGrid)}
                          className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1.5 ${showGrid
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                          title="Bật/Tắt lưới toạ độ nền"
                        >
                          <Grid className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Lưới tọa độ</span>
                        </button>

                        {/* Zoom to duplicates toggle with dynamic padding slider */}
                        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                          <button
                            onClick={() => setZoomToDuplicates(!zoomToDuplicates)}
                            className={`p-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1 ${zoomToDuplicates
                              ? 'bg-white text-red-700 shadow-2xs border border-slate-200'
                              : 'text-slate-500 hover:text-slate-800'
                              }`}
                            title="Bật/Tắt tự động thu phóng cận cảnh vào đối tượng"
                          >
                            {zoomToDuplicates ? <Minimize2 className="w-3.5 h-3.5 text-red-500" /> : <Maximize2 className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">Zoom Cận Cảnh</span>
                          </button>
                          {zoomToDuplicates && (
                            <div className="flex items-center space-x-1 pl-1.5 border-l border-slate-200">
                              <input
                                type="range"
                                min="10"
                                max="400"
                                step="5"
                                value={customZoomPadding}
                                onChange={(e) => setCustomZoomPadding(parseInt(e.target.value, 10))}
                                className="w-12 sm:w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                                title="Kéo về trái để zoom siêu gần sát đối tượng nhỏ (giảm khoảng đệm)"
                              />
                              <span className="text-[9px] sm:text-[10px] font-mono font-semibold text-slate-600 w-11 text-right" title="Khoảng cách lề bao quanh đối tượng (px). Càng nhỏ thì zoom càng cận!">
                                ±{customZoomPadding}px
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SVG drawing viewport */}
                  <div className="flex-1 bg-slate-950 relative flex items-center justify-center p-4 min-h-[300px]">
                    {selectedFrameData && selectedGroup ? (
                      <div className="w-full h-full flex flex-col justify-between items-center absolute inset-0 p-4">

                        {/* Coordinate indicator */}
                        <div className="self-start flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800 backdrop-blur-xs z-10">
                          <span>Kích thước: {selectedFrameData.width} × {selectedFrameData.height} px</span>
                          <span className="text-slate-600">|</span>
                          {currentImageSrc ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-sans font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Đã tải ảnh thực tế từ ZIP
                            </span>
                          ) : zipInstance ? (
                            <span className="text-amber-400 font-sans font-medium">Không tìm thấy ảnh {selectedFrameData.name.split('/').pop()} trong ZIP</span>
                          ) : (
                            <span className="text-slate-500 font-sans">Chỉ có file XML (Vẽ mô phỏng)</span>
                          )}
                        </div>

                        {/* Responsive SVG Container */}
                        <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
                          {imageLoading && (
                            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center z-20">
                              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-2" />
                              <p className="text-xs text-slate-300 font-bold font-sans">Đang giải nén ảnh...</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-mono truncate max-w-xs">{selectedFrameData.name}</p>
                            </div>
                          )}

                          <svg
                            viewBox={zoomToDuplicates ? getZoomViewBox() : `0 0 ${selectedFrameData.width} ${selectedFrameData.height}`}
                            className="w-full h-full max-h-[600px] lg:max-h-[800px] border border-slate-800 shadow-2xl transition-all duration-300"
                          >
                            {/* SVG Grid pattern */}
                            {showGrid && (
                              <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                                </pattern>
                                <pattern id="grid-major" width="200" height="200" patternUnits="userSpaceOnUse">
                                  <rect width="200" height="200" fill="url(#grid)" />
                                  <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                                </pattern>
                              </defs>
                            )}

                            {/* Background drawing (Image or solid dark color) */}
                            {currentImageSrc ? (
                              <image
                                href={currentImageSrc}
                                width={selectedFrameData.width}
                                height={selectedFrameData.height}
                                opacity={imageOpacity}
                                preserveAspectRatio="none"
                              />
                            ) : (
                              <rect
                                width={selectedFrameData.width}
                                height={selectedFrameData.height}
                                fill="#090d16"
                              />
                            )}

                            {/* Grid overlay */}
                            {showGrid && (
                              <rect
                                width={selectedFrameData.width}
                                height={selectedFrameData.height}
                                fill="url(#grid-major)"
                              />
                            )}

                            {/* DRAW ALL OTHER BOXES on this frame (Non-duplicates) */}
                            {selectedFrameData.boxes
                              .filter(b => !selectedGroup.boxes.some(gb => gb.id === b.id))
                              .map(box => (
                                <g key={box.id} className="opacity-30">
                                  <rect
                                    x={box.xtl}
                                    y={box.ytl}
                                    width={box.xbr - box.xtl}
                                    height={box.ybr - box.ytl}
                                    fill="none"
                                    stroke="#475569"
                                    strokeWidth="1.5"
                                    strokeDasharray="4,4"
                                  />
                                  <text
                                    x={box.xtl + 4}
                                    y={box.ytl + 12}
                                    fill="#94a3b8"
                                    fontSize="10"
                                    fontWeight="bold"
                                    fontFamily="monospace"
                                  >
                                    {box.label}
                                  </text>
                                </g>
                              ))}

                            {/* DRAW THE DUPLICATE BOX GROUP (High contrast highlighted) */}
                            {selectedGroup.boxes.map((box, idx) => {
                              const isFirst = idx === 0;
                              const isHovered = hoveredBoxId === box.id;

                              // Highlight duplicate group only; app no longer marks keep/delete boxes.
                              const color = '#38bdf8';
                              const strokeWidth = isHovered ? '4' : '2.5';

                              return (
                                <g
                                  key={box.id}
                                  className="cursor-pointer transition-all"
                                  onMouseEnter={() => setHoveredBoxId(box.id)}
                                  onMouseLeave={() => setHoveredBoxId(null)}
                                >
                                  {/* Bounding box rect */}
                                  <rect
                                    x={box.xtl}
                                    y={box.ytl}
                                    width={box.xbr - box.xtl}
                                    height={box.ybr - box.ytl}
                                    fill="rgba(56,189,248,0.06)"
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    style={{ transition: 'stroke-width 0.15s ease' }}
                                  />

                                  {/* Small label badge at top-left of box */}
                                  <rect
                                    x={box.xtl}
                                    y={box.ytl - (isFirst ? 18 : 34)}
                                    width={Math.max((box.label.length * 7) + 30, 95)}
                                    height="16"
                                    fill={color}
                                    rx="2"
                                  />

                                  <text
                                    x={box.xtl + 5}
                                    y={box.ytl - (isFirst ? 6 : 22)}
                                    fill="#ffffff"
                                    fontSize="9.5"
                                    fontWeight="black"
                                    fontFamily="sans-serif"
                                  >
                                    {box.label}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Visual label note */}
                        <div className="self-center flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 px-4 py-1.5 rounded-full border border-slate-800 backdrop-blur-xs z-10">
                          <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-xs bg-sky-400 mr-1.5"></span>Label hiển thị trên box</span>
                        </div>

                      </div>
                    ) : (
                      <div className="text-center p-10 flex flex-col items-center justify-center max-w-sm text-slate-500">
                        <Layers className="w-16 h-16 text-slate-800 mb-4 animate-pulse" />
                        <h4 className="font-bold text-sm text-slate-300">Chọn một tệp trùng lặp bên trái</h4>
                        <p className="text-xs text-slate-500 mt-2">
                          Nhấp chọn bất kỳ cặp trùng lặp nào trong danh mục bên trái để soi tọa độ cận cảnh trực quan.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phần bảng chi tiết đã được xoá theo yêu cầu để nhường không gian cho Canvas SVG */}

              </div>
            </div>

          </div>
        )}

      </main>

      {/* App Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p>© 2026 CVAT Duplicate Bounding Box Auditor — Giải pháp tối ưu hóa dữ liệu ML.</p>
          <p className="font-mono text-[10px] text-slate-300">Built using React 19 + TypeScript + JSZip + Tailwind CSS</p>
        </div>
      </footer>
    </div>
  );
}
