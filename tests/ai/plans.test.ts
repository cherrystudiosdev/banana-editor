import { describe, expect, it } from 'vitest';
import { createClip, createProject, newId, type Project } from '../../src/shared/model';
import type { EditPlan } from '../../src/shared/ai';
import { applyEditPlan, transcriptToCaptionPlan, validateEditPlan } from '../../src/main/ai/plans';
import { History } from '../../src/core/history';

function fixture(): Project {
  const p = createProject();
  p.assets.push({ id: 'asset', name: 'Örnek medya.mp4', path: 'C:/private/Örnek medya.mp4', kind: 'video', duration: 60, width: 1920, height: 1080, hasAudio: true });
  p.sequence.tracks[0]!.clips.push(createClip('video', 'A', { id: 'clip', assetId: 'asset', start: 30, duration: 300, sourceIn: 2 }));
  return p;
}
function plan(p: Project, steps: EditPlan['steps']): EditPlan { return { schemaVersion: 1, id: newId(), projectId: p.id, sequenceId: p.sequence.id, baseRevision: p.revision, description: 'Test plan', steps }; }

describe('AI edit plans remain scoped atomic editor transactions', () => {
  it('applies multiple operations with one undo and preserves the original project', () => {
    const p = fixture(); const history = new History(p);
    const proposed = plan(p, [{ type: 'setClipVolume', clipId: 'clip', volume: 0.4 }, { type: 'addMarker', frame: 60, name: 'Bölüm' }]);
    const next = applyEditPlan(p, proposed, ['clip']);
    expect(next.revision).toBe(1); expect(next.appliedPlanIds).toContain(proposed.id);
    expect(p.sequence.tracks[0]!.clips[0]!.effects.volume).toBe(1);
    history.commit(next); expect(history.current.sequence.markers).toHaveLength(1);
    expect(history.undo().sequence.markers).toHaveLength(0);
    expect(history.current.sequence.tracks[0]!.clips[0]!.effects.volume).toBe(1);
    expect(history.redo().sequence.tracks[0]!.clips[0]!.effects.volume).toBe(0.4);
  });
  it('rejects stale revision, replay and other projects', () => {
    const p = fixture(); const proposed = plan(p, [{ type: 'setClipVolume', clipId: 'clip', volume: 0.5 }]);
    expect(() => validateEditPlan(p, { ...proposed, baseRevision: 1 }, ['clip'])).toThrow(/changed/);
    expect(() => validateEditPlan(p, { ...proposed, projectId: 'other' }, ['clip'])).toThrow(/different/);
    const next = applyEditPlan(p, proposed, ['clip']);
    expect(() => applyEditPlan(next, { ...proposed, baseRevision: next.revision }, ['clip'])).toThrow(/already/);
  });
  it('rejects shell instructions, unknown keys and unselected clips', () => {
    const p = fixture();
    expect(() => validateEditPlan(p, plan(p, [{ type: 'shell', command: 'whoami' }] as unknown as EditPlan['steps']), ['clip'])).toThrow(/unauthorized/);
    expect(() => validateEditPlan(p, { ...plan(p, [{ type: 'setClipVolume', clipId: 'clip', volume: 0.5 }]), key: 'secret' }, ['clip'])).toThrow(/unauthorized/);
    expect(() => validateEditPlan(p, plan(p, [{ type: 'setClipVolume', clipId: 'unselected', volume: 0.5 }]), ['clip'])).toThrow(/outside/);
  });
  it('rejects locks, invalid bounds and a partially valid transaction without changing data', () => {
    const p = fixture(); const original = JSON.stringify(p);
    expect(() => applyEditPlan(p, plan(p, [{ type: 'setClipVolume', clipId: 'clip', volume: 0.2 }, { type: 'splitClip', clipId: 'clip', frame: 1000 }]), ['clip'])).toThrow(/bounds/);
    expect(JSON.stringify(p)).toBe(original);
    expect(() => validateEditPlan(p, plan(p, [{ type: 'trimClip', clipId: 'clip', start: 30, duration: 301, sourceIn: 2 }]), ['clip'])).toThrow(/outside/);
    p.sequence.tracks[0]!.locked = true;
    expect(() => validateEditPlan(p, plan(p, [{ type: 'setClipVolume', clipId: 'clip', volume: 0.2 }]), ['clip'])).toThrow(/locked/);
  });
  it('does not affect linked clips that were not approved', () => {
    const p = fixture(); p.sequence.tracks[2]!.clips.push(createClip('audio', 'Linked audio', { id: 'linked', assetId: 'asset', start: 30, duration: 300, sourceIn: 2 }));
    p.linkedGroups.push({ id: 'link', clipIds: ['clip', 'linked'] });
    expect(() => validateEditPlan(p, plan(p, [{ type: 'splitClip', clipId: 'clip', frame: 60 }]), ['clip'])).toThrow(/linked/);
    expect(validateEditPlan(p, plan(p, [{ type: 'splitClip', clipId: 'clip', frame: 60 }]), ['clip', 'linked']).steps).toHaveLength(1);
  });
  it('maps chunk source offsets to rational timeline frames and respects clip end', () => {
    const p = fixture(); p.sequence.fps = { num: 30000, den: 1001 };
    const proposed = transcriptToCaptionPlan(p, { language: 'tr', wordTimestamps: false, segments: [{ clipId: 'clip', start: 3.001, end: 4.002, text: 'Türkçe konuşma', timing: 'segment' }] }, ['clip']);
    expect(proposed?.steps[0]).toMatchObject({ type: 'addCaption', start: 60, duration: 30, text: 'Türkçe konuşma' });
  });
  it('caption correction preserves every timing and style property', () => {
    const p = fixture(); const caption = createClip('caption', 'Caption', { id: 'caption', start: 90, duration: 20, text: { text: 'Merhaba', fontSize: 48, color: '#ffffff', background: 'transparent', align: 'center' } });
    p.sequence.tracks[1]!.clips.push(caption);
    const next = applyEditPlan(p, plan(p, [{ type: 'setCaptionText', clipId: 'caption', text: 'Hello' }]), ['caption']);
    expect(next.sequence.tracks[1]!.clips[0]).toEqual({ ...caption, text: { ...caption.text, text: 'Hello' } });
  });
});
