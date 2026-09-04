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
  it('centers file upload around the quality-check headline', () => {
    const { container, root } = renderUploadZone();

    expect(container.textContent).toContain('CVAT Box Audit');
    expect(container.querySelector('button')?.textContent).toContain('Chọn file XML hoặc ZIP');

    act(() => root.unmount());
    container.remove();
  });
});
