import { EffectSchema, ProjectSchema, type Project } from '../shared/model';
import { framesToSeconds } from './time';

export function validateProject(input: unknown): Project {
  const p = ProjectSchema.parse(input);
  const ids = new Set<string>();
  const unique = (value: string): void => { if (ids.has(value)) throw new Error(`Duplicate identifier: ${value}`); ids.add(value); };
  unique(p.id); unique(p.sequence.id);
  const assets = new Map(p.assets.map(a => { unique(a.id); return [a.id, a] as const; }));
  const clips = new Map(p.sequence.tracks.flatMap(t => t.clips.map(c => [c.id, c] as const)));
  for (const track of p.sequence.tracks) {
    unique(track.id);
    const sorted = [...track.clips].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i]!; unique(c.id);
      if (!Number.isSafeInteger(c.start + c.duration)) throw new Error('Clip end is outside supported time range');
      if (track.kind === 'audio' && c.kind !== 'audio') throw new Error('Only audio clips can be placed on audio tracks');
      if (track.kind === 'video' && c.kind === 'audio') throw new Error('Audio clips require an audio track');
      if (c.kind === 'title' || c.kind === 'caption') {
        if (!c.text) throw new Error('Text clip has no text content');
        if (c.assetId) throw new Error('Text clips cannot reference a media asset');
      } else {
        const a = c.assetId ? assets.get(c.assetId) : undefined;
        if (!a) throw new Error(`Missing media asset for clip ${c.name}`);
        if (c.kind === 'audio' && !a.hasAudio) throw new Error('Media asset does not contain audio');
        if (c.kind === 'video' && a.kind !== 'video') throw new Error('Video clip requires a video asset');
        if (c.kind === 'image' && a.kind !== 'image') throw new Error('Image clip requires an image asset');
        if (c.kind !== 'image' && c.sourceIn + framesToSeconds(c.duration, p.sequence.fps) > a.duration + 0.000001) throw new Error(`Clip exceeds source duration: ${c.name}`);
      }
      if (c.effects.cropTop + c.effects.cropBottom >= 1 || c.effects.cropLeft + c.effects.cropRight >= 1) throw new Error('Crop must leave a nonempty image');
      if (c.effects.fadeIn > c.duration || c.effects.fadeOut > c.duration) throw new Error('Fade duration exceeds clip duration');
      const kfIds = new Set<string>();
      for (const k of c.keyframes) {
        if (k.frame > c.duration) throw new Error('Keyframe lies outside the clip');
        const key = `${k.property}:${k.frame}`;
        if (kfIds.has(key)) throw new Error('Duplicate keyframe');
        kfIds.add(key);
        EffectSchema.parse({ ...c.effects, [k.property]: k.value });
      }
      const previous = sorted[i - 1]; const overlap = previous ? previous.start + previous.duration - c.start : 0;
      if (overlap > 0 && (!c.transition || c.transition.duration !== overlap || overlap > c.duration || overlap > previous!.duration)) throw new Error('Clips on one track may overlap only for an explicit matching cross dissolve');
      if (c.transition && (overlap <= 0 || c.transition.duration !== overlap)) throw new Error('Cross dissolve requires a matching overlap with the previous clip');
      const beforePrevious = sorted[i - 2];
      if (beforePrevious && beforePrevious.start + beforePrevious.duration > c.start) throw new Error('Three clips cannot overlap on the same track');
    }
  }
  for (const m of p.sequence.markers) unique(m.id);
  const grouped = new Set<string>();
  for (const g of p.linkedGroups) {
    unique(g.id);
    for (const cid of g.clipIds) {
      if (!clips.has(cid)) throw new Error('Linked group references a missing clip');
      if (grouped.has(cid)) throw new Error('A clip cannot belong to multiple linked groups');
      grouped.add(cid);
    }
  }
  if (new Set(p.appliedPlanIds).size !== p.appliedPlanIds.length) throw new Error('Duplicate applied plan identifier');
  return p;
}

export function parseProject(json: string | unknown): Project {
  const value: unknown = typeof json === 'string' ? JSON.parse(json) : json;
  if (!value || typeof value !== 'object' || !('schemaVersion' in value)) throw new Error('This file is not a versioned Banana project');
  if (value.schemaVersion !== 1) throw new Error(`Unsupported project schema ${String(value.schemaVersion)}. The original file has not been changed.`);
  return validateProject(value);
}

// Migrations are deliberately explicit; v1 has no older released formats.
export const migrateProject = parseProject;
export function serializeProject(project: Project): string { return JSON.stringify(validateProject(project), null, 2) + '\n'; }
