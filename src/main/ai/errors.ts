import type { AIErrorCode, AIErrorData } from '../../shared/ai';

export class AIError extends Error implements AIErrorData {
  constructor(public code: AIErrorCode, message: string, public retryable = false) { super(message); this.name = 'AIError'; }
  toJSON(): AIErrorData { return { code: this.code, message: this.message, retryable: this.retryable }; }
}

/** Do not forward provider messages: they may echo a key, prompt, or request body. */
export function normalizeError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const status = Number(record.status ?? record.statusCode);
  const name = String(record.name ?? '');
  const code = String(record.code ?? '');
  if (name === 'ZodError' || name === 'SyntaxError') return new AIError('invalid_output', 'The provider returned an invalid structured response.');
  if (name === 'AbortError' || name === 'APIUserAbortError') return new AIError('cancelled', 'The request was cancelled. A request already accepted by the provider may still be billed.');
  if (/timeout/i.test(name) || code === 'ETIMEDOUT') return new AIError('timeout', 'The provider did not respond in time.');
  if (status === 401 || status === 403) return new AIError('authentication', 'The provider rejected the API key or account permissions.');
  if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached') return new AIError('quota', 'The provider account has no available quota.');
  if (status === 429) return new AIError('rate_limit', 'The provider rate limit was reached. Try again later.', true);
  if (status === 404 || (status === 400 && /model/i.test(String(record.message ?? '')))) return new AIError('unsupported_model', 'The selected model or capability is unavailable for this account.');
  if (status >= 500) return new AIError('provider_error', 'The provider returned a temporary server error.', true);
  if (/connection|fetch|network/i.test(name) || ['ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED'].includes(code)) return new AIError('network', 'The provider could not be reached.', true);
  return new AIError('provider_error', 'The AI request failed. Check the model, account access, and network connection.');
}

export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancelled = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancelled); reject(new AIError('cancelled', 'The request was cancelled.')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancelled); resolve(); }, ms);
    if (signal?.aborted) cancelled(); else signal?.addEventListener('abort', cancelled, { once: true });
  });
}

export async function withRetry<T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal, options: { retries?: number; timeoutMs?: number; baseDelayMs?: number } = {}): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? 120000);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  try {
    for (let attempt = 0; ; attempt++) {
      if (combined.aborted) throw new AIError(signal?.aborted ? 'cancelled' : 'timeout', signal?.aborted ? 'The request was cancelled.' : 'The provider did not respond in time.');
      try { return await operation(combined); }
      catch (raw) {
        if (combined.aborted) throw new AIError(signal?.aborted ? 'cancelled' : 'timeout', signal?.aborted ? 'The request was cancelled. The provider may still bill accepted work.' : 'The provider did not respond in time.');
        const error = normalizeError(raw);
        if (!error.retryable || attempt >= (options.retries ?? 2)) throw error;
        try { await abortableDelay(Math.min((options.baseDelayMs ?? 750) * 2 ** attempt, 5000), combined); }
        catch { throw new AIError(signal?.aborted ? 'cancelled' : 'timeout', signal?.aborted ? 'The request was cancelled.' : 'The provider did not respond in time.'); }
      }
    }
  } finally { clearTimeout(timer); }
}
