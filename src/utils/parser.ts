import { CVATBox, CVATFrameData, CVATDataset, DuplicateGroup, DetectionSettings, CVATAttribute } from '../types';

/**
 * Calculates the Intersection over Union (IoU) of two bounding boxes.
 */
export function calculateIoU(
  box1: { xtl: number; ytl: number; xbr: number; ybr: number },
  box2: { xtl: number; ytl: number; xbr: number; ybr: number }
): number {
  const x_left = Math.max(box1.xtl, box2.xtl);
  const y_top = Math.max(box1.ytl, box2.ytl);
  const x_right = Math.min(box1.xbr, box2.xbr);
  const y_bottom = Math.min(box1.ybr, box2.ybr);

  if (x_right < x_left || y_bottom < y_top) {
    return 0.0;
  }

  const intersection_area = (x_right - x_left) * (y_bottom - y_top);

  const box1_area = (box1.xbr - box1.xtl) * (box1.ybr - box1.ytl);
  const box2_area = (box2.xbr - box2.xtl) * (box2.ybr - box2.ytl);

  const union_area = box1_area + box2_area - intersection_area;

  if (union_area <= 0) return 0.0;
  return intersection_area / union_area;
}

/**
 * Parses CVAT XML string into a structured dataset.
 */
export function parseCVATXML(xmlString: string, filename: string): CVATDataset {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check parsing error
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('File XML không hợp lệ hoặc bị lỗi cú pháp: ' + parserError.textContent);
  }

  // Get labels
  const labelsSet = new Set<string>();
  const labelColors: Record<string, string> = {};
  const labelBlocks = doc.querySelectorAll('meta > project > labels > label, meta > task > labels > label, labels > label');
  labelBlocks.forEach(block => {
    const nameNode = block.querySelector('name');
    const colorNode = block.querySelector('color');
    if (nameNode && nameNode.textContent) {
      const name = nameNode.textContent.trim();
      labelsSet.add(name);
      if (colorNode && colorNode.textContent) {
        labelColors[name] = colorNode.textContent.trim();
      }
    }
  });
  
  // Backup: if meta doesn't have labels, scan boxes
  if (labelsSet.size === 0) {
    const allBoxes = doc.querySelectorAll('box');
    allBoxes.forEach(box => {
      const l = box.getAttribute('label');
      if (l) labelsSet.add(l);
    });
  }
  
  const labels = Array.from(labelsSet);

  const taskNameNode = doc.querySelector('meta > task > name, meta > project > name');
  const taskName = taskNameNode ? taskNameNode.textContent || undefined : undefined;

  const frames: CVATFrameData[] = [];
  let type: 'images' | 'tracks' = 'images';

  const imageNodes = doc.querySelectorAll('image');
  const trackNodes = doc.querySelectorAll('track');

  if (imageNodes.length > 0) {
    type = 'images';
    let absoluteBoxIdx = 1;
    imageNodes.forEach((imgNode, imgIdx) => {
      const frameId = imgNode.getAttribute('id') || String(imgIdx);
      const name = imgNode.getAttribute('name') || `Frame ${frameId}`;
      const width = parseFloat(imgNode.getAttribute('width') || '0');
      const height = parseFloat(imgNode.getAttribute('height') || '0');

      const boxes: CVATBox[] = [];
      const boxNodes = imgNode.querySelectorAll('box');

      boxNodes.forEach((boxNode, boxIdx) => {
        const label = boxNode.getAttribute('label') || 'unlabeled';
        const xtl = parseFloat(boxNode.getAttribute('xtl') || '0');
        const ytl = parseFloat(boxNode.getAttribute('ytl') || '0');
        const xbr = parseFloat(boxNode.getAttribute('xbr') || '0');
        const ybr = parseFloat(boxNode.getAttribute('ybr') || '0');
        const occluded = boxNode.getAttribute('occluded') === '1';
        const z_order = boxNode.getAttribute('z_order') ? parseInt(boxNode.getAttribute('z_order') || '0', 10) : undefined;
        const group_id = boxNode.getAttribute('group_id') ? parseInt(boxNode.getAttribute('group_id') || '0', 10) : undefined;
        const source = boxNode.getAttribute('source') || undefined;

        // Get attributes
        const attributes: CVATAttribute[] = [];
        boxNode.querySelectorAll('attribute').forEach(attrNode => {
          attributes.push({
            name: attrNode.getAttribute('name') || '',
            value: attrNode.textContent || ''
          });
        });

        const parsedBoxId = boxNode.getAttribute('id');
        const currentGlobalIndex = absoluteBoxIdx++;
        const finalBoxId = parsedBoxId ? parsedBoxId : String(currentGlobalIndex);

        boxes.push({
          id: finalBoxId,
          label,
          xtl,
          ytl,
          xbr,
          ybr,
          occluded,
          z_order,
          group_id,
          source,
          attributes,
          originalIndex: boxIdx,
          globalIndex: currentGlobalIndex
        });
      });

      frames.push({
        id: frameId,
        name,
        width,
        height,
        boxes
      });
    });
  } else if (trackNodes.length > 0) {
    type = 'tracks';
    // Track annotations represent video, boxes are inside tracks across frames
    // We need to group them by frame so we can detect duplicates on the same frame!
    const frameMap: { [frameId: string]: { name: string; width: number; height: number; boxes: CVATBox[] } } = {};
    let absoluteBoxIdx = 1;

    trackNodes.forEach((trackNode) => {
      const trackId = trackNode.getAttribute('id') || '';
      const label = trackNode.getAttribute('label') || 'unlabeled';

      const boxNodes = trackNode.querySelectorAll('box');
      boxNodes.forEach((boxNode, boxIdx) => {
        const frameId = boxNode.getAttribute('frame') || '0';
        const xtl = parseFloat(boxNode.getAttribute('xtl') || '0');
        const ytl = parseFloat(boxNode.getAttribute('ytl') || '0');
        const xbr = parseFloat(boxNode.getAttribute('xbr') || '0');
        const ybr = parseFloat(boxNode.getAttribute('ybr') || '0');
        const occluded = boxNode.getAttribute('occluded') === '1';
        const outside = boxNode.getAttribute('outside') === '1';
        const keyframe = boxNode.getAttribute('keyframe') === '1';

        // Skip outside boxes as they indicate the track has ended or is absent in this frame
        if (outside) return;

        // Attributes can be on box or track, merge them
        const attributes: CVATAttribute[] = [];
        boxNode.querySelectorAll('attribute').forEach(attrNode => {
          attributes.push({
            name: attrNode.getAttribute('name') || '',
            value: attrNode.textContent || ''
          });
        });

        if (!frameMap[frameId]) {
          frameMap[frameId] = {
            name: `Frame ${frameId}`,
            // In video tracking XML, width and height might be stored in meta, default to 1920x1080 if not found
            width: 1920,
            height: 1080,
            boxes: []
          };
        }

        const parsedBoxId = boxNode.getAttribute('id');
        const currentGlobalIndex = absoluteBoxIdx++;
        const finalBoxId = parsedBoxId ? parsedBoxId : String(currentGlobalIndex);

        frameMap[frameId].boxes.push({
          id: finalBoxId,
          label,
          xtl,
          ytl,
          xbr,
          ybr,
          occluded,
          outside,
          keyframe,
          trackId,
          attributes,
          originalIndex: boxIdx,
          globalIndex: currentGlobalIndex
        });
      });
    });

    // Check if task meta has size info to correct frame widths and heights
    const widthNode = doc.querySelector('meta > task > original_size > width, meta > project > original_size > width');
    const heightNode = doc.querySelector('meta > task > original_size > height, meta > project > original_size > height');
    const metaWidth = widthNode ? parseFloat(widthNode.textContent || '1920') : 1920;
    const metaHeight = heightNode ? parseFloat(heightNode.textContent || '1080') : 1080;

    Object.keys(frameMap)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .forEach(frameId => {
        frames.push({
          id: frameId,
          name: frameMap[frameId].name,
          width: metaWidth,
          height: metaHeight,
          boxes: frameMap[frameId].boxes
        });
      });
  }

  return {
    filename,
    taskName,
    labels: labels.length > 0 ? labels : Array.from(new Set(frames.flatMap(f => f.boxes.map(b => b.label)))),
    type,
    labelColors,
    frames,
    source: 'xml'
  };
}

/**
 * Detects duplicate bounding boxes in a dataset based on user settings.
 */
export function detectDuplicates(
  dataset: CVATDataset,
  settings: DetectionSettings,
  options: { skipFramesWithSkipLabel?: boolean } = {}
): DuplicateGroup[] {
  const duplicateGroups: DuplicateGroup[] = [];
  const skipFramesWithSkipLabel = options.skipFramesWithSkipLabel ?? true;

  dataset.frames.forEach(frame => {
    const { boxes } = frame;
    if (skipFramesWithSkipLabel && boxes.some(box => box.label.toLowerCase().includes('skip'))) return;
    if (boxes.length < 2) return;

    const isDuplicate = (boxA: CVATBox, boxB: CVATBox): boolean => {
      if (settings.matchLabelOnly && boxA.label !== boxB.label) return false;
      if (settings.useIoU) return calculateIoU(boxA, boxB) * 100 >= settings.overlapThreshold;
      return Math.abs(boxA.xtl - boxB.xtl) <= settings.tolerancePx &&
        Math.abs(boxA.ytl - boxB.ytl) <= settings.tolerancePx &&
        Math.abs(boxA.xbr - boxB.xbr) <= settings.tolerancePx &&
        Math.abs(boxA.ybr - boxB.ybr) <= settings.tolerancePx;
    };

    const visited = new Set<string>();
    boxes.forEach((startBox, startIndex) => {
      if (visited.has(startBox.id)) return;
      const component: CVATBox[] = [];
      const queue = [startIndex];
      visited.add(startBox.id);
      while (queue.length > 0) {
        const currentIndex = queue.shift()!;
        const current = boxes[currentIndex];
        component.push(current);
        boxes.forEach((candidate, candidateIndex) => {
          if (!visited.has(candidate.id) && isDuplicate(current, candidate)) {
            visited.add(candidate.id);
            queue.push(candidateIndex);
          }
        });
      }
      if (component.length < 2) return;
      let overlapSum = 0;
      let overlapCount = 0;
      for (let i = 0; i < component.length; i++) {
        for (let j = i + 1; j < component.length; j++) {
          overlapSum += calculateIoU(component[i], component[j]) * 100;
          overlapCount++;
        }
      }
      const stableKey = component.map(box => box.id).sort().join('|');
      duplicateGroups.push({
        id: `group-${frame.id}-${stableKey}`,
        frameId: frame.id,
        frameName: frame.name,
        boxes: component,
        overlapPercentage: Math.round((overlapSum / Math.max(1, overlapCount)) * 100) / 100,
      });
    });
  });

  return duplicateGroups;
}

/**
 * Cleans the XML string by removing duplicate boxes.
 * For each duplicate group, it keeps the FIRST box and removes all subsequent boxes.
 */
export function removeDuplicatesFromXML(
  xmlString: string,
  dataset: CVATDataset,
  duplicateGroups: DuplicateGroup[]
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  if (duplicateGroups.length === 0) {
    return xmlString;
  }

  // Set of box IDs to delete
  // We keep group.boxes[0] (the first one) and delete all other boxes in the group
  const boxIdsToDelete = new Set<string>();
  duplicateGroups.forEach(group => {
    // Keep group.boxes[0], delete the rest
    group.boxes.slice(1).forEach(box => {
      boxIdsToDelete.add(box.id);
    });
  });

  let absoluteBoxIdx = 1;
  const nodesToDelete: Element[] = [];

  if (dataset.type === 'images') {
    const imageNodes = doc.querySelectorAll('image');
    imageNodes.forEach((imgNode) => {
      const boxNodes = imgNode.querySelectorAll('box');
      boxNodes.forEach((boxNode) => {
        const parsedBoxId = boxNode.getAttribute('id');
        const currentGlobalIndex = absoluteBoxIdx++;
        const finalBoxId = parsedBoxId ? parsedBoxId : String(currentGlobalIndex);

        if (boxIdsToDelete.has(finalBoxId)) {
          nodesToDelete.push(boxNode);
        }
      });
    });
  } else {
    const trackNodes = doc.querySelectorAll('track');
    trackNodes.forEach((trackNode) => {
      const boxNodes = trackNode.querySelectorAll('box');
      boxNodes.forEach((boxNode) => {
        const parsedBoxId = boxNode.getAttribute('id');
        const currentGlobalIndex = absoluteBoxIdx++;
        const finalBoxId = parsedBoxId ? parsedBoxId : String(currentGlobalIndex);

        if (boxIdsToDelete.has(finalBoxId)) {
          nodesToDelete.push(boxNode);
        }
      });
    });
  }

  // Now delete them safely
  nodesToDelete.forEach(node => {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

/**
 * Helper to generate CSV of duplicates for download
 */
export function generateCSVReport(duplicateGroups: DuplicateGroup[]): string {
  const headers = ['Mã Nhóm', 'Khung Hình/Tên File', 'ID Khung Hình', 'Nhãn Bounding Box', 'XTL (Trái)', 'YTL (Trên)', 'XBR (Phải)', 'YBR (Dưới)', 'Độ Trùng Lặp (%)', 'Ghi Chú'];
  const rows: string[][] = [headers];

  duplicateGroups.forEach((group, gIdx) => {
    group.boxes.forEach((box, bIdx) => {
      rows.push([
        `Nhom_${gIdx + 1}`,
        group.frameName,
        group.frameId,
        box.label,
        box.xtl.toFixed(2),
        box.ytl.toFixed(2),
        box.xbr.toFixed(2),
        box.ybr.toFixed(2),
        bIdx === 0 ? 'Mẫu Giữ Lại' : `${group.overlapPercentage}% (Trùng Lặp - Sẽ Xóa)`,
        bIdx === 0 ? 'Giữ lại làm gốc' : `Trùng lặp với box đầu tiên`
      ]);
    });
  });

  return '\ufeff' + rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
}
