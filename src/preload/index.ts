import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { BananaBridge, JobProgress } from '../shared/bridge';
const api: BananaBridge = {
  info: () => ipcRenderer.invoke('app:info'),
  settings: () => ipcRenderer.invoke('settings:get'),
  configure: patch => ipcRenderer.invoke('settings:set', patch),
  setKey: (provider, key) => ipcRenderer.invoke('key:set', { provider, key }),
  deleteKey: provider => ipcRenderer.invoke('key:delete', provider),
  testKey: (provider, model) => ipcRenderer.invoke('key:test', { provider, model }),
  openProject: recentPath => ipcRenderer.invoke('project:open', recentPath),
  saveProject: (project, saveAs) => ipcRenderer.invoke('project:save', { project, saveAs }),
  autosave: project => ipcRenderer.invoke('project:autosave', project),
  checkpoint: (project, dirty) => ipcRenderer.invoke('project:checkpoint', { project, dirty }),
  discardRecovery: () => ipcRenderer.invoke('project:discardRecovery'),
  importMedia: paths => ipcRenderer.invoke('media:import', paths),
  droppedPath: file => webUtils.getPathForFile(file),
  relink: assetId => ipcRenderer.invoke('media:relink', assetId),
  export: (project, options) => ipcRenderer.invoke('render:export', { project, options }),
  preview: (project, quality) => ipcRenderer.invoke('render:preview', { project, quality }),
  cancel: id => ipcRenderer.invoke('job:cancel', id),
  cache: action => ipcRenderer.invoke('cache', action),
  captions: (action, text, format) => ipcRenderer.invoke('captions', { action, text, format }),
  ai: (request, media) => ipcRenderer.invoke('ai:execute', { request, media }),
  onProgress: callback => { const listener = (_: Electron.IpcRendererEvent, event: JobProgress) => callback(event); ipcRenderer.on('job:progress', listener); return () => ipcRenderer.removeListener('job:progress', listener); },
  onMenu: callback => { const listener = (_: Electron.IpcRendererEvent, action: string) => callback(action); ipcRenderer.on('menu', listener); return () => ipcRenderer.removeListener('menu', listener); },
};
contextBridge.exposeInMainWorld('banana', api);
