import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';
import ConfirmDialog from '../components/ui/ConfirmDialog';

function ThemeProbe() {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-pref">{theme}</span>
      <span data-testid="theme-resolved">{resolvedTheme}</span>
      <button type="button" onClick={toggleTheme}>Toggle</button>
      <button type="button" onClick={() => setTheme('dark')}>Dark</button>
    </div>
  );
}

describe('ThemeProvider & ConfirmDialog', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('defaults to dark theme, toggles to light, and persists to localStorage', () => {
    act(() => root.render(<ThemeProvider><ThemeProbe /></ThemeProvider>));
    expect(container.querySelector('[data-testid="theme-resolved"]')?.textContent).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    const toggle = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Toggle')!;
    act(() => toggle.click());
    expect(container.querySelector('[data-testid="theme-resolved"]')?.textContent).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('cvat-tools-theme')).toBe('light');
  });

  it('renders ConfirmDialog with Job details, confirms and handles Escape cancel', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    act(() =>
      root.render(
        <ConfirmDialog
          confirmation={{ jobId: 42, frames: ['1', '2'], deleteCount: 3, keepCount: 2, source: 'list' }}
          locale="en"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />,
      ),
    );

    expect(container.textContent).toContain('Job #42');
    expect(container.textContent).toContain('1, 2');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(onCancel).toHaveBeenCalledTimes(1);

    const confirmBtn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Confirm delete'))!;
    act(() => confirmBtn.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
