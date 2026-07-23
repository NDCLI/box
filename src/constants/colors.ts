import { type CVATDataset } from '../types';

export const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#f43f5e'
];

export const HARDCODED_LABEL_COLORS: Record<string, string> = {
  person: '#c06060',
  car: '#2080c0',
  motorbike: '#00a0a0',
  bicycle: '#004040',
  bus: '#204080',
  truck: '#906080',
  train: '#50a080',
  face: '#90e8ce',
  head: '#ba9109',
  _skip: '#766433',
  negative: '#e6213a',
  licenseplate: '#e277ef'
};

export const getLabelColor = (label: string, dataset?: CVATDataset | null) => {
  if (dataset?.labelColors?.[label]) {
    return dataset.labelColors[label];
  }
  if (HARDCODED_LABEL_COLORS[label]) {
    return HARDCODED_LABEL_COLORS[label];
  }
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
};
