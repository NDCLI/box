import React from 'react';

function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
        <p>&copy; 2026 CVAT Duplicate Bounding Box Auditor.</p>
        <p className="font-mono text-[10px] text-slate-300">Built using React 19 + TypeScript + zip.js + Tailwind CSS</p>
      </div>
    </footer>
  );
}

// Suppress unused import warning for React (needed for JSX in some configs)
void React;

export default Footer;
