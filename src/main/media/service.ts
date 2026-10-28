import { access, mkdir, stat, readFile, readdir, rm, mkdtemp } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { MediaAsset, Project, Rational } from '../../shared/model';
import type { PreparedMedia } from '../../shared/ai';
import { MediaAssetSchema } from '../../shared/model';
import { framesToSeconds } from '../../core/time';
import { MediaError, runProcess, WorkQueue } from './process';
import { renderProject } from './render';
import type { ExportOptions, MediaCapabilities, MediaServiceOptions, RenderCallbacks, RenderResult } from './types';
export type { ExportOptions, MediaCapabilities, MediaServiceOptions, RenderCallbacks, RenderResult, RenderProgress } from './types';
export { MediaError } from './process';

interface ProbeStream { codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string; avg_frame_rate?: string; r_frame_rate?: string; sample_aspect_ratio?: string; disposition?: { attached_pic?: number }; tags?: { rotate?: string }; side_data_list?: Array<{ rotation?: number }>; }
interface ProbeData { streams?: ProbeStream[]; format?: { duration?: string; format_name?: string; }; }
const allowedFormats = new Set(['mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2', 'matroska', 'webm', 'wav', 'mp3', 'image2', 'png_pipe', 'jpeg_pipe', 'mjpeg']);
const compatibleVideo = new Set(['h264', 'vp8', 'vp9', 'av1', 'theora']);

function rational(value?: string): Rational | undefined {
  const [num, den] = (value ?? '').split('/').map(Number);
  return num && den && Number.isInteger(num) && Number.isInteger(den) && num > 0 && den > 0 && num <= 240000 && den <= 100000 ? { num, den } : undefined;
}

export class MediaService {
  private readonly queue = new WorkQueue(2);
  private runtimeCapabilities?: Promise<MediaCapabilities>;
  private active = 0;
  constructor(public readonly options: MediaServiceOptions) {}

  private async work<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return this.queue.run(async () => { this.active++; try { return await run(); } finally { this.active--; } }, signal);
  }

  async probe(path: string, signal?: AbortSignal): Promise<MediaAsset> {
    const absolute = resolve(path); const info = await stat(absolute);
    if (!info.isFile()) throw new MediaError('INVALID_MEDIA', 'Choose a regular media file.');
    const result = await runProcess(this.options.ffprobePath, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', absolute], { signal, maxOutputBytes: 2 * 1024 * 1024 });
    let data: ProbeData;
    try { data = JSON.parse(result.stdout.toString('utf8')) as ProbeData; } catch { throw new MediaError('INVALID_MEDIA', 'Media metadata is invalid.'); }
    const formats = (data.format?.format_name ?? '').split(',');
    if (!formats.some(format => allowedFormats.has(format))) throw new MediaError('INVALID_MEDIA', `Unsupported media container: ${data.format?.format_name ?? 'unknown'}.`);
    const video = data.streams?.find(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
    const audio = data.streams?.find(stream => stream.codec_type === 'audio');
    if (!video && !audio) throw new MediaError('INVALID_MEDIA', 'No decodable video, audio or image stream was found.');
    const image = !!video && formats.some(format => ['image2', 'png_pipe', 'jpeg_pipe', 'mjpeg'].includes(format));
    const duration = image ? 0 : Number(data.format?.duration ?? video?.duration ?? audio?.duration ?? 0);
    if (!image && (!Number.isFinite(duration) || duration <= 0)) throw new MediaError('INVALID_MEDIA', 'Media does not have a finite positive duration.');
    const [sarNum, sarDen] = (video?.sample_aspect_ratio ?? '1:1').split(':').map(Number);
    const sar = sarNum && sarDen && sarNum > 0 && sarDen > 0 ? sarNum / sarDen : 1;
    let width = Math.round((video?.width ?? 0) * sar); let height = video?.height ?? 0;
    const rotation = video?.side_data_list?.find(side => Number.isFinite(side.rotation))?.rotation ?? Number(video?.tags?.rotate ?? 0);
    if (Math.abs(Math.round(rotation / 90)) % 2 === 1) [width, height] = [height, width];
    return MediaAssetSchema.parse({ id: randomUUID(), name: basename(absolute), path: absolute, kind: image ? 'image' : video ? 'video' : 'audio', duration, width, height, ...(image ? {} : { fps: rational(video?.avg_frame_rate) ?? rational(video?.r_frame_rate) }), hasAudio: !!audio, videoCodec: video?.codec_name, audioCodec: audio?.codec_name });
  }

  private async cacheKey(path: string): Promise<string> {
    const info = await stat(path);
    return createHash('sha256').update(`${resolve(path)}\n${info.size}\n${info.mtimeMs}`).digest('hex').slice(0, 32);
  }

  async importAsset(path: string, signal?: AbortSignal): Promise<MediaAsset> {
    return this.work(async () => {
      const asset = await this.probe(path, signal);
      await mkdir(this.options.cacheDir, { recursive: true });
      if (asset.kind !== 'audio') asset.thumbnail = await this.thumbnail(asset, signal);
      if (asset.hasAudio) asset.waveform = await this.waveform(asset, signal);
      if (asset.kind === 'video' && !compatibleVideo.has(asset.videoCodec ?? '')) asset.proxyPath = await this.proxy(asset, signal);
      return asset;
    }, signal);
  }

  async thumbnail(asset: MediaAsset, signal?: AbortSignal): Promise<string> {
    await mkdir(this.options.cacheDir, { recursive: true });
    const target = join(this.options.cacheDir, `${await this.cacheKey(asset.path)}.jpg`);
    try { await access(target); return target; } catch { /* Create cache miss. */ }
    try {
      await runProcess(this.options.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', String(Math.min(asset.duration / 3, 1)), '-protocol_whitelist', 'file,pipe', '-i', asset.path, '-frames:v', '1', '-vf', 'scale=320:180:force_original_aspect_ratio=decrease', '-q:v', '3', target], { signal });
      return target;
    } catch (error) { await rm(target, { force: true }); throw error; }
  }

  async waveform(asset: MediaAsset, signal?: AbortSignal): Promise<number[]> {
    if (!asset.hasAudio) return [];
    const samplesPerBin = Math.max(1, Math.ceil(asset.duration * 8000 / 1200));
    const filter = `aresample=8000,asetnsamples=n=${samplesPerBin}:p=1,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-`;
    const { stdout } = await runProcess(this.options.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', asset.path, '-vn', '-ac', '1', '-af', filter, '-f', 'null', '-'], { signal, maxOutputBytes: 1024 * 1024 });
    return [...stdout.toString('utf8').matchAll(/lavfi\.astats\.Overall\.Peak_level=(-?inf|[-\d.]+)/g)].map(match => { const db = Number(match[1]); return Number.isFinite(db) ? Math.max(0, Math.min(1, 10 ** (db / 20))) : 0; });
  }

  async proxy(asset: MediaAsset, signal?: AbortSignal): Promise<string> {
    await mkdir(this.options.cacheDir, { recursive: true });
    const target = join(this.options.cacheDir, `${await this.cacheKey(asset.path)}.proxy.webm`);
    try { await access(target); return target; } catch { /* Create cache miss. */ }
    try {
      await runProcess(this.options.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-protocol_whitelist', 'file,pipe', '-i', asset.path, '-vf', "scale=w='min(960,iw)':h=-2", '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-b:v', '0', '-crf', '35', '-c:a', 'libopus', '-b:a', '128k', '-threads', '2', target], { signal });
      await this.probe(target, signal); return target;
    } catch (error) { await rm(target, { force: true }); throw error; }
  }

  async capabilities(): Promise<MediaCapabilities> {
    this.runtimeCapabilities ??= this.readCapabilities();
    try { return await this.runtimeCapabilities; } catch (error) { this.runtimeCapabilities = undefined; throw error; }
  }

  private async readCapabilities(): Promise<MediaCapabilities> {
    const [encoderOutput, versionOutput, hwOutput] = await Promise.all([
      runProcess(this.options.ffmpegPath, ['-hide_banner', '-encoders']),
      runProcess(this.options.ffmpegPath, ['-version']),
      runProcess(this.options.ffmpegPath, ['-hide_banner', '-hwaccels']),
    ]);
    const encoders = [...encoderOutput.stdout.toString('utf8').matchAll(/^\s*[VAS][A-Z.]{5}\s+(\S+)/gm)].map(match => match[1]!);
    const hardware = hwOutput.stdout.toString('utf8').split(/\r?\n/).slice(1).map(s => s.trim()).filter(Boolean);
    const formats: MediaCapabilities['formats'] = [];
    if (encoders.includes('libvpx-vp9') && encoders.includes('libopus')) formats.push('webm');
    let h264Encoder: string | undefined;
    await mkdir(this.options.cacheDir, { recursive: true });
    for (const encoder of ['libopenh264', 'libx264', 'h264_mf']) {
      if (!encoders.includes(encoder) || !encoders.includes('aac')) continue;
      const target = join(this.options.cacheDir, `.encoder-test-${randomUUID()}.mp4`);
      try {
        await runProcess(this.options.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'color=black:s=64x64:r=30:d=0.1', '-c:v', encoder, ...(encoder === 'h264_mf' ? ['-hw_encoding', '0'] : []), '-b:v', '500k', '-pix_fmt', 'yuv420p', target]);
        h264Encoder = encoder; formats.push('mp4'); break;
      } catch { /* Installed encoder may not work on this machine. Try the next CPU path. */ }
      finally { await rm(target, { force: true }); }
    }
    return { encoders, formats, hardware, h264Encoder, version: versionOutput.stdout.toString('utf8').split(/\r?\n/)[0] ?? 'unknown' };
  }

  async render(project: Project, options: ExportOptions, callbacks: RenderCallbacks = {}): Promise<RenderResult> {
    return this.work(async () => renderProject(project, options, this.options, await this.capabilities(), (path, signal) => this.probe(path, signal), callbacks), callbacks.signal);
  }

  async cacheStats(): Promise<{ bytes: number; files: number }> {
    await mkdir(this.options.cacheDir, { recursive: true });
    let bytes = 0; let files = 0;
    for (const entry of await readdir(this.options.cacheDir, { withFileTypes: true })) if (entry.isFile()) { bytes += (await stat(join(this.options.cacheDir, entry.name))).size; files++; }
    return { bytes, files };
  }

  async clearCache(): Promise<void> {
    if (this.active) throw new MediaError('FILESYSTEM', 'Wait for active media jobs before clearing the cache.');
    await mkdir(this.options.cacheDir, { recursive: true });
    for (const entry of await readdir(this.options.cacheDir, { withFileTypes: true })) if (entry.isFile()) await rm(join(this.options.cacheDir, entry.name), { force: true });
  }

  /** Source ranges only; caller must obtain explicit provider/model/media confirmation. */
  async prepareAI(project: Project, selectedClipIds: string[], options: { includeImages: boolean; includeAudio: boolean; includeVideo?: boolean }, signal?: AbortSignal): Promise<PreparedMedia[]> {
    return this.work(async () => {
      const clips = project.sequence.tracks.flatMap(t => t.clips).filter(c => selectedClipIds.includes(c.id));
      if (!clips.length) return [];
      const assets = new Map(project.assets.map(a => [a.id, a]));
      let parts = 0;
      for (const clip of clips) {
        const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
        if (options.includeAudio && asset?.hasAudio) parts += Math.ceil(framesToSeconds(clip.duration, project.sequence.fps) / 30);
        if (options.includeImages && asset && asset.kind !== 'audio') parts++;
      }
      if (parts > 64) throw new MediaError('INVALID_MEDIA', 'Select a shorter range: AI media is limited to 64 chunks per request.');
      await mkdir(this.options.cacheDir, { recursive: true });
      const directory = await mkdtemp(join(this.options.cacheDir, 'ai-'));
      const result: PreparedMedia[] = []; let bytes = 0; let images = 0;
      const append = async (path: string, metadata: Omit<PreparedMedia, 'data'>) => {
        const info = await stat(path); bytes += info.size;
        if (bytes > 32 * 1024 * 1024) throw new MediaError('INVALID_MEDIA', 'Select a shorter range: AI media is limited to 32 MB per request.');
        result.push({ ...metadata, data: await readFile(path) });
      };
      try {
        for (const clip of clips) {
          const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
          if (!asset) continue;
          const duration = framesToSeconds(clip.duration, project.sequence.fps);
          if (options.includeImages && asset.kind !== 'audio' && images < 8) {
            const path = join(directory, `frame-${images++}.jpg`);
            await runProcess(this.options.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', String(asset.kind === 'image' ? 0 : clip.sourceIn + Math.min(duration / 2, 2)), '-protocol_whitelist', 'file,pipe', '-i', asset.path, '-frames:v', '1', '-vf', "scale=w='min(768,iw)':h=-2", '-q:v', '4', path], { signal });
            await append(path, { clipId: clip.id, kind: 'image', mimeType: 'image/jpeg', sourceStart: asset.kind === 'image' ? 0 : clip.sourceIn + Math.min(duration / 2, 2), duration: 0 });
          }
          if (options.includeAudio && asset.hasAudio) {
            for (let offset = 0; offset < duration; offset += 30) {
              const length = Math.min(30, duration - offset); const path = join(directory, `audio-${result.length}.wav`);
              await runProcess(this.options.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', String(clip.sourceIn + offset), '-t', String(length), '-protocol_whitelist', 'file,pipe', '-i', asset.path, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', path], { signal });
              await append(path, { clipId: clip.id, kind: 'audio', mimeType: 'audio/wav', sourceStart: clip.sourceIn + offset, duration: length });
            }
          }
          if (options.includeVideo) throw new MediaError('INVALID_MEDIA', 'Video upload is disabled; use bounded sampled frames and selected audio instead.');
        }
        return result;
      } finally { await rm(directory, { recursive: true, force: true }); }
    }, signal);
  }

  async detectSilence(asset: MediaAsset, start = 0, duration = asset.duration, signal?: AbortSignal): Promise<Array<{ start: number; end: number }>> {
    if (!asset.hasAudio || start < 0 || duration <= 0 || start + duration > asset.duration + 0.001) throw new MediaError('INVALID_MEDIA', 'Choose a valid source audio range.');
    return this.work(async () => {
      const { stderr } = await runProcess(this.options.ffmpegPath, ['-hide_banner', '-nostdin', '-ss', String(start), '-t', String(duration), '-protocol_whitelist', 'file,pipe', '-i', asset.path, '-vn', '-af', 'silencedetect=noise=-35dB:d=0.3', '-f', 'null', '-'], { signal });
      const events = [...stderr.matchAll(/silence_(start|end): ([\d.]+)/g)]; const intervals: Array<{ start: number; end: number }> = []; let current = 0;
      for (const event of events) { if (event[1] === 'start') current = Number(event[2]); else intervals.push({ start: start + current, end: start + Math.min(duration, Number(event[2])) }); }
      if (events.at(-1)?.[1] === 'start') intervals.push({ start: start + current, end: start + duration });
      return intervals;
    }, signal);
  }
}
