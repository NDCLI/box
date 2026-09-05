import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { listCvatJobs, listCvatTasks, loadCvatJobDataset } from './utils/cvatApi';
import type { CVATDataset } from './types';

vi.mock('./utils/cvatApi', () => ({
  listCvatTasks: vi.fn(),
  listCvatJobs: vi.fn(),
  loadCvatJobDataset: vi.fn(),
  loadCvatFrameImage: vi.fn(),
}));

const dataset = (filename: string): CVATDataset => ({
  filename, type: 'images', labels: ['car'],
  frames: [{ id: '0', name: 'image.jpg', width: 100, height: 100, boxes: [] }],
});

describe('CVAT Job session', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.resetAllMocks();
    window.cvatDesktop = {
      request: vi.fn(), getStoredToken: vi.fn().mockResolvedValue('test-token'),
      saveToken: vi.fn().mockResolvedValue(undefined), hasDefaultToken: vi.fn().mockResolvedValue(false),
    };
    vi.mocked(listCvatTasks).mockResolvedValue([{ id: 10, name: 'Task 10' }]);
    vi.mocked(listCvatJobs).mockResolvedValue([{ id: 101 }, { id: 102 }]);
    vi.mocked(loadCvatJobDataset).mockResolvedValue(dataset('job-101.json'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<App />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete window.cvatDesktop;
    vi.unstubAllGlobals();
  });

  async function click(text: string) {
    const button = [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === text);
    expect(button, text).toBeDefined();
    await act(async () => button!.click());
  }

  async function openJob() {
    await click('Lấy danh sách Task');
    await click('Tải annotation Job');
  }

  it('keeps loaded Task/Job choices after closing and opens another Job without listing again', async () => {
    await openJob();
    expect(container.querySelector('.app-upload-stage')?.closest('[hidden]')).not.toBeNull();
    await click('Đóng Job');
    expect(container.querySelector('.app-upload-stage')?.closest('[hidden]')).toBeNull();
    const jobSelect = [...container.querySelectorAll('select')].find(select => select.value === '101')!;
    expect(jobSelect.options.length).toBe(2);
    await act(async () => {
      jobSelect.value = '102';
      jobSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click('Tải annotation Job');
    expect(loadCvatJobDataset).toHaveBeenLastCalledWith(expect.objectContaining({ token: 'test-token' }), 10, 102);
    expect(listCvatTasks).toHaveBeenCalledTimes(1);
    expect(listCvatJobs).toHaveBeenCalledTimes(1);
  });

  it('refreshes the open Job, retains data on failure, and ignores a response after closing', async () => {
    await openJob();
    vi.mocked(loadCvatJobDataset).mockResolvedValueOnce(dataset('updated-job.json'));
    await click('Tải lại Job');
    expect(container.querySelector('.app-file-bar')?.textContent).toContain('updated-job.json');
    expect(listCvatTasks).toHaveBeenCalledTimes(1);
    expect(listCvatJobs).toHaveBeenCalledTimes(1);

    vi.mocked(loadCvatJobDataset).mockRejectedValueOnce(new Error('Server unavailable'));
    await click('Tải lại Job');
    expect(container.textContent).toContain('Server unavailable');
    expect(container.querySelector('.app-file-bar')?.textContent).toContain('updated-job.json');

    let finish!: (value: CVATDataset) => void;
    vi.mocked(loadCvatJobDataset).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await click('Tải lại Job');
    const loadingButton = [...container.querySelectorAll('button')].find(button => button.textContent === 'Đang tải lại…');
    expect(loadingButton?.disabled).toBe(true);
    await click('Đóng Job');
    await act(async () => finish(dataset('late-response.json')));
    expect(container.querySelector('.app-file-bar')).toBeNull();
    expect(container.querySelector('.app-upload-stage')?.closest('[hidden]')).toBeNull();
  });
});
