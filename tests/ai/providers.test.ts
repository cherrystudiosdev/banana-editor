import { afterEach, describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import type { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { GeminiProvider, OpenAIProvider, type AIProvider, type ProviderPrompt } from '../../src/main/ai/providers';
import { AIService, minimalContext, validatePreparedMedia } from '../../src/main/ai/service';
import { AIError, normalizeError, withRetry } from '../../src/main/ai/errors';
import { capabilities, validateConfiguration } from '../../src/main/ai/capabilities';
import { createClip, createProject } from '../../src/shared/model';
import type { AIRequest, PreparedMedia } from '../../src/shared/ai';

afterEach(() => vi.restoreAllMocks());
const prompt: ProviderPrompt = { model: 'gpt-6-astra', system: 'Only describe evidence.', text: 'Describe this selected frame.', media: [] };
const ResultSchema = z.object({ answer: z.string() }).strict();
const frame: PreparedMedia = { clipId: 'clip', kind: 'image', mimeType: 'image/png', data: new Uint8Array([1, 2, 3]), sourceStart: 2, duration: 0 };
const audio: PreparedMedia = { clipId: 'clip', kind: 'audio', mimeType: 'audio/wav', data: new Uint8Array([1, 2, 3]), sourceStart: 2, duration: 2 };

function request(task: AIRequest['task'] = 'chat'): AIRequest {
  const project = createProject();
  project.assets.push({ id: 'asset', name: 'private-name.mp4', path: 'C:/private/SECRET_FILE.mp4', kind: 'video', duration: 60, width: 1920, height: 1080, hasAudio: true });
  project.sequence.tracks[0]!.clips.push(createClip('video', 'clip', { id: 'clip', assetId: 'asset', start: 30, duration: 300, sourceIn: 2 }));
  return { project, task, provider: 'openai', model: 'gpt-6-astra', prompt: 'Summarize', selectedClipIds: ['clip'] };
}
function fakeProvider(): AIProvider {
  return { id: 'openai', capabilities, validateConfiguration, chat: vi.fn(async () => ({ value: 'Metadata only', usage: { inputTokens: 1 } })), analyzeMedia: vi.fn(async () => ({ value: 'Frame observation', usage: {} })), proposeEditPlan: vi.fn(), transcribe: vi.fn(async () => ({ value: [{ clipId: 'clip', start: 2, end: 4, text: 'Merhaba dünya', timing: 'chunk' as const }], usage: { audioSeconds: 2 } })), testConnection: vi.fn() };
}

describe('real SDK adapter request contracts (network-free fixtures)', () => {
  it('uses OpenAI Responses structured output, no server storage and no tool grants', async () => {
    let body: Record<string, unknown> = {};
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ id: 'resp_fixture', object: 'response', created_at: 0, status: 'completed', output: [{ id: 'msg_fixture', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"answer":"verified fixture"}', annotations: [] }] }], usage: { input_tokens: 11, output_tokens: 5, total_tokens: 16 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const provider = new OpenAIProvider(new OpenAI({ apiKey: 'fixture-not-a-real-key', fetch: fetcher }));
    const response = await provider.proposeEditPlan({ ...prompt, media: [frame] }, ResultSchema);
    expect(response.value.answer).toBe('verified fixture'); expect(response.usage.totalTokens).toBe(16);
    expect(body.store).toBe(false); expect(body.tools).toBeUndefined(); expect(body.model).toBe(prompt.model);
    expect(body).toHaveProperty('text.format.type', 'json_schema');
    expect(JSON.stringify(body)).toContain('data:image/png;base64,AQID');
    expect(JSON.stringify(body)).not.toContain('fixture-not-a-real-key');
  });
  it('uses Gemini Interactions JSON schema and inline media without uploading files', async () => {
    const create = vi.fn(async () => ({ status: 'completed', output_text: '{"answer":"Gemini fixture"}', usage: { total_input_tokens: 10, total_output_tokens: 5, total_tokens: 15 } }));
    const client = { interactions: { create } } as unknown as GoogleGenAI;
    const provider = new GeminiProvider(client);
    const result = await provider.proposeEditPlan({ ...prompt, model: 'gemini-3.8-flash', media: [{ ...frame, kind: 'video', mimeType: 'video/mp4', duration: 1 }] }, ResultSchema);
    expect(result.value.answer).toBe('Gemini fixture'); expect(result.usage.totalTokens).toBe(15);
    const call = create.mock.calls[0] as unknown as [Record<string, unknown>, { signal: AbortSignal }];
    expect(call[0]).toMatchObject({ model: 'gemini-3.8-flash', store: false, response_format: { type: 'text', mime_type: 'application/json' } });
    expect(call[0].tools).toBeUndefined(); expect(call[1].signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(call[0])).toContain('"type":"video"');
  });
  it('rejects malformed Gemini output and incomplete OpenAI output', async () => {
    const gemini = new GeminiProvider({ interactions: { create: vi.fn(async () => ({ status: 'completed', output_text: '{"danger":"not-schema"}' })) } } as unknown as GoogleGenAI);
    await expect(gemini.proposeEditPlan(prompt, ResultSchema)).rejects.toMatchObject({ code: 'invalid_output' });
    const openai = new OpenAIProvider({ responses: { create: vi.fn(async () => ({ status: 'incomplete', output_text: 'truncated' })) } } as unknown as OpenAI);
    await expect(openai.chat(prompt)).rejects.toMatchObject({ code: 'invalid_output' });
  });
  it('adds chunk offsets to legacy segment timestamps and does not invent modern segment timing', async () => {
    const create = vi.fn().mockResolvedValueOnce({ segments: [{ start: 0.2, end: 1.4, text: 'hello' }], duration: 2 }).mockResolvedValueOnce({ text: 'Merhaba' });
    const provider = new OpenAIProvider({ audio: { transcriptions: { create } } } as unknown as OpenAI);
    expect((await provider.transcribe('whisper-1', audio)).value[0]).toMatchObject({ start: 2.2, end: 3.4, timing: 'segment' });
    expect((await provider.transcribe('gpt-transcribe', audio)).value[0]).toMatchObject({ start: 2, end: 4, timing: 'chunk' });
    expect(create.mock.calls[1]![0]).toMatchObject({ model: 'gpt-transcribe', response_format: 'json' });
  });
});

describe('AI orchestration and privacy', () => {
  it('requires keys but does not include paths or credentials in model context', async () => {
    const data = request(); const provider = fakeProvider(); const service = new AIService(() => provider);
    await expect(service.execute(data, '')).rejects.toMatchObject({ code: 'authentication' });
    expect(JSON.stringify(minimalContext(data))).not.toContain('SECRET_FILE');
    expect(JSON.stringify(minimalContext(data))).not.toContain('C:/');
    const result = await service.execute(data, 'fixture-key');
    expect(result.text).toBe('Metadata only'); expect(result.warnings.join(' ')).toContain('metadata');
    expect(JSON.stringify(vi.mocked(provider.chat).mock.calls)).not.toContain('fixture-key');
  });
  it('maps transcript source offsets into a reviewed caption plan', async () => {
    const provider = fakeProvider(); const service = new AIService(() => provider);
    const data = { ...request('transcribe'), model: 'gpt-transcribe', media: [audio] };
    const result = await service.execute(data, 'fixture-key');
    expect(result.transcript?.wordTimestamps).toBe(false);
    expect(result.plan?.steps[0]).toMatchObject({ type: 'addCaption', start: 30, duration: 60 });
    expect(result.warnings.join(' ')).toContain('chunk boundaries');
  });
  it('rejects bad chunk timestamps, out-of-scope media and unknown model modalities', async () => {
    const provider = fakeProvider(); const service = new AIService(() => provider);
    vi.mocked(provider.transcribe).mockResolvedValue({ value: [{ clipId: 'clip', start: 2, end: 50, text: 'bad', timing: 'segment' }], usage: {} });
    await expect(service.execute({ ...request('transcribe'), model: 'gpt-transcribe', media: [audio] }, 'fixture-key')).rejects.toMatchObject({ code: 'invalid_output' });
    expect(() => validatePreparedMedia(request().project, ['clip'], [{ ...audio, sourceStart: 0 }])).toThrow(/outside/);
    await expect(service.execute({ ...request(), model: 'custom-model', media: [frame] }, 'fixture-key')).rejects.toMatchObject({ code: 'unsupported_model' });
  });
  it('caption translation rejects changed IDs and preserves approved segment timing', async () => {
    const data = request('translate');
    data.project.sequence.tracks[1]!.clips.push(createClip('caption', 'caption', { id: 'caption', start: 30, duration: 60, text: { text: 'Merhaba', fontSize: 48, color: '#ffffff', background: 'transparent', align: 'center' } }));
    data.selectedClipIds = ['caption'];
    const provider = fakeProvider();
    vi.mocked(provider.proposeEditPlan).mockResolvedValueOnce({ value: { captions: [{ clipId: 'wrong', text: 'Hello' }] }, usage: {} }).mockResolvedValueOnce({ value: { captions: [{ clipId: 'caption', text: 'Hello' }] }, usage: {} });
    const service = new AIService(() => provider);
    await expect(service.execute(data, 'fixture-key')).rejects.toMatchObject({ code: 'invalid_output' });
    const result = await service.execute(data, 'fixture-key');
    expect(result.plan?.steps).toEqual([{ type: 'setCaptionText', clipId: 'caption', text: 'Hello' }]);
  });
});

describe('normalized failures and bounded cancellation/retry', () => {
  it('never forwards provider key or prompt echoes', () => {
    const error = normalizeError({ status: 401, message: 'Invalid key SUPER_SECRET_KEY, prompt private' });
    expect(error.code).toBe('authentication'); expect(JSON.stringify(error)).not.toContain('SUPER_SECRET');
    expect(normalizeError({ status: 429, code: 'insufficient_quota' }).code).toBe('quota');
    expect(normalizeError({ status: 404 }).code).toBe('unsupported_model');
  });
  it('retries temporary failures only and respects cancellation before dispatch', async () => {
    const operation = vi.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValue('ok');
    expect(await withRetry(operation, undefined, { baseDelayMs: 1 })).toBe('ok'); expect(operation).toHaveBeenCalledTimes(2);
    const permanent = vi.fn().mockRejectedValue({ status: 401 });
    await expect(withRetry(permanent, undefined, { baseDelayMs: 1 })).rejects.toMatchObject({ code: 'authentication' }); expect(permanent).toHaveBeenCalledTimes(1);
    const controller = new AbortController(); controller.abort();
    await expect(withRetry(operation, controller.signal)).rejects.toMatchObject({ code: 'cancelled' }); expect(operation).toHaveBeenCalledTimes(2);
  });
  it('passes aborts into the in-flight transport and classifies timeout', async () => {
    const operation = (signal: AbortSignal) => new Promise<void>((_resolve, reject) => { signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }); });
    await expect(withRetry(operation, undefined, { timeoutMs: 5, retries: 0 })).rejects.toMatchObject({ code: 'timeout' });
    expect(new AIError('invalid_input', 'safe message').toJSON()).toEqual({ code: 'invalid_input', message: 'safe message', retryable: false });
  });
});
