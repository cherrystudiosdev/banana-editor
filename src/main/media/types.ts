import type { Rational } from '../../shared/model';

export interface MediaServiceOptions { ffmpegPath: string; ffprobePath: string; cacheDir: string; fontPath?: string; }
export interface ExportOptions {
  outputPath: string; format: 'webm' | 'mp4'; width: number; height: number; fps?: Rational;
  quality?: number; bitrateKbps?: number; audioBitrateKbps?: number; sampleRate?: number;
  burnCaptions?: boolean; fit?: 'fit' | 'fill'; overwrite?: boolean; preview?: boolean;
}
export interface RenderProgress { fraction: number; frame: number; seconds: number; stage: 'preparing' | 'rendering' | 'validating' | 'complete'; }
export interface RenderCallbacks { signal?: AbortSignal; onProgress?: (progress: RenderProgress) => void; }
export interface RenderResult { path: string; duration: number; width: number; height: number; }
export interface MediaCapabilities { encoders: string[]; formats: Array<'webm' | 'mp4'>; hardware: string[]; h264Encoder?: string; version: string; }
