const appIconUrl = `${import.meta.env.BASE_URL}app-icon.svg`;

function Header() {
  return (
    <header className="app-header bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src={appIconUrl} alt="" className="app-logo w-11 h-11" />
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900">CVAT Box Counter & Duplicate Inspector</h1>
            <p className="hidden sm:block text-[11px] text-slate-500 mt-0.5">Kiểm tra annotation nhanh, trực quan và bảo mật</p>
          </div>
        </div>
        <div className="app-local-badge hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Xử lý cục bộ
        </div>
      </div>
    </header>
  );
}

export default Header;
