import { mkdir, mkdtemp, writeFile, rm, rename, stat, realpath, link } from 'node:fs/promises';
import { dirname, basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaAsset, Project } from '../../shared/model';
import { validateProject } from '../../core/validation';
import { durationFrames, framesToSeconds } from '../../core/time';
import { scalar, keyframeExpression, fadeExpression, localFrameVariable } from './expressions';
import { renderText } from './text';
import { MediaError, runProcess } from './process';
import type { ExportOptions, MediaCapabilities, MediaServiceOptions, RenderCallbacks, RenderResult } from './types';

type ProbeOutput = { duration: number; width: number; height: number; };
type Probe = (path: string, signal?: AbortSignal) => Promise<ProbeOutput>;

function canonical(path: string): string { const value = resolve(path); return process.platform === 'win32' ? value.toLocaleLowerCase('en-US') : value; }
async function safeDestination(project: Project, output: string, overwrite: boolean): Promise<void> {
  const finalPath = canonical(output);
  let existing: string | undefined;
  try { existing = canonical(await realpath(output)); } catch { /* A new output is expected. */ }
  for (const asset of project.assets) {
    let source = canonical(asset.path); try { source = canonical(await realpath(asset.path)); } catch { /* Render will diagnose missing media. */ }
    if (canonical(asset.path) === finalPath || source === existing) throw new MediaError('FILESYSTEM', 'Export cannot overwrite source media. Choose another filename.');
  }
  if (existing && !overwrite) throw new MediaError('FILESYSTEM', 'Output already exists. Confirm overwrite or choose another filename.');
  const parent = await stat(dirname(output));
  if (!parent.isDirectory()) throw new MediaError('FILESYSTEM', 'Output folder does not exist.');
}

/** One graph is used for cached playback and final export; no source-only preview path. */
export async function renderProject(project: Project, options: ExportOptions, runtime: MediaServiceOptions, capabilities: MediaCapabilities, probe: Probe, callbacks: RenderCallbacks = {}): Promise<RenderResult> {
  validateProject(project);
  if (!capabilities.formats.includes(options.format)) throw new MediaError('ENCODER', `The installed runtime does not support ${options.format} encoding.`);
  if (![options.width, options.height].every(n => Number.isSafeInteger(n) && n >= 16 && n <= 8192 && n % 2 === 0)) throw new MediaError('ENCODER', 'Output dimensions must be even integers between 16 and 8192.');
  if (options.quality !== undefined && (!Number.isInteger(options.quality) || options.quality < 0 || options.quality > 63)) throw new MediaError('ENCODER', 'Quality must be an integer from 0 to 63.');
  if (options.bitrateKbps !== undefined && (!Number.isInteger(options.bitrateKbps) || options.bitrateKbps < 100 || options.bitrateKbps > 200000)) throw new MediaError('ENCODER', 'Video bitrate must be from 100 to 200000 kbps.');
  if (options.audioBitrateKbps !== undefined && (!Number.isInteger(options.audioBitrateKbps) || options.audioBitrateKbps < 32 || options.audioBitrateKbps > 512)) throw new MediaError('ENCODER', 'Audio bitrate must be from 32 to 512 kbps.');
  if (options.sampleRate !== undefined && ![44100, 48000, 96000].includes(options.sampleRate)) throw new MediaError('ENCODER', 'Unsupported audio sample rate.');
  const fps = options.fps ?? project.sequence.fps;
  if (!Number.isInteger(fps.num) || !Number.isInteger(fps.den) || fps.num <= 0 || fps.den <= 0 || fps.num / fps.den > 240) throw new MediaError('ENCODER', 'Invalid output frame rate.');
  const totalFrames = durationFrames(project);
  if (!totalFrames) throw new MediaError('ENCODER', 'Add at least one clip before exporting.');
  const seconds = framesToSeconds(totalFrames, project.sequence.fps);
  await safeDestination(project, options.outputPath, options.overwrite ?? false);
  await mkdir(runtime.cacheDir, { recursive: true });
  const tempDir = await mkdtemp(join(runtime.cacheDir, 'render-'));
  // Temporary output lives on the destination filesystem, enabling an atomic rename.
  const temporary = join(dirname(options.outputPath), `.${basename(options.outputPath)}.${randomUUID()}.partial.${options.format}`);
  const assets = new Map(project.assets.map(a => [a.id, a]));
  const rate = `${fps.num}/${fps.den}`;
  const width = options.width; const height = options.height;
  const seq = project.sequence;
  const sx = width / seq.width; const sy = height / seq.height;
  const args = ['-hide_banner', '-nostdin', '-y', '-filter_complex_threads', '1', '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:r=${rate}:d=${scalar(seconds)}`];
  const graph: string[] = ['[0:v]format=rgba[base0]'];
  const audio: string[] = []; let inputIndex = 1; let layerIndex = 0;
  const anySolo = seq.tracks.some(t => t.solo);
  callbacks.onProgress?.({ fraction: 0, seconds: 0, frame: 0, stage: 'preparing' });
  try {
    for (const track of seq.tracks) {
      const clips = [...track.clips].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
      for (let ci = 0; ci < clips.length; ci++) {
        if (callbacks.signal?.aborted) throw new MediaError('CANCELLED', 'Operation cancelled.');
        const clip = clips[ci]!;
        if (clip.kind === 'caption' && options.burnCaptions === false) continue;
        const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
        const visible = track.visible && clip.kind !== 'audio';
        const audible = !track.muted && (!anySolo || track.solo) && asset?.hasAudio && (clip.kind === 'audio' || clip.kind === 'video');
        if (!visible && !audible) continue;
        const start = framesToSeconds(clip.start, seq.fps); const duration = framesToSeconds(clip.duration, seq.fps);
        const isText = clip.kind === 'title' || clip.kind === 'caption';
        const isImage = clip.kind === 'image' || isText;
        const sourcePath = isText ? await renderText(clip, seq.width, seq.height, tempDir, runtime.fontPath) : asset?.path;
        if (!sourcePath) throw new MediaError('INVALID_MEDIA', `Source media is missing for ${clip.name}.`);
        if (isImage) args.push('-loop', '1', '-framerate', rate);
        else args.push('-ss', scalar(clip.sourceIn));
        args.push('-t', scalar(duration), '-protocol_whitelist', 'file,pipe', '-i', sourcePath);
        const idx = inputIndex++;
        if (visible) {
          const effects = clip.effects;
          const sourceWidth = isText ? seq.width : (asset as MediaAsset).width;
          const sourceHeight = isText ? seq.height : (asset as MediaAsset).height;
          const cropWidth = Math.max(1, Math.round(sourceWidth * (1 - effects.cropLeft - effects.cropRight)));
          const cropHeight = Math.max(1, Math.round(sourceHeight * (1 - effects.cropTop - effects.cropBottom)));
          const mode = options.fit ?? effects.fit;
          const factor = mode === 'fill' ? Math.max(width / cropWidth, height / cropHeight) : Math.min(width / cropWidth, height / cropHeight);
          const frameVar = localFrameVariable('t', seq.fps);
          const scale = keyframeExpression(clip, 'scale', frameVar);
          const filter = [`trim=duration=${scalar(duration)}`, 'setpts=PTS-STARTPTS', `fps=${rate}`, `scale=${sourceWidth}:${sourceHeight}`, 'setsar=1', `crop=${cropWidth}:${cropHeight}:${Math.round(sourceWidth * effects.cropLeft)}:${Math.round(sourceHeight * effects.cropTop)}`, `scale=w='max(2,trunc(${scalar(cropWidth * factor)}*(${scale})/2)*2)':h='max(2,trunc(${scalar(cropHeight * factor)}*(${scale})/2)*2)':eval=frame`];
          filter.push('format=rgba');
          // The LGPL runtime intentionally lacks GPL's eq filter. Use LGPL RGB
          // channel mixing and LUT filters with explicit, reproducible math.
          if (effects.saturation !== 1 && effects.saturation <= 2) {
            const s = effects.saturation; const r = 0.2126 * (1 - s); const g = 0.7152 * (1 - s); const b = 0.0722 * (1 - s);
            filter.push(`colorchannelmixer=rr=${scalar(r + s)}:rg=${scalar(g)}:rb=${scalar(b)}:gr=${scalar(r)}:gg=${scalar(g + s)}:gb=${scalar(b)}:br=${scalar(r)}:bg=${scalar(g)}:bb=${scalar(b + s)}`);
          }
          if (effects.saturation > 2) {
            const luminance = '0.2126*r(X,Y)+0.7152*g(X,Y)+0.0722*b(X,Y)';
            const channel = (name: string) => `clip((${luminance})+(${name}(X,Y)-(${luminance}))*${scalar(effects.saturation)},0,255)`;
            filter.push(`geq=r='${channel('r')}':g='${channel('g')}':b='${channel('b')}':a='alpha(X,Y)'`);
          }
          if (effects.brightness !== 0 || effects.contrast !== 1) {
            const value = `clip((val-128)*${scalar(effects.contrast)}+128+${scalar(effects.brightness * 255)},0,255)`;
            filter.push(`lutrgb=r='${value}':g='${value}':b='${value}'`);
          }
          if (effects.rotation) { const angle = scalar(effects.rotation * Math.PI / 180); filter.push(`rotate=${angle}:ow=rotw(${angle}):oh=roth(${angle}):c=none`); }
          const alphaFrame = localFrameVariable('T', seq.fps);
          const opacity = `(${keyframeExpression(clip, 'opacity', alphaFrame)})*(${fadeExpression(clip, alphaFrame)})`;
          if (effects.opacity !== 1 || effects.fadeIn || effects.fadeOut || clip.transition || clip.keyframes.some(k => k.property === 'opacity')) filter.push(`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${opacity})'`);
          filter.push(`setpts=PTS+${scalar(start)}/TB`);
          graph.push(`[${idx}:v]${filter.join(',')}[layer${layerIndex}]`);
          const globalFrame = localFrameVariable('t', seq.fps, start);
          const x = keyframeExpression(clip, 'x', globalFrame); const y = keyframeExpression(clip, 'y', globalFrame);
          graph.push(`[base${layerIndex}][layer${layerIndex}]overlay=x='(main_w-overlay_w)/2+(${x})*${scalar(sx)}':y='(main_h-overlay_h)/2+(${y})*${scalar(sy)}':enable='gte(t,${scalar(start)})*lt(t,${scalar(start + duration)})':eof_action=pass:repeatlast=0:format=auto[base${layerIndex + 1}]`);
          layerIndex++;
        }
        if (audible) {
          const frameVar = localFrameVariable('t', seq.fps);
          const volume = `(${keyframeExpression(clip, 'volume', frameVar)})*(${fadeExpression(clip, frameVar, clips[ci + 1], true)})`;
          const delaySamples = Math.round(start * (options.sampleRate ?? seq.sampleRate));
          const label = `audio${audio.length}`;
          graph.push(`[${idx}:a]atrim=duration=${scalar(duration)},asetpts=PTS-STARTPTS,aresample=${options.sampleRate ?? seq.sampleRate},aformat=sample_fmts=fltp:channel_layouts=stereo,volume='${volume}':eval=frame,adelay=${delaySamples}S:all=1[${label}]`);
          audio.push(`[${label}]`);
        }
      }
    }
    graph.push(`[base${layerIndex}]format=yuv420p[vout]`);
    if (audio.length) graph.push(`${audio.join('')}amix=inputs=${audio.length}:normalize=0:duration=longest,apad,atrim=duration=${scalar(seconds)}[aout]`);
    else graph.push(`anullsrc=r=${options.sampleRate ?? seq.sampleRate}:cl=stereo,atrim=duration=${scalar(seconds)}[aout]`);
    const graphPath = join(tempDir, 'composition.ffgraph'); await writeFile(graphPath, graph.join(';\n'), 'utf8');
    args.push('-/filter_complex', graphPath, '-map', '[vout]', '-map', '[aout]', '-t', scalar(seconds), '-r', rate, '-threads', '2');
    if (options.format === 'webm') args.push('-c:v', 'libvpx-vp9', '-deadline', options.preview ? 'realtime' : 'good', '-cpu-used', options.preview ? '8' : '4', '-row-mt', '1', '-crf', String(options.quality ?? 30), '-b:v', options.bitrateKbps ? `${options.bitrateKbps}k` : '0', '-c:a', 'libopus');
    else {
      args.push('-c:v', capabilities.h264Encoder!);
      if (capabilities.h264Encoder === 'h264_mf') args.push('-hw_encoding', '0');
      if (capabilities.h264Encoder === 'libx264') args.push('-preset', options.preview ? 'ultrafast' : 'medium', '-crf', String(options.quality ?? 23));
      args.push('-b:v', `${options.bitrateKbps ?? 8000}k`, '-c:a', 'aac', '-movflags', '+faststart');
    }
    // Opus encodes at 48 kHz; sequence rates are converted after mixing, preserving timing.
    args.push('-b:a', `${options.audioBitrateKbps ?? 192}k`, '-ar', String(options.format === 'webm' ? 48000 : (options.sampleRate ?? seq.sampleRate)), '-progress', 'pipe:1', '-nostats', temporary);
    let renderedFrame = 0;
    await runProcess(runtime.ffmpegPath, args, { signal: callbacks.signal, onLine(line) {
      const [key, value] = line.split('=');
      if (key === 'frame') renderedFrame = Number(value) || 0;
      if (key === 'out_time_us') { const current = Number(value) / 1e6; callbacks.onProgress?.({ fraction: Math.max(0, Math.min(0.99, current / seconds)), frame: renderedFrame, seconds: current, stage: 'rendering' }); }
    } });
    callbacks.onProgress?.({ fraction: 0.99, frame: renderedFrame, seconds, stage: 'validating' });
    const output = await probe(temporary, callbacks.signal);
    if (output.width !== width || output.height !== height || Math.abs(output.duration - seconds) > Math.max(fps.den / fps.num, 0.03)) throw new MediaError('ENCODER', 'Output validation failed: dimensions or duration do not match the render plan.');
    // A failed encode never damages an existing destination. Windows rename replaces atomically.
    if (options.overwrite) await rename(temporary, options.outputPath);
    else { await link(temporary, options.outputPath); await rm(temporary); }
    callbacks.onProgress?.({ fraction: 1, frame: renderedFrame, seconds, stage: 'complete' });
    return { path: options.outputPath, duration: output.duration, width, height };
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
