import type { Project, Rational } from '../shared/model';

export function framesToSeconds(frames: number, fps: Rational): number { return frames * fps.den / fps.num; }
export function secondsToFrames(seconds: number, fps: Rational, rounding: 'round' | 'floor' | 'ceil' = 'round'): number { return Math[rounding](seconds * fps.num / fps.den); }
export function framesToSamples(frames: number, fps: Rational, sampleRate: number): number {
  if (!Number.isSafeInteger(frames) || frames < 0 || !Number.isSafeInteger(sampleRate) || sampleRate < 1) throw new Error('Invalid frame or sample rate');
  return Number((BigInt(frames) * BigInt(fps.den) * BigInt(sampleRate) + BigInt(Math.floor(fps.num / 2))) / BigInt(fps.num));
}
export function durationFrames(project: Project): number { return Math.max(0, ...project.sequence.tracks.flatMap(t => t.clips.map(c => c.start + c.duration))); }
export function formatTimecode(frame: number, fps: Rational): string {
  const whole = Math.max(0, Math.floor(frame)); const nominal = Math.round(fps.num / fps.den);
  const seconds = Math.floor(whole / nominal);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60, whole % nominal].map(n => String(n).padStart(2, '0')).join(':');
}
export function parseFps(text: string): Rational {
  const parts = text.split('/'); const num = Number(parts[0]); const den = parts.length > 1 ? Number(parts[1]) : 1;
  if (!Number.isInteger(num) || !Number.isInteger(den) || num <= 0 || den <= 0) throw new Error('Frame rate must be a positive rational number');
  return { num, den };
}
