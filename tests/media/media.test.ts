import { beforeAll, describe, expect, it } from 'vitest';
import { mkdir, readFile, writeFile, access, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { MediaService } from '../../src/main/media/service';
import { runProcess } from '../../src/main/media/process';
import { createClip, createProject, createTrack, type MediaAsset, type Project } from '../../src/shared/model';

const directory = resolve('test-artifacts/media');
const ffmpegPath = resolve('resources/ffmpeg/bin/ffmpeg.exe');
const ffprobePath = resolve('resources/ffmpeg/bin/ffprobe.exe');
const media = new MediaService({ ffmpegPath, ffprobePath, cacheDir: join(directory, 'cache'), fontPath: resolve('resources/fonts/NotoSans-Regular.ttf') });
let red: MediaAsset; let blue: MediaAsset; let music: MediaAsset; let voice: MediaAsset; let image: MediaAsset;

async function ffmpeg(args: string[]): Promise<void> { await runProcess(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args]); }
async function pixel(path: string, second: number, x = 80, y = 45): Promise<number[]> {
  const result = await runProcess(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(second), '-i', path, '-frames:v', '1', '-vf', `crop=2:2:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return [...result.stdout.subarray(0, 3)];
}
async function rms(path: string, second: number, duration = 0.2): Promise<number> {
  const result = await runProcess(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(second), '-t', String(duration), '-i', path, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-']);
  let sum = 0; const n = result.stdout.length / 4;
  for (let i = 0; i < n; i++) { const value = result.stdout.readFloatLE(i * 4); sum += value * value; }
  return Math.sqrt(sum / n);
}
function project(): Project {
  const p = createProject('Gerçek medya – Türkçe'); p.sequence.width = 160; p.sequence.height = 90;
  p.assets = [red, blue, music, voice, image];
  const [v1, v2, a1, a2] = p.sequence.tracks;
  v1!.clips = [createClip('video', 'Red', { assetId: red.id, duration: 45, effects: { fadeIn: 6 } }), createClip('video', 'Blue dissolve', { assetId: blue.id, start: 30, duration: 45, transition: { type: 'crossDissolve', duration: 15 } })];
  v2!.clips = [createClip('image', 'Green overlay', { assetId: image.id, start: 45, duration: 15, effects: { scale: 0.4 }, keyframes: [{ property: 'opacity', frame: 0, value: 0, interpolation: 'linear' }, { property: 'opacity', frame: 5, value: 1, interpolation: 'linear' }] })];
  a1!.clips = [createClip('audio', 'Music', { assetId: music.id, duration: 120, keyframes: [{ property: 'volume', frame: 0, value: 1, interpolation: 'linear' }, { property: 'volume', frame: 119, value: 0.25, interpolation: 'linear' }] })];
  a2!.muted = true; a2!.clips = [createClip('audio', 'Muted voice', { assetId: voice.id, duration: 120, effects: { volume: 8 } })];
  p.sequence.tracks.push(createTrack('video', 'Titles', { clips: [createClip('title', 'Türkçe title', { start: 75, duration: 15, text: { text: 'İyi çekim!', fontSize: 14, color: '#ffffff', background: '#112233', align: 'center' } })] }));
  p.sequence.tracks.push(createTrack('video', 'Captions', { clips: [createClip('caption', 'Caption', { start: 105, duration: 15, text: { text: 'şğüıöç', fontSize: 12, color: '#ffffff', background: '#333333', align: 'center' } })] }));
  return p;
}

beforeAll(async () => {
  await mkdir(directory, { recursive: true });
  await ffmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=30000/1001:d=4.1', '-c:v', 'libopenh264', '-b:v', '400k', '-pix_fmt', 'yuv420p', join(directory, "kırmızı ' [özel] &.mp4")]);
  await ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:s=240x160:r=30:d=4.1', '-c:v', 'libopenh264', '-b:v', '400k', '-pix_fmt', 'yuv420p', join(directory, 'blue.mp4')]);
  await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4.1', '-c:a', 'pcm_s16le', join(directory, 'müzik.wav')]);
  await ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=44100:duration=4.1', '-c:a', 'pcm_s16le', join(directory, 'voice.wav')]);
  await ffmpeg(['-f', 'lavfi', '-i', 'color=c=lime:s=160x90', '-frames:v', '1', join(directory, 'image.png')]);
  [red, blue, music, voice, image] = await Promise.all(["kırmızı ' [özel] &.mp4", 'blue.mp4', 'müzik.wav', 'voice.wav', 'image.png'].map(path => media.probe(join(directory, path))));
});

describe('real Windows FFmpeg media pipeline', () => {
  it('detects installed CPU encoders and imports real metadata, thumbnail and waveform', async () => {
    const capabilities = await media.capabilities();
    expect(capabilities.formats).toEqual(expect.arrayContaining(['webm', 'mp4']));
    expect(capabilities.h264Encoder).toBe('libopenh264');
    const asset = await media.importAsset(red.path);
    expect(asset.fps).toEqual({ num: 30000, den: 1001 });
    expect(asset.width).toBe(160); await expect(access(asset.thumbnail!)).resolves.toBeUndefined();
    const sound = await media.importAsset(music.path);
    expect(sound.waveform!.length).toBeGreaterThan(100);
    expect(Math.max(...sound.waveform!)).toBeGreaterThan(0.1);
    expect(image.kind).toBe('image');
  });

  it('exports actual layers, dissolve, title, caption, gaps, keyframes and muted audio', async () => {
    const p = project(); const outputPath = join(directory, 'composition.webm'); const progress: number[] = [];
    const output = await media.render(p, { outputPath, format: 'webm', width: 160, height: 90, overwrite: true, quality: 20 }, { onProgress: p => progress.push(p.fraction) });
    expect(output.duration).toBeCloseTo(4, 1); expect(progress.at(-1)).toBe(1);
    const first = await pixel(outputPath, 0.5); expect(first[0]).toBeGreaterThan(200); expect(first[2]).toBeLessThan(30);
    const dissolve = await pixel(outputPath, 1.25); expect(dissolve[0]).toBeGreaterThan(80); expect(dissolve[2]).toBeGreaterThan(80);
    const overlay = await pixel(outputPath, 1.8); expect(overlay[1]).toBeGreaterThan(180); expect(overlay[0]).toBeLessThan(30);
    const outside = await pixel(outputPath, 1.8, 20, 20); expect(outside[2]).toBeGreaterThan(180);
    const title = await pixel(outputPath, 2.7); expect(title.reduce((a, b) => a + b, 0)).toBeGreaterThan(50);
    const gap = await pixel(outputPath, 3.2); expect(Math.max(...gap)).toBeLessThan(10);
    const caption = await pixel(outputPath, 3.8, 70, 75); expect(caption.reduce((a, b) => a + b, 0)).toBeGreaterThan(30);
    const early = await rms(outputPath, 0.5); const late = await rms(outputPath, 3.3);
    expect(early).toBeGreaterThan(0.05); expect(early).toBeLessThan(0.12); expect(late).toBeLessThan(early * 0.6);
    await writeFile(join(directory, 'composition.banana'), JSON.stringify(p, null, 2));
  });

  it('exports MP4 at rational FPS and validates one-frame duration', async () => {
    const p = createProject(); p.sequence.width = 160; p.sequence.height = 90; p.sequence.fps = { num: 30000, den: 1001 }; p.assets = [red];
    p.sequence.tracks[0]!.clips = [createClip('video', 'Exact cut', { assetId: red.id, duration: 37, sourceIn: 0.2 })];
    const outputPath = join(directory, 'rational.mp4');
    await media.render(p, { outputPath, format: 'mp4', width: 160, height: 90, overwrite: true });
    const output = await media.probe(outputPath);
    expect(output.fps).toEqual(p.sequence.fps); expect(Math.abs(output.duration - 37 * 1001 / 30000)).toBeLessThan(1001 / 30000);
  });

  it('renders position and scale keyframes, rotation, crop and monochrome color adjustment', async () => {
    const p = createProject(); p.sequence.width = 160; p.sequence.height = 90; p.assets = [red, image];
    p.sequence.tracks[0]!.clips = [createClip('video', 'Background', { assetId: red.id, duration: 30 })];
    p.sequence.tracks[1]!.clips = [createClip('image', 'Animated image', { assetId: image.id, duration: 30, keyframes: [
      { property: 'x', frame: 0, value: -40, interpolation: 'linear' }, { property: 'x', frame: 29, value: 40, interpolation: 'linear' },
      { property: 'scale', frame: 0, value: 0.2, interpolation: 'linear' }, { property: 'scale', frame: 29, value: 0.6, interpolation: 'linear' },
    ] })];
    const outputPath = join(directory, 'animated.webm');
    await media.render(p, { outputPath, format: 'webm', width: 160, height: 90, overwrite: true });
    expect((await pixel(outputPath, 0.1, 45, 45))[1]).toBeGreaterThan(180);
    expect((await pixel(outputPath, 0.1, 125, 45))[0]).toBeGreaterThan(180);
    expect((await pixel(outputPath, 0.9, 45, 45))[0]).toBeGreaterThan(180);
    expect((await pixel(outputPath, 0.9, 125, 45))[1]).toBeGreaterThan(180);
    const transformed = p.sequence.tracks[1]!.clips[0]!;
    transformed.keyframes = []; transformed.effects.scale = 0.5; transformed.effects.rotation = 90;
    transformed.effects.cropLeft = 0.25; transformed.effects.cropRight = 0.25; transformed.effects.saturation = 0;
    const transformedPath = join(directory, 'transformed.webm');
    await media.render(p, { outputPath: transformedPath, format: 'webm', width: 160, height: 90, overwrite: true });
    const center = await pixel(transformedPath, 0.5);
    expect(Math.max(...center) - Math.min(...center)).toBeLessThan(12);
    expect(center[0]).toBeGreaterThan(80);
    expect((await pixel(transformedPath, 0.5, 10, 10))[0]).toBeGreaterThan(180);
  });

  it('creates an actually decodable proxy for an incompatible preview codec', async () => {
    const path = join(directory, 'legacy.mov');
    await ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=160x90:r=24:d=0.5', '-c:v', 'mpeg4', path]);
    const imported = await media.importAsset(path);
    expect(imported.videoCodec).toBe('mpeg4'); expect(imported.proxyPath).toBeDefined();
    const proxy = await media.probe(imported.proxyPath!); expect(proxy.videoCodec).toBe('vp9'); expect(proxy.duration).toBeCloseTo(0.5, 1);
  });

  it('honors phone rotation metadata and non-square source pixel aspect', async () => {
    const rotatedPath = join(directory, 'phone-rotated.mov');
    await ffmpeg(['-i', blue.path, '-c', 'copy', '-metadata:s:v:0', 'rotate=90', rotatedPath]);
    const rotated = await media.probe(rotatedPath); expect(rotated.width).toBe(160); expect(rotated.height).toBe(240);
    const p = createProject(); p.sequence.width = 160; p.sequence.height = 90; p.assets = [rotated];
    p.sequence.tracks[0]!.clips = [createClip('video', 'Phone', { assetId: rotated.id, duration: 10 })];
    const outputPath = join(directory, 'rotation.webm');
    await media.render(p, { outputPath, format: 'webm', width: 160, height: 90, overwrite: true });
    expect((await pixel(outputPath, 0.1))[2]).toBeGreaterThan(180); expect(Math.max(...await pixel(outputPath, 0.1, 10, 45))).toBeLessThan(10);
    const anamorphicPath = join(directory, 'anamorphic.mp4');
    await ffmpeg(['-f', 'lavfi', '-i', 'color=c=red:s=160x90:r=30:d=0.5', '-vf', 'setsar=4/3', '-c:v', 'libopenh264', '-b:v', '400k', anamorphicPath]);
    const anamorphic = await media.probe(anamorphicPath); expect(anamorphic.width).toBe(213); expect(anamorphic.height).toBe(90);
    p.assets = [anamorphic]; p.sequence.tracks[0]!.clips[0]!.assetId = anamorphic.id;
    await expect(media.render(p, { outputPath: join(directory, 'anamorphic.webm'), format: 'webm', width: 160, height: 90, overwrite: true })).resolves.toMatchObject({ width: 160, height: 90 });
  });

  it('handles the maximum supported saturation and converts 96 kHz sequences for Opus', async () => {
    const p = createProject(); p.sequence.width = 160; p.sequence.height = 90; p.sequence.sampleRate = 96000; p.assets = [red, music];
    p.sequence.tracks[0]!.clips = [createClip('video', 'Saturation', { assetId: red.id, duration: 10, effects: { saturation: 4, brightness: 0.05, contrast: 1.1 } })];
    p.sequence.tracks[2]!.clips = [createClip('audio', 'Audio', { assetId: music.id, duration: 10 })];
    const outputPath = join(directory, 'saturation.webm');
    await media.render(p, { outputPath, format: 'webm', width: 160, height: 90, sampleRate: 96000, overwrite: true });
    expect((await pixel(outputPath, 0.1))[0]).toBeGreaterThan(200);
    const result = await runProcess(ffprobePath, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'default=nw=1:nk=1', outputPath]);
    expect(result.stdout.toString().trim()).toBe('48000');
  });

  it('applies track solo and keeps caption burning optional', async () => {
    const p = project(); p.sequence.tracks[3]!.muted = false; p.sequence.tracks[3]!.solo = true; p.sequence.tracks[3]!.clips[0]!.effects.volume = 0.25;
    const outputPath = join(directory, 'solo.webm');
    await media.render(p, { outputPath, format: 'webm', width: 160, height: 90, overwrite: true, burnCaptions: false });
    const level = await rms(outputPath, 0.5); expect(level).toBeGreaterThan(0.015); expect(level).toBeLessThan(0.03);
    expect(Math.max(...await pixel(outputPath, 3.8, 70, 75))).toBeLessThan(10);
  });

  it('refuses source overwrite, unconfirmed overwrite, corrupt input and bad directories', async () => {
    const p = project(); const original = await readFile(red.path);
    await expect(media.render(p, { outputPath: red.path, format: 'mp4', width: 160, height: 90, overwrite: true })).rejects.toThrow('source media');
    expect(await readFile(red.path)).toEqual(original);
    const target = join(directory, 'do-not-overwrite.webm'); await writeFile(target, 'preserve me');
    await expect(media.render(p, { outputPath: target, format: 'webm', width: 160, height: 90 })).rejects.toThrow('already exists');
    expect(await readFile(target, 'utf8')).toBe('preserve me');
    await expect(media.probe(target)).rejects.toThrow();
    await expect(media.render(p, { outputPath: join(directory, 'missing-folder', 'output.webm'), format: 'webm', width: 160, height: 90 })).rejects.toThrow();
  });

  it('cancels a real render and cleans partial output', async () => {
    const p = project(); const controller = new AbortController(); const outputPath = join(directory, 'cancelled.webm');
    const task = media.render(p, { outputPath, format: 'webm', width: 1920, height: 1080, overwrite: true }, { signal: controller.signal, onProgress: progress => { if (progress.stage === 'rendering') controller.abort(); } });
    await expect(task).rejects.toThrow(/cancel/i);
    await expect(access(outputPath)).rejects.toThrow();
  });

  it('preserves an existing destination when Windows denies replacement', async () => {
    const target = join(directory, 'locked-output.webm'); await writeFile(target, 'preserved original output');
    const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = `$f = [System.IO.File]::Open('${target.replaceAll("'", "''")}', [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None); [Console]::WriteLine('LOCKED'); [Console]::ReadLine() | Out-Null; $f.Dispose()`;
    const lock = spawn(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      await new Promise<void>((resolve, reject) => { let output = ''; lock.stdout.on('data', chunk => { output += chunk.toString(); if (output.includes('LOCKED')) resolve(); }); lock.once('error', reject); lock.once('exit', code => { if (!output.includes('LOCKED')) reject(new Error(`Lock helper exited: ${code}`)); }); });
      const p = createProject(); p.sequence.width = 160; p.sequence.height = 90; p.assets = [red]; p.sequence.tracks[0]!.clips = [createClip('video', 'Clip', { assetId: red.id, duration: 3 })];
      await expect(media.render(p, { outputPath: target, format: 'webm', width: 160, height: 90, overwrite: true })).rejects.toThrow();
    } finally { lock.stdin.end('\n'); await new Promise<void>(resolve => lock.once('close', () => resolve())); }
    expect(await readFile(target, 'utf8')).toBe('preserved original output');
  });

  it('extracts bounded AI media with original source offsets and measures silence', async () => {
    const p = project(); p.sequence.tracks[2]!.clips[0]!.sourceIn = 0.1;
    const prepared = await media.prepareAI(p, [p.sequence.tracks[0]!.clips[0]!.id, p.sequence.tracks[2]!.clips[0]!.id], { includeAudio: true, includeImages: true });
    expect(prepared.map(part => part.kind)).toEqual(['image', 'audio']);
    expect(prepared[1]!.sourceStart).toBe(0.1); expect(prepared[1]!.duration).toBe(4);
    expect(prepared.reduce((sum, part) => sum + part.data.byteLength, 0)).toBeLessThan(32 * 1024 * 1024);
    expect(await media.detectSilence(music, 0, 1)).toEqual([]);
    expect((await stat(join(directory, 'composition.webm'))).size).toBeGreaterThan(1000);
  });
});
