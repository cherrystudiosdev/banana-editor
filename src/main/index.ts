import { app, BrowserWindow, ipcMain, protocol, net, dialog, Menu, safeStorage, session } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Project, MediaAsset } from '../shared/model';
import { ProjectSchema } from '../shared/model';
import { validateProject } from '../core/validation';
import { atomicWrite, readProjectFile, saveProjectFile } from './persistence';
import { MediaService } from './media/service';
import { AIService } from './ai/service';
import { AITaskSchema, ProviderIdSchema, TranscriptSchema, PROVIDER_DEFAULTS } from '../shared/ai';
import type { Settings, JobProgress, ProjectFile } from '../shared/bridge';

protocol.registerSchemesAsPrivileged([{ scheme: 'banana', privileges: { standard: true, secure: true, supportFetchAPI: true } }, { scheme: 'banana-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
let window: BrowserWindow;
let media: MediaService;
const ai = new AIService();
let projectPath: string | null = null;
let sessionProject: Project | null = null;
let sessionDirty = false;
let closing = false;
let closeDialogOpen = false;
const assets = new Map<string, MediaAsset>();
const mediaURLs = new Map<string, string>();
const jobs = new Map<string, AbortController>();
const keys = new Map<string, string>();
let settings: Settings = { language: 'tr', aiEnabled: false, provider: 'openai', models: { ...PROVIDER_DEFAULTS }, transcriptionModel: 'gpt-transcribe', keyStatus: { openai: false, gemini: false }, secureStorage: false, recent: [] };
const dataFile = (name: string) => path.join(app.getPath('userData'), name);
const resources = () => app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources');
function urlFor(file: string): string { const id = createHash('sha256').update(file).digest('hex'); mediaURLs.set(id, file); return `banana-media://asset/${id}`; }
function exposeAsset(asset: MediaAsset): MediaAsset { assets.set(asset.id, asset); return { ...asset, thumbnail: asset.thumbnail ? urlFor(asset.thumbnail) : undefined, proxyPath: urlFor(asset.proxyPath ?? asset.path) }; }
function trustedProject(value: unknown): Project {
  const p = validateProject(value);
  p.assets = p.assets.map(a => {
    const actual = assets.get(a.id);
    if (!actual || path.resolve(actual.path).toLowerCase() !== path.resolve(a.path).toLowerCase()) throw new Error(`Media must be imported or relinked: ${a.name}`);
    return { ...actual, folder: a.folder, name: a.name };
  }); return validateProject(p);
}
const sendProgress = (event: JobProgress) => { if (!window.isDestroyed()) window.webContents.send('job:progress', event); };
async function job<T>(id: string, kind: JobProgress['kind'], fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (jobs.has(id)) throw new Error('This operation is already running');
  const controller = new AbortController(); jobs.set(id, controller);
  sendProgress({ id, kind, message: 'processing' });
  try { const result = await fn(controller.signal); sendProgress({ id, kind, progress: 1, message: 'finished' }); return result; }
  catch (error) { sendProgress({ id, kind, message: controller.signal.aborted ? 'cancelled' : 'failed' }); throw error; }
  finally { jobs.delete(id); }
}
function handle<T extends z.ZodType>(channel: string, schema: T, fn: (input: z.infer<T>) => unknown): void {
  ipcMain.handle(channel, async (event, payload: unknown) => {
    const sender = event.senderFrame;
    if (event.sender !== window.webContents || !sender || sender !== window.webContents.mainFrame || !(sender.url.startsWith('banana://app/') || (!app.isPackaged && sender.url.startsWith('http://127.0.0.1:5173/')))) throw new Error('Untrusted IPC sender');
    try { return await fn(schema.parse(payload)); }
    catch (error) { const message = error instanceof Error ? error.message : 'Operation failed'; throw new Error(message.replace(/(?:sk-|AIza)[A-Za-z0-9_-]{12,}/g, '[redacted]').slice(0, 3000)); }
  });
}
async function persistSettings(): Promise<void> {
  await atomicWrite(dataFile('settings.json'), JSON.stringify({ ...settings, keyStatus: undefined, secureStorage: undefined }, null, 2));
}
async function openFile(file: string): Promise<ProjectFile> {
  const project = await readProjectFile(file); validateProject(project);
  const missing: string[] = [];
  for (let i = 0; i < project.assets.length; i++) {
    const asset = project.assets[i]!;
    try { const probed = await media.importAsset(asset.path); project.assets[i] = exposeAsset({ ...probed, id: asset.id, name: asset.name, folder: asset.folder }); }
    catch { assets.set(asset.id, asset); missing.push(asset.id); }
  }
  validateProject(project);
  projectPath = file; settings.recent = [file, ...settings.recent.filter(p => p !== file)].slice(0, 12); await persistSettings();
  return { project, path: file, missing };
}
async function recovery(): Promise<ProjectFile | null> {
  try { const file = dataFile('recovery.banana'); const p = await readProjectFile(file); const missing: string[] = [];
    for (let i = 0; i < p.assets.length; i++) { const a = p.assets[i]!; try { const found = await media.importAsset(a.path); p.assets[i] = exposeAsset({ ...found, id: a.id, folder: a.folder }); } catch { assets.set(a.id, a); missing.push(a.id); } }
    return { project: p, path: null, missing };
  } catch { return null; }
}
async function saveSnapshot(p: Project, saveAs = false): Promise<string | null> {
  let file = projectPath;
  if (!file || saveAs) { const result = await dialog.showSaveDialog(window, { defaultPath: `${p.name}.banana`, filters: [{ name: 'Banana project', extensions: ['banana'] }] }); if (result.canceled || !result.filePath) return null; file = result.filePath; }
  if (p.assets.some(a => path.resolve(a.path).toLowerCase() === path.resolve(file!).toLowerCase())) throw new Error('Cannot overwrite source media');
  await saveProjectFile(file, p); projectPath = file; settings.recent = [file, ...settings.recent.filter(f => f !== file)].slice(0, 12); await persistSettings(); await fs.rm(dataFile('recovery.banana'), { force: true });
  if (sessionProject?.revision === p.revision && sessionProject.id === p.id) sessionDirty = false;
  return file;
}
function installIPC(): void {
  const nothing = z.undefined();
  handle('app:info', nothing, async () => { let formats: string[] = []; try { const caps = await media.capabilities(); formats = caps.formats; } catch { /* missing runtime is surfaced in UI */ }
    const gpu = await app.getGPUInfo('basic'); return { version: app.getVersion(), packaged: app.isPackaged, ffmpeg: formats.length > 0, formats, gpu: JSON.stringify(gpu), recovery: await recovery() }; });
  handle('settings:get', nothing, () => settings);
  handle('settings:set', z.object({ language: z.enum(['en', 'tr']).optional(), aiEnabled: z.boolean().optional(), provider: ProviderIdSchema.optional(), models: z.object({ openai: z.string().trim().min(1).max(200), gemini: z.string().trim().min(1).max(200) }).optional(), transcriptionModel: z.string().trim().min(1).max(200).optional() }).strict(), async patch => { settings = { ...settings, ...patch }; await persistSettings(); return settings; });
  handle('key:set', z.object({ provider: ProviderIdSchema, key: z.string().trim().min(8).max(4096) }).strict(), async ({ provider, key }) => { keys.set(provider, key); settings.keyStatus[provider] = true; if (settings.secureStorage) await atomicWrite(dataFile(`credential-${provider}`), safeStorage.encryptString(key)); return settings; });
  handle('key:delete', ProviderIdSchema, async provider => { keys.delete(provider); settings.keyStatus[provider] = false; await fs.rm(dataFile(`credential-${provider}`), { force: true }); return settings; });
  handle('key:test', z.object({ provider: ProviderIdSchema, model: z.string().min(1).max(200) }).strict(), async ({ provider, model }) => { const key = keys.get(provider); if (!key) throw new Error('API key is missing'); await ai.testConnection(provider, model, key); return 'Connection verified'; });
  handle('project:open', z.string().max(32768).optional(), async requested => { let file = requested;
    if (file && !settings.recent.includes(file)) throw new Error('Choose this project using the Open dialog');
    if (!file) { const result = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Banana project', extensions: ['banana'] }] }); if (result.canceled) return null; file = result.filePaths[0]; }
    return file ? openFile(file) : null;
  });
  handle('project:save', z.object({ project: ProjectSchema, saveAs: z.boolean().optional() }).strict(), async ({ project, saveAs }) => {
    return saveSnapshot(trustedProject(project), saveAs);
  });
  handle('project:checkpoint', z.object({ project: ProjectSchema, dirty: z.boolean() }).strict(), ({ project, dirty }) => { sessionProject = trustedProject(project); sessionDirty = dirty; });
  handle('project:autosave', ProjectSchema, async p => { await saveProjectFile(dataFile('recovery.banana'), trustedProject(p)); });
  handle('project:discardRecovery', nothing, async () => { projectPath = null; await fs.rm(dataFile('recovery.banana'), { force: true }); });
  handle('media:import', z.array(z.string().min(1).max(32768)).max(100).optional(), async paths => {
    let files = paths; if (!files) { const result = await dialog.showOpenDialog(window, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Media', extensions: ['mp4', 'mov', 'webm', 'mkv', 'wav', 'mp3', 'png', 'jpg', 'jpeg', 'ogg'] }] }); if (result.canceled) return []; files = result.filePaths; }
    return job('import', 'import', async signal => { const imported: MediaAsset[] = []; for (let i = 0; i < files.length; i++) { const file = files[i]!; if (!path.isAbsolute(file) || !/\.(mp4|mov|webm|mkv|wav|mp3|png|jpe?g|ogg)$/i.test(file)) throw new Error('Unsupported media path'); imported.push(exposeAsset(await media.importAsset(file, signal))); sendProgress({ id: 'import', kind: 'import', progress: (i + 1) / files.length, message: path.basename(file) }); } return imported; });
  });
  handle('media:relink', z.string().min(1).max(128), async id => { const old = assets.get(id); if (!old) throw new Error('Unknown media'); const result = await dialog.showOpenDialog(window, { properties: ['openFile'] }); if (result.canceled || !result.filePaths[0]) return null; return exposeAsset({ ...await media.importAsset(result.filePaths[0]), id, folder: old.folder }); });
  const optionsSchema = z.object({ format: z.enum(['webm', 'mp4']), width: z.number().int().min(16).max(8192).multipleOf(2), height: z.number().int().min(16).max(8192).multipleOf(2), fps: z.object({ num: z.number().int().positive().max(240000), den: z.number().int().positive().max(100000) }), quality: z.number().int().min(0).max(63), bitrateKbps: z.number().positive().max(200000).optional(), audioBitrateKbps: z.number().int().min(32).max(512), sampleRate: z.number().int().min(8000).max(96000), burnCaptions: z.boolean(), fit: z.enum(['fit', 'fill']) }).strict();
  handle('render:export', z.object({ project: ProjectSchema, options: optionsSchema }).strict(), async ({ project, options }) => {
    const p = trustedProject(project); const result = await dialog.showSaveDialog(window, { defaultPath: `${p.name}.${options.format}`, filters: [{ name: options.format.toUpperCase(), extensions: [options.format] }] }); if (result.canceled || !result.filePath) return null;
    return job('export', 'export', async signal => { const output = await media.render(p, { ...options, outputPath: result.filePath!, overwrite: true }, { signal, onProgress: progress => sendProgress({ id: 'export', kind: 'export', progress: progress.fraction, message: 'encoding' }) }); return output.path; });
  });
  handle('render:preview', z.object({ project: ProjectSchema, quality: z.number().int().min(240).max(1080) }).strict(), async ({ project, quality }) => {
    const p = trustedProject(project); const hash = createHash('sha256').update(JSON.stringify(p)).update(String(quality)).digest('hex'); const outputPath = path.join(app.getPath('userData'), 'cache', `preview-${hash}.webm`);
    try { await fs.access(outputPath); return urlFor(outputPath); } catch { /* generate cache */ }
    return job('preview', 'preview', async signal => { const height = Math.round(quality / 2) * 2; const width = Math.max(16, Math.round(height * p.sequence.width / p.sequence.height / 2) * 2);
      const result = await media.render(p, { outputPath, format: 'webm', width, height, preview: true, quality: 36, burnCaptions: true, overwrite: true }, { signal, onProgress: progress => sendProgress({ id: 'preview', kind: 'preview', progress: progress.fraction, message: 'rendering' }) }); return urlFor(result.path); });
  });
  handle('job:cancel', z.enum(['preview', 'export', 'import', 'ai']), id => { jobs.get(id)?.abort(); });
  handle('cache', z.enum(['stats', 'clear']), async action => { if (action === 'clear') { if (jobs.size) throw new Error('Wait for active jobs before clearing cache'); await media.clearCache(); } return media.cacheStats(); });
  handle('captions', z.object({ action: z.enum(['import', 'export']), text: z.string().max(5000000).optional(), format: z.enum(['srt', 'vtt']).optional() }).strict(), async ({ action, text, format }) => {
    if (action === 'import') { const r = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Captions', extensions: ['srt', 'vtt'] }] }); if (r.canceled || !r.filePaths[0]) return null; const s = await fs.stat(r.filePaths[0]); if (s.size > 5000000) throw new Error('Caption file exceeds 5 MB'); return fs.readFile(r.filePaths[0], 'utf8'); }
    const r = await dialog.showSaveDialog(window, { defaultPath: `captions.${format ?? 'srt'}`, filters: [{ name: 'Captions', extensions: [format ?? 'srt'] }] }); if (r.canceled || !r.filePath) return null; if ([...assets.values()].some(a => path.resolve(a.path).toLowerCase() === path.resolve(r.filePath!).toLowerCase())) throw new Error('Cannot overwrite source media'); await atomicWrite(r.filePath, text ?? ''); return r.filePath;
  });
  const requestSchema = z.object({ provider: ProviderIdSchema, model: z.string().min(1).max(200), task: AITaskSchema, prompt: z.string().max(20000), project: ProjectSchema, selectedClipIds: z.array(z.string().max(128)).max(100), transcript: TranscriptSchema.optional(), language: z.string().max(100).optional() }).strict();
  handle('ai:execute', z.object({ request: requestSchema, media: z.object({ images: z.boolean(), audio: z.boolean() }).strict() }).strict(), async ({ request, media: scope }) => {
    if (!settings.aiEnabled) throw new Error('Enable Banana AI in Settings'); const key = keys.get(request.provider); if (!key) throw new Error('API key is missing');
    return job('ai', 'ai', async signal => { const p = trustedProject(request.project); const prepared = (scope.images || scope.audio) ? await media.prepareAI(p, request.selectedClipIds, { includeImages: scope.images, includeAudio: scope.audio }, signal) : [];
      return ai.execute({ ...request, project: p, media: prepared }, key, signal); });
  });
}
app.whenReady().then(async () => {
  await fs.mkdir(dataFile('cache'), { recursive: true });
  try { const saved = JSON.parse(await fs.readFile(dataFile('settings.json'), 'utf8')) as Partial<Settings>; settings = { ...settings, ...saved, keyStatus: { openai: false, gemini: false }, secureStorage: safeStorage.isEncryptionAvailable() }; } catch { settings.secureStorage = safeStorage.isEncryptionAvailable(); }
  if (settings.secureStorage) for (const provider of ['openai', 'gemini'] as const) { try { keys.set(provider, safeStorage.decryptString(await fs.readFile(dataFile(`credential-${provider}`)))); settings.keyStatus[provider] = true; } catch { /* no persisted key */ } }
  media = new MediaService({ ffmpegPath: path.join(resources(), 'ffmpeg', 'bin', 'ffmpeg.exe'), ffprobePath: path.join(resources(), 'ffmpeg', 'bin', 'ffprobe.exe'), cacheDir: dataFile('cache'), fontPath: path.join(resources(), 'fonts', 'NotoSans-Regular.ttf') });
  protocol.handle('banana', request => { const url = new URL(request.url); if (url.hostname !== 'app') return new Response('', { status: 403 }); const root = path.join(app.getAppPath(), 'dist', 'renderer'); const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); if (!file.startsWith(root + path.sep)) return new Response('', { status: 403 }); return net.fetch(pathToFileURL(file).href); });
  protocol.handle('banana-media', request => { const url = new URL(request.url); const file = mediaURLs.get(url.pathname.slice(1)); if (url.hostname !== 'asset' || !file) return new Response('', { status: 404 }); return net.fetch(pathToFileURL(file).href, { headers: request.headers }); });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({ width: 1600, height: 960, minWidth: 1100, minHeight: 700, backgroundColor: '#131416', title: 'Banana Editor', icon: path.join(resources(), 'icon.ico'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('close', event => {
    if (closing || !sessionDirty || !sessionProject) return;
    event.preventDefault(); if (closeDialogOpen) return; closeDialogOpen = true;
    const tr = settings.language === 'tr';
    void dialog.showMessageBox(window, { type: 'question', title: 'Banana Editor', message: tr ? 'Projeyi kapatmadan önce değişiklikleri kaydet?' : 'Save changes before closing this project?', buttons: tr ? ['Kaydet', 'Kaydetmeden kapat', 'İptal'] : ['Save', 'Close without saving', 'Cancel'], defaultId: 0, cancelId: 2 }).then(async result => {
      if (result.response === 2) return;
      if (result.response === 0 && sessionProject && !await saveSnapshot(sessionProject)) return;
      if (result.response === 1) await fs.rm(dataFile('recovery.banana'), { force: true });
      closing = true; window.close();
    }).catch(error => dialog.showErrorBox(tr ? 'Kayıt başarısız' : 'Save failed', error instanceof Error ? error.message : 'Save failed')).finally(() => { closeDialogOpen = false; });
  });
  const menu: Electron.MenuItemConstructorOptions[] = [
    { label: 'File', submenu: [{ label: 'New project', accelerator: 'CmdOrCtrl+N', click: () => window.webContents.send('menu', 'new') }, { label: 'Open project', accelerator: 'CmdOrCtrl+O', click: () => window.webContents.send('menu', 'open') }, { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => window.webContents.send('menu', 'save') }, { label: 'Save as', click: () => window.webContents.send('menu', 'saveAs') }, { label: 'Import media', accelerator: 'CmdOrCtrl+I', click: () => window.webContents.send('menu', 'import') }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => window.webContents.send('menu', 'undo') }, { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => window.webContents.send('menu', 'redo') }, { type: 'separator' }, { role: 'copy' }, { role: 'paste' }, { label: 'Settings', click: () => window.webContents.send('menu', 'settings') }] },
    { label: 'View', submenu: [{ label: 'Reset workspace', click: () => window.webContents.send('menu', 'resetLayout') }, { role: 'togglefullscreen' }] },
    { label: 'Sequence', submenu: [{ label: 'Sequence settings', click: () => window.webContents.send('menu', 'sequence') }, { label: 'Add video track', click: () => window.webContents.send('menu', 'addVideoTrack') }, { label: 'Add audio track', click: () => window.webContents.send('menu', 'addAudioTrack') }] },
    { label: 'Tools', submenu: [{ label: 'Export', click: () => window.webContents.send('menu', 'export') }, { label: 'Banana AI', click: () => window.webContents.send('menu', 'ai') }, { label: 'Cache', click: () => window.webContents.send('menu', 'cache') }] },
    { label: 'Help', submenu: [{ label: 'Keyboard shortcuts', click: () => window.webContents.send('menu', 'help') }, { label: 'About Banana Editor', click: () => window.webContents.send('menu', 'about') }] },
  ]; Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  installIPC();
  await window.loadURL(!app.isPackaged && process.env.BANANA_DEV_URL === 'http://127.0.0.1:5173' ? process.env.BANANA_DEV_URL : 'banana://app/index.html');
}).catch(error => { dialog.showErrorBox('Banana Editor', error instanceof Error ? error.message : 'Startup failed'); app.quit(); });
app.on('window-all-closed', () => { for (const controller of jobs.values()) controller.abort(); app.quit(); });
