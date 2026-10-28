# Testing and evidence

Tests establish behavior only for the code, binaries, platform and commit that
actually ran. A passing renderer build is not an Electron test. A generated
installer is not an installation test. API fixtures are not live model results.
Final execution evidence belongs in [implementation-status.md](implementation-status.md)
and, after publication, release notes for the verified commit.

## Commands

```powershell
pnpm install --frozen-lockfile
pnpm setup:ffmpeg
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test:core` selects core, AI and persistence suites. `pnpm test:media` runs
real FFmpeg tests. Media fixtures and generated outputs are under
`test-artifacts/media/`; they must not be mistaken for shipped user projects.
AI tests run without API keys or external requests. A separate credentialed smoke
test is optional when the user has supplied credentials and must be recorded
separately from mocked contracts.

## Coverage

| Layer | Checks implemented or required |
| --- | --- |
| Core | Split, trim, move, ripple, linked groups, locks, validation, rational time, keyframes, transitions, history, caption parsing |
| Persistence | Atomic save/reopen, relative paths, schema rejection and preservation of original data |
| Media | Generated color/sine fixtures; ffprobe FPS/resolution/duration; decoded pixel/RMS assertions; layers, gaps, text, captions, transitions and sound; cancellation and source/output protection |
| AI | Real OpenAI SDK serialization with mocked HTTP, Gemini SDK boundary contracts, schema/scope/revision/replay rejection, source offsets, translation timing, errors/retry/cancellation and secret exclusion |
| Electron | Startup, import, editing, save/reopen, preview and export through the running desktop app |
| Distribution | Packaged FFmpeg/font paths, install/start/import/export/uninstall on actual Windows |

On 2026-10-28, the AI suite was executed locally: **18 tests passed in 2 files**.
This statement does not stand in for the other suites, CI, installed-app checks or
live AI validation. Use the latest status record for subsequent results.

## Required desktop scenario

1. Open the built Electron app without API keys and create a project.
2. Import two videos, one image and two audio files, including spaces, Turkish
   characters, quotes and symbols in paths.
3. Place media across at least two video and two audio tracks; verify source and
   program monitors serve different roles.
4. Split, trim, move and ripple; check linked behavior, lock enforcement and
   multi-step undo/redo. Check normal Delete preserves gaps.
5. Adjust an effect, add position/scale/opacity/volume keyframes, and add a valid
   dissolve with enough source handles.
6. Add Turkish titles and captions; import/export SRT and WebVTT.
7. Save, close, reopen and verify paths, revision and project content. Exercise
   recovery separately without corrupting the manual file.
8. Render program preview and export. Probe the output and inspect known-frame
   pixels/audio RMS, including black gaps and mute/solo behavior.
9. Cancel a job and exercise corrupt media, missing media, permission/disk failure
   and output overwrite protection. The UI must not report failed work as done.
10. Verify keyboard focus, editable text, translated labels and panel accessibility
    at 1366×768 and 1920×1080.

## Required Windows package scenario

Build unpacked and installer artifacts from the exact tested commit. Run the app
from its packaged directory with bundled runtimes; verify import/export and font
rendering. Install the installer into a path with spaces/Turkish characters,
launch the installed application and repeat the short media flow. Confirm
userData/cache are writable and the uninstall process preserves user projects.
Do not infer Node independence merely because Node is installed on the build host;
inspect runtime resolution and test in a clean Windows environment.

Retain platform version, commit SHA, commands, output probes, screenshots, artifact
names/hashes, installation evidence and signing status. Package/installer tests
must run on actual Windows, not only in a cross-build environment.
