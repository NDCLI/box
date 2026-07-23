import { useState } from 'react';
import {
  Settings,
  X
} from 'lucide-react';
import { type DetectionSettings } from '../types';

interface ConfigPanelProps {
  frameRange: { min: number; max: number };
  frameRangeStart: string;
  frameRangeEnd: string;
  onFrameRangeStartChange: (value: string) => void;
  onFrameRangeEndChange: (value: string) => void;
  excludeLabels: string[];
  onSaveExcludeLabels: (labels: string[]) => void;
  settings: DetectionSettings;
  onSettingsChange: (settings: DetectionSettings) => void;
}

export default function ConfigPanel({
  frameRange,
  frameRangeStart,
  frameRangeEnd,
  onFrameRangeStartChange,
  onFrameRangeEndChange,
  excludeLabels,
  onSaveExcludeLabels,
  settings,
  onSettingsChange
}: ConfigPanelProps) {
  const [newExcludeLabel, setNewExcludeLabel] = useState("");

  return (
    <>
      {/* Global Config: Frame Range & Exclude */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center space-x-2 text-slate-800 pb-3 border-b border-slate-100">
          <Settings className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold">Cấu hình Kiểm tra & Loại trừ Box</h3>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* Frame Range Filter */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">1. Lọc theo vùng Frame (Giới hạn: {frameRange.min} - {frameRange.max})</span>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min={frameRange.min}
                  max={frameRange.max}
                  placeholder={`Start: ${frameRange.min}`}
                  value={frameRangeStart}
                  onChange={(e) => onFrameRangeStartChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all font-mono"
                />
              </div>
              <span className="text-slate-400 font-black">&rarr;</span>
              <div className="flex-1">
                <input
                  type="number"
                  min={frameRange.min}
                  max={frameRange.max}
                  placeholder={`End: ${frameRange.max}`}
                  value={frameRangeEnd}
                  onChange={(e) => onFrameRangeEndChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all font-mono"
                />
              </div>
              {(frameRangeStart !== String(frameRange.min) || frameRangeEnd !== String(frameRange.max)) && (
                <button
                  onClick={() => { onFrameRangeStartChange(String(frameRange.min)); onFrameRangeEndChange(String(frameRange.max)); }}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Xóa bộ lọc vùng frame"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Exclude Labels Config */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">2. Các Nhãn loại trừ khỏi tổng số đếm</span>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap gap-2 items-center min-h-[46px]">
              {excludeLabels.map(lbl => (
                <span key={lbl} className="inline-flex items-center space-x-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                  <span>{lbl}</span>
                  <button onClick={() => onSaveExcludeLabels(excludeLabels.filter(x => x !== lbl))} className="hover:text-red-900"><X className="w-3 h-3" /></button>
                </span>
              ))}
              <div className="flex-1 flex min-w-[150px]">
                <input
                  type="text"
                  placeholder="Nhập tên nhãn (Vd: _corrupt) và Enter..."
                  value={newExcludeLabel}
                  onChange={e => setNewExcludeLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newExcludeLabel.trim()) {
                      if (!excludeLabels.includes(newExcludeLabel.trim())) {
                        onSaveExcludeLabels([...excludeLabels, newExcludeLabel.trim()]);
                      }
                      setNewExcludeLabel('');
                    }
                  }}
                  className="w-full bg-transparent border-none text-sm font-medium focus:ring-0 p-0 text-slate-700 placeholder-slate-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Config & Audit Tool Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center space-x-2 text-slate-800 pb-3 border-b border-slate-100">
          <Settings className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold">Cấu hình quét trùng lặp (Thử cả 2 tiêu chí để tránh bỏ sót)</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Match Mode Selector */}
          <div className="lg:col-span-4 space-y-3">
            <span className="text-xs font-bold text-slate-500 block">TIÊU CHÍ SO KHỚP TỌA ĐỘ</span>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => onSettingsChange({ ...settings, useIoU: true })}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${settings.useIoU
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Chỉ số IoU (Mức chồng đè)
              </button>
              <button
                onClick={() => onSettingsChange({ ...settings, useIoU: false })}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${!settings.useIoU
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                Sai lệch pixel (Cạnh trùng)
              </button>
            </div>
          </div>

          {/* Sliders for tolerance */}
          <div className="lg:col-span-5 space-y-3">
            {!settings.useIoU ? (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-500">
                    MỨC SAI LỆCH TOẠ ĐỘ CHO PHÉP (PIXEL)
                  </span>
                  <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                    {settings.tolerancePx === 0 ? '0.0 px (Trùng khớp 100%)' : `${settings.tolerancePx.toFixed(1)} px`}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-400">Khớp Tuyệt Đối</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={settings.tolerancePx}
                    onChange={(e) => onSettingsChange({ ...settings, tolerancePx: parseFloat(e.target.value) })}
                    className="flex-1 accent-red-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-400">Sai lệch 10px</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-500">
                    HỆ SỐ TRÙNG NHAU TỐI THIỂU (IoU)
                  </span>
                  <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                    {settings.overlapThreshold}% trùng nhau
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-400">50% Overlap</span>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="1"
                    value={settings.overlapThreshold}
                    onChange={(e) => onSettingsChange({ ...settings, overlapThreshold: parseInt(e.target.value, 10) })}
                    className="flex-1 accent-red-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-400">100% </span>
                </div>
              </div>
            )}
          </div>

          {/* Match Label Option */}
          <div className="lg:col-span-3 pt-4 lg:pt-1 space-y-2">
            <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Cài đặt nhãn</span>
            <label className="flex items-center space-x-3 cursor-pointer group bg-slate-50 p-2.5 rounded-xl border border-slate-150 hover:bg-slate-100/50 transition-colors">
              <input
                type="checkbox"
                checked={settings.matchLabelOnly}
                onChange={(e) => onSettingsChange({ ...settings, matchLabelOnly: e.target.checked })}
                className="w-4.5 h-4.5 accent-red-500 cursor-pointer rounded-sm"
              />
              <div className="text-xs font-semibold text-slate-700">
                Chỉ tính trùng khi cùng Nhãn (Label)
                <span className="block font-normal text-slate-400 text-[10px] mt-0.5">
                  {settings.matchLabelOnly ? 'Cùng toạ độ & cùng nhãn' : 'Trùng toạ độ kể cả khác nhãn'}
                </span>
              </div>
            </label>
          </div>

        </div>
      </div>
    </>
  );
}
