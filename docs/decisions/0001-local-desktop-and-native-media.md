# ADR 0001: Local desktop application and native media processes

Status: accepted for implementation. Date: 2026-10-28.

The user requires offline editing, no mandatory account, real local export and a
self-contained Windows installer. Electron/React/TypeScript provide the desktop
shell and workspace. Native FFmpeg/ffprobe perform media operations in bounded
child processes; ffmpeg.wasm is not the desktop engine.

OS/file/credential/network operations stay in main. Renderer runs sandboxed with
context isolation and a narrow preload contract. The editor core remains a pure
TypeScript command/model layer for UI and AI reuse. Runtime schema validation is
mandatory at project and IPC boundaries.

Consequences: the installer is larger and native dependency licensing/source
provision must be fulfilled. Platform packages require native smoke tests. This
tradeoff avoids mandatory cloud infrastructure or developer tools on end-user PCs.
