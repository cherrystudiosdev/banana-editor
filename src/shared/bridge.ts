import type { Project, MediaAsset } from './model';
import type { AIRequest, AIResult } from './ai';

export type Provider = 'openai' | 'gemini';
export interface Settings {
  language: 'en' | 'tr'; aiEnabled: boolean; provider: Provider;
  models: Record<Provider, string>; transcriptionModel: string;
  keyStatus: Record<Provider, boolean>; secureStorage: boolean;
  recent: string[];
}
export interface ExportOptions {
  format: 'webm' | 'mp4'; width: number; height: number;
  fps: { num: number; den: number }; quality: number; bitrateKbps?: number;
  audioBitrateKbps: number; sampleRate: number; burnCaptions: boolean; fit: 'fit' | 'fill';
}
export interface JobProgress { id: string; kind: 'preview' | 'export' | 'import' | 'ai'; progress?: number; message: string }
export interface ProjectFile { project: Project; path: string | null; missing: string[] }
export interface AppInfo { version: string; packaged: boolean; ffmpeg: boolean; formats: string[]; gpu: string; recovery: ProjectFile | null }
export interface BananaBridge {
  info(): Promise<AppInfo>;
  settings(): Promise<Settings>;
  configure(patch: Partial<Pick<Settings, 'language' | 'aiEnabled' | 'provider' | 'models' | 'transcriptionModel'>>): Promise<Settings>;
  setKey(provider: Provider, key: string): Promise<Settings>;
  deleteKey(provider: Provider): Promise<Settings>;
  testKey(provider: Provider, model: string): Promise<string>;
  openProject(recentPath?: string): Promise<ProjectFile | null>;
  saveProject(project: Project, saveAs?: boolean): Promise<string | null>;
  autosave(project: Project): Promise<void>;
  checkpoint(project: Project, dirty: boolean): Promise<void>;
  discardRecovery(): Promise<void>;
  importMedia(paths?: string[]): Promise<MediaAsset[]>;
  droppedPath(file: File): string;
  relink(assetId: string): Promise<MediaAsset | null>;
  export(project: Project, options: ExportOptions): Promise<string | null>;
  preview(project: Project, quality: number): Promise<string>;
  cancel(id: string): Promise<void>;
  cache(action: 'stats' | 'clear'): Promise<{ bytes: number; files: number }>;
  captions(action: 'import' | 'export', text?: string, format?: 'srt' | 'vtt'): Promise<string | null>;
  ai(request: Omit<AIRequest, 'media'>, media: { images: boolean; audio: boolean }): Promise<AIResult>;
  onProgress(callback: (event: JobProgress) => void): () => void;
  onMenu(callback: (action: string) => void): () => void;
}
declare global { interface Window { banana: BananaBridge } }
