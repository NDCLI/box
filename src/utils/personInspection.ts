import type { CVATBox, CVATDataset } from '../types';

export const defaultPersonThresholds = { width: 60, height: 90, area: 25, aspect: 1.2, relative: 4 };
export type PersonThresholds = typeof defaultPersonThresholds;
export type PersonSeverity = 'High' | 'Medium' | 'Low';
export interface PersonFinding {
  frameId: string; box: CVATBox; width: number; height: number; areaPercent: number | null;
  relative: number | null; aspect: number; reasons: string[]; severity: PersonSeverity;
}

export function inspectPersons(dataset: CVATDataset, thresholds: PersonThresholds) {
  if (Object.values(thresholds).some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Invalid thresholds');
  let skipped = 0;
  const persons = dataset.frames.flatMap(frame => frame.boxes.flatMap(box => {
    if (box.label.trim().toLowerCase() !== 'person' || box.outside) return [];
    const width = box.xbr - box.xtl, height = box.ybr - box.ytl;
    if ((box.shapeType && box.shapeType !== 'rectangle') || ![box.xtl, box.ytl, box.xbr, box.ybr, width, height].every(Number.isFinite) || width <= 0 || height <= 0) { skipped++; return []; }
    const dimensions = Number.isFinite(frame.width) && Number.isFinite(frame.height) && frame.width > 0 && frame.height > 0;
    return [{ frameId: frame.id, box, width, height, aspect: width / height,
      areaPercent: dimensions ? width * height / (frame.width * frame.height) * 100 : null,
      widthPercent: dimensions ? width / frame.width * 100 : null,
      heightPercent: dimensions ? height / frame.height * 100 : null }];
  }));
  const areas = persons.flatMap(p => p.areaPercent === null ? [] : [p.areaPercent]).sort((a, b) => a - b);
  const mid = Math.floor(areas.length / 2);
  const median = areas.length >= 5 ? (areas[mid] + areas[Math.floor((areas.length - 1) / 2)]) / 2 : null;
  const findings: PersonFinding[] = [];
  for (const person of persons) {
    const relative = median && person.areaPercent !== null ? person.areaPercent / median : null;
    const reasons: string[] = [];
    const large = (person.areaPercent !== null && person.areaPercent >= thresholds.area) || (relative !== null && relative >= thresholds.relative);
    if (person.areaPercent !== null && person.areaPercent >= thresholds.area) reasons.push('Area');
    if (relative !== null && relative >= thresholds.relative) reasons.push('Relative Size');
    if (person.aspect >= thresholds.aspect) reasons.push('Aspect Ratio');
    if (person.widthPercent !== null && person.widthPercent >= thresholds.width) reasons.push('Width');
    if (person.heightPercent !== null && person.heightPercent >= thresholds.height) reasons.push('Height');
    if (reasons.length) findings.push({ ...person, relative, reasons, severity: large && person.aspect >= thresholds.aspect ? 'High' : large ? 'Medium' : 'Low' });
  }
  const rank = { High: 0, Medium: 1, Low: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.relative ?? 0) - (a.relative ?? 0));
  return { total: persons.length, skipped, median, missingDimensions: persons.filter(p => p.areaPercent === null).length, findings };
}

export function personFindingUrl(dataset: CVATDataset, finding: PersonFinding): string | null {
  const context = dataset.cvatContext;
  const id = finding.box.annotationKind === 'track' ? finding.box.trackId : finding.box.serverShapeId;
  if (!context?.jobId || !context.serverUrl || id === undefined) return null;
  try {
    const url = new URL(context.serverUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.pathname = `${url.pathname.replace(/\/(?:api(?:\/v1)?)?\/?$/, '')}/tasks/${context.taskId}/jobs/${context.jobId}`;
    url.search = new URLSearchParams({ frame: finding.frameId, type: finding.box.annotationKind === 'track' ? 'track' : 'shape', serverID: String(id) }).toString();
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

export function personFindingsCsv(findings: PersonFinding[]) {
  const cell = (value: unknown) => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [['Frame ID', 'Annotation ID', 'Kind', 'Label', 'X', 'Y', 'Width', 'Height', 'Area %', 'Relative area', 'Aspect ratio', 'Reasons', 'Severity'],
    ...findings.map(p => [p.frameId, p.box.trackId ?? p.box.serverShapeId ?? p.box.id, p.box.annotationKind ?? 'shape', p.box.label, p.box.xtl, p.box.ytl, p.width, p.height, p.areaPercent, p.relative, p.aspect, p.reasons.join('; '), p.severity])].map(row => row.map(cell).join(',')).join('\r\n');
}
