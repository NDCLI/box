import React from 'react';

function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 shadow-lg shadow-cyan-500/25 ring-1 ring-white/20 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75),transparent_34%)]" />
            <svg viewBox="0 0 44 44" className="relative w-full h-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.35)]" aria-hidden="true">
              <path d="M22 8 35 14.5 22 21 9 14.5 22 8Z" fill="#f8fafc" opacity="0.96" />
              <path d="M9 14.5 22 21v14L9 28.5v-14Z" fill="#67e8f9" />
              <path d="M35 14.5 22 21v14l13-6.5v-14Z" fill="#a78bfa" />
              <path d="M14 14.5 22 10.5l8 4-8 4-8-4Z" fill="#0f172a" opacity="0.9" />
              <path d="M13 24.5 22 29l9-4.5" fill="none" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
              <path d="M13 19.5 22 24l9-4.5" fill="none" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">CVAT Box Counter & Duplicate Inspector</h1>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-bold tracking-tight">
            <span className="font-sans font-medium text-slate-300">Build With Google AI Studio</span>
          </h2>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>
    </header>
  );
}

// Suppress unused import warning for React (needed for JSX in some configs)
void React;

export default Header;
