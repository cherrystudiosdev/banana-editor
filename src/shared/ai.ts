import { z } from 'zod';
import type { Project } from './model';

export const ProviderIdSchema = z.enum(['openai', 'gemini']);
export type ProviderId = z.infer<typeof ProviderIdSchema>;
export const AITaskSchema = z.enum(['chat', 'summary', 'markers', 'titles', 'shortCut', 'edit', 'transcribe', 'translate', 'correct']);
export type AITask = z.infer<typeof AITaskSchema>;
export const AIConfigurationSchema = z.object({
  enabled: z.boolean(), provider: ProviderIdSchema,
  model: z.string().trim().min(1).max(200),
  transcriptionModel: z.string().trim().min(1).max(200),
}).strict();
export type AIConfiguration = z.infer<typeof AIConfigurationSchema>;
export const DEFAULT_AI_CONFIGURATION: AIConfiguration = {
  enabled: false, provider: 'openai', model: 'gpt-6-astra', transcriptionModel: 'gpt-transcribe',
};
export const PROVIDER_DEFAULTS = { openai: 'gpt-6-astra', gemini: 'gemini-3.8-flash' } as const;

const frame = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const clipId = z.string().min(1).max(128);
export const EditStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('splitClip'), clipId, frame }).strict(),
  z.object({ type: z.literal('trimClip'), clipId, start: frame, duration: frame.positive(), sourceIn: z.number().finite().nonnegative() }).strict(),
  z.object({ type: z.literal('addMarker'), frame, name: z.string().min(1).max(512) }).strict(),
  z.object({ type: z.literal('addCaption'), trackId: clipId, start: frame, duration: frame.positive(), text: z.string().min(1).max(20000) }).strict(),
  z.object({ type: z.literal('addTitle'), trackId: clipId, start: frame, duration: frame.positive(), text: z.string().min(1).max(20000) }).strict(),
  z.object({ type: z.literal('setClipVolume'), clipId, volume: z.number().finite().min(0).max(8) }).strict(),
  z.object({ type: z.literal('setClipProperty'), clipId, property: z.enum(['x', 'y', 'scale', 'rotation', 'opacity', 'brightness', 'contrast', 'saturation', 'cropTop', 'cropBottom', 'cropLeft', 'cropRight', 'volume', 'fadeIn', 'fadeOut']), value: z.number().finite() }).strict(),
  z.object({ type: z.literal('setCaptionText'), clipId, text: z.string().min(1).max(20000) }).strict(),
]);
export type EditStep = z.infer<typeof EditStepSchema>;
export const EditPlanSchema = z.object({
  schemaVersion: z.literal(1), id: clipId, projectId: clipId, sequenceId: clipId,
  baseRevision: frame, description: z.string().min(1).max(10000), steps: z.array(EditStepSchema).min(1).max(500),
}).strict();
export type EditPlan = z.infer<typeof EditPlanSchema>;
export const TranscriptSegmentSchema = z.object({
  clipId, start: z.number().finite().nonnegative(), end: z.number().finite().nonnegative(), text: z.string().max(20000),
  timing: z.enum(['segment', 'chunk', 'estimated']),
}).strict();
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
export const TranscriptSchema = z.object({
  segments: z.array(TranscriptSegmentSchema).max(10000),
  language: z.string().max(100).nullable(), wordTimestamps: z.literal(false),
}).strict();
export type Transcript = z.infer<typeof TranscriptSchema>;
export interface AIUsage { inputTokens?: number; outputTokens?: number; totalTokens?: number; audioSeconds?: number }
export interface AIResult { text: string; plan?: EditPlan; transcript?: Transcript; usage: AIUsage; warnings: string[] }
export interface AICapabilities {
  chat: boolean; structuredOutput: boolean; images: boolean; video: boolean; audio: boolean;
  transcribe: boolean; segmentTimestamps: boolean; wordTimestamps: false; known: boolean;
}
/** Main-process-only bounded media, already extracted from the user-approved range. */
export interface PreparedMedia {
  clipId: string; kind: 'image' | 'audio' | 'video'; mimeType: string; data: Uint8Array;
  sourceStart: number; duration: number;
}
export interface AIRequest {
  provider: ProviderId; model: string; task: AITask; prompt: string; project: Project;
  selectedClipIds: string[]; media?: PreparedMedia[]; transcript?: Transcript; language?: string;
}
export const AIErrorCodeSchema = z.enum(['cancelled', 'timeout', 'authentication', 'quota', 'rate_limit', 'network', 'unsupported_model', 'invalid_input', 'invalid_output', 'refused', 'provider_error']);
export type AIErrorCode = z.infer<typeof AIErrorCodeSchema>;
export interface AIErrorData { code: AIErrorCode; message: string; retryable: boolean }
