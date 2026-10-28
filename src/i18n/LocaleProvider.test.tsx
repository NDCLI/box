import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider, translate } from './LocaleProvider';

describe('LocaleProvider', () => {
  let root: ReturnType<typeof createRoot>;
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it('defaults to English and restores Vietnamese when selected', () => {
    act(() => root.render(<LocaleProvider><p title="Đã xảy ra lỗi">Đã xảy ra lỗi</p></LocaleProvider>));
    expect(container.textContent).toContain('Something went wrong');
    expect(container.querySelector('p')?.getAttribute('title')).toBe('Something went wrong');

    act(() => localStorage.setItem('cvat-tools-locale', 'vi'));
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<LocaleProvider><p>Đã xảy ra lỗi</p></LocaleProvider>));
    expect(container.textContent).toContain('Đã xảy ra lỗi');
  });

  it('translates dynamic deletion confirmation text', () => {
    expect(translate('Job #101\nFrame: 2\nSẽ xóa 3 Shape.\n\nTiếp tục?', 'en')).toContain('Will delete 3 Shape.');
    expect(translate('Job #101\nFrame: 2\nSẽ xóa 3 Shape.\n\nTiếp tục?', 'en')).toContain('Continue?');
  });

  it('keeps translated dynamic values in sync after React updates them', async () => {
    function DynamicValue() {
      const [value, setValue] = useState(50);
      return <><button onClick={() => setValue(60)}>change</button><p>{`${value}% trùng nhau`}</p></>;
    }

    await act(async () => {
      root.render(<LocaleProvider><DynamicValue /></LocaleProvider>);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('50% overlap');
    await act(async () => {
      container.querySelector('button')?.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('60% overlap');
  });
});
