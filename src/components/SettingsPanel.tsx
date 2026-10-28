import { useState } from 'react';
import { useLocale } from '../i18n/LocaleProvider';

export default function SettingsPanel() {
  const { locale, setLocale } = useLocale();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const check = async () => {
    setChecking(true);
    setMessage('');
    try {
      const result = await window.cvatDesktop?.checkForUpdates?.();
      setMessage(result?.message || 'Hãy mở bản Portable Windows để kiểm tra cập nhật.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không kiểm tra được cập nhật.'); }
    finally { setChecking(false); }
  };
  return <section className="app-panel rounded-2xl border p-6 space-y-6">
    <h2 className="text-xl font-bold">{locale === 'vi' ? 'Cài đặt' : 'Settings'}</h2>
    <div className="space-y-2"><label htmlFor="app-language" className="block font-semibold">{locale === 'vi' ? 'Ngôn ngữ' : 'Language'}</label>
      <select id="app-language" value={locale} onChange={event => setLocale(event.target.value as 'en' | 'vi')} className="rounded-lg border px-3 py-2"><option value="en">English</option><option value="vi">Tiếng Việt</option></select>
    </div>
    <div className="space-y-3"><h3 className="font-semibold">{locale === 'vi' ? 'Cập nhật ứng dụng' : 'App updates'}</h3>
      <button disabled={checking} onClick={() => void check()} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{checking ? (locale === 'vi' ? 'Đang kiểm tra và tải bản vá…' : 'Checking and downloading…') : (locale === 'vi' ? 'Kiểm tra cập nhật' : 'Check for updates')}</button>
      <p role="status" className="text-sm text-slate-400">{message}</p>
    </div>
  </section>;
}
