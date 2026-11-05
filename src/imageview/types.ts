export interface ViewerImage {
  id: string;
  key: string;
  name: string;
  frameId?: number;
  width: number;
  height: number;
}

export interface ViewerAnnotation {
  id: string | number;
  width: number;
  height: number;
  boxes: { label: string; xtl: number; ytl: number; xbr: number; ybr: number }[];
}

export interface ViewerSource {
  title: string;
  images: ViewerImage[];
  annotations: { labels: Record<string, string>; images: Record<string, ViewerAnnotation>; jobId?: number };
  warning?: string;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  getImage(key: string, options: { signal: AbortSignal; priority: boolean }): Promise<Blob>;
  dispose(): void;
}

export interface ViewerHandle { dispose(): void }
