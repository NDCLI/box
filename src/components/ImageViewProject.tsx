import { useEffect, useRef, useState } from 'react';
import type { ViewerHandle, ViewerSource } from '../imageview/types';
import { translate, useLocale } from '../i18n/LocaleProvider';

function Viewer({ source }: { source: ViewerSource }) {
  const { locale } = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let viewer: ViewerHandle | undefined;
    void import('../imageview/solid/entry.jsx').then(({ mountViewer }) => {
      if (!disposed && host.current) viewer = mountViewer(host.current, source, (text: string) => translate(text, locale));
    }).catch(error => setError(error.message));
    return () => { disposed = true; viewer?.dispose(); };
  }, [source, locale]);
  return <>{error && <p role="alert">{error}</p>}<div ref={host} className="imageview-host" data-testid="imageview-host" /></>;
}

export default function ImageViewProject({ createSource }: { createSource: () => Promise<ViewerSource> }) {
  const { locale } = useLocale();
  const [source, setSource] = useState<ViewerSource | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let current: ViewerSource | undefined;
    setSource(null); setError('');
    void createSource().then(next => {
      if (disposed) { next.dispose(); return; }
      current = next;
      if (!next.images.length) { setError(locale === 'vi' ? 'Nguồn dữ liệu không có ảnh.' : 'No images in this data source.'); return; }
      setSource(next);
    }).catch(error => { if (!disposed) setError(error instanceof Error ? error.message : String(error)); });
    return () => { disposed = true; current?.dispose(); };
  }, [createSource]);
  return <section className="imageview-project" aria-label="ImageView">
    {error && <p role="alert" className="text-amber-400">{error}</p>}
    {source?.warning && <p className="text-amber-400 text-sm">{source.warning}</p>}
    {source ? <Viewer source={source} /> : !error && <p role="status">{locale === 'vi' ? 'Đang chuẩn bị ảnh từ nguồn dữ liệu chung…' : 'Preparing images from the shared data source…'}</p>}
  </section>;
}
