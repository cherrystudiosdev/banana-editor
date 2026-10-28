import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join, resolve, basename, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// This audits upstream recipes as data. It never executes downloaded scripts.
// --acquire additionally mirrors supported immutable source archives and notices.
// Audit remains failed until inclusion/transitive-source obligations are reviewed.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtime = join(root, 'resources', 'ffmpeg');
const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
const commit = 'b4a2b1d7cc241786eb8e2b588a7ade40cad48bbd';
const unpack = join(root, '.downloads', 'ffmpeg-build-recipes');
await mkdir(unpack, { recursive: true });
execFileSync(tar, ['-xf', join(runtime, 'source', 'build-recipes-b4a2b1d.tar.gz'), '-C', unpack], { windowsHide: true });
const recipes = join(unpack, `FFmpeg-Builds-${commit}`, 'scripts.d');
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name)));
    else if (entry.name.endsWith('.sh')) result.push(join(directory, entry.name));
  }
  return result;
}
function archiveURL(repo, revision) {
  if (repo.startsWith('https://github.com/')) return `https://codeload.github.com/${repo.slice('https://github.com/'.length).replace(/\.git$/, '')}/tar.gz/${encodeURIComponent(revision)}`;
  if (/^https:\/\/(gitlab\.[^/]+|code\.videolan\.org)\//.test(repo)) { const base = repo.replace(/\.git$/, ''); return `${base}/-/archive/${encodeURIComponent(revision)}/${basename(base)}-${encodeURIComponent(revision)}.tar.gz`; }
  if (repo.includes('.googlesource.com/')) return `${repo.replace(/\.git$/, '')}/+archive/${encodeURIComponent(revision)}.tar.gz`;
  return null;
}
const components = [];
for (const path of await files(recipes)) {
  const text = await readFile(path, 'utf8');
  for (const repoMatch of text.matchAll(/^SCRIPT_REPO(\d*)="([^"]+)"/gm)) {
    const suffix = repoMatch[1];
    const revision = text.match(new RegExp(`^SCRIPT_COMMIT${suffix}="([^"]+)"`, 'm'))?.[1];
    if (!revision) continue;
    const repo = repoMatch[2];
    const id = `${relative(recipes, path).replace(/[\\/]/g, '-').replace(/\.sh$/, '')}${suffix ? `-${suffix}` : ''}`;
    if (components.some(item => item.repo === repo && item.revision === revision)) continue;
    components.push({ id, recipe: relative(recipes, path).replaceAll('\\', '/'), repo, revision, archiveURL: archiveURL(repo, revision), immutableRevision: /^[0-9a-f]{40}$/.test(revision), enabledFlags: [...text.matchAll(/echo --enable-([a-zA-Z0-9_-]+)/g)].map(match => match[1]), inclusion: 'requires-review', sourceStatus: 'missing', licenses: [] });
  }
}
const sourceDir = join(runtime, 'source', 'dependencies');
const noticesDir = join(runtime, 'licenses', 'dependencies');
await mkdir(sourceDir, { recursive: true }); await mkdir(noticesDir, { recursive: true });
const limitFlag = process.argv.find(value => value.startsWith('--limit='));
const limit = limitFlag ? Number(limitFlag.split('=')[1]) : Infinity;
const matchFlag = process.argv.find(value => value.startsWith('--match='));
const match = matchFlag ? new RegExp(matchFlag.slice('--match='.length)) : null;
let acquired = 0;
for (const component of components) {
  const path = join(sourceDir, `${component.id}-${component.revision.slice(0, 12)}.tar.gz`);
  let present = false; try { await access(path); present = true; } catch { /* missing archive */ }
  if (!present && process.argv.includes('--acquire') && component.archiveURL && component.immutableRevision && acquired < limit && (!match || match.test(component.id))) {
    acquired++;
    try {
      console.log(`Mirroring ${component.id} at ${component.revision}`);
      const response = await fetch(component.archiveURL, { signal: AbortSignal.timeout(120000) });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(path)); present = true;
    } catch (error) { component.sourceStatus = `download-error: ${error.message}`; }
  }
  if (!present) continue;
  try {
    const bytes = await readFile(path);
    component.sha256 = createHash('sha256').update(bytes).digest('hex');
    component.archivePath = relative(runtime, path).replaceAll('\\', '/');
    const listing = execFileSync(tar, ['-tf', path], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 }).split(/\r?\n/);
    const licenses = listing.filter(name => /(?:^|\/)(?:COPYING(?:\.[^/]*)?|LICENSE(?:\.[^/]*)?|NOTICE(?:\.[^/]*)?|COPYRIGHT)$/i.test(name) && !name.includes('..') && !name.startsWith('/') && !name.includes(':'));
    const directory = join(noticesDir, component.id); await mkdir(directory, { recursive: true });
    for (let i = 0; i < licenses.length; i++) {
      const name = licenses[i];
      const text = execFileSync(tar, ['-xOf', path, name], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
      const noticePath = join(directory, `${i}-${basename(name)}`);
      await writeFile(noticePath, text); component.licenses.push({ sourcePath: name, noticePath: relative(runtime, noticePath).replaceAll('\\', '/'), sha256: createHash('sha256').update(text).digest('hex') });
    }
    component.sourceStatus = licenses.length ? 'archive-and-notices-present' : 'archive-present-notice-review-needed';
  } catch (error) { component.sourceStatus = `archive-error: ${error.message}`; }
}
const inventory = { schemaVersion: 1, complete: false, buildCommit: commit, generatedAt: new Date().toISOString(), blockers: ['Review which build recipes and transitive dependencies are actually linked into the distributed runtime.', 'Mirror every required source archive, its patches, generated inputs and license notices. Git snapshots do not automatically contain submodules or vendored Rust crate sources.', 'Resolve mutable tag revisions to the exact revisions used in the compiled build.', 'Audit the final binary against this inventory before clearing the redistribution gate.'], components };
await writeFile(join(runtime, 'redistribution-audit.json'), JSON.stringify(inventory, null, 2));
console.log(`${components.length} candidate components inventoried; ${components.filter(c => c.sourceStatus === 'archive-and-notices-present').length} source/notice archives present. Public redistribution gate remains CLOSED.`);
process.exitCode = process.argv.includes('--inventory-only') ? 0 : 1;
