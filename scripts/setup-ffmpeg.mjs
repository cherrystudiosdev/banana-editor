import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, readdir, cp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Release assets and SHA256 are immutable inputs, never the moving `latest` URL.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const target = join(root, 'resources', 'ffmpeg');
const filename = 'ffmpeg-n9.0.2-36-g6882969ce9-win64-lgpl-shared-9.0.zip';
const url = `https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-27-18-38/${filename}`;
const sha256 = 'f70e43c4f5670fbbf2dc4eb667b0d6b3743d68386f766c08bb2e0ec3edece398';
const downloadDir = join(root, '.downloads');
await mkdir(target, { recursive: true });
await mkdir(downloadDir, { recursive: true });
const archive = join(downloadDir, filename);
try { await access(archive); } catch {
  console.log(`Downloading pinned FFmpeg: ${filename}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`FFmpeg download: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
}
const actual = createHash('sha256').update(await readFile(archive)).digest('hex');
if (actual !== sha256) throw new Error(`FFmpeg SHA256 mismatch: ${actual}`);
const unpack = join(downloadDir, filename.replace('.zip', ''));
await mkdir(unpack, { recursive: true });
if (process.platform !== 'win32') throw new Error('This pinned distribution targets Windows x64 only. Do not publish untested platform packages.');
const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tar, ['-xf', archive, '-C', unpack], { windowsHide: true, stdio: 'inherit' });
const [folder] = await readdir(unpack);
if (!folder) throw new Error('FFmpeg archive was empty');
await cp(join(unpack, folder), target, { recursive: true });
const configuration = execFileSync(join(target, 'bin', 'ffmpeg.exe'), ['-hide_banner', '-buildconf'], { encoding: 'utf8', windowsHide: true });
if (configuration.includes('--enable-nonfree') || configuration.includes('--enable-gpl')) throw new Error('Unexpected FFmpeg license configuration');
await writeFile(join(target, 'BUILD-CONFIGURATION.txt'), configuration);
await writeFile(join(target, 'provenance.json'), JSON.stringify({ filename, url, sha256, ffmpegCommit: '6882969ce9fd2aa6aa1d0008b2bfe1c838aac11d', buildCommit: 'b4a2b1d7cc241786eb8e2b588a7ade40cad48bbd', buildRepository: 'https://github.com/BtbN/FFmpeg-Builds', release: 'autobuild-2026-10-27-18-38', license: 'LGPL-3.0-or-later', verifiedAt: new Date().toISOString() }, null, 2));
const sourceDir = join(target, 'source');
await mkdir(sourceDir, { recursive: true });
const sources = [
  { name: 'ffmpeg-6882969ce9.tar.gz', url: 'https://codeload.github.com/FFmpeg/FFmpeg/tar.gz/6882969ce9fd2aa6aa1d0008b2bfe1c838aac11d', sha: '9dc825750d71d51a9c8d45516ad3ffdf05e74f029a66f8c3efaf431ed7331701' },
  { name: 'build-recipes-b4a2b1d.tar.gz', url: 'https://codeload.github.com/BtbN/FFmpeg-Builds/tar.gz/b4a2b1d7cc241786eb8e2b588a7ade40cad48bbd', sha: 'e250ee310b7a033fe28781f569015183ae320937ffe5722c34226e27ee12c892' },
];
for (const source of sources) {
  const path = join(sourceDir, source.name);
  try { await access(path); } catch {
    const response = await fetch(source.url);
    if (!response.ok || !response.body) throw new Error(`Source download: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
  }
  if (createHash('sha256').update(await readFile(path)).digest('hex') !== source.sha) throw new Error(`Source SHA256 mismatch: ${source.name}`);
}
for (const license of ['COPYING.GPLv3', 'COPYING.LGPLv3']) {
  const data = execFileSync(tar, ['-xOf', join(sourceDir, sources[0].name), `FFmpeg-6882969ce9fd2aa6aa1d0008b2bfe1c838aac11d/${license}`], { windowsHide: true });
  await writeFile(join(target, license), data);
}
console.log(`Verified FFmpeg at ${target}`);
