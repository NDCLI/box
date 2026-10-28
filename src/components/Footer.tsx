import { useEffect, useState } from 'react';
import { useLocale } from '../i18n/LocaleProvider';

function Footer() {
  const { locale } = useLocale();
  const [version, setVersion] = useState('—');

  useEffect(() => {
    void window.cvatDesktop?.getAppInfo?.()
      .then((info) => setVersion(info.version))
      .catch(() => {});
  }, []);

  return (
    <footer className="app-footer bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
        <p>&copy; 2026 CVAT Duplicate Bounding Box Auditor.</p>
        <p className="font-mono text-[10px] text-slate-300">{locale === 'vi' ? 'Phiên bản' : 'Version'} {version}</p>
      </div>
    </footer>
  );
}

export default Footer;
