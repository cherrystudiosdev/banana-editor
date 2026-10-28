import { describe, expect, it } from 'vitest';
import { createClip, createProject, createTrack, newId, type Project } from '../../src/shared/model';
import { copyClips, duplicateClips, executeCommands, findClip, pasteClips, snapFrame } from '../../src/core/commands';
import { History } from '../../src/core/history';
import { evaluateEffects, sampleFrame } from '../../src/core/evaluate';
import { durationFrames, formatTimecode, framesToSamples, framesToSeconds, secondsToFrames } from '../../src/core/time';
import { parseProject, serializeProject, validateProject } from '../../src/core/validation';
import { captionCommands, captionsFromProject, mapTranscriptToClip, parseCaptions, serializeCaptions } from '../../src/core/captions';

function fixture(): Project {
  const project = createProject('Türkçe project');
  project.assets = [
    { id: 'video', name: 'Video', path: 'C:/Medya özel/a "clip" & 1.mp4', kind: 'video', duration: 20, width: 1920, height: 1080, hasAudio: true },
    { id: 'audio', name: 'Audio', path: './sound.wav', kind: 'audio', duration: 20, width: 0, height: 0, hasAudio: true },
    { id: 'image', name: 'Image', path: './image.png', kind: 'image', duration: 0, width: 640, height: 480, hasAudio: false },
  ];
  project.sequence.tracks[0]!.clips.push(createClip('video', 'First', { id: 'first', assetId: 'video', duration: 90, sourceIn: 2 }));
  project.sequence.tracks[0]!.clips.push(createClip('video', 'Second', { id: 'second', assetId: 'video', start: 120, duration: 60, sourceIn: 5 }));
  project.sequence.tracks[2]!.clips.push(createClip('audio', 'Music', { id: 'music', assetId: 'audio', duration: 180 }));
  return validateProject(project);
}

describe('rational timeline and schema', () => {
  it('converts rational frames and sample positions without accumulating floating-point increments', () => {
    const fps = { num: 30000, den: 1001 };
    expect(framesToSeconds(30000, fps)).toBe(1001);
    expect(secondsToFrames(1001, fps)).toBe(30000);
    expect(framesToSamples(30000, fps, 48000)).toBe(48048000);
    expect(framesToSamples(1, fps, 48000)).toBe(1602);
    expect(formatTimecode(1800, { num: 30, den: 1 })).toBe('00:01:00:00');
  });
  it('round-trips the complete project including unusual paths and Turkish text', () => {
    const project = fixture(); expect(parseProject(serializeProject(project))).toEqual(project);
    expect(durationFrames(project)).toBe(180);
  });
  it('rejects newer schemas, unknown secret fields, duplicate IDs and missing media', () => {
    const project = fixture();
    expect(() => parseProject({ ...project, schemaVersion: 2 })).toThrow('Unsupported project schema');
    expect(() => parseProject({ ...project, apiKey: 'secret' })).toThrow();
    project.assets[1]!.id = 'video'; expect(() => validateProject(project)).toThrow('Duplicate');
    const missing = fixture(); missing.assets = []; expect(() => validateProject(missing)).toThrow('Missing media');
  });
  it('rejects source overflow, negative time, illegal track kinds, empty crop and invalid keyframes', () => {
    const project = fixture(); const clip = project.sequence.tracks[0]!.clips[0]!;
    clip.sourceIn = 19; expect(() => validateProject(project)).toThrow('source duration');
    clip.sourceIn = 2; clip.start = -1; expect(() => validateProject(project)).toThrow();
    clip.start = 0; clip.effects.cropLeft = 0.8; clip.effects.cropRight = 0.3; expect(() => validateProject(project)).toThrow('Crop');
    clip.effects.cropLeft = 0; clip.effects.cropRight = 0; clip.keyframes = [{ property: 'opacity', frame: 0, value: 2, interpolation: 'linear' }]; expect(() => validateProject(project)).toThrow();
  });
});

describe('transactional editing', () => {
  it('splits at an exact frame and preserves source in/out points', () => {
    const project = fixture(); const next = executeCommands(project, [{ type: 'splitClip', clipId: 'first', frame: 30 }]);
    expect(findClip(next, 'first').clip.duration).toBe(30);
    const right = next.sequence.tracks[0]!.clips.find(c => c.start === 30)!;
    expect(right.duration).toBe(60); expect(right.sourceIn).toBe(3);
    expect(project.sequence.tracks[0]!.clips[0]!.duration).toBe(90);
    expect(next.revision).toBe(project.revision + 1);
  });
  it('rejects invalid final state without applying earlier commands to the original', () => {
    const project = fixture(); const before = JSON.stringify(project);
    expect(() => executeCommands(project, [{ type: 'renameProject', name: 'Changed' }, { type: 'moveClip', clipId: 'second', start: 50 }])).toThrow('overlap');
    expect(JSON.stringify(project)).toBe(before);
  });
  it('trims the source start and preserves a normal delete gap', () => {
    const trimmed = executeCommands(fixture(), [{ type: 'trimClip', clipId: 'first', start: 15 }]);
    expect(findClip(trimmed, 'first').clip).toMatchObject({ start: 15, duration: 75, sourceIn: 2.5 });
    const deleted = executeCommands(trimmed, [{ type: 'deleteClips', clipIds: ['first'] }]);
    expect(findClip(deleted, 'second').clip.start).toBe(120);
  });
  it('ripple delete closes only deleted duration on affected tracks', () => {
    const next = executeCommands(fixture(), [{ type: 'deleteClips', clipIds: ['first'], ripple: true }]);
    expect(findClip(next, 'second').clip.start).toBe(30);
    expect(findClip(next, 'music').clip.start).toBe(0);
  });
  it('ripple trim shifts followers by the end delta', () => {
    const next = executeCommands(fixture(), [{ type: 'trimClip', clipId: 'first', duration: 60, ripple: true }]);
    expect(findClip(next, 'second').clip.start).toBe(90);
    expect(findClip(next, 'music').clip.duration).toBe(180);
  });
  it('linked clips move, split and delete together and honor all locks', () => {
    let project = fixture();
    project = executeCommands(project, [{ type: 'detachAudio', clipId: 'first' }]);
    const group = project.linkedGroups[0]!; const audioId = group.clipIds.find(cid => cid !== 'first')!;
    expect(findClip(project, 'first').clip.effects.volume).toBe(0);
    project = executeCommands(project, [{ type: 'moveClip', clipId: 'first', start: 15 }]);
    expect(findClip(project, audioId).clip.start).toBe(15);
    project = executeCommands(project, [{ type: 'splitClip', clipId: 'first', frame: 45 }]);
    expect(project.linkedGroups).toHaveLength(2);
    project = executeCommands(project, [{ type: 'updateTrack', trackId: findClip(project, audioId).track.id, patch: { locked: true } }]);
    expect(() => executeCommands(project, [{ type: 'deleteClips', clipIds: ['first'] }])).toThrow('locked');
  });
  it('copy/paste and duplicate preserve links with fresh IDs', () => {
    let project = fixture(); project = executeCommands(project, [{ type: 'detachAudio', clipId: 'first' }]);
    const clipboard = copyClips(project, ['first']); expect(clipboard.clips).toHaveLength(2);
    const commands = pasteClips(project, clipboard, 210); const pasted = executeCommands(project, commands);
    expect(pasted.linkedGroups).toHaveLength(2); expect(pasted.sequence.tracks.flatMap(t => t.clips).filter(c => c.start === 210)).toHaveLength(2);
    const isolated = createProject(); isolated.assets = fixture().assets; isolated.sequence.tracks[0]!.clips = [createClip('video', 'Copy', { id: 'copy', assetId: 'video', duration: 30 })];
    expect(executeCommands(isolated, duplicateClips(isolated, ['copy'])).sequence.tracks[0]!.clips.map(c => c.start)).toEqual([0, 30]);
  });
  it('track operations do not delete source files or referenced media', () => {
    const project = fixture(); expect(() => executeCommands(project, [{ type: 'removeAsset', assetId: 'video' }])).toThrow('Remove clips');
    const next = executeCommands(project, [{ type: 'removeTrack', trackId: project.sequence.tracks[0]!.id }]); expect(next.assets).toEqual(project.assets);
  });
  it('track and marker partial updates preserve unspecified state', () => {
    let project = fixture(); const trackId = project.sequence.tracks[0]!.id;
    project = executeCommands(project, [{ type: 'updateTrack', trackId, patch: { muted: true, visible: false, solo: true } }]);
    project = executeCommands(project, [{ type: 'updateTrack', trackId, patch: { name: 'Renamed' } }]);
    expect(project.sequence.tracks[0]).toMatchObject({ name: 'Renamed', muted: true, visible: false, solo: true });
    const markerId = newId(); project = executeCommands(project, [{ type: 'addMarker', marker: { id: markerId, frame: 4, name: 'Red', color: '#ff0000' } }]);
    project = executeCommands(project, [{ type: 'updateMarker', markerId, patch: { frame: 5 } }]);
    expect(project.sequence.markers[0]!.color).toBe('#ff0000');
  });
  it('undo/redo groups batches and keeps revisions increasing', () => {
    const history = new History(fixture());
    history.execute([{ type: 'renameProject', name: 'Changed' }, { type: 'setClipVolume', clipId: 'music', volume: 0.25 }]);
    expect(history.current.revision).toBe(1); expect(history.undo().name).toBe('Türkçe project'); expect(history.current.revision).toBe(2);
    expect(history.redo().name).toBe('Changed'); expect(history.current.revision).toBe(3);
    expect(findClip(history.current, 'music').clip.effects.volume).toBe(0.25);
    history.undo(); history.execute([{ type: 'renameProject', name: 'New branch' }]); expect(history.canRedo).toBe(false);
  });
  it('snaps to edits and markers within a pixel-converted frame tolerance', () => {
    const project = fixture(); expect(snapFrame(project, 88, 3)).toBe(90); expect(snapFrame(project, 88, 1)).toBe(88);
  });
});

describe('shared timeline evaluation', () => {
  it('uses half-open ranges, bottom-to-top layers and independent audio mute/solo', () => {
    const project = fixture();
    project.sequence.tracks[1]!.clips.push(createClip('image', 'Overlay', { assetId: 'image', duration: 60 }));
    expect(sampleFrame(project, 20).layers.map(l => l.clip.name)).toEqual(['First', 'Overlay']);
    expect(sampleFrame(project, 90).layers).toHaveLength(0);
    expect(sampleFrame(project, 20).audio).toHaveLength(2);
    project.sequence.tracks[2]!.solo = true; expect(sampleFrame(project, 20).audio.map(v => v.clip.id)).toEqual(['music']);
    project.sequence.tracks[2]!.muted = true; expect(sampleFrame(project, 20).audio).toHaveLength(0);
  });
  it('interpolates linear and hold keyframes with clamped endpoints', () => {
    const clip = createClip('title', 'Keyframes', { duration: 90, keyframes: [
      { property: 'x', frame: 10, value: 10, interpolation: 'linear' }, { property: 'x', frame: 30, value: 50, interpolation: 'hold' }, { property: 'x', frame: 60, value: 100, interpolation: 'linear' },
    ] });
    expect(evaluateEffects(clip, 0).x).toBe(10); expect(evaluateEffects(clip, 20).x).toBe(30); expect(evaluateEffects(clip, 45).x).toBe(50); expect(evaluateEffects(clip, 60).x).toBe(100); expect(evaluateEffects(clip, 90).x).toBe(100);
  });
  it('evaluates fade boundaries and cross dissolve without double alpha fading', () => {
    const fading = createClip('title', 'Fade', { duration: 60, effects: { fadeIn: 10, fadeOut: 10 } });
    expect(evaluateEffects(fading, 0).opacity).toBe(0); expect(evaluateEffects(fading, 5).opacity).toBe(0.5); expect(evaluateEffects(fading, 55).volume).toBe(0.5);
    const project = executeCommands(fixture(), [{ type: 'setTransition', clipId: 'second', transition: { type: 'crossDissolve', duration: 30 } }]);
    expect(findClip(project, 'second').clip.start).toBe(60);
    const frame = sampleFrame(project, 75);
    expect(frame.layers.map(v => v.effects.opacity)).toEqual([1, 0.5]); expect(frame.audio.filter(v => v.track.kind === 'video').map(v => v.effects.volume)).toEqual([0.5, 0.5]);
    expect(() => executeCommands(project, [{ type: 'setTransition', clipId: 'second', transition: { type: 'crossDissolve', duration: 100 } }])).toThrow('longer');
  });
  it('splitting animated clips preserves position at the cut and after it', () => {
    let project = fixture(); project = executeCommands(project, [
      { type: 'setKeyframe', clipId: 'first', keyframe: { property: 'x', frame: 0, value: 0, interpolation: 'linear' } },
      { type: 'setKeyframe', clipId: 'first', keyframe: { property: 'x', frame: 90, value: 90, interpolation: 'linear' } },
    ]);
    const split = executeCommands(project, [{ type: 'splitClip', clipId: 'first', frame: 30 }]);
    for (const frame of [0, 29, 30, 45, 89]) expect(sampleFrame(split, frame).layers[0]!.effects.x).toBe(sampleFrame(project, frame).layers[0]!.effects.x);
  });
  it('splitting inside a fade preserves each displayed frame and audio gain', () => {
    let project = fixture(); project = executeCommands(project, [
      { type: 'setClipProperty', clipId: 'first', property: 'fadeIn', value: 60 },
      { type: 'setClipProperty', clipId: 'first', property: 'fadeOut', value: 60 },
      { type: 'setKeyframe', clipId: 'first', keyframe: { property: 'opacity', frame: 0, value: 0.4, interpolation: 'linear' } },
      { type: 'setKeyframe', clipId: 'first', keyframe: { property: 'opacity', frame: 90, value: 1, interpolation: 'linear' } },
    ]);
    const split = executeCommands(project, [{ type: 'splitClip', clipId: 'first', frame: 35 }]);
    for (let frame = 0; frame < 90; frame++) {
      expect(sampleFrame(split, frame).layers[0]!.effects.opacity).toBeCloseTo(sampleFrame(project, frame).layers[0]!.effects.opacity, 8);
      expect(sampleFrame(split, frame).audio[0]!.effects.volume).toBeCloseTo(sampleFrame(project, frame).audio[0]!.effects.volume, 8);
    }
  });
  it('copying a complete dissolve preserves its overlap and transition', () => {
    const project = executeCommands(fixture(), [{ type: 'setTransition', clipId: 'second', transition: { type: 'crossDissolve', duration: 30 } }]);
    const copied = executeCommands(project, pasteClips(project, copyClips(project, ['first', 'second']), 240));
    expect(copied.sequence.tracks[0]!.clips.filter(c => c.start >= 240).map(c => c.transition?.duration)).toEqual([undefined, 30]);
  });
  it('cross dissolves keep linked detached audio synchronized and blend both tracks', () => {
    let project = executeCommands(fixture(), [{ type: 'detachAudio', clipId: 'first' }, { type: 'detachAudio', clipId: 'second' }]);
    project = executeCommands(project, [{ type: 'setTransition', clipId: 'second', transition: { type: 'crossDissolve', duration: 30 } }]);
    const audioIds = project.linkedGroups.flatMap(g => g.clipIds).filter(id => !['first', 'second'].includes(id));
    const detached = sampleFrame(project, 75).audio.filter(v => audioIds.includes(v.clip.id));
    expect(detached.map(v => v.effects.volume)).toEqual([0.5, 0.5]);
    project = executeCommands(project, [{ type: 'setTransition', clipId: 'second' }]);
    for (const id of project.linkedGroups.find(g => g.clipIds.includes('second'))!.clipIds) expect(findClip(project, id).clip.start).toBe(90);
  });
});

describe('caption interchange and source timing', () => {
  const cues = [{ start: 1.25, end: 3.5, text: 'İstanbul, özgür kurgu.\nİkinci satır.' }, { start: 4, end: 5, text: 'Merhaba' }];
  it('round-trips UTF-8 SRT and WebVTT with millisecond times', () => {
    for (const format of ['srt', 'vtt'] as const) expect(parseCaptions(serializeCaptions(cues, format), format)).toEqual(cues);
    expect(() => parseCaptions('1\n00:00:02,000 --> 00:00:01,000\nBad')).toThrow('after');
  });
  it('maps transcript offsets through a trimmed clip and clips source bounds', () => {
    const clip = createClip('audio', 'Source', { start: 300, sourceIn: 2, duration: 90 });
    expect(mapTranscriptToClip(cues, clip, { num: 30, den: 1 })).toEqual([{ start: 10, end: 11.5, text: cues[0]!.text }, { start: 12, end: 13, text: 'Merhaba' }]);
  });
  it('creates caption clips as a single reversible command transaction', () => {
    const project = fixture(); const track = createTrack('video', 'Captions');
    const ready = executeCommands(project, [{ type: 'addTrack', track }]);
    const result = executeCommands(ready, captionCommands(cues, ready, track.id));
    expect(captionsFromProject(result)).toEqual([{ ...cues[0], start: 38 / 30 }, cues[1]]);
    expect(result.revision).toBe(ready.revision + 1);
  });
  it('markers can be edited and removed without affecting clip timing', () => {
    const id = newId(); const p = executeCommands(fixture(), [{ type: 'addMarker', marker: { id, frame: 30, name: 'Bölüm', color: '#f4dc54' } }]);
    const edited = executeCommands(p, [{ type: 'updateMarker', markerId: id, patch: { frame: 45, name: 'New' } }]); expect(edited.sequence.markers[0]!.frame).toBe(45);
    expect(executeCommands(edited, [{ type: 'removeMarker', markerId: id }]).sequence.markers).toEqual([]);
  });
});
