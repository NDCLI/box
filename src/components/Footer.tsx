import { useEffect, useState } from 'react';
import { useLocale } from '../i18n/LocaleProvider';
import type { CVATDataset } from '../types';

interface FooterProps {
  dataset?: CVATDataset | null;
  totalDuplicates?: number;
}

function Footer({ dataset, totalDuplicates }: FooterProps) {
  const { locale } = useLocale();
  const vi = locale === 'vi';
  const [version, setVersion] = useState('—');

  useEffect(() => {
    void window.cvatDesktop?.getAppInfo?.()
      .then((info) => setVersion(info.version))
      .catch(() => {});
  }, []);

  const totalFrames = dataset?.frames.length ?? 0;
  const totalBoxes = dataset ? dataset.frames.reduce((sum, frame) => sum + frame.boxes.length, 0) : 0;

  return (
    <footer className="app-footer shrink-0 select-none">
      <div className="flex min-w-0 items-center gap-3 truncate">
        {dataset ? (
          <>
            <span className="dt-mono text-[var(--text-secondary)]">
              {totalFrames.toLocaleString()} {vi ? 'frame' : 'frames'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="dt-mono text-[var(--text-secondary)]">
              {totalBoxes.toLocaleString()} {vi ? 'box' : 'boxes'}
            </span>
            {typeof totalDuplicates === 'number' && totalDuplicates > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="dt-mono font-medium text-[var(--status-danger-text)]">
                  {totalDuplicates.toLocaleString()} {vi ? 'trùng lặp' : 'duplicates'}
                </span>
              </>
            )}
          </>
        ) : (
          <span>CVAT Tools · {vi ? 'Kiểm tra annotation nhanh, trực quan và bảo mật' : 'Fast, visual, and secure annotation checks'}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden sm:inline dt-mono text-[10px] text-[var(--text-muted)]">
          Ctrl+B {vi ? 'thanh bên' : 'sidebar'} · Ctrl+1–5 {vi ? 'chuyển tab' : 'switch tools'}
        </span>
        <span className="dt-mono text-[10px] text-[var(--text-secondary)]">
          {vi ? 'Phiên bản' : 'Version'} {version}
        </span>
      </div>
    </footer>
  );
}

export default Footer;
