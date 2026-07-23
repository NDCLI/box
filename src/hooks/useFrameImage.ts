import { useState, useEffect } from 'react';
import { BlobWriter, Entry } from '@zip.js/zip.js';
import type { CVATFrameData } from '../types';

export interface UseFrameImageArgs {
  selectedFrameData: CVATFrameData | null;
  zipEntries: Entry[] | null;
  manualImages: Record<string, string>;
}

export interface UseFrameImageReturn {
  currentImageSrc: string | null;
  imageLoading: boolean;
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
}: UseFrameImageArgs): UseFrameImageReturn {
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Effect to load frame image from ZIP or manual map when active frame changes
  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    const loadFrameImage = async () => {
      if (!selectedFrameData) {
        setCurrentImageSrc(null);
        return;
      }

      // 1. Check if we have a manual image uploaded for this frame
      if (manualImages[selectedFrameData.name]) {
        setCurrentImageSrc(manualImages[selectedFrameData.name]);
        setImageLoading(false);
        return;
      }

      // 2. Otherwise try loading from ZIP
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
  }, [selectedFrameData, zipEntries, manualImages]);

  return { currentImageSrc, imageLoading };
}
