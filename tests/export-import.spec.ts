import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Mock exportDb before importing export-import
vi.mock('../src/db', () => ({ exportDb: vi.fn().mockResolvedValue(new Uint8Array([1,2,3])) }));
import { exportDatabase, importDatabase, createFileInput } from '../src/export-import';

describe('export-import module', () => {
  beforeEach(() => {
    // Mock URL.createObjectURL and revoke
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob://test'),
      revokeObjectURL: vi.fn(),
    });
    // Spy on anchor click
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('exportDatabase creates a download and returns filename', async () => {
    const result = await exportDatabase();
    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/^sololedger-backup-\d{4}-\d{2}-\d{2}T/);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('importDatabase throws on invalid extension', async () => {
    const badFile = new File([new ArrayBuffer(1)], 'test.txt');
    await expect(importDatabase(badFile)).rejects.toThrow('Invalid file type');
  });

  it('importDatabase calls window.importDb on valid file', async () => {
    const buf = new ArrayBuffer(2);
    const file = new File([buf], 'db.sqlite3');
    // @ts-ignore
    window.importDb = vi.fn().mockResolvedValue(undefined);
    const ok = await importDatabase(file);
    expect(ok).toBe(true);
    // @ts-ignore
    expect(window.importDb).toHaveBeenCalledWith(new Uint8Array(buf));
  });

  it('createFileInput returns hidden input and triggers callback', () => {
    const cb = vi.fn();
    const input = createFileInput(cb);
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.type).toBe('file');
    expect(input.accept).toContain('.sqlite3');
    expect(input.style.display).toBe('none');
    // Append to body
    expect(document.body.contains(input)).toBe(true);
    // Simulate file selection
    const file = new File([new ArrayBuffer(1)], 'test.db');
    const dt = new DataTransfer(); dt.items.add(file);
    // @ts-ignore
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
    expect(cb).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
  });
});