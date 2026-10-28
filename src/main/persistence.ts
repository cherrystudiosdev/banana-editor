import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Project } from '../shared/model';
import { parseProject, validateProject } from '../core/validation';

export async function atomicWrite(file: string, content: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(content); await handle.sync(); await handle.close(); handle = undefined;
    await fs.rename(temporary, file);
  } finally { await handle?.close(); await fs.rm(temporary, { force: true }); }
}

export function portableProject(project: Project, file: string): Project {
  const copy = validateProject(project);
  copy.assets = copy.assets.map(asset => ({ ...asset, path: path.relative(path.dirname(file), asset.path), thumbnail: undefined, proxyPath: undefined, waveform: undefined }));
  return copy;
}
export async function saveProjectFile(file: string, project: Project): Promise<void> {
  await atomicWrite(file, JSON.stringify(portableProject(project, file), null, 2) + '\n');
}
export async function readProjectFile(file: string): Promise<Project> {
  const stat = await fs.stat(file);
  if (stat.size > 32 * 1024 * 1024) throw new Error('Project exceeds 32 MB limit');
  const raw: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
  const project = parseProject(raw);
  project.assets = project.assets.map(asset => ({ ...asset, path: path.resolve(path.dirname(file), asset.path), thumbnail: undefined, proxyPath: undefined }));
  return project;
}
