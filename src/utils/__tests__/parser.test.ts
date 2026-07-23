import { describe, it, expect } from 'vitest';
import {
  calculateIoU,
  parseCVATXML,
  detectDuplicates,
  removeDuplicatesFromXML,
  generateCSVReport,
} from '../parser';
import type { CVATDataset, DetectionSettings, DuplicateGroup } from '../../types';

// ─── Helpers ────────────────────────────────────────────────────────

/** Minimal CVAT image-mode XML wrapper */
function imageXml(
  images: { id?: string; name?: string; width?: number; height?: number; boxes: string[] }[],
  labels?: string[],
): string {
  const labelBlock = labels
    ? `<labels>${labels.map(l => `<label><name>${l}</name></label>`).join('')}</labels>`
    : '';
  const imageBlocks = images
    .map((img, i) => {
      const id = img.id ?? String(i);
      const name = img.name ?? `frame_${id}.png`;
      const w = img.width ?? 1920;
      const h = img.height ?? 1080;
      return `<image id="${id}" name="${name}" width="${w}" height="${h}">${img.boxes.join('')}</image>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?>
<annotations>
  <meta><task><name>test</name>${labelBlock}</task></meta>
  ${imageBlocks}
</annotations>`;
}

/** Minimal CVAT track-mode XML wrapper */
function trackXml(
  tracks: { id: string; label: string; boxes: string[] }[],
  size?: { width: number; height: number },
): string {
  const sizeBlock = size
    ? `<original_size><width>${size.width}</width><height>${size.height}</height></original_size>`
    : '';
  const trackBlocks = tracks
    .map(t => `<track id="${t.id}" label="${t.label}">${t.boxes.join('')}</track>`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?>
<annotations>
  <meta><task><name>test</name>${sizeBlock}</task></meta>
  ${trackBlocks}
</annotations>`;
}

/** Shorthand for a <box> element string */
function boxStr(attrs: Record<string, string | number>, children = ''): string {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<box ${a}>${children}</box>`;
}

const defaultSettings: DetectionSettings = {
  matchLabelOnly: true,
  tolerancePx: 0,
  overlapThreshold: 100,
  useIoU: true,
};

// ─── calculateIoU ───────────────────────────────────────────────────

describe('calculateIoU', () => {
  it('returns 1.0 for identical boxes', () => {
    const box = { xtl: 10, ytl: 10, xbr: 50, ybr: 50 };
    expect(calculateIoU(box, box)).toBe(1.0);
  });

  it('returns 0 for non-overlapping boxes', () => {
    const a = { xtl: 0, ytl: 0, xbr: 10, ybr: 10 };
    const b = { xtl: 20, ytl: 20, xbr: 30, ybr: 30 };
    expect(calculateIoU(a, b)).toBe(0);
  });

  it('calculates partial overlap correctly', () => {
    const a = { xtl: 0, ytl: 0, xbr: 20, ybr: 20 };
    const b = { xtl: 10, ytl: 10, xbr: 30, ybr: 30 };
    // Intersection: 10×10 = 100, Union: 400 + 400 - 100 = 700
    expect(calculateIoU(a, b)).toBeCloseTo(100 / 700, 5);
  });

  it('handles full containment (small box inside large box)', () => {
    const large = { xtl: 0, ytl: 0, xbr: 100, ybr: 100 };
    const small = { xtl: 20, ytl: 20, xbr: 40, ybr: 40 };
    // Intersection: 20×20 = 400, Union: 10000 + 400 - 400 = 10000
    expect(calculateIoU(large, small)).toBeCloseTo(400 / 10000, 5);
  });

  it('returns 0 for zero-area boxes', () => {
    const a = { xtl: 5, ytl: 5, xbr: 5, ybr: 5 };
    const b = { xtl: 5, ytl: 5, xbr: 10, ybr: 10 };
    expect(calculateIoU(a, b)).toBe(0);
  });

  it('returns 0 for touching edges (no overlap area)', () => {
    const a = { xtl: 0, ytl: 0, xbr: 10, ybr: 10 };
    const b = { xtl: 10, ytl: 0, xbr: 20, ybr: 10 };
    expect(calculateIoU(a, b)).toBe(0);
  });
});

// ─── parseCVATXML ───────────────────────────────────────────────────

describe('parseCVATXML', () => {
  it('parses a simple image-mode XML with one frame and one box', () => {
    const xml = imageXml([
      {
        id: '0',
        name: 'frame_0.png',
        width: 640,
        height: 480,
        boxes: [boxStr({ label: 'car', xtl: 10, ytl: 20, xbr: 100, ybr: 200 })],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');

    expect(ds.type).toBe('images');
    expect(ds.filename).toBe('test.xml');
    expect(ds.frames).toHaveLength(1);
    expect(ds.frames[0].id).toBe('0');
    expect(ds.frames[0].name).toBe('frame_0.png');
    expect(ds.frames[0].width).toBe(640);
    expect(ds.frames[0].height).toBe(480);
    expect(ds.frames[0].boxes).toHaveLength(1);
    expect(ds.frames[0].boxes[0].label).toBe('car');
    expect(ds.frames[0].boxes[0].xtl).toBe(10);
  });

  it('extracts labels from meta block', () => {
    const xml = imageXml(
      [{ boxes: [boxStr({ label: 'car', xtl: 0, ytl: 0, xbr: 10, ybr: 10 })] }],
      ['car', 'person', 'bike'],
    );
    const ds = parseCVATXML(xml, 'test.xml');
    expect(ds.labels).toEqual(expect.arrayContaining(['car', 'person', 'bike']));
    expect(ds.labels).toHaveLength(3);
  });

  it('falls back to scanning boxes when meta has no labels', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<annotations>
  <meta><task><name>test</name></task></meta>
  <image id="0" name="f.png" width="100" height="100">
    <box label="dog" xtl="0" ytl="0" xbr="10" ybr="10"></box>
    <box label="cat" xtl="20" ytl="20" xbr="30" ybr="30"></box>
  </image>
</annotations>`;
    const ds = parseCVATXML(xml, 'test.xml');
    expect(ds.labels).toEqual(expect.arrayContaining(['dog', 'cat']));
  });

  it('extracts label colors from meta', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<annotations>
  <meta><task><name>test</name>
    <labels><label><name>car</name><color>#ff0000</color></label></labels>
  </task></meta>
  <image id="0" name="f.png" width="100" height="100">
    <box label="car" xtl="0" ytl="0" xbr="10" ybr="10"></box>
  </image>
</annotations>`;
    const ds = parseCVATXML(xml, 'test.xml');
    expect(ds.labelColors).toEqual({ car: '#ff0000' });
  });

  it('parses multiple frames with multiple boxes', () => {
    const xml = imageXml([
      {
        id: '0',
        boxes: [
          boxStr({ label: 'a', xtl: 0, ytl: 0, xbr: 10, ybr: 10 }),
          boxStr({ label: 'b', xtl: 20, ytl: 20, xbr: 30, ybr: 30 }),
        ],
      },
      {
        id: '1',
        boxes: [boxStr({ label: 'c', xtl: 5, ytl: 5, xbr: 15, ybr: 15 })],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    expect(ds.frames).toHaveLength(2);
    expect(ds.frames[0].boxes).toHaveLength(2);
    expect(ds.frames[1].boxes).toHaveLength(1);
  });

  it('parses box attributes', () => {
    const attrChild = '<attribute name="color">red</attribute>';
    const xml = imageXml([
      {
        boxes: [boxStr({ label: 'car', xtl: 0, ytl: 0, xbr: 10, ybr: 10 }, attrChild)],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    expect(ds.frames[0].boxes[0].attributes).toEqual([{ name: 'color', value: 'red' }]);
  });

  it('parses occluded and z_order attributes', () => {
    const xml = imageXml([
      {
        boxes: [
          boxStr({ label: 'car', xtl: 0, ytl: 0, xbr: 10, ybr: 10, occluded: '1', z_order: '3' }),
        ],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    expect(ds.frames[0].boxes[0].occluded).toBe(true);
    expect(ds.frames[0].boxes[0].z_order).toBe(3);
  });

  it('parses track-mode XML', () => {
    const xml = trackXml([
      {
        id: '0',
        label: 'car',
        boxes: [
          boxStr({ frame: '0', xtl: 10, ytl: 10, xbr: 50, ybr: 50, outside: '0', keyframe: '1' }),
          boxStr({ frame: '1', xtl: 12, ytl: 12, xbr: 52, ybr: 52, outside: '0', keyframe: '1' }),
        ],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    expect(ds.type).toBe('tracks');
    expect(ds.frames).toHaveLength(2);
    expect(ds.frames[0].boxes[0].trackId).toBe('0');
  });

  it('skips outside boxes in track mode', () => {
    const xml = trackXml([
      {
        id: '0',
        label: 'car',
        boxes: [
          boxStr({ frame: '0', xtl: 10, ytl: 10, xbr: 50, ybr: 50, outside: '0', keyframe: '1' }),
          boxStr({ frame: '1', xtl: 10, ytl: 10, xbr: 50, ybr: 50, outside: '1', keyframe: '1' }),
        ],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    expect(ds.frames).toHaveLength(1); // frame 1 box is outside, so only frame 0
  });

  it('throws on malformed XML', () => {
    expect(() => parseCVATXML('<not-valid<xml>', 'bad.xml')).toThrow();
  });
});

// ─── detectDuplicates ───────────────────────────────────────────────

describe('detectDuplicates', () => {
  function makeDataset(
    frames: { id: string; boxes: { id: string; label: string; xtl: number; ytl: number; xbr: number; ybr: number }[] }[],
  ): CVATDataset {
    return {
      filename: 'test.xml',
      labels: [],
      type: 'images',
      frames: frames.map(f => ({
        id: f.id,
        name: `frame_${f.id}.png`,
        width: 1920,
        height: 1080,
        boxes: f.boxes.map((b, i) => ({
          ...b,
          occluded: false,
          attributes: [],
          originalIndex: i,
          globalIndex: i + 1,
        })),
      })),
    };
  }

  it('detects exact duplicate boxes on the same frame', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [
          { id: '1', label: 'car', xtl: 10, ytl: 10, xbr: 100, ybr: 100 },
          { id: '2', label: 'car', xtl: 10, ytl: 10, xbr: 100, ybr: 100 },
        ],
      },
    ]);
    const groups = detectDuplicates(ds, defaultSettings);
    expect(groups).toHaveLength(1);
    expect(groups[0].boxes).toHaveLength(2);
  });

  it('does not flag distinct boxes as duplicates', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [
          { id: '1', label: 'car', xtl: 0, ytl: 0, xbr: 10, ybr: 10 },
          { id: '2', label: 'car', xtl: 500, ytl: 500, xbr: 600, ybr: 600 },
        ],
      },
    ]);
    const groups = detectDuplicates(ds, defaultSettings);
    expect(groups).toHaveLength(0);
  });

  it('respects matchLabelOnly — different labels not grouped', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [
          { id: '1', label: 'car', xtl: 10, ytl: 10, xbr: 100, ybr: 100 },
          { id: '2', label: 'person', xtl: 10, ytl: 10, xbr: 100, ybr: 100 },
        ],
      },
    ]);
    const groups = detectDuplicates(ds, { ...defaultSettings, matchLabelOnly: true });
    expect(groups).toHaveLength(0);
  });

  it('groups different labels when matchLabelOnly is false', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [
          { id: '1', label: 'car', xtl: 10, ytl: 10, xbr: 100, ybr: 100 },
          { id: '2', label: 'person', xtl: 10, ytl: 10, xbr: 100, ybr: 100 },
        ],
      },
    ]);
    const groups = detectDuplicates(ds, { ...defaultSettings, matchLabelOnly: false });
    expect(groups).toHaveLength(1);
  });

  it('uses coordinate tolerance mode', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [
          { id: '1', label: 'car', xtl: 10, ytl: 10, xbr: 100, ybr: 100 },
          { id: '2', label: 'car', xtl: 12, ytl: 12, xbr: 102, ybr: 102 },
        ],
      },
    ]);
    // With tolerance=0 and no IoU, should NOT match (coords differ by 2px)
    const noMatch = detectDuplicates(ds, {
      ...defaultSettings,
      useIoU: false,
      tolerancePx: 0,
    });
    expect(noMatch).toHaveLength(0);

    // With tolerance=5, should match
    const match = detectDuplicates(ds, {
      ...defaultSettings,
      useIoU: false,
      tolerancePx: 5,
    });
    expect(match).toHaveLength(1);
  });

  it('respects IoU overlap threshold', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [
          { id: '1', label: 'car', xtl: 0, ytl: 0, xbr: 100, ybr: 100 },
          { id: '2', label: 'car', xtl: 50, ytl: 0, xbr: 150, ybr: 100 },
        ],
      },
    ]);
    // IoU = 50×100 / (10000 + 10000 - 5000) = 5000/15000 ≈ 33.33%
    // With threshold 100%, should NOT match
    const noMatch = detectDuplicates(ds, {
      ...defaultSettings,
      overlapThreshold: 100,
    });
    expect(noMatch).toHaveLength(0);

    // With threshold 30%, SHOULD match
    const match = detectDuplicates(ds, {
      ...defaultSettings,
      overlapThreshold: 30,
    });
    expect(match).toHaveLength(1);
  });

  it('handles multiple duplicate groups on same frame', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [
          { id: '1', label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 },
          { id: '2', label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 },
          { id: '3', label: 'person', xtl: 200, ytl: 200, xbr: 300, ybr: 300 },
          { id: '4', label: 'person', xtl: 200, ytl: 200, xbr: 300, ybr: 300 },
        ],
      },
    ]);
    const groups = detectDuplicates(ds, defaultSettings);
    expect(groups).toHaveLength(2);
  });

  it('detects duplicates across multiple frames independently', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [
          { id: '1', label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 },
          { id: '2', label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 },
        ],
      },
      {
        id: '1',
        boxes: [
          { id: '3', label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 },
          { id: '4', label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 },
        ],
      },
    ]);
    const groups = detectDuplicates(ds, defaultSettings);
    expect(groups).toHaveLength(2);
    expect(groups[0].frameId).toBe('0');
    expect(groups[1].frameId).toBe('1');
  });

  it('does not create groups for frames with fewer than 2 boxes', () => {
    const ds = makeDataset([
      {
        id: '0',
        boxes: [{ id: '1', label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 }],
      },
    ]);
    const groups = detectDuplicates(ds, defaultSettings);
    expect(groups).toHaveLength(0);
  });
});

// ─── removeDuplicatesFromXML ────────────────────────────────────────

describe('removeDuplicatesFromXML', () => {
  it('removes duplicate boxes and keeps the first one', () => {
    const xml = imageXml([
      {
        id: '0',
        boxes: [
          boxStr({ label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 }),
          boxStr({ label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 }),
        ],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    const groups = detectDuplicates(ds, defaultSettings);
    expect(groups).toHaveLength(1);

    const cleaned = removeDuplicatesFromXML(xml, ds, groups);
    // Parse the cleaned XML and verify only 1 box remains
    const cleanedDs = parseCVATXML(cleaned, 'test.xml');
    expect(cleanedDs.frames[0].boxes).toHaveLength(1);
  });

  it('returns original XML when no duplicates found', () => {
    const xml = imageXml([
      {
        id: '0',
        boxes: [
          boxStr({ label: 'car', xtl: 0, ytl: 0, xbr: 10, ybr: 10 }),
          boxStr({ label: 'car', xtl: 500, ytl: 500, xbr: 600, ybr: 600 }),
        ],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    const groups: DuplicateGroup[] = [];
    const cleaned = removeDuplicatesFromXML(xml, ds, groups);
    expect(cleaned).toBe(xml); // returns original string unchanged
  });

  it('handles multiple duplicate groups correctly', () => {
    const xml = imageXml([
      {
        id: '0',
        boxes: [
          boxStr({ label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 }),
          boxStr({ label: 'car', xtl: 10, ytl: 10, xbr: 50, ybr: 50 }),
          boxStr({ label: 'dog', xtl: 200, ytl: 200, xbr: 300, ybr: 300 }),
          boxStr({ label: 'dog', xtl: 200, ytl: 200, xbr: 300, ybr: 300 }),
        ],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    const groups = detectDuplicates(ds, defaultSettings);
    expect(groups).toHaveLength(2);

    const cleaned = removeDuplicatesFromXML(xml, ds, groups);
    const cleanedDs = parseCVATXML(cleaned, 'test.xml');
    expect(cleanedDs.frames[0].boxes).toHaveLength(2); // 1 car + 1 dog
  });

  it('works with track-mode XML', () => {
    const xml = trackXml([
      {
        id: '0',
        label: 'car',
        boxes: [
          boxStr({ frame: '0', xtl: 10, ytl: 10, xbr: 50, ybr: 50, outside: '0', keyframe: '1' }),
        ],
      },
      {
        id: '1',
        label: 'car',
        boxes: [
          boxStr({ frame: '0', xtl: 10, ytl: 10, xbr: 50, ybr: 50, outside: '0', keyframe: '1' }),
        ],
      },
    ]);
    const ds = parseCVATXML(xml, 'test.xml');
    const groups = detectDuplicates(ds, defaultSettings);
    expect(groups).toHaveLength(1);

    const cleaned = removeDuplicatesFromXML(xml, ds, groups);
    const cleanedDs = parseCVATXML(cleaned, 'test.xml');
    // Should have 1 frame with 1 box (duplicate removed)
    expect(cleanedDs.frames[0].boxes).toHaveLength(1);
  });
});

// ─── generateCSVReport ──────────────────────────────────────────────

describe('generateCSVReport', () => {
  it('returns only BOM + header row for empty input', () => {
    const csv = generateCSVReport([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    // Starts with UTF-8 BOM
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toContain('Khung Hình');
  });

  it('generates correct rows for a single duplicate group', () => {
    const groups: DuplicateGroup[] = [
      {
        id: 'group-0',
        frameId: '5',
        frameName: 'frame_5.png',
        overlapPercentage: 100,
        boxes: [
          {
            id: '10',
            label: 'car',
            xtl: 10,
            ytl: 20,
            xbr: 100,
            ybr: 200,
            occluded: false,
            attributes: [],
            originalIndex: 0,
            globalIndex: 1,
          },
          {
            id: '11',
            label: 'car',
            xtl: 10,
            ytl: 20,
            xbr: 100,
            ybr: 200,
            occluded: false,
            attributes: [],
            originalIndex: 1,
            globalIndex: 2,
          },
        ],
      },
    ];
    const csv = generateCSVReport(groups);
    const lines = csv.split('\n');
    // header + 2 box rows
    expect(lines).toHaveLength(3);
    // First box row should say "Mẫu Giữ Lại"
    expect(lines[1]).toContain('Mẫu Giữ Lại');
    // Second box row should indicate duplicate
    expect(lines[2]).toContain('Trùng Lặp');
    expect(lines[2]).toContain('100%');
  });

  it('properly escapes double quotes in CSV values', () => {
    const groups: DuplicateGroup[] = [
      {
        id: 'group-0',
        frameId: '0',
        frameName: 'file "with" quotes.png',
        overlapPercentage: 95.5,
        boxes: [
          {
            id: '1',
            label: 'label"test',
            xtl: 0,
            ytl: 0,
            xbr: 10,
            ybr: 10,
            occluded: false,
            attributes: [],
            originalIndex: 0,
            globalIndex: 1,
          },
          {
            id: '2',
            label: 'label"test',
            xtl: 0,
            ytl: 0,
            xbr: 10,
            ybr: 10,
            occluded: false,
            attributes: [],
            originalIndex: 1,
            globalIndex: 2,
          },
        ],
      },
    ];
    const csv = generateCSVReport(groups);
    // Double quotes should be escaped as ""
    expect(csv).toContain('""with""');
    expect(csv).toContain('label""test');
  });
});
