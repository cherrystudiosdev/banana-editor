import { z } from 'zod';
import { ClipSchema, EffectSchema, KeyframePropertySchema, KeyframeSchema, MarkerSchema, MediaAssetSchema, RationalSchema, TextStyleSchema, TrackSchema, TransitionSchema, createClip, newId, type Clip, type Keyframe, type Project, type Track } from '../shared/model';
import { framesToSeconds } from './time';
import { evaluateEffects } from './evaluate';
import { validateProject } from './validation';

const id = z.string().min(1).max(128);
const frame = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const clipIds = z.array(id).min(1).max(100000);
const textStyle = z.object({ fontSize: z.number().finite().min(8).max(512).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), background: z.string().regex(/^(#[0-9a-fA-F]{6}|transparent)$/).optional(), align: z.enum(['left', 'center', 'right']).optional() }).strict();
const textCommand = { trackId: id.optional(), start: frame, duration: frame.refine(n => n > 0), text: z.string().max(20000), style: textStyle.optional() };
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addAsset'), asset: MediaAssetSchema }).strict(),
  z.object({ type: z.literal('updateAsset'), assetId: id, patch: MediaAssetSchema.omit({ id: true }).partial() }).strict(),
  z.object({ type: z.literal('removeAsset'), assetId: id }).strict(),
  z.object({ type: z.literal('addClip'), trackId: id, clip: ClipSchema }).strict(),
  z.object({ type: z.literal('splitClip'), clipId: id, frame }).strict(),
  z.object({ type: z.literal('trimClip'), clipId: id, start: frame.optional(), duration: frame.refine(n => n > 0).optional(), sourceIn: z.number().finite().nonnegative().optional(), ripple: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('moveClip'), clipId: id, start: frame, trackId: id.optional() }).strict(),
  z.object({ type: z.literal('deleteClips'), clipIds, ripple: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('setClipProperty'), clipId: id, property: EffectSchema.keyof(), value: z.union([z.number().finite(), z.literal('fit'), z.literal('fill')]) }).strict(),
  z.object({ type: z.literal('setClipVolume'), clipId: id, volume: z.number().finite().min(0).max(8) }).strict(),
  z.object({ type: z.literal('updateClip'), clipId: id, patch: z.object({ name: z.string().min(1).max(512).optional(), text: TextStyleSchema.optional() }).strict() }).strict(),
  z.object({ type: z.literal('setKeyframe'), clipId: id, keyframe: KeyframeSchema }).strict(),
  z.object({ type: z.literal('removeKeyframe'), clipId: id, property: KeyframePropertySchema, frame }).strict(),
  z.object({ type: z.literal('setTransition'), clipId: id, transition: TransitionSchema.optional() }).strict(),
  z.object({ type: z.literal('addTitle'), ...textCommand }).strict(),
  z.object({ type: z.literal('addCaption'), ...textCommand }).strict(),
  z.object({ type: z.literal('addMarker'), marker: MarkerSchema }).strict(),
  z.object({ type: z.literal('updateMarker'), markerId: id, patch: z.object({ frame: frame.optional(), name: z.string().min(1).max(512).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict() }).strict(),
  z.object({ type: z.literal('removeMarker'), markerId: id }).strict(),
  z.object({ type: z.literal('addTrack'), track: TrackSchema }).strict(),
  z.object({ type: z.literal('updateTrack'), trackId: id, patch: z.object({ name: z.string().min(1).max(512).optional(), locked: z.boolean().optional(), visible: z.boolean().optional(), muted: z.boolean().optional(), solo: z.boolean().optional() }).strict() }).strict(),
  z.object({ type: z.literal('removeTrack'), trackId: id }).strict(),
  z.object({ type: z.literal('linkClips'), clipIds }).strict(),
  z.object({ type: z.literal('unlinkClips'), clipIds }).strict(),
  z.object({ type: z.literal('detachAudio'), clipId: id, trackId: id.optional() }).strict(),
  z.object({ type: z.literal('setSequence'), patch: z.object({ name: z.string().min(1).max(512).optional(), width: z.number().int().min(16).max(8192).optional(), height: z.number().int().min(16).max(8192).optional(), fps: RationalSchema.optional(), sampleRate: z.union([z.literal(44100), z.literal(48000), z.literal(96000)]).optional() }).strict() }).strict(),
  z.object({ type: z.literal('renameProject'), name: z.string().min(1).max(512) }).strict(),
]);
export type Command = z.infer<typeof CommandSchema>;
export type ClipLocation = { clip: Clip; track: Track };
export function findClip(project: Project, clipId: string): ClipLocation {
  for (const track of project.sequence.tracks) { const clip = track.clips.find(c => c.id === clipId); if (clip) return { clip, track }; }
  throw new Error(`Clip does not exist: ${clipId}`);
}
function getTrack(project: Project, trackId: string): Track {
  const track = project.sequence.tracks.find(t => t.id === trackId);
  if (!track) throw new Error('Track does not exist');
  return track;
}
function assertUnlocked(track: Track): void { if (track.locked) throw new Error(`Track is locked: ${track.name}`); }
function linkedIds(project: Project, ids: string[]): string[] {
  const all = new Set(ids);
  for (const group of project.linkedGroups) if (group.clipIds.some(cid => all.has(cid))) group.clipIds.forEach(cid => all.add(cid));
  return [...all];
}
function selected(project: Project, ids: string[], expand = true): ClipLocation[] {
  return (expand ? linkedIds(project, ids) : [...new Set(ids)]).map(cid => { const found = findClip(project, cid); assertUnlocked(found.track); return found; });
}
function cleanGroups(project: Project): void {
  const existing = new Set(project.sequence.tracks.flatMap(t => t.clips.map(c => c.id)));
  project.linkedGroups = project.linkedGroups.map(g => ({ ...g, clipIds: g.clipIds.filter(cid => existing.has(cid)) })).filter(g => g.clipIds.length >= 2);
}
function cleanOrphanTransitions(project: Project): void {
  for (const track of project.sequence.tracks) {
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    sorted.forEach((c, i) => { if (c.transition && (!sorted[i - 1] || sorted[i - 1]!.start + sorted[i - 1]!.duration <= c.start)) delete c.transition; });
  }
}

function sliceKeyframes(original: Clip, start: number, duration: number): Keyframe[] {
  const keys: Keyframe[] = [];
  for (const property of ['x', 'y', 'scale', 'opacity', 'volume'] as const) {
    const k = original.keyframes.filter(v => v.property === property).sort((a, b) => a.frame - b.frame);
    if (!k.length) continue;
    const withoutFades = { ...original, effects: { ...original.effects, fadeIn: 0, fadeOut: 0 } };
    const atStart = evaluateEffects(withoutFades, start)[property];
    const left = [...k].reverse().find(v => v.frame <= start);
    keys.push({ property, frame: 0, value: atStart, interpolation: left?.interpolation ?? 'linear' });
    for (const key of k) if (key.frame > start && key.frame < start + duration) keys.push({ ...key, frame: key.frame - start });
    keys.push({ property, frame: duration, value: evaluateEffects(withoutFades, start + duration)[property], interpolation: 'linear' });
  }
  return keys;
}

/** Preserve the sampled appearance when a cut falls inside a fade. Fades are
 * relative to clip edges, so retaining them on both cut pieces would restart
 * the envelope. Convert that envelope to keys, sampling only nonlinear spans. */
function preserveSplitFades(original: Clip, slice: Clip, offset: number): void {
  if (!original.effects.fadeIn && !original.effects.fadeOut) return;
  slice.effects.fadeIn = 0; slice.effects.fadeOut = 0;
  slice.keyframes = slice.keyframes.filter(k => k.property !== 'opacity' && k.property !== 'volume');
  for (const property of ['opacity', 'volume'] as const) {
    const points = new Set<number>([0, slice.duration]);
    const add = (point: number): void => {
      for (const integer of [Math.floor(point), Math.ceil(point)]) if (integer >= 0 && integer <= slice.duration) points.add(integer);
    };
    for (const key of original.keyframes.filter(k => k.property === property)) { add(key.frame - offset); add(key.frame - offset - 1); }
    add(original.effects.fadeIn - offset);
    add(original.duration - original.effects.fadeOut - offset);
    if (original.effects.fadeIn && original.effects.fadeOut) add(original.duration * original.effects.fadeIn / (original.effects.fadeIn + original.effects.fadeOut) - offset);
    const boundaries = [...points].sort((a, b) => a - b);
    const value = (frame: number): number => evaluateEffects(original, offset + frame)[property];
    for (let i = 1; i < boundaries.length; i++) {
      const a = boundaries[i - 1]!, b = boundaries[i]!;
      if (b - a < 2) continue;
      const mid = Math.floor((a + b) / 2);
      const linear = value(a) + (value(b) - value(a)) * (mid - a) / (b - a);
      // Multiplication of an animated gain/opacity with a fade is quadratic.
      if (Math.abs(value(mid) - linear) > 1e-9) for (let frame = a + 1; frame < b; frame++) {
        if (points.size > 4900) throw new Error('Splitting this animated fade would exceed the keyframe limit; shorten the fade first');
        points.add(frame);
      }
    }
    slice.keyframes.push(...[...points].sort((a, b) => a - b).map(frame => ({ property, frame, value: value(frame), interpolation: 'linear' as const })));
  }
}

function apply(project: Project, command: Command): void {
  switch (command.type) {
    case 'addAsset': project.assets.push(structuredClone(command.asset)); return;
    case 'updateAsset': {
      const asset = project.assets.find(a => a.id === command.assetId); if (!asset) throw new Error('Asset does not exist');
      Object.assign(asset, command.patch); return;
    }
    case 'removeAsset': {
      if (project.sequence.tracks.some(t => t.clips.some(c => c.assetId === command.assetId))) throw new Error('Remove clips using this asset before removing it from the project');
      if (!project.assets.some(a => a.id === command.assetId)) throw new Error('Asset does not exist');
      project.assets = project.assets.filter(a => a.id !== command.assetId); return;
    }
    case 'addClip': { const track = getTrack(project, command.trackId); assertUnlocked(track); track.clips.push(structuredClone(command.clip)); return; }
    case 'moveClip': {
      const target = findClip(project, command.clipId); const delta = command.start - target.clip.start;
      const locations = selected(project, [command.clipId]);
      for (const { clip } of locations) clip.start += delta;
      if (command.trackId && command.trackId !== target.track.id) {
        const destination = getTrack(project, command.trackId); assertUnlocked(destination);
        target.track.clips = target.track.clips.filter(c => c.id !== target.clip.id); destination.clips.push(target.clip);
      }
      cleanOrphanTransitions(project); return;
    }
    case 'splitClip': {
      const locations = selected(project, [command.clipId]); const rightIds: string[] = [];
      for (const { clip, track } of locations) {
        const offset = command.frame - clip.start;
        if (offset <= 0 || offset >= clip.duration) throw new Error('Split must be strictly inside every linked clip');
        if (clip.transition && offset < clip.transition.duration) throw new Error('Split outside the cross dissolve, or remove the transition first');
        const original = structuredClone(clip); const right = structuredClone(clip);
        right.id = newId(); right.start = command.frame; right.duration -= offset;
        if (right.kind !== 'image' && right.kind !== 'title' && right.kind !== 'caption') right.sourceIn += framesToSeconds(offset, project.sequence.fps);
        right.effects.fadeIn = 0; right.effects.fadeOut = Math.min(original.effects.fadeOut, right.duration);
        delete right.transition;
        right.keyframes = sliceKeyframes(original, offset, right.duration);
        clip.duration = offset; clip.effects.fadeOut = 0; clip.effects.fadeIn = Math.min(original.effects.fadeIn, offset);
        clip.keyframes = sliceKeyframes(original, 0, offset);
        preserveSplitFades(original, clip, 0); preserveSplitFades(original, right, offset);
        track.clips.push(right); rightIds.push(right.id);
      }
      if (rightIds.length >= 2) project.linkedGroups.push({ id: newId(), clipIds: rightIds });
      return;
    }
    case 'trimClip': {
      const target = findClip(project, command.clipId).clip;
      const startDelta = (command.start ?? target.start) - target.start;
      const durationDelta = (command.duration ?? target.duration - startDelta) - target.duration;
      const sourceDelta = command.sourceIn !== undefined ? command.sourceIn - target.sourceIn : framesToSeconds(startDelta, project.sequence.fps);
      const locations = selected(project, [command.clipId]); const ids = new Set(locations.map(v => v.clip.id));
      for (const { clip, track } of locations) {
        const oldEnd = clip.start + clip.duration; const original = structuredClone(clip);
        clip.start += startDelta; clip.duration += durationDelta;
        if (clip.kind !== 'image' && clip.kind !== 'title' && clip.kind !== 'caption') clip.sourceIn += sourceDelta;
        clip.keyframes = sliceKeyframes(original, startDelta, clip.duration);
        clip.effects.fadeIn = Math.min(clip.effects.fadeIn, clip.duration); clip.effects.fadeOut = Math.min(clip.effects.fadeOut, clip.duration);
        if (command.ripple) {
          const delta = startDelta + durationDelta;
          for (const following of track.clips) if (!ids.has(following.id) && following.start >= oldEnd) {
            // A linked follower may be on another track; moving only one would desynchronize it.
            const peers = selected(project, [following.id]);
            for (const { clip: peer } of peers) { if (!ids.has(peer.id)) { peer.start += delta; ids.add(peer.id); } }
          }
        }
      }
      cleanOrphanTransitions(project); return;
    }
    case 'deleteClips': {
      const locations = selected(project, command.clipIds); const ids = new Set(locations.map(v => v.clip.id));
      const intervals = new Map<string, { start: number; end: number }[]>();
      for (const { clip, track } of locations) { const list = intervals.get(track.id) ?? []; list.push({ start: clip.start, end: clip.start + clip.duration }); intervals.set(track.id, list); }
      for (const track of project.sequence.tracks) track.clips = track.clips.filter(c => !ids.has(c.id));
      cleanGroups(project);
      if (command.ripple) {
        const shifts = new Map<string, number>();
        for (const [tid, list] of intervals) {
          const union: { start: number; end: number }[] = [];
          for (const interval of list.sort((a, b) => a.start - b.start)) { const last = union[union.length - 1]; if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end); else union.push({ ...interval }); }
          for (const clip of getTrack(project, tid).clips) {
            if (union.some(v => clip.start < v.end && clip.start + clip.duration > v.start)) throw new Error('Ripple range intersects another clip; remove its transition first');
            const shift = union.filter(v => v.end <= clip.start).reduce((n, v) => n - (v.end - v.start), 0);
            for (const cid of linkedIds(project, [clip.id])) {
              const previous = shifts.get(cid); if (previous !== undefined && previous !== shift) throw new Error('Ripple would desynchronize linked clips');
              shifts.set(cid, shift);
            }
          }
        }
        for (const [cid, shift] of shifts) { const { clip, track } = findClip(project, cid); if (shift) assertUnlocked(track); clip.start += shift; }
      }
      cleanOrphanTransitions(project); return;
    }
    case 'setClipProperty': { const { clip, track } = findClip(project, command.clipId); assertUnlocked(track); clip.effects = EffectSchema.parse({ ...clip.effects, [command.property]: command.value }); return; }
    case 'setClipVolume': { const { clip, track } = findClip(project, command.clipId); assertUnlocked(track); clip.effects.volume = command.volume; return; }
    case 'updateClip': { const { clip, track } = findClip(project, command.clipId); assertUnlocked(track); Object.assign(clip, command.patch); return; }
    case 'setKeyframe': { const { clip, track } = findClip(project, command.clipId); assertUnlocked(track); clip.keyframes = clip.keyframes.filter(k => k.property !== command.keyframe.property || k.frame !== command.keyframe.frame); clip.keyframes.push(command.keyframe); return; }
    case 'removeKeyframe': { const { clip, track } = findClip(project, command.clipId); assertUnlocked(track); clip.keyframes = clip.keyframes.filter(k => k.property !== command.property || k.frame !== command.frame); return; }
    case 'setTransition': {
      const { clip, track } = findClip(project, command.clipId); assertUnlocked(track);
      const sorted = [...track.clips].sort((a, b) => a.start - b.start); const previous = sorted[sorted.findIndex(c => c.id === clip.id) - 1];
      if (command.transition) {
        if (!previous) throw new Error('A cross dissolve requires a previous clip on this track');
        const overlap = command.transition.duration;
        if (overlap > clip.duration || overlap > previous.duration) throw new Error('Transition is longer than the available clip');
        // Move the incoming clip earlier using its existing media; no invented source handles.
        const delta = previous.start + previous.duration - overlap - clip.start;
        const peers = selected(project, [clip.id]);
        for (const { clip: peer } of peers) peer.start += delta;
        for (const { clip: peer, track: peerTrack } of peers) {
          const preceding = peerTrack.clips.filter(c => c.id !== peer.id && c.start < peer.start).sort((a, b) => b.start - a.start)[0];
          if (preceding && preceding.start + preceding.duration > peer.start) peer.transition = { ...command.transition };
          else delete peer.transition;
        }
        clip.transition = { ...command.transition };
      } else {
        if (clip.transition && previous) {
          const delta = previous.start + previous.duration - clip.start;
          for (const { clip: peer } of selected(project, [clip.id])) { peer.start += delta; delete peer.transition; }
        } else delete clip.transition;
      }
      return;
    }
    case 'addTitle': case 'addCaption': {
      const track = command.trackId ? getTrack(project, command.trackId) : [...project.sequence.tracks].reverse().find(t => t.kind === 'video' && !t.locked && !t.clips.some(c => c.start < command.start + command.duration && c.start + c.duration > command.start));
      if (!track || track.kind !== 'video') throw new Error('Choose an unlocked video track with room for the text');
      assertUnlocked(track);
      track.clips.push(createClip(command.type === 'addCaption' ? 'caption' : 'title', command.text.slice(0, 60) || (command.type === 'addCaption' ? 'Caption' : 'Title'), { start: command.start, duration: command.duration, text: { text: command.text, fontSize: command.type === 'addCaption' ? 48 : 80, color: '#ffffff', background: command.type === 'addCaption' ? '#16181c' : 'transparent', align: 'center', ...command.style }, effects: { y: command.type === 'addCaption' ? project.sequence.height * 0.36 : 0 } })); return;
    }
    case 'addMarker': project.sequence.markers.push(command.marker); return;
    case 'updateMarker': { const m = project.sequence.markers.find(v => v.id === command.markerId); if (!m) throw new Error('Marker does not exist'); Object.assign(m, command.patch); return; }
    case 'removeMarker': { if (!project.sequence.markers.some(v => v.id === command.markerId)) throw new Error('Marker does not exist'); project.sequence.markers = project.sequence.markers.filter(v => v.id !== command.markerId); return; }
    case 'addTrack': project.sequence.tracks.push(command.track); return;
    case 'updateTrack': {
      const track = getTrack(project, command.trackId);
      if (track.locked && (command.patch.name !== undefined || command.patch.visible !== undefined || command.patch.muted !== undefined || command.patch.solo !== undefined)) throw new Error('Unlock the track before modifying it');
      Object.assign(track, command.patch); return;
    }
    case 'removeTrack': { const track = getTrack(project, command.trackId); assertUnlocked(track); project.sequence.tracks = project.sequence.tracks.filter(t => t.id !== track.id); cleanGroups(project); return; }
    case 'linkClips': {
      const locations = selected(project, command.clipIds); const ids = [...new Set(locations.map(v => v.clip.id))];
      if (ids.length < 2) throw new Error('Select at least two clips to link');
      project.linkedGroups = project.linkedGroups.filter(g => !g.clipIds.some(cid => ids.includes(cid))); project.linkedGroups.push({ id: newId(), clipIds: ids }); return;
    }
    case 'unlinkClips': { selected(project, command.clipIds); const ids = new Set(command.clipIds); project.linkedGroups = project.linkedGroups.filter(g => !g.clipIds.some(cid => ids.has(cid))); return; }
    case 'detachAudio': {
      const { clip, track } = findClip(project, command.clipId); assertUnlocked(track);
      const asset = project.assets.find(a => a.id === clip.assetId);
      if (clip.kind !== 'video' || !asset?.hasAudio) throw new Error('The selected video has no audio to detach');
      const destination = command.trackId ? getTrack(project, command.trackId) : project.sequence.tracks.find(t => t.kind === 'audio' && !t.locked && !t.clips.some(c => c.start < clip.start + clip.duration && c.start + c.duration > clip.start));
      if (!destination || destination.kind !== 'audio') throw new Error('An unlocked audio track with enough space is required');
      assertUnlocked(destination);
      const audio = createClip('audio', clip.name, { assetId: clip.assetId, start: clip.start, duration: clip.duration, sourceIn: clip.sourceIn, effects: { volume: clip.effects.volume, fadeIn: clip.effects.fadeIn, fadeOut: clip.effects.fadeOut }, keyframes: clip.keyframes.filter(k => k.property === 'volume') });
      clip.effects.volume = 0; clip.keyframes = clip.keyframes.filter(k => k.property !== 'volume'); destination.clips.push(audio);
      const group = project.linkedGroups.find(g => g.clipIds.includes(clip.id)); if (group) group.clipIds.push(audio.id); else project.linkedGroups.push({ id: newId(), clipIds: [clip.id, audio.id] }); return;
    }
    case 'setSequence': Object.assign(project.sequence, command.patch); return;
    case 'renameProject': project.name = command.name; return;
  }
}

export function executeCommands(project: Project, commands: readonly Command[]): Project {
  if (!commands.length) return project;
  const parsed = z.array(CommandSchema).max(100000).parse(commands);
  const draft = structuredClone(project);
  for (const command of parsed) apply(draft, command);
  draft.revision = project.revision + 1;
  return validateProject(draft);
}

export interface ClipboardData { clips: { trackId: string; trackKind: Track['kind']; clip: Clip }[]; groups: string[][] }
export function copyClips(project: Project, ids: string[]): ClipboardData {
  const allIds = new Set(linkedIds(project, ids));
  return { clips: [...allIds].map(cid => { const { clip, track } = findClip(project, cid); return { trackId: track.id, trackKind: track.kind, clip: structuredClone(clip) }; }), groups: project.linkedGroups.filter(g => g.clipIds.every(cid => allIds.has(cid))).map(g => [...g.clipIds]) };
}
export function pasteClips(project: Project, clipboard: ClipboardData, atFrame: number): Command[] {
  if (!clipboard.clips.length) return [];
  const earliest = Math.min(...clipboard.clips.map(v => v.clip.start)); const mapped = new Map<string, string>(); const commands: Command[] = [];
  for (const item of clipboard.clips) {
    const track = project.sequence.tracks.find(t => t.id === item.trackId) ?? project.sequence.tracks.find(t => t.kind === item.trackKind && !t.locked);
    if (!track) throw new Error('Clipboard target track does not exist');
    const clip = structuredClone(item.clip); clip.id = newId(); clip.start += atFrame - earliest;
    // A dissolve is meaningful only when its outgoing partner is included.
    if (clip.transition && !clipboard.clips.some(other => other.trackId === item.trackId && other.clip.id !== item.clip.id && other.clip.start < item.clip.start && other.clip.start + other.clip.duration - item.clip.start === clip.transition!.duration)) delete clip.transition;
    mapped.set(item.clip.id, clip.id); commands.push({ type: 'addClip', trackId: track.id, clip });
  }
  for (const group of clipboard.groups) commands.push({ type: 'linkClips', clipIds: group.map(cid => mapped.get(cid)!) });
  return commands;
}
export function duplicateClips(project: Project, ids: string[]): Command[] {
  const clipboard = copyClips(project, ids); const end = Math.max(0, ...clipboard.clips.map(v => v.clip.start + v.clip.duration));
  return pasteClips(project, clipboard, end);
}
export function snapFrame(project: Project, proposed: number, tolerance = 6, excludedClipIds: string[] = []): number {
  const points = [0, ...project.sequence.markers.map(m => m.frame), ...project.sequence.tracks.flatMap(t => t.clips.filter(c => !excludedClipIds.includes(c.id)).flatMap(c => [c.start, c.start + c.duration]))];
  let best = Math.max(0, Math.round(proposed)); let distance = tolerance + 1;
  for (const point of points) if (Math.abs(point - proposed) <= tolerance && Math.abs(point - proposed) < distance) { best = point; distance = Math.abs(point - proposed); }
  return best;
}
