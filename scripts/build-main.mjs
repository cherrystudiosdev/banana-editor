import { build } from 'esbuild';
await build({ entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['electron', 'sharp'], sourcemap: true });
await build({ entryPoints: ['src/preload/index.ts'], outfile: 'dist/main/preload.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node24', external: ['electron'] });
