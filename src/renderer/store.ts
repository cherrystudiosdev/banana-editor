import { create } from 'zustand';
import { createProject, createClip, type Project, type MediaAsset } from '../shared/model';
import { History } from '../core/history';
import { type Command, copyClips, pasteClips } from '../core/commands';
import { secondsToFrames, durationFrames } from '../core/time';
const history = new History(createProject('Untitled project'));
type Clipboard = ReturnType<typeof copyClips>;
interface State {
  project: Project; selected: string[]; sourceId: string | null; frame: number;
  playing: boolean; zoom: number; snap: boolean; tool: 'select' | 'split';
  dirty: boolean; canUndo: boolean; canRedo: boolean; error: string | null;
  path: string | null; missing: string[]; clipboard: Clipboard | null;
  execute: (commands: Command[]) => boolean;
  commit: (project: Project) => void;
  load: (project: Project, path?: string | null, missing?: string[]) => void;
  undo: () => void; redo: () => void; copy: () => void; paste: () => void;
  addMedia: (asset: MediaAsset, trackId?: string, at?: number) => void;
  seek: (frame: number) => void;
}
export const useEditor = create<State>((set, get) => ({
  project: history.current, selected: [], sourceId: null, frame: 0, playing: false,
  zoom: 1, snap: true, tool: 'select', dirty: false, canUndo: false, canRedo: false,
  error: null, path: null, missing: [], clipboard: null,
  execute: commands => { try { const project = history.execute(commands); set({ project, dirty: true, canUndo: history.canUndo, canRedo: history.canRedo, error: null, playing: false }); return true; } catch (e) { set({ error: e instanceof Error ? e.message : String(e) }); return false; } },
  commit: project => { try { set({ project: history.commit(project), dirty: true, canUndo: true, canRedo: false }); } catch (e) { set({ error: String(e) }); } },
  load: (project, path = null, missing = []) => { set({ project: history.reset(project), path, missing, selected: [], frame: 0, playing: false, dirty: false, canUndo: false, canRedo: false, error: null }); },
  undo: () => set({ project: history.undo(), canUndo: history.canUndo, canRedo: history.canRedo, dirty: true, playing: false }),
  redo: () => set({ project: history.redo(), canUndo: history.canUndo, canRedo: history.canRedo, dirty: true, playing: false }),
  copy: () => { try { set({ clipboard: copyClips(get().project, get().selected) }); } catch (e) { set({ error: String(e) }); } },
  paste: () => { const s = get(); if (s.clipboard) s.execute(pasteClips(s.project, s.clipboard, s.frame)); },
  addMedia: (asset, trackId, at) => {
    const s = get(); const tracks = s.project.sequence.tracks;
    const track = trackId ? tracks.find(t => t.id === trackId) : tracks.find(t => t.kind === (asset.kind === 'audio' ? 'audio' : 'video') && !t.locked);
    if (!track) return; const start = at ?? Math.max(s.frame, ...track.clips.map(c => c.start + c.duration));
    const clip = createClip(asset.kind, asset.name, { assetId: asset.id, start, duration: asset.kind === 'image' ? secondsToFrames(5, s.project.sequence.fps) : Math.max(1, secondsToFrames(asset.duration, s.project.sequence.fps, 'floor')) });
    if (s.execute([{ type: 'addClip', trackId: track.id, clip }])) set({ selected: [clip.id] });
  },
  seek: frame => set({ frame: Math.max(0, Math.min(Math.round(frame), Math.max(0, durationFrames(get().project) - 1))) }),
}));
