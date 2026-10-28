import type { Clip, Keyframe, Rational } from '../../shared/model';

const number = (value: number): string => { if (!Number.isFinite(value)) throw new Error('Non-finite render value'); return Number(value.toFixed(12)).toString(); };
export const scalar = number;

/** FFmpeg's local time is converted back into the sequence's frame domain. */
export function keyframeExpression(clip: Clip, property: Keyframe['property'], frameVariable: string): string {
  const keys = clip.keyframes.filter(key => key.property === property).sort((a, b) => a.frame - b.frame);
  if (!keys.length) return number(clip.effects[property]);
  let expression = number(keys[keys.length - 1]!.value);
  for (let i = keys.length - 1; i > 0; i--) {
    const a = keys[i - 1]!; const b = keys[i]!;
    const value = a.interpolation === 'hold' ? number(a.value) : `${number(a.value)}+(${number(b.value - a.value)})*((${frameVariable})-${number(a.frame)})/${number(b.frame - a.frame)}`;
    expression = `if(lt(${frameVariable},${number(b.frame)}),${value},${expression})`;
  }
  return `if(lte(${frameVariable},${number(keys[0]!.frame)}),${number(keys[0]!.value)},${expression})`;
}

export function fadeExpression(clip: Clip, frameVariable: string, next?: Clip, audio = false): string {
  let fade = '1';
  if (clip.effects.fadeIn) fade = `min(${fade},max(0,${frameVariable})/${clip.effects.fadeIn})`;
  if (clip.effects.fadeOut) fade = `min(${fade},max(0,${clip.duration}-(${frameVariable}))/${clip.effects.fadeOut})`;
  if (clip.transition) fade = `(${fade})*min(1,max(0,${frameVariable})/${clip.transition.duration})`;
  if (audio && next?.transition) fade = `(${fade})*min(1,max(0,1-((${frameVariable})-${next.start - clip.start})/${next.transition.duration}))`;
  return fade;
}

export function localFrameVariable(variable: string, fps: Rational, startSeconds = 0): string {
  return `((${variable})-${number(startSeconds)})*${fps.num}/${fps.den}`;
}
