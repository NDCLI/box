import { useState, useEffect, useRef, useCallback } from 'react';
import { ZipReader, BlobReader, TextWriter, Entry } from '@zip.js/zip.js';
import { parseCVATXML } from '../utils/parser';
import type { CVATDataset } from '../types';

export interface UseFileProcessorOptions {
  onDatasetParsed?: (dataset: CVATDataset) => void;
}

export interface UseFileProcessorReturn {
  // File upload state
  file: File | null;
  isDragging: boolean;
  isLoading: boolean;
  error: string | null;
  successMsg: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setSuccessMsg: React.Dispatch<React.SetStateAction<string | null>>;

  // ZIP state
  zipEntries: Entry[] | null;
  xmlFilesInZip: string[];
  selectedXmlPath: string;

  // Parsed data
  xmlContent: string;
  xmlFilename: string;
  dataset: CVATDataset | null;

  // Ref
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Handlers
  handleUploadClick: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent) => Promise<void>;
  handleXmlPathChange: (path: string) => Promise<void>;
  resetState: () => void;
}

export function useFileProcessor(
  options?: UseFileProcessorOptions
): UseFileProcessorReturn {
  const { onDatasetParsed } = options ?? {};

  // Keep a stable ref to the callback so it never triggers re-runs of the
  // XML-parsing useEffect (the caller typically creates an inline closure that
  // captures hook return values, so its identity changes every render).
  const onDatasetParsedRef = useRef(onDatasetParsed);
  onDatasetParsedRef.current = onDatasetParsed;

  // File uploading states
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ZIP specific states
  const [zipEntries, setZipEntries] = useState<Entry[] | null>(null);
  const [xmlFilesInZip, setXmlFilesInZip] = useState<string[]>([]);
  const [selectedXmlPath, setSelectedXmlPath] = useState<string>('');

  // CVAT Dataset states
  const [xmlContent, setXmlContent] = useState<string>('');
  const [xmlFilename, setXmlFilename] = useState<string>('');
  const [dataset, setDataset] = useState<CVATDataset | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger file browser
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Reset all state
  const resetState = useCallback(() => {
    setFile(null);
    setError(null);
    setSuccessMsg(null);
    setZipEntries(null);
    setXmlFilesInZip([]);
    setSelectedXmlPath('');
    setXmlContent('');
    setXmlFilename('');
    setDataset(null);
  }, []);

  // Main file processor
  const processUploadedFiles = useCallback(async (files: FileList | File[]) => {
    resetState();
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsLoading(true);

    try {
      // Handle single file upload
      const uploadedFile = fileArray[0];
      setFile(uploadedFile);

      const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
      if (extension === 'zip') {
        let entries: Entry[] = [];
        try {
          const zipFileReader = new BlobReader(uploadedFile);
          const zipReader = new ZipReader(zipFileReader);
          entries = await zipReader.getEntries();
          setZipEntries(entries);
        } catch (zipErr: any) {
          console.error("Lỗi nạp tệp ZIP:", zipErr);
          const errorMsg = zipErr.message || String(zipErr);
          throw new Error(
            `Không thể đọc tệp ZIP (Lỗi: ${errorMsg}).\n` +
            `💡 Mẹo: Tệp tin ZIP có thể bị hỏng.`
          );
        }

        const xmlPaths: string[] = [];
        entries.forEach((entry) => {
          const relativePath = entry.filename;
          if (relativePath.toLowerCase().endsWith('.xml') && !relativePath.startsWith('__MACOSX/')) {
            xmlPaths.push(relativePath);
          }
        });

        if (xmlPaths.length === 0) {
          throw new Error('Không tìm thấy tệp tin XML nào trong tệp ZIP đã tải lên.');
        }

        setXmlFilesInZip(xmlPaths);
        const defaultXml = xmlPaths.find(p => p.toLowerCase().includes('annotation')) || xmlPaths[0];
        setSelectedXmlPath(defaultXml);

        const xmlEntry = entries.find(e => e.filename === defaultXml);
        if (xmlEntry && (xmlEntry as any).getData) {
          const content = await (xmlEntry as any).getData(new TextWriter());
          setXmlContent(content);
          setXmlFilename(defaultXml.split('/').pop() || defaultXml);
        } else {
          throw new Error('Không thể đọc file XML trong ZIP.');
        }

      } else if (extension === 'xml') {
        try {
          const content = await uploadedFile.text();
          setXmlContent(content);
          setXmlFilename(uploadedFile.name);
        } catch (_err) {
          throw new Error('Không thể đọc tệp XML này.');
        }
      } else {
        throw new Error('Định dạng tệp không được hỗ trợ. Vui lòng tải lên tệp .XML hoặc .ZIP.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi không xác định khi tải tệp lên.');
    } finally {
      setIsLoading(false);
    }
  }, [resetState]);

  // Handle file select
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedFiles(e.target.files);
    }
    // reset input so the same file/folder can be selected again
    e.target.value = '';
  }, [processUploadedFiles]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(e.dataTransfer.files);
    }
  }, [processUploadedFiles]);

  // Handle changing selected XML from ZIP
  const handleXmlPathChange = useCallback(async (path: string) => {
    if (!zipEntries) return;
    try {
      setIsLoading(true);
      setSelectedXmlPath(path);

      const xmlEntry = zipEntries.find(e => e.filename === path);
      if (xmlEntry && (xmlEntry as any).getData) {
        const content = await (xmlEntry as any).getData(new TextWriter());
        setXmlContent(content);
        setXmlFilename(path.split('/').pop() || path);
      } else {
        throw new Error('Không thể đọc file XML trong ZIP.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải file XML.');
    } finally {
      setIsLoading(false);
    }
  }, [zipEntries]);

  // Parse XML when content changes
  useEffect(() => {
    if (!xmlContent) return;

    try {
      const parsed = parseCVATXML(xmlContent, xmlFilename);
      setDataset(parsed);
      onDatasetParsedRef.current?.(parsed);
    } catch (err: any) {
      setError('Lỗi khi phân tích XML: ' + err.message);
    }
  }, [xmlContent, xmlFilename]);

  return {
    file,
    isDragging,
    isLoading,
    error,
    successMsg,
    setError,
    setSuccessMsg,
    zipEntries,
    xmlFilesInZip,
    selectedXmlPath,
    xmlContent,
    xmlFilename,
    dataset,
    fileInputRef,
    handleUploadClick,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleXmlPathChange,
    resetState,
  };
}
