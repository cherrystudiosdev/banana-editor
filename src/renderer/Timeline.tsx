import { useEffect, useRef, useState } from 'react';
import { Scissors, MousePointer2, Magnet, Trash2, Plus, Type, Captions, Flag, LockKeyhole, UnlockKeyhole, Eye, EyeOff, Volume2, VolumeX, Link2, Unlink2, Copy, Minus, Undo2, Redo2 } from 'lucide-react';
import { useEditor } from './store';
import { createTrack, newId, type Clip, type Track } from '../shared/model';
import { durationFrames, formatTimecode } from '../core/time';
import { IconButton } from './components';
import { useText } from './i18n';
import type { Command } from '../core/commands';

export function Timeline({ onText, onMarker }: { onText: (kind: 'title' | 'caption') => void; onMarker: () => void }) {
  const t = useText(); const s = useEditor(); const scroll = useRef<HTMLDivElement>(null); const head = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0); const [drag, setDrag] = useState<{ id: string; left: number; width: number } | null>(null);
  const ppf = 2 * s.zoom; const total = Math.max(durationFrames(s.project) + 180, 900); const width = total * ppf;
  const fps = s.project.sequence.fps.num / s.project.sequence.fps.den;
  const chosen = s.project.sequence.tracks.flatMap(tr => tr.clips).filter(c => s.selected.includes(c.id));
  useEffect(() => { const listener = (e: Event) => { const frame = (e as CustomEvent<number>).detail; if (head.current) head.current.style.left = `${frame * ppf}px`; }; window.addEventListener('banana-frame', listener); return () => window.removeEventListener('banana-frame', listener); }, [ppf]);
  const snap = (frame: number, ignored: string[] = []) => {
    if (!s.snap) return Math.max(0, frame);
    const points = [0, s.frame, ...s.project.sequence.markers.map(m => m.frame), ...s.project.sequence.tracks.flatMap(tr => tr.clips.filter(c => !ignored.includes(c.id)).flatMap(c => [c.start, c.start + c.duration]))];
    const nearest = points.sort((a, b) => Math.abs(a - frame) - Math.abs(b - frame))[0]!;
    return Math.max(0, Math.abs(nearest - frame) * ppf < 9 ? nearest : frame);
  };
  const remove = (ripple = false) => s.selected.length && s.execute([{ type: 'deleteClips', clipIds: s.selected, ripple }]);
  const split = () => { const seen = new Set<string>(); const commands: Command[] = []; for (const clip of chosen.filter(c => c.start < s.frame && c.start + c.duration > s.frame)) { if (seen.has(clip.id)) continue; commands.push({ type: 'splitClip', clipId: clip.id, frame: s.frame }); const group = s.project.linkedGroups.find(g => g.clipIds.includes(clip.id)); (group?.clipIds ?? [clip.id]).forEach(id => seen.add(id)); } s.execute(commands); };
  function beginTrim(e: React.PointerEvent, clip: Clip, edge: 'left' | 'right') {
    e.stopPropagation(); e.preventDefault(); const origin = e.clientX; const node = e.currentTarget as HTMLElement; node.setPointerCapture(e.pointerId);
    const move = (event: PointerEvent) => { const delta = Math.round((event.clientX - origin) / ppf); const left = edge === 'left' ? snap(clip.start + delta, [clip.id]) : clip.start; const duration = edge === 'left' ? clip.duration + clip.start - left : snap(clip.start + clip.duration + delta, [clip.id]) - clip.start; if (duration > 0) setDrag({ id: clip.id, left, width: duration }); };
    const up = (event: PointerEvent) => { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); const delta = Math.round((event.clientX - origin) / ppf); const start = edge === 'left' ? snap(clip.start + delta, [clip.id]) : clip.start; const duration = edge === 'left' ? clip.duration + clip.start - start : snap(clip.start + clip.duration + delta, [clip.id]) - start; setDrag(null); s.execute([{ type: 'trimClip', clipId: clip.id, start, duration, sourceIn: clip.sourceIn + (start - clip.start) / fps, ripple: event.shiftKey }]); };
    node.addEventListener('pointermove', move); node.addEventListener('pointerup', up, { once: true });
  }
  function onDrop(e: React.DragEvent, track: Track) {
    e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); const frame = snap(Math.round((e.clientX - rect.left) / ppf));
    const assetId = e.dataTransfer.getData('banana/asset'); const clipId = e.dataTransfer.getData('banana/clip');
    if (assetId) { const asset = s.project.assets.find(a => a.id === assetId); if (asset) s.addMedia(asset, track.id, frame); }
    if (clipId) { const clip = s.project.sequence.tracks.flatMap(tr => tr.clips).find(c => c.id === clipId); if (!clip) return;
      const selected = s.selected.includes(clipId) ? chosen : [clip]; const delta = frame - clip.start;
      const grouped = new Set<string>(); const commands: Command[] = [];
      for (const c of selected) { if (grouped.has(c.id)) continue; commands.push({ type: 'moveClip', clipId: c.id, start: Math.max(0, c.start + delta), ...(c.id === clipId ? { trackId: track.id } : {}) }); const group = s.project.linkedGroups.find(g => g.clipIds.includes(c.id)); group?.clipIds.forEach(id => grouped.add(id)); }
      s.execute(commands);
    }
  }
  return <section className="timeline panel" tabIndex={0} aria-label={t('timelineFocus')} onKeyDown={e => { if ((e.target as HTMLElement).matches('input,textarea')) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); s.copy(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); s.paste(); } }}>
    <div className="timeline-heading"><div className="sequence-tab"><span className="yellow-dot"/>{s.project.sequence.name}<span className="muted">{s.project.sequence.width} × {s.project.sequence.height}</span></div><span className="timeline-time">{formatTimecode(s.frame, s.project.sequence.fps)}</span></div>
    <div className="timeline-toolbar"><div className="button-row">
      <IconButton label={t('select')} active={s.tool === 'select'} onClick={() => useEditor.setState({ tool: 'select' })}><MousePointer2 size={17}/></IconButton><IconButton label={t('split')} active={s.tool === 'split'} onClick={split}><Scissors size={17}/></IconButton><span className="divider"/>
      <IconButton label={t('snapping')} active={s.snap} onClick={() => useEditor.setState({ snap: !s.snap })}><Magnet size={17}/></IconButton><IconButton label={t('undo')} disabled={!s.canUndo} onClick={s.undo}><Undo2 size={17}/></IconButton><IconButton label={t('redo')} disabled={!s.canRedo} onClick={s.redo}><Redo2 size={17}/></IconButton><IconButton label={t('delete')} disabled={!chosen.length} onClick={() => remove()}><Trash2 size={16}/></IconButton>
      <button className="subtle-button" disabled={!chosen.length} onClick={() => remove(true)}>{t('rippleDelete')}</button><span className="divider"/>
      <IconButton label={t('title')} onClick={() => onText('title')}><Type size={17}/></IconButton><IconButton label={t('caption')} onClick={() => onText('caption')}><Captions size={17}/></IconButton><IconButton label={t('marker')} onClick={onMarker}><Flag size={16}/></IconButton>
      <IconButton label={t('duplicate')} disabled={!chosen.length} onClick={() => { s.copy(); const last = Math.max(...chosen.map(c => c.start + c.duration)); useEditor.setState({ frame: last }); useEditor.getState().paste(); }}><Copy size={16}/></IconButton>
      <IconButton label={t('link')} disabled={chosen.length < 2} onClick={() => s.execute([{ type: 'linkClips', clipIds: s.selected }])}><Link2 size={16}/></IconButton><IconButton label={t('unlink')} disabled={!chosen.length} onClick={() => s.execute([{ type: 'unlinkClips', clipIds: s.selected }])}><Unlink2 size={16}/></IconButton>
    </div><div className="button-row zoom"><Minus size={13}/><input aria-label={t('zoom')} type="range" min="0.2" max="8" step="0.1" value={s.zoom} onChange={e => useEditor.setState({ zoom: Number(e.target.value) })}/><Plus size={13}/></div></div>
    <div className="timeline-body"><div className="track-headers"><div className="track-ruler-head"><span>{t('tracks')}</span><IconButton label={t('addTrack')} onClick={() => s.execute([{ type: 'addTrack', track: createTrack('video', `V${s.project.sequence.tracks.filter(t => t.kind === 'video').length + 1}`) }])}><Plus size={14}/></IconButton></div>
      {s.project.sequence.tracks.map(track => <div className={`track-header ${track.kind}`} key={track.id}><div className="track-name"><span className="track-badge">{track.kind === 'video' ? 'V' : 'A'}</span><input aria-label={`${t('rename')} ${track.name}`} defaultValue={track.name} key={track.name} onBlur={e => { if (e.target.value && e.target.value !== track.name) s.execute([{ type: 'updateTrack', trackId: track.id, patch: { name: e.target.value } }]); }}/></div><div className="track-controls"><IconButton label={t('lock')} active={track.locked} onClick={() => s.execute([{ type: 'updateTrack', trackId: track.id, patch: { locked: !track.locked } }])}>{track.locked ? <LockKeyhole size={12}/> : <UnlockKeyhole size={12}/>}</IconButton><IconButton label={t('visibility')} active={!track.visible} onClick={() => s.execute([{ type: 'updateTrack', trackId: track.id, patch: { visible: !track.visible } }])}>{track.visible ? <Eye size={13}/> : <EyeOff size={13}/>}</IconButton><IconButton label={t('mute')} active={track.muted} onClick={() => s.execute([{ type: 'updateTrack', trackId: track.id, patch: { muted: !track.muted } }])}>{track.muted ? <VolumeX size={13}/> : <Volume2 size={13}/>}</IconButton><button aria-label={t('solo')} title={t('solo')} className={`solo-button ${track.solo ? 'active' : ''}`} onClick={() => s.execute([{ type: 'updateTrack', trackId: track.id, patch: { solo: !track.solo } }])}>S</button><IconButton label={t('remove')} disabled={track.locked || s.project.sequence.tracks.length === 1} onClick={() => s.execute([{ type: 'removeTrack', trackId: track.id }])}><Trash2 size={12}/></IconButton></div></div>)}
      <button className="track-add" onClick={() => s.execute([{ type: 'addTrack', track: createTrack('audio', `A${s.project.sequence.tracks.filter(t => t.kind === 'audio').length + 1}`) }])}><Plus size={13}/>{t('audio')}</button></div>
      <div className="timeline-scroll" ref={scroll} onScroll={e => setOffset(e.currentTarget.scrollLeft)}><div className="timeline-content" style={{ width }}>
        <div className="ruler" onPointerDown={e => { const rect = e.currentTarget.getBoundingClientRect(); s.seek((e.clientX - rect.left) / ppf); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (e.buttons === 1) { const rect = e.currentTarget.getBoundingClientRect(); s.seek((e.clientX - rect.left) / ppf); } }}>
          {Array.from({ length: Math.ceil(total / (fps * (s.zoom < 1 ? 5 : 2))) }, (_, i) => { const frame = Math.round(i * fps * (s.zoom < 1 ? 5 : 2)); return <span key={i} style={{ left: frame * ppf }}>{formatTimecode(frame, s.project.sequence.fps)}</span>; })}
          {s.project.sequence.markers.map(m => <button className="marker" key={m.id} title={m.name} aria-label={m.name} style={{ left: m.frame * ppf, color: m.color }} onClick={e => { e.stopPropagation(); s.seek(m.frame); }} onDoubleClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('banana-edit-marker', { detail: m })); }}><Flag size={14}/></button>)}
        </div>
        {s.project.sequence.tracks.map(track => <div className={`track-lane ${track.kind} ${track.locked ? 'locked' : ''}`} key={track.id} onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, track)} onClick={e => { if (e.target === e.currentTarget) useEditor.setState({ selected: [] }); }}>
          {track.clips.filter(c => (c.start + c.duration) * ppf >= offset - 100 && c.start * ppf <= offset + (scroll.current?.clientWidth ?? 1600) + 100).map(clip => { const asset = s.project.assets.find(a => a.id === clip.assetId); const left = drag?.id === clip.id ? drag.left : clip.start; const duration = drag?.id === clip.id ? drag.width : clip.duration; return <div key={clip.id} role="button" tabIndex={0} aria-label={`${clip.name} ${clip.start}–${clip.start + clip.duration}`} aria-selected={s.selected.includes(clip.id)} className={`clip ${clip.kind} ${s.selected.includes(clip.id) ? 'selected' : ''}`} style={{ left: left * ppf, width: Math.max(8, duration * ppf) }} draggable={!track.locked} onDragStart={e => { e.dataTransfer.setData('banana/clip', clip.id); e.dataTransfer.effectAllowed = 'move'; }} onClick={e => { e.stopPropagation(); if (s.tool === 'split') { const rect = e.currentTarget.getBoundingClientRect(); s.execute([{ type: 'splitClip', clipId: clip.id, frame: clip.start + Math.round((e.clientX - rect.left) / ppf) }]); } else useEditor.setState({ selected: e.ctrlKey || e.metaKey ? s.selected.includes(clip.id) ? s.selected.filter(id => id !== clip.id) : [...s.selected, clip.id] : [clip.id] }); }} onKeyDown={e => { if (e.key === 'Enter') useEditor.setState({ selected: [clip.id] }); }}>
            <div className="trim-handle left" onPointerDown={e => beginTrim(e, clip, 'left')}/><span className="clip-name">{clip.kind === 'title' ? 'T ' : clip.kind === 'caption' ? 'CC ' : ''}{clip.name}</span>
            {asset?.thumbnail && <div className="clip-film" style={{ backgroundImage: `url("${asset.thumbnail}")` }}/>} {asset?.waveform && (clip.kind === 'audio') && <svg className="waveform" viewBox="0 0 200 28" preserveAspectRatio="none" aria-hidden="true"><path d={asset.waveform.filter((_, i) => i % Math.max(1, Math.floor(asset.waveform!.length / 100)) === 0).slice(0, 100).map((v, i) => `M${i * 2},${14 - v * 13}v${v * 26}`).join(' ')}/></svg>}
            <div className="trim-handle right" onPointerDown={e => beginTrim(e, clip, 'right')}/>{clip.transition && <span className="transition-tag">◩ {clip.transition.duration}f</span>}
          </div>; })}
        </div>)}
        {!durationFrames(s.project) && <div className="timeline-empty"><div className="empty-drop-icon"><Plus size={24}/></div><strong>{t('emptyTimeline')}</strong><p>{t('timelineHint')}</p></div>}
        <div className="playhead" ref={head} style={{ left: s.frame * ppf }}><span/></div>
      </div></div>
    </div>
  </section>;
}
export function defaultMarker(frame: number, name: string) { return { id: newId(), frame, name, color: '#f4dc54' }; }
