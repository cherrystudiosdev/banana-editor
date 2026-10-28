import { spawn } from 'node:child_process';

export class MediaError extends Error {
  constructor(public readonly code: 'CANCELLED' | 'MISSING_RUNTIME' | 'INVALID_MEDIA' | 'ENCODER' | 'FILESYSTEM', message: string) { super(message); this.name = 'MediaError'; }
}

export interface ProcessOptions { signal?: AbortSignal; onLine?: (line: string) => void; maxOutputBytes?: number; cwd?: string; }
export interface ProcessResult { stdout: Buffer; stderr: string; }

/** No shell is used. File paths are always separate argv values. */
export function runProcess(executable: string, args: string[], options: ProcessOptions = {}): Promise<ProcessResult> {
  if (options.signal?.aborted) return Promise.reject(new MediaError('CANCELLED', 'Operation cancelled.'));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], cwd: options.cwd });
    const chunks: Buffer[] = []; let length = 0; let stderr = ''; let pending = ''; let exceeded = false;
    const abort = () => { child.kill(); };
    options.signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > (options.maxOutputBytes ?? 32 * 1024 * 1024)) { exceeded = true; child.kill(); return; }
      chunks.push(chunk);
      if (options.onLine) {
        pending += chunk.toString('utf8');
        const lines = pending.split(/\r?\n/); pending = lines.pop() ?? '';
        for (const line of lines) options.onLine(line);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-16000); });
    child.once('error', (error) => { options.signal?.removeEventListener('abort', abort); reject(new MediaError('MISSING_RUNTIME', `Cannot start media runtime: ${error.message}`)); });
    child.once('close', (code) => {
      options.signal?.removeEventListener('abort', abort);
      if (options.signal?.aborted) return reject(new MediaError('CANCELLED', 'Operation cancelled.'));
      if (exceeded) return reject(new MediaError('INVALID_MEDIA', 'Media runtime returned more data than allowed.'));
      if (code !== 0) return reject(new MediaError(/Permission denied|No space left|Access is denied/i.test(stderr) ? 'FILESYSTEM' : 'ENCODER', stderr.trim() || `Media runtime exited with ${code}.`));
      if (pending && options.onLine) options.onLine(pending);
      resolve({ stdout: Buffer.concat(chunks), stderr });
    });
  });
}

/** Small FIFO queue; cancellation while queued never starts a child process. */
export class WorkQueue {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  constructor(private readonly concurrency = 2) {}
  async run<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new MediaError('CANCELLED', 'Operation cancelled.');
    if (this.active >= this.concurrency) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.active++;
    try { if (signal?.aborted) throw new MediaError('CANCELLED', 'Operation cancelled.'); return await operation(); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}
