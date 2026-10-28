const appIconUrl = `${import.meta.env.BASE_URL}app-icon.svg`;
import { useLocale } from '../i18n/LocaleProvider';

function Header() {
  const { locale, setLocale, t } = useLocale();
  return (
    <header className="app-header bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center gap-4">
        <div className="flex items-center space-x-3">
          <img src={appIconUrl} alt="" className="app-logo w-11 h-11" />
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 text-center">Cvat Tools</h1>
            <p className="hidden sm:block text-[11px] text-slate-500 mt-0.5">{t('Kiểm tra annotation nhanh, trực quan và bảo mật')}</p>
          </div>
        </div>
        <label className="sr-only" htmlFor="app-language">{t('Ngôn ngữ')}</label>
        <select id="app-language" value={locale} onChange={(event) => setLocale(event.target.value as 'en' | 'vi')} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          <option value="en">English</option>
          <option value="vi">Tiếng Việt</option>
        </select>
      </div>
    </header>
  );
}

export default Header;
