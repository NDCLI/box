import { describe, expect, it } from 'vitest';
import type { CVATDataset } from '../../types';
import { defaultPersonThresholds as thresholds, inspectPersons, personFindingUrl, personFindingsCsv } from '../personInspection';
function dataset(sizes: [number, number][]): CVATDataset {
  return { filename: 'test', type: 'images', labels: ['person'], frames: sizes.map(([w, h], i) => ({ id: String(i), name: '', width: 1000, height: 1000, boxes: [{ id: String(i), serverShapeId: i + 1, annotationKind: 'shape', label: 'person', xtl: 0, ytl: 0, xbr: w, ybr: h, occluded: false, attributes: [], originalIndex: 0, globalIndex: i }] })) };
}
const normal: [number, number][] = Array.from({ length: 6 }, () => [50, 150]);
describe('person inspection', () => {
  it('requires combined large area and wide aspect for High', () => {
    const result = inspectPersons(dataset([...normal, [800, 400], [300, 900], [100, 50]]), thresholds);
    expect(result.total).toBe(9);
    expect(result.findings.map(p => [p.frameId, p.severity])).toEqual([['6', 'High'], ['7', 'Medium'], ['8', 'Low']]);
  });
  it('normalizes relative area across resolutions', () => {
    const data = dataset([...normal, [100, 300]]);
    data.frames[6].width = data.frames[6].height = 2000;
    expect(inspectPersons(data, thresholds).findings).toEqual([]);
  });
  it('does not invent a baseline for small samples or missing image dimensions', () => {
    const data = dataset([[800, 400]]);
    expect(inspectPersons(data, thresholds).median).toBeNull();
    data.frames[0].width = 0;
    const result = inspectPersons(data, thresholds);
    expect(result.findings[0].severity).toBe('Low');
    expect(result.findings[0].relative).toBeNull();
    expect(result.missingDimensions).toBe(1);
  });
  it('ignores non-person, outside, mask and invalid boxes', () => {
    const data = dataset([[0, 20], [50, 100], [50, 100], [50, 100]]);
    data.frames[1].boxes[0].outside = true;
    data.frames[2].boxes[0].label = 'car';
    data.frames[3].boxes[0].shapeType = 'mask';
    expect(inspectPersons(data, thresholds)).toMatchObject({ total: 0, skipped: 2, findings: [] });
    expect(() => inspectPersons(data, { ...thresholds, area: NaN })).toThrow();
  });
  it('links server annotation IDs and refuses offline or unsafe links', () => {
    const data = dataset([[800, 400]]);
    const finding = inspectPersons(data, thresholds).findings[0];
    expect(personFindingUrl(data, finding)).toBeNull();
    data.cvatContext = { serverUrl: 'https://cvat.example/api', taskId: 1, jobId: 2 };
    expect(personFindingUrl(data, finding)).toBe('https://cvat.example/tasks/1/jobs/2?frame=0&type=shape&serverID=1');
    data.cvatContext.serverUrl = 'javascript:alert(1)';
    expect(personFindingUrl(data, finding)).toBeNull();
  });
  it('exports quoted Unicode CSV and neutralizes spreadsheet formulas', () => {
    const finding = inspectPersons(dataset([[800, 400]]), thresholds).findings[0];
    finding.box.label = '=HYPERLINK("evil")';
    const csv = personFindingsCsv([finding]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
    expect(csv).toContain('"High"');
  });
});
