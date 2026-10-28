import { z } from 'zod';

const id = z.string().min(1).max(128);
const frame = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const finite = z.number().finite();
export const RationalSchema = z.object({ num: z.number().int().positive().max(240000), den: z.number().int().positive().max(100000) }).strict();
export type Rational = z.infer<typeof RationalSchema>;
export const EffectSchema = z.object({
  x: finite.min(-32768).max(32768).default(0), y: finite.min(-32768).max(32768).default(0),
  scale: finite.min(0.01).max(16).default(1), rotation: finite.min(-36000).max(36000).default(0),
  opacity: finite.min(0).max(1).default(1), brightness: finite.min(-1).max(1).default(0),
  contrast: finite.min(0).max(4).default(1), saturation: finite.min(0).max(4).default(1),
  cropTop: finite.min(0).max(0.99).default(0), cropBottom: finite.min(0).max(0.99).default(0),
  cropLeft: finite.min(0).max(0.99).default(0), cropRight: finite.min(0).max(0.99).default(0),
  fit: z.enum(['fit', 'fill']).default('fit'), volume: finite.min(0).max(8).default(1),
  fadeIn: frame.default(0), fadeOut: frame.default(0),
}).strict();
export type Effect = z.infer<typeof EffectSchema>;
export const KeyframePropertySchema = z.enum(['x', 'y', 'scale', 'opacity', 'volume']);
export const KeyframeSchema = z.object({ property: KeyframePropertySchema, frame, value: finite, interpolation: z.enum(['linear', 'hold']).default('linear') }).strict();
export type Keyframe = z.infer<typeof KeyframeSchema>;
export const TransitionSchema = z.object({ type: z.literal('crossDissolve'), duration: frame.refine(n => n > 0) }).strict();
export type Transition = z.infer<typeof TransitionSchema>;
export const TextStyleSchema = z.object({ text: z.string().max(20000), fontSize: finite.min(8).max(512).default(64), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'), background: z.string().regex(/^(#[0-9a-fA-F]{6}|transparent)$/).default('transparent'), align: z.enum(['left', 'center', 'right']).default('center') }).strict();
export const ClipSchema = z.object({
  id, name: z.string().min(1).max(512), kind: z.enum(['video', 'audio', 'image', 'title', 'caption']),
  assetId: id.optional(), start: frame, duration: frame.refine(n => n > 0), sourceIn: finite.nonnegative().default(0),
  effects: EffectSchema.default(() => EffectSchema.parse({})), keyframes: z.array(KeyframeSchema).max(10000).default([]),
  text: TextStyleSchema.optional(), transition: TransitionSchema.optional(),
}).strict();
export type Clip = z.infer<typeof ClipSchema>;
export type Caption = Clip & { kind: 'caption'; text: z.infer<typeof TextStyleSchema> };
export const MediaAssetSchema = z.object({
  id, name: z.string().min(1).max(512), path: z.string().min(1).max(32768), kind: z.enum(['video', 'audio', 'image']),
  duration: finite.nonnegative(), width: z.number().int().nonnegative().max(32768), height: z.number().int().nonnegative().max(32768),
  fps: RationalSchema.optional(), hasAudio: z.boolean(), videoCodec: z.string().max(100).optional(), audioCodec: z.string().max(100).optional(),
  thumbnail: z.string().max(32768).optional(), waveform: z.array(finite.min(0).max(1)).max(20000).optional(),
  proxyPath: z.string().max(32768).optional(), folder: z.string().max(512).optional(),
}).strict();
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export const MarkerSchema = z.object({ id, frame, name: z.string().min(1).max(512), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f4dc54') }).strict();
export type Marker = z.infer<typeof MarkerSchema>;
export const TrackSchema = z.object({ id, name: z.string().min(1).max(512), kind: z.enum(['video', 'audio']), locked: z.boolean().default(false), visible: z.boolean().default(true), muted: z.boolean().default(false), solo: z.boolean().default(false), clips: z.array(ClipSchema).max(100000).default([]) }).strict();
export type Track = z.infer<typeof TrackSchema>;
export const SequenceSchema = z.object({ id, name: z.string().min(1).max(512), width: z.number().int().min(16).max(8192), height: z.number().int().min(16).max(8192), fps: RationalSchema, sampleRate: z.union([z.literal(44100), z.literal(48000), z.literal(96000)]), tracks: z.array(TrackSchema).min(1).max(128), markers: z.array(MarkerSchema).max(100000).default([]) }).strict();
export type Sequence = z.infer<typeof SequenceSchema>;
export const LinkedClipGroupSchema = z.object({ id, clipIds: z.array(id).min(2).max(128) }).strict();
export type LinkedClipGroup = z.infer<typeof LinkedClipGroupSchema>;
export const ProjectSchema = z.object({ schemaVersion: z.literal(1), appVersion: z.string().default('1.0.0'), id, name: z.string().min(1).max(512), revision: frame, assets: z.array(MediaAssetSchema).max(100000), sequence: SequenceSchema, linkedGroups: z.array(LinkedClipGroupSchema).default([]), appliedPlanIds: z.array(id).max(100000).default([]) }).strict();
export type Project = z.infer<typeof ProjectSchema>;

export function newId(): string { return crypto.randomUUID(); }
export function createTrack(kind: Track['kind'], name = kind === 'video' ? 'Video' : 'Audio', overrides: Partial<Track> = {}): Track {
  return TrackSchema.parse({ id: newId(), kind, name, clips: [], ...overrides });
}
export function createClip(kind: Clip['kind'], name: string, overrides: Partial<Omit<Clip, 'effects'>> & { effects?: Partial<Effect> } = {}): Clip {
  return ClipSchema.parse({ id: newId(), kind, name, start: 0, duration: 150, sourceIn: 0, effects: {}, keyframes: [], ...overrides });
}
export function createProject(name = 'Untitled project'): Project {
  return ProjectSchema.parse({ schemaVersion: 1, appVersion: '1.0.0', id: newId(), name, revision: 0, assets: [], linkedGroups: [], appliedPlanIds: [], sequence: { id: newId(), name: 'Sequence 01', width: 1920, height: 1080, fps: { num: 30, den: 1 }, sampleRate: 48000, tracks: [createTrack('video', 'V1'), createTrack('video', 'V2'), createTrack('audio', 'A1'), createTrack('audio', 'A2')], markers: [] } });
}
