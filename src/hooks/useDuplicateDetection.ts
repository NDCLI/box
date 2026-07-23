import { useState, useMemo, useEffect } from 'react';
import { detectDuplicates } from '../utils/parser';
import type { CVATDataset, CVATFrameData, DetectionSettings, DuplicateGroup } from '../types';

export interface UseDuplicateDetectionArgs {
  dataset: CVATDataset | null;
  excludeLabels: string[];
}

export interface DuplicateStats {
  totalFrames: number;
  totalBoxes: number;
  totalDuplicates: number;
  affectedFramesCount: number;
  duplicatePercent: number;
  firstBoxId: string;
  lastBoxId: string;
  labelBreakdown: { label: string; count: number }[];
  totalValidBoxes: number;
  excludeCount: number;
  framesWithSkipCount: number;
  finalCount: number;
  frameRange: { min: number; max: number };
}

export interface UseDuplicateDetectionReturn {
  // Settings
  settings: DetectionSettings;
  setSettings: React.Dispatch<React.SetStateAction<DetectionSettings>>;

  // Search & filters
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  selectedLabels: string[];
  setSelectedLabels: React.Dispatch<React.SetStateAction<string[]>>;
  selectedGroupId: string | null;
  setSelectedGroupId: React.Dispatch<React.SetStateAction<string | null>>;

  // Frame range
  frameRangeStart: string;
  setFrameRangeStart: React.Dispatch<React.SetStateAction<string>>;
  frameRangeEnd: string;
  setFrameRangeEnd: React.Dispatch<React.SetStateAction<string>>;

  // Pagination
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  totalPages: number;

  // Computed values
  duplicateGroups: DuplicateGroup[];
  stats: DuplicateStats;
  frameRange: { min: number; max: number };
  baseFilteredGroups: DuplicateGroup[];
  filteredDuplicateGroups: DuplicateGroup[];
  paginatedGroups: DuplicateGroup[];
  selectedGroup: DuplicateGroup | null;
  selectedFrameData: CVATFrameData | null;
}

export function useDuplicateDetection({
  dataset,
  excludeLabels,
}: UseDuplicateDetectionArgs): UseDuplicateDetectionReturn {
  // Settings state
  const [settings, setSettings] = useState<DetectionSettings>({
    matchLabelOnly: true,
    tolerancePx: 0.0,
    overlapThreshold: 100.0,
    useIoU: true,
  });

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Frame range filter
  const [frameRangeStart, setFrameRangeStart] = useState<string>('');
  const [frameRangeEnd, setFrameRangeEnd] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Init frameRangeStart/End from dataset
  useEffect(() => {
    if (dataset && dataset.frames.length > 0) {
      const ids = dataset.frames
        .map((f: { id: string }) => parseInt(f.id, 10))
        .filter((n: number) => !isNaN(n));
      if (ids.length > 0) {
        setFrameRangeStart(String(Math.min(...ids)));
        setFrameRangeEnd(String(Math.max(...ids)));
      }
    }
  }, [dataset]);

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

  // Frame range (min/max) from dataset
  const frameRange = useMemo(() => {
    if (!dataset || dataset.frames.length === 0) return { min: 0, max: 0 };
    const ids = dataset.frames.map(f => parseInt(f.id, 10)).filter(n => !isNaN(n));
    return { min: Math.min(...ids), max: Math.max(...ids) };
  }, [dataset]);

  // Extract statistics
  const stats = useMemo((): DuplicateStats => {
    if (!dataset) {
      return {
        totalFrames: 0,
        totalBoxes: 0,
        totalDuplicates: 0,
        affectedFramesCount: 0,
        duplicatePercent: 0,
        firstBoxId: '—',
        lastBoxId: '—',
        labelBreakdown: [],
        totalValidBoxes: 0,
        excludeCount: 0,
        framesWithSkipCount: 0,
        finalCount: 0,
        frameRange: { min: 0, max: 0 },
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

        const hasPassAttr = b.attributes.some(
          a =>
            a.name.toLowerCase() === 'pass' &&
            ['true', '1', 'yes', 'y', 'on'].includes(a.value.trim().toLowerCase())
        );
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

    const firstBoxId = minBoxId === Infinity ? '—' : String(minBoxId);
    const lastBoxId = maxBoxId === -Infinity ? '—' : String(maxBoxId);

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
      frameRange: { min: minDatasetFrame, max: maxDatasetFrame },
    };
  }, [dataset, duplicateGroups, frameRangeStart, frameRangeEnd, excludeLabels]);

  // Filter duplicate groups based on search term and frame range
  const baseFilteredGroups = useMemo(() => {
    return duplicateGroups.filter(group => {
      // Search matches frame name/id
      const matchesSearch =
        group.frameName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.frameId.toString().includes(searchTerm);

      // Frame range filter
      const frameNum = parseInt(group.frameId, 10);
      const startOk =
        frameRangeStart === '' ||
        isNaN(parseInt(frameRangeStart, 10)) ||
        frameNum >= parseInt(frameRangeStart, 10);
      const endOk =
        frameRangeEnd === '' ||
        isNaN(parseInt(frameRangeEnd, 10)) ||
        frameNum <= parseInt(frameRangeEnd, 10);

      return matchesSearch && startOk && endOk;
    });
  }, [duplicateGroups, searchTerm, frameRangeStart, frameRangeEnd]);

  // Filter by selected labels
  const filteredDuplicateGroups = useMemo(() => {
    if (selectedLabels.length === 0) return baseFilteredGroups;
    return baseFilteredGroups.filter(group =>
      group.boxes.some(box => selectedLabels.includes(box.label))
    );
  }, [baseFilteredGroups, selectedLabels]);

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

  return {
    settings,
    setSettings,
    searchTerm,
    setSearchTerm,
    selectedLabels,
    setSelectedLabels,
    selectedGroupId,
    setSelectedGroupId,
    frameRangeStart,
    setFrameRangeStart,
    frameRangeEnd,
    setFrameRangeEnd,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    totalPages,
    duplicateGroups,
    stats,
    frameRange,
    baseFilteredGroups,
    filteredDuplicateGroups,
    paginatedGroups,
    selectedGroup,
    selectedFrameData,
  };
}
