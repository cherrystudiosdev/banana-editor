import sharp from 'sharp';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Clip } from '../../shared/model';

function escapeMarkup(text: string): string { return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }

/** Both program playback and final output consume this same rasterized text layout. */
export async function renderText(clip: Clip, width: number, height: number, directory: string, fontPath?: string): Promise<string> {
  if (!clip.text) throw new Error('Text clip is missing its style.');
  const style = clip.text;
  const text = escapeMarkup(style.text || ' ');
  const safeWidth = Math.floor(width * 0.8);
  const rendered = await sharp({ text: { text: `<span foreground="${style.color}">${text}</span>`, font: `Noto Sans ${style.fontSize}`, ...(fontPath ? { fontfile: fontPath } : {}), width: safeWidth, align: style.align, dpi: 72, rgba: true, spacing: Math.round(style.fontSize * 0.2) } }).png().toBuffer({ resolveWithObject: true });
  if (rendered.info.height > height * 0.8) throw new Error('Text exceeds the safe area. Reduce font size or split it into shorter captions.');
  const padding = Math.max(4, Math.round(style.fontSize * 0.18));
  const textWidth = Math.min(width, rendered.info.width + padding * 2);
  const textHeight = Math.min(height, rendered.info.height + padding * 2);
  const box = await sharp({ create: { width: textWidth, height: textHeight, channels: 4, background: style.background === 'transparent' ? { r: 0, g: 0, b: 0, alpha: 0 } : style.background } }).composite([{ input: rendered.data, left: padding, top: padding }]).png().toBuffer();
  const path = join(directory, `${createHash('sha256').update(clip.id).digest('hex')}.png`);
  const left = style.align === 'left' ? Math.round(width * 0.1) : style.align === 'right' ? Math.round(width * 0.9) - textWidth : Math.round((width - textWidth) / 2);
  const top = clip.kind === 'caption' ? Math.round(height * 0.9) - textHeight : Math.round((height - textHeight) / 2);
  await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: box, left, top }]).png().toFile(path);
  return path;
}
