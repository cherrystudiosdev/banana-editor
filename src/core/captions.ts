import { createClip, newId, type Clip, type Project, type Rational } from '../shared/model';
import { framesToSeconds, secondsToFrames } from './time';
import type { Command } from './commands';

export interface CaptionCue { start: number; end: number; text: string }
function timestamp(value: string): number {
  const match = /^(?:(\d{1,4}):)?(\d{2}):(\d{2})[,.](\d{3})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid caption timestamp: ${value}`);
  const hours = Number(match[1] ?? 0), minutes = Number(match[2]), seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) throw new Error('Caption timestamp minutes and seconds must be below 60');
  return hours * 3600 + minutes * 60 + seconds + Number(match[4]) / 1000;
}
export function parseCaptions(source: string, format?: 'srt' | 'vtt'): CaptionCue[] {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const vtt = format === 'vtt' || text.startsWith('WEBVTT');
  const blocks = text.split(/\n[ \t]*\n/); const cues: CaptionCue[] = [];
  for (let block of blocks) {
    if (vtt && /^(WEBVTT|NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(block)) {
      if (block.startsWith('WEBVTT') && block.includes('-->')) block = block.slice(block.indexOf('\n') + 1); else continue;
    }
    const lines = block.split('\n'); const timingIndex = lines.findIndex(line => line.includes('-->'));
    if (timingIndex < 0) throw new Error('Caption block has no timing line');
    const match = /^\s*(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(lines[timingIndex]!);
    if (!match) throw new Error('Malformed caption timing');
    const start = timestamp(match[1]!), end = timestamp(match[2]!);
    if (end <= start) throw new Error('Caption end must be after its start');
    const content = lines.slice(timingIndex + 1).join('\n').replace(/<[^>]*>/g, '').trim();
    if (!content) throw new Error('Caption contains no text');
    cues.push({ start, end, text: content });
  }
  return cues.sort((a, b) => a.start - b.start);
}
function formatTimestamp(seconds: number, format: 'srt' | 'vtt'): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const whole = Math.floor(ms / 1000);
  const clock = [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60].map(n => String(n).padStart(2, '0')).join(':');
  return clock + (format === 'srt' ? ',' : '.') + String(ms % 1000).padStart(3, '0');
}
export function serializeCaptions(cues: readonly CaptionCue[], format: 'srt' | 'vtt' = 'srt'): string {
  return (format === 'vtt' ? 'WEBVTT\n\n' : '') + cues.map((cue, i) => `${format === 'srt' ? String(i + 1) + '\n' : ''}${formatTimestamp(cue.start, format)} --> ${formatTimestamp(cue.end, format)}\n${cue.text}`).join('\n\n') + '\n';
}
export function captionsFromProject(project: Project): CaptionCue[] {
  return project.sequence.tracks.flatMap(t => t.clips.filter(c => c.kind === 'caption').map(c => ({ start: framesToSeconds(c.start, project.sequence.fps), end: framesToSeconds(c.start + c.duration, project.sequence.fps), text: c.text?.text ?? '' }))).sort((a, b) => a.start - b.start);
}
export function captionCommands(cues: readonly CaptionCue[], project: Project, trackId: string): Command[] {
  return cues.map(c => {
    const start = secondsToFrames(c.start, project.sequence.fps), end = secondsToFrames(c.end, project.sequence.fps);
    if (end <= start) throw new Error('Caption is shorter than one timeline frame');
    return { type: 'addCaption', trackId, start, duration: end - start, text: c.text };
  });
}
/** Map source-time transcripts to a trimmed timeline clip, intersecting its source interval. */
export function mapTranscriptToClip(cues: readonly CaptionCue[], clip: Clip, fps: Rational): CaptionCue[] {
  const sourceEnd = clip.sourceIn + framesToSeconds(clip.duration, fps); const offset = framesToSeconds(clip.start, fps) - clip.sourceIn;
  return cues.filter(c => c.end > clip.sourceIn && c.start < sourceEnd).map(c => ({ text: c.text, start: Math.max(c.start, clip.sourceIn) + offset, end: Math.min(c.end, sourceEnd) + offset }));
}
export function createCaption(text: string, start: number, duration: number): Clip {
  return createClip('caption', text.slice(0, 60) || 'Caption', { id: newId(), start, duration, text: { text, fontSize: 48, color: '#ffffff', background: '#16181c', align: 'center' } });
}
