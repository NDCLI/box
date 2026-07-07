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
  const labelNodes = doc.querySelectorAll('meta > project > labels > label > name, meta > task > labels > label > name');
  const labels: string[] = [];
  labelNodes.forEach(node => {
    if (node.textContent) labels.push(node.textContent.trim());
  });

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
        const finalBoxId = parsedBoxId ? parsedBoxId : String(absoluteBoxIdx++);

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
          originalIndex: boxIdx
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
        const finalBoxId = parsedBoxId ? parsedBoxId : String(absoluteBoxIdx++);

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
          originalIndex: boxIdx
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
    frames
  };
}

/**
 * Detects duplicate bounding boxes in a dataset based on user settings.
 */
export function detectDuplicates(
  dataset: CVATDataset,
  settings: DetectionSettings
): DuplicateGroup[] {
  const duplicateGroups: DuplicateGroup[] = [];
  let groupIdCounter = 0;

  dataset.frames.forEach(frame => {
    const { boxes } = frame;
    if (boxes.length < 2) return;

    // Track which boxes have already been flagged as duplicates
    const processedBoxIds = new Set<string>();

    for (let i = 0; i < boxes.length; i++) {
      const boxA = boxes[i];
      if (processedBoxIds.has(boxA.id)) continue;

      const groupBoxes: CVATBox[] = [boxA];

      for (let j = i + 1; j < boxes.length; j++) {
        const boxB = boxes[j];
        if (processedBoxIds.has(boxB.id)) continue;

        // Label matching check
        if (settings.matchLabelOnly && boxA.label !== boxB.label) {
          continue;
        }

        let isDuplicate = false;
        let overlapPercent = 0;

        if (settings.useIoU) {
          const iou = calculateIoU(boxA, boxB);
          overlapPercent = Math.round(iou * 10000) / 100; // 2 decimal places percentage
          if (overlapPercent >= settings.overlapThreshold) {
            isDuplicate = true;
          }
        } else {
          // Coordinate tolerance check
          const xtlDiff = Math.abs(boxA.xtl - boxB.xtl);
          const ytlDiff = Math.abs(boxA.ytl - boxB.ytl);
          const xbrDiff = Math.abs(boxA.xbr - boxB.xbr);
          const ybrDiff = Math.abs(boxA.ybr - boxB.ybr);

          if (
            xtlDiff <= settings.tolerancePx &&
            ytlDiff <= settings.tolerancePx &&
            xbrDiff <= settings.tolerancePx &&
            ybrDiff <= settings.tolerancePx
          ) {
            isDuplicate = true;
            // For coordinate tolerance, if exact, overlap is 100%
            overlapPercent = calculateIoU(boxA, boxB) * 100;
          }
        }

        if (isDuplicate) {
          groupBoxes.push(boxB);
          processedBoxIds.add(boxB.id);
        }
      }

      // If we found duplicates for boxA, create a group
      if (groupBoxes.length > 1) {
        processedBoxIds.add(boxA.id);
        const avgOverlap = groupBoxes.length === 2
          ? calculateIoU(groupBoxes[0], groupBoxes[1]) * 100
          : groupBoxes.slice(1).reduce((acc, box) => acc + calculateIoU(groupBoxes[0], box) * 100, 0) / (groupBoxes.length - 1);

        duplicateGroups.push({
          id: `group-${groupIdCounter++}`,
          frameId: frame.id,
          frameName: frame.name,
          boxes: groupBoxes,
          overlapPercentage: Math.round(avgOverlap * 100) / 100
        });
      }
    }
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

  if (dataset.type === 'images') {
    // Process image nodes
    const imageNodes = doc.querySelectorAll('image');
    imageNodes.forEach((imgNode, imgIdx) => {
      const frameId = imgNode.getAttribute('id') || String(imgIdx);
      const boxNodes = imgNode.querySelectorAll('box');

      // Loop backwards to avoid index shifting problems when deleting
      for (let boxIdx = boxNodes.length - 1; boxIdx >= 0; boxIdx--) {
        const boxId = `img-${frameId}-box-${boxIdx}`;
        if (boxIdsToDelete.has(boxId)) {
          const nodeToRemove = boxNodes[boxIdx];
          if (nodeToRemove && nodeToRemove.parentNode) {
            nodeToRemove.parentNode.removeChild(nodeToRemove);
          }
        }
      }
    });
  } else {
    // Process track-based XML
    // Track nodes have boxes. Each box inside track has frame attribute and index.
    const trackNodes = doc.querySelectorAll('track');
    trackNodes.forEach((trackNode) => {
      const trackId = trackNode.getAttribute('id') || '';
      const boxNodes = trackNode.querySelectorAll('box');

      for (let boxIdx = boxNodes.length - 1; boxIdx >= 0; boxIdx--) {
        const boxNode = boxNodes[boxIdx];
        const frameId = boxNode.getAttribute('frame') || '0';
        const boxId = `track-${trackId}-frame-${frameId}`;

        if (boxIdsToDelete.has(boxId)) {
          if (boxNode && boxNode.parentNode) {
            boxNode.parentNode.removeChild(boxNode);
          }
        }
      }
    });
  }

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
