import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, X, RefreshCw } from 'lucide-react';

interface StatusBannersProps {
  isLoading: boolean;
  error: string | null;
  successMsg: string | null;
  onDismissError: () => void;
  onDismissSuccess: () => void;
}

function StatusBanners({
  isLoading,
  error,
  successMsg,
  onDismissError,
  onDismissSuccess,
}: StatusBannersProps) {
  return (
    <>
      {/* Global loading state */}
      {isLoading && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center justify-center shadow-xs">
          <RefreshCw className="w-10 h-10 text-red-500 animate-spin mb-4" />
          <h4 className="text-lg font-semibold text-slate-800">Đang đọc và xử lý tệp dữ liệu...</h4>
          <p className="text-sm text-slate-500 mt-1">Quá trình này có thể mất vài giây tùy thuộc vào dung lượng file.</p>
        </div>
      )}

      {/* Global Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3 text-rose-800"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1">
            <h5 className="font-bold text-rose-900">Đã xảy ra lỗi</h5>
            <p className="text-sm mt-0.5">{error}</p>
          </div>
          <button onClick={onDismissError} className="text-rose-500 hover:text-rose-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Global Success message */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start space-x-3 text-emerald-800"
        >
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1 text-sm font-medium">{successMsg}</div>
          <button onClick={onDismissSuccess} className="text-emerald-500 hover:text-emerald-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </>
  );
}

// Suppress unused import warning for React (needed for JSX in some configs)
void React;

export default StatusBanners;
