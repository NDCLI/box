import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import UploadZone from './UploadZone';

function renderUploadZone() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <UploadZone
        isDragging={false}
        fileInputRef={{ current: null }}
        onUploadClick={() => {}}
        onFileChange={() => {}}
        onDragOver={() => {}}
        onDragLeave={() => {}}
        onDrop={() => {}}
        onCvatDatasetLoaded={() => {}}
      />,
    );
  });

  return { container, root };
}

describe('UploadZone empty state', () => {
  it('defaults to CVAT and switches sources without remounting the connection panel', () => {
    const { container, root } = renderUploadZone();
    const cvatTab = container.querySelector<HTMLButtonElement>('#source-tab-cvat')!;
    const zipTab = container.querySelector<HTMLButtonElement>('#source-tab-zip')!;
    const cvatPanel = container.querySelector<HTMLDivElement>('#source-panel-cvat')!;
    const zipPanel = container.querySelector<HTMLDivElement>('#source-panel-zip')!;
    const connectionInput = cvatPanel.querySelector('input');

    expect(cvatTab.getAttribute('aria-selected')).toBe('true');
    expect(cvatPanel.hidden).toBe(false);
    expect(zipPanel.hidden).toBe(true);
    act(() => zipTab.click());
    expect(cvatPanel.hidden).toBe(true);
    expect(zipPanel.hidden).toBe(false);
    act(() => zipTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    expect(cvatPanel.hidden).toBe(false);
    expect(zipPanel.hidden).toBe(true);
    expect(document.activeElement).toBe(cvatTab);
    expect(cvatPanel.querySelector('input')).toBe(connectionInput);

    act(() => root.unmount());
    container.remove();
  });

  it('centers file upload around the quality-check headline', () => {
    const { container, root } = renderUploadZone();

    expect(container.textContent).toContain('Cvat Tools');
    expect(container.querySelector('#upload-dropzone')?.textContent).toContain('Chọn file XML hoặc ZIP');

    act(() => root.unmount());
    container.remove();
  });
});
