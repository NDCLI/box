import { useState, useEffect } from 'react';
import { BlobWriter, Entry } from '@zip.js/zip.js';
import type { CVATFrameData } from '../types';
import { loadCvatFrameImage, type CvatConnection } from '../utils/cvatApi';

export interface CvatFrameSource {
  connection: CvatConnection;
  taskId: number;
  jobId?: number;
}

export interface UseFrameImageArgs {
  selectedFrameData: CVATFrameData | null;
  zipEntries: Entry[] | null;
  manualImages: Record<string, string>;
  cvatFrameSource: CvatFrameSource | null;
}

export interface UseFrameImageReturn {
  currentImageSrc: string | null;
  imageLoading: boolean;
  imageError: string | null;
  imageDimensions: { width: number; height: number } | null;
}

async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    return null;
  }
}

/**
 * Find an image entry in a ZIP archive by matching frame name.
 */
function findImageInZip(entries: Entry[], frameName: string): string | null {
  const targetBaseName = frameName.split('/').pop()?.toLowerCase();
  if (!targetBaseName) return null;

  let matchedPath: string | null = null;
  entries.forEach((entry) => {
    const relativePath = entry.filename;
    if (entry.directory) return;

    const ext = relativePath.split('.').pop()?.toLowerCase();
    if (ext && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff'].includes(ext)) {
      const currentBaseName = relativePath.split('/').pop()?.toLowerCase();
      if (
        currentBaseName === targetBaseName ||
        relativePath.toLowerCase() === frameName.toLowerCase()
      ) {
        matchedPath = relativePath;
      }
    }
  });
  return matchedPath;
}

export function useFrameImage({
  selectedFrameData,
  zipEntries,
  manualImages,
  cvatFrameSource,
}: UseFrameImageArgs): UseFrameImageReturn {
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Effect to load frame image from ZIP or manual map when active frame changes
  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    const loadFrameImage = async () => {
      if (!selectedFrameData) {
        setCurrentImageSrc(null);
        setImageError(null);
        setImageDimensions(null);
        return;
      }

      setImageError(null);
      setImageDimensions(null);

      // 1. Check if we have a manual image uploaded for this frame
      if (manualImages[selectedFrameData.name]) {
        setCurrentImageSrc(manualImages[selectedFrameData.name]);
        setImageLoading(false);
        return;
      }

      // 2. Otherwise try loading from CVAT
      if (cvatFrameSource) {
        setImageLoading(true);
        try {
          const blob = await loadCvatFrameImage(cvatFrameSource.connection, cvatFrameSource.taskId, selectedFrameData.id, cvatFrameSource.jobId);
          if (active) {
            localUrl = URL.createObjectURL(blob);
            setImageDimensions(await getImageDimensions(blob));
            setCurrentImageSrc(localUrl);
          }
        } catch (err) {
          console.error('Lỗi khi tải ảnh Frame từ CVAT:', err);
          if (active) {
            setCurrentImageSrc(null);
            setImageError(err instanceof Error ? err.message : 'Không thể tải ảnh từ CVAT.');
          }
        } finally {
          if (active) setImageLoading(false);
        }
        return;
      }

      // 3. Otherwise try loading from ZIP
      if (!zipEntries) {
        setCurrentImageSrc(null);
        return;
      }

      setImageLoading(true);
      try {
        const imgPath = findImageInZip(zipEntries, selectedFrameData.name);
        if (imgPath) {
          const entry = zipEntries.find(e => e.filename === imgPath);
          if (entry && (entry as any).getData) {
            const blob = await (entry as any).getData(new BlobWriter());
            if (active) {
              localUrl = URL.createObjectURL(blob);
              setImageDimensions(await getImageDimensions(blob));
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
  }, [selectedFrameData, zipEntries, manualImages, cvatFrameSource]);

  return { currentImageSrc, imageLoading, imageError, imageDimensions };
}
