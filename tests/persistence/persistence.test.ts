import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { atomicWrite, portableProject, readProjectFile, saveProjectFile } from '../../src/main/persistence';
import { createClip, createProject, type Project } from '../../src/shared/model';

const directories: string[] = [];
async function temporaryDirectory(): Promise<string> { const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'banana kayıt & test ')); directories.push(directory); return directory; }
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))); });

function projectWithMedia(directory: string): Project {
  const project = createProject('Özgür İstanbul');
  project.assets.push({ id: 'asset', name: 'Türkçe & media', path: path.join(directory, 'media', 'özgür 1 & video.mp4'), kind: 'video', duration: 10, width: 320, height: 180, hasAudio: false, thumbnail: path.join(directory, 'thumb.png'), proxyPath: path.join(directory, 'proxy.webm'), waveform: [0.1, 0.3] });
  project.sequence.tracks[0]!.clips.push(createClip('video', 'Kaynak', { assetId: 'asset', duration: 60 }));
  return project;
}

describe('atomic persistence', () => {
  it('round-trips unusual Unicode paths and stores media paths relative to the project', async () => {
    const directory = await temporaryDirectory(); const file = path.join(directory, 'projects', 'İlk & proje.banana'); const project = projectWithMedia(directory);
    await saveProjectFile(file, project);
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as Project;
    expect(path.isAbsolute(raw.assets[0]!.path)).toBe(false);
    expect(raw.assets[0]!.thumbnail).toBeUndefined(); expect(raw.assets[0]!.proxyPath).toBeUndefined(); expect(raw.assets[0]!.waveform).toBeUndefined();
    const loaded = await readProjectFile(file); expect(loaded.assets[0]!.path).toBe(project.assets[0]!.path); expect(loaded.name).toBe(project.name);
    expect(project.assets[0]!.thumbnail).toBeDefined();
  });
  it('replaces complete saves atomically and leaves no temporary files', async () => {
    const directory = await temporaryDirectory(); const file = path.join(directory, 'project.banana');
    await atomicWrite(file, 'first'); await atomicWrite(file, 'second');
    expect(await fs.readFile(file, 'utf8')).toBe('second'); expect(await fs.readdir(directory)).toEqual(['project.banana']);
  });
  it('preserves an existing destination directory and cleans a failed rename temporary file', async () => {
    const directory = await temporaryDirectory(); const target = path.join(directory, 'existing'); await fs.mkdir(target); await fs.writeFile(path.join(target, 'user.txt'), 'Keep me');
    await expect(atomicWrite(target, 'replacement')).rejects.toThrow();
    expect(await fs.readFile(path.join(target, 'user.txt'), 'utf8')).toBe('Keep me'); expect(await fs.readdir(directory)).toEqual(['existing']);
  });
  it('autosave at a separate path cannot replace the manual save', async () => {
    const directory = await temporaryDirectory(); const manual = path.join(directory, 'manual.banana'); const recovery = path.join(directory, 'recovery', 'autosave.banana');
    const project = createProject('Manual'); await saveProjectFile(manual, project); await saveProjectFile(recovery, { ...project, name: 'Unsaved edits', revision: 1 });
    expect((await readProjectFile(manual)).name).toBe('Manual'); expect((await readProjectFile(recovery)).name).toBe('Unsaved edits');
  });
  it('does not write credentials or unknown project fields', async () => {
    const directory = await temporaryDirectory(); const file = path.join(directory, 'project.banana');
    await expect(saveProjectFile(file, { ...createProject(), apiKey: 'not-a-real-secret' } as Project)).rejects.toThrow();
    await expect(fs.access(file)).rejects.toThrow();
  });
  it('rejects malformed, oversized and future project formats without changing them', async () => {
    const directory = await temporaryDirectory(); const file = path.join(directory, 'bad.banana');
    const original = JSON.stringify({ ...createProject(), schemaVersion: 99 }); await fs.writeFile(file, original);
    await expect(readProjectFile(file)).rejects.toThrow(); expect(await fs.readFile(file, 'utf8')).toBe(original);
    await fs.writeFile(file, '{ invalid'); await expect(readProjectFile(file)).rejects.toThrow();
    const handle = await fs.open(file, 'w'); await handle.truncate(32 * 1024 * 1024 + 1); await handle.close(); await expect(readProjectFile(file)).rejects.toThrow('32 MB');
  });
  it('rejects semantically invalid saved projects before overwriting a healthy save', async () => {
    const directory = await temporaryDirectory(); const file = path.join(directory, 'project.banana'); const project = projectWithMedia(directory);
    await saveProjectFile(file, project); const original = await fs.readFile(file, 'utf8');
    project.sequence.tracks[0]!.clips[0]!.sourceIn = 9;
    await expect(saveProjectFile(file, project)).rejects.toThrow('source duration');
    expect(await fs.readFile(file, 'utf8')).toBe(original);
  });
  it('rejects missing references and invalid source ranges when opening untrusted files', async () => {
    const directory = await temporaryDirectory(); const file = path.join(directory, 'bad.banana'); const project = projectWithMedia(directory);
    project.assets = []; await fs.writeFile(file, JSON.stringify(project)); await expect(readProjectFile(file)).rejects.toThrow('Missing media');
  });
  it('portable conversion returns an independent copy', async () => {
    const directory = await temporaryDirectory(); const project = projectWithMedia(directory); const serialized = portableProject(project, path.join(directory, 'a.banana'));
    serialized.sequence.name = 'Changed'; expect(project.sequence.name).not.toBe('Changed');
  });
});
