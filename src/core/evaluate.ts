import type { Clip, Effect, MediaAsset, Project, Track } from '../shared/model';
import { framesToSeconds } from './time';
export { durationFrames } from './time';

export function evaluateEffects(clip: Clip, localFrame: number): Effect {
  const effects = { ...clip.effects };
  for (const property of ['x', 'y', 'scale', 'opacity', 'volume'] as const) {
    const keys = clip.keyframes.filter(k => k.property === property).sort((a, b) => a.frame - b.frame);
    if (!keys.length) continue;
    const first = keys[0]!; const last = keys[keys.length - 1]!;
    if (localFrame <= first.frame) { effects[property] = first.value; continue; }
    if (localFrame >= last.frame) { effects[property] = last.value; continue; }
    for (let i = 1; i < keys.length; i++) {
      const next = keys[i]!; const prev = keys[i - 1]!;
      if (localFrame <= next.frame) {
        effects[property] = prev.interpolation === 'hold' ? (localFrame === next.frame ? next.value : prev.value) : prev.value + (next.value - prev.value) * (localFrame - prev.frame) / (next.frame - prev.frame);
        break;
      }
    }
  }
  const fade = Math.min(clip.effects.fadeIn ? Math.max(0, localFrame) / clip.effects.fadeIn : 1, clip.effects.fadeOut ? Math.max(0, clip.duration - localFrame) / clip.effects.fadeOut : 1, 1);
  effects.opacity *= fade; effects.volume *= fade;
  return effects;
}

export interface EvaluatedClip { clip: Clip; track: Track; asset?: MediaAsset; localFrame: number; sourceTime: number; effects: Effect }
export interface EvaluatedFrame { frame: number; seconds: number; layers: EvaluatedClip[]; audio: EvaluatedClip[] }
export function sampleFrame(project: Project, frame: number): EvaluatedFrame {
  const result: EvaluatedFrame = { frame, seconds: framesToSeconds(frame, project.sequence.fps), layers: [], audio: [] };
  const assets = new Map(project.assets.map(a => [a.id, a]));
  const anySolo = project.sequence.tracks.some(t => t.solo);
  for (const track of project.sequence.tracks) {
    const clips = [...track.clips].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]!;
      if (frame < clip.start || frame >= clip.start + clip.duration) continue;
      const localFrame = frame - clip.start; const effects = evaluateEffects(clip, localFrame);
      // Incoming dissolve blends over the full outgoing picture; only audio fades both sides.
      if (clip.transition && localFrame < clip.transition.duration) {
        effects.opacity *= localFrame / clip.transition.duration;
        effects.volume *= localFrame / clip.transition.duration;
      }
      const next = clips[i + 1];
      if (next?.transition && frame >= next.start) effects.volume *= Math.max(0, 1 - (frame - next.start) / next.transition.duration);
      const value: EvaluatedClip = { clip, track, asset: clip.assetId ? assets.get(clip.assetId) : undefined, localFrame, sourceTime: clip.sourceIn + framesToSeconds(localFrame, project.sequence.fps), effects };
      if (track.visible && clip.kind !== 'audio') result.layers.push(value);
      if (!track.muted && (!anySolo || track.solo) && value.asset?.hasAudio && (clip.kind === 'audio' || clip.kind === 'video')) result.audio.push(value);
    }
  }
  return result;
}
