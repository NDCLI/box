import { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import { type DetectionSettings } from '../types';
import { useLocale } from '../i18n/LocaleProvider';

interface ConfigPanelProps {
  frameRange: { min: number; max: number };
  frameRangeStart: string;
  frameRangeEnd: string;
  onFrameRangeStartChange: (value: string) => void;
  onFrameRangeEndChange: (value: string) => void;
  excludeLabels: string[];
  onSaveExcludeLabels: (labels: string[]) => void;
  skipFrameFilterEnabled: boolean;
  onSkipFrameFilterEnabledChange: (enabled: boolean) => void;
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
  skipFrameFilterEnabled,
  onSkipFrameFilterEnabledChange,
  settings,
  onSettingsChange,
}: ConfigPanelProps) {
  const { t, locale } = useLocale();
  const [newExcludeLabel, setNewExcludeLabel] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const hasCustomRange =
    frameRangeStart !== String(frameRange.min) || frameRangeEnd !== String(frameRange.max);

  return (
    <section className="dt-panel overflow-hidden">
      {/* Compact Header with live summary pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[var(--bg-surface-elevated)] border-b border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>Cấu hình Kiểm tra &amp; Loại trừ Box</span>
          {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" /> : <ChevronUp className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
        </button>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="dt-mono rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[var(--text-secondary)]">
            Frame {frameRangeStart || frameRange.min}–{frameRangeEnd || frameRange.max}
          </span>
          <span className="dt-mono rounded border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-2 py-0.5 text-[var(--accent-text)]">
            {settings.useIoU
              ? `IoU ≥ ${settings.overlapThreshold}%`
              : `Tol ≤ ${settings.tolerancePx.toFixed(1)}px`}
          </span>
          <span className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[var(--text-secondary)]">
            {settings.matchLabelOnly
              ? (locale === 'vi' ? 'Cùng nhãn' : 'Same label')
              : (locale === 'vi' ? 'Mọi nhãn' : 'Any label')}
          </span>
          {excludeLabels.length > 0 && (
            <span className="dt-mono rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-2 py-0.5 text-[var(--status-danger-text)]">
              Exclude: {excludeLabels.length}
            </span>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 gap-4 p-3.5 xl:grid-cols-12">
          {/* Column 1: Frame range & Skip toggle */}
          <div className="space-y-2.5 xl:col-span-4">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {t(`1. Lọc theo vùng Frame (Giới hạn: ${frameRange.min} - ${frameRange.max})`)}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={frameRange.min}
                max={frameRange.max}
                placeholder={`Start: ${frameRange.min}`}
                value={frameRangeStart}
                onChange={(e) => onFrameRangeStartChange(e.target.value)}
                className="dt-input dt-input-sm dt-mono min-w-0 flex-1 font-semibold"
              />
              <span className="text-xs font-bold text-[var(--text-muted)]">&rarr;</span>
              <input
                type="number"
                min={frameRange.min}
                max={frameRange.max}
                placeholder={`End: ${frameRange.max}`}
                value={frameRangeEnd}
                onChange={(e) => onFrameRangeEndChange(e.target.value)}
                className="dt-input dt-input-sm dt-mono min-w-0 flex-1 font-semibold"
              />
              {hasCustomRange && (
                <button
                  type="button"
                  onClick={() => {
                    onFrameRangeStartChange(String(frameRange.min));
                    onFrameRangeEndChange(String(frameRange.max));
                  }}
                  className="dt-icon-btn border border-[var(--border-strong)]"
                  title="Xóa bộ lọc vùng frame"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                skipFrameFilterEnabled
                  ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] text-[var(--status-danger-text)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)]'
              }`}
            >
              <span className="font-semibold">
                {skipFrameFilterEnabled ? 'Bỏ qua box trong Frame Skip' : 'Đếm tất cả box'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={skipFrameFilterEnabled}
                aria-label={skipFrameFilterEnabled ? 'Bỏ qua box trong Frame Skip' : 'Đếm tất cả box'}
                onClick={() => onSkipFrameFilterEnabledChange(!skipFrameFilterEnabled)}
                className={`relative h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${
                  skipFrameFilterEnabled ? 'bg-[var(--status-danger)]' : 'bg-[var(--border-strong)]'
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                    skipFrameFilterEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Column 2: Exclude Labels */}
          <div className="space-y-2.5 xl:col-span-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              2. Các Nhãn loại trừ khỏi tổng số đếm
            </span>
            <div className="flex min-h-[68px] flex-wrap content-start items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] p-2">
              {excludeLabels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1 rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-danger-text)]"
                >
                  <span>{lbl}</span>
                  <button
                    type="button"
                    onClick={() => onSaveExcludeLabels(excludeLabels.filter((x) => x !== lbl))}
                    className="hover:opacity-75"
                    aria-label={`Remove ${lbl}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Nhập tên nhãn (Vd: _corrupt) và Enter..."
                value={newExcludeLabel}
                onChange={(e) => setNewExcludeLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newExcludeLabel.trim()) {
                    if (!excludeLabels.includes(newExcludeLabel.trim())) {
                      onSaveExcludeLabels([...excludeLabels, newExcludeLabel.trim()]);
                    }
                    setNewExcludeLabel('');
                  }
                }}
                className="min-w-[140px] flex-1 border-none bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </div>
          </div>

          {/* Column 3: Duplicate Scan Criteria */}
          <div className="space-y-2.5 xl:col-span-5 xl:border-l xl:border-[var(--border-subtle)] xl:pl-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                TIÊU CHÍ SO KHỚP TỌA ĐỘ
              </span>
              <div className="inline-grid grid-cols-2 gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-0.5">
                <button
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, useIoU: true })}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    settings.useIoU
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Chỉ số IoU (Mức chồng đè)
                </button>
                <button
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, useIoU: false })}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    !settings.useIoU
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Sai lệch pixel (Cạnh trùng)
                </button>
              </div>
            </div>

            {!settings.useIoU ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[var(--text-secondary)]">
                    MỨC SAI LỆCH TOẠ ĐỘ CHO PHÉP (PIXEL)
                  </span>
                  <span className="dt-mono rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-2 py-0.5 font-semibold text-[var(--status-danger-text)]">
                    {settings.tolerancePx === 0
                      ? '0.0 px (Trùng khớp 100%)'
                      : `${settings.tolerancePx.toFixed(1)} px`}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">Khớp Tuyệt Đối</span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={settings.tolerancePx}
                    onChange={(e) => onSettingsChange({ ...settings, tolerancePx: parseFloat(e.target.value) })}
                    className="dt-range flex-1"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">Sai lệch 10px</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[var(--text-secondary)]">
                    HỆ SỐ TRÙNG NHAU TỐI THIỂU (IoU)
                  </span>
                  <span className="dt-mono rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] px-2 py-0.5 font-semibold text-[var(--status-danger-text)]">
                    {t(`${settings.overlapThreshold}% trùng nhau`)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">50% Overlap</span>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="1"
                    value={settings.overlapThreshold}
                    onChange={(e) => onSettingsChange({ ...settings, overlapThreshold: parseInt(e.target.value, 10) })}
                    className="dt-range flex-1"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">100%</span>
                </div>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-2.5 py-1.5 hover:bg-[var(--bg-surface-hover)] transition-colors">
              <input
                type="checkbox"
                checked={settings.matchLabelOnly}
                onChange={(e) => onSettingsChange({ ...settings, matchLabelOnly: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent-primary)] cursor-pointer"
              />
              <div className="min-w-0 text-xs">
                <span className="font-semibold text-[var(--text-primary)]">
                  Chỉ tính trùng khi cùng Nhãn (Label)
                </span>
                <span className="ml-2 text-[11px] text-[var(--text-muted)]">
                  — {settings.matchLabelOnly ? 'Cùng toạ độ & cùng nhãn' : 'Trùng toạ độ kể cả khác nhãn'}
                </span>
              </div>
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
