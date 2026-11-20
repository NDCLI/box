import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ViewerHandle, ViewerSource } from '../imageview/types';
import { translate, useLocale } from '../i18n/LocaleProvider';

function Viewer({ source }: { source: ViewerSource }) {
  const { locale } = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let viewer: ViewerHandle | undefined;
    void import('../imageview/solid/entry.jsx')
      .then(({ mountViewer }) => {
        if (!disposed && host.current) viewer = mountViewer(host.current, source, (text: string) => translate(text, locale));
      })
      .catch((err) => setError(err.message));
    return () => { disposed = true; viewer?.dispose(); };
  }, [source, locale]);
  return (
    <>
      {error && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-3 py-2 text-xs text-[var(--status-danger-text)]"
        >
          {error}
        </p>
      )}
      <div ref={host} className="imageview-host" data-testid="imageview-host" />
    </>
  );
}

export default function ImageViewProject({ createSource }: { createSource: () => Promise<ViewerSource> }) {
  const { locale } = useLocale();
  const [source, setSource] = useState<ViewerSource | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    let current: ViewerSource | undefined;
    setSource(null);
    setError('');
    void createSource()
      .then((next) => {
        if (disposed) { next.dispose(); return; }
        current = next;
        if (!next.images.length) {
          setError(locale === 'vi' ? 'Nguồn dữ liệu không có ảnh.' : 'No images in this data source.');
          return;
        }
        setSource(next);
      })
      .catch((err) => {
        if (!disposed) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { disposed = true; current?.dispose(); };
  }, [createSource]);

  return (
    <section className="imageview-project" aria-label="ImageView">
      {error && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-subtle)] px-3 py-2 text-xs font-medium text-[var(--status-warning-text)]"
        >
          {error}
        </p>
      )}
      {source?.warning && (
        <p className="mb-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-subtle)] px-3 py-1.5 text-xs text-[var(--status-warning-text)]">
          {source.warning}
        </p>
      )}
      {source ? (
        <Viewer source={source} />
      ) : (
        !error && (
          <div
            role="status"
            className="dt-panel flex flex-1 items-center justify-center gap-2 text-xs text-[var(--text-secondary)]"
          >
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-primary)]" />
            <span>
              {locale === 'vi' ? 'Đang chuẩn bị ảnh từ nguồn dữ liệu chung…' : 'Preparing images from the shared data source…'}
            </span>
          </div>
        )
      )}
    </section>
  );
}
